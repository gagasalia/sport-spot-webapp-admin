import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { ArticlesComponent } from './articles.component';
import { TPipe } from '../../shared/i18n/t.pipe';
import { ArticleService } from '../../services/http-services/article.service';
import { Article, ArticleListQuery } from '../../shared/models/article.model';
import { SsToastService } from '../../shared/ui/toast.service';
import { SsDialogService } from '../../shared/ui/dialog.service';

const base: Omit<Article, '_id' | 'title' | 'slug' | 'status'> = {
  bodyHtml: '<p>x</p>',
  category: 'tips',
  tags: [],
  faq: [],
  relatedFacilities: [],
  wordCount: 950,
  readingMinutes: 5,
  author: 'Sport Space რედაქცია',
  updatedAt: '2026-09-20T08:00:00.000Z',
};

const draft: Article = {
  ...base,
  _id: 'a-1',
  title: 'პადელის წესები',
  titleEn: 'Padel rules',
  slug: 'padelis-tsesebi',
  status: 'draft',
};

const scheduled: Article = {
  ...base,
  _id: 'a-2',
  title: 'ტურნირი ვაკეში',
  slug: 'turniri-vakeshi',
  category: 'news',
  status: 'scheduled',
  publishAt: '2026-10-01T06:00:00.000Z',
};

const published: Article = {
  ...base,
  _id: 'a-3',
  title: 'სად ვითამაშოთ',
  slug: 'sad-vitamashot',
  category: 'places',
  status: 'published',
  publishedAt: '2026-09-01T06:00:00.000Z',
};

const archived: Article = {
  ...base,
  _id: 'a-4',
  title: 'ძველი',
  slug: 'dzveli',
  status: 'archived',
  readingMinutes: 0,
};

describe('ArticlesComponent', () => {
  let component: ArticlesComponent;
  let fixture: ComponentFixture<ArticlesComponent>;
  let articleSpy: jasmine.SpyObj<ArticleService>;
  let routerSpy: jasmine.SpyObj<Router>;
  let dialogSpy: jasmine.SpyObj<SsDialogService>;
  let alertSpy: jasmine.SpyObj<SsToastService>;

  const lastQuery = (): ArticleListQuery => articleSpy.getArticles.calls.mostRecent().args[0];
  const rows = (): HTMLElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('[data-testid="article-row"]'));
  const buttonsIn = (row: HTMLElement): string[] =>
    Array.from(row.querySelectorAll('[data-testid^="quick-"]')).map(
      (b) => (b as HTMLElement).dataset['testid'] as string,
    );

  beforeEach(async () => {
    articleSpy = jasmine.createSpyObj<ArticleService>('ArticleService', [
      'getArticles',
      'setStatus',
      'deleteArticle',
    ]);
    articleSpy.getArticles.and.returnValue(
      of({
        data: [draft, scheduled, published, archived],
        page: { page: 1, size: 20, total: 41 },
      }),
    );
    articleSpy.setStatus.and.returnValue(of({ ...draft, status: 'published' }));
    articleSpy.deleteArticle.and.returnValue(of(undefined));

    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);
    routerSpy.navigate.and.resolveTo(true);
    dialogSpy = jasmine.createSpyObj<SsDialogService>('SsDialogService', ['open']);
    dialogSpy.open.and.returnValue(of(true));
    alertSpy = jasmine.createSpyObj<SsToastService>('SsToastService', ['open']);
    alertSpy.open.and.returnValue(of(undefined));

    await TestBed.configureTestingModule({
      imports: [ArticlesComponent],
      providers: [
        { provide: ArticleService, useValue: articleSpy },
        { provide: Router, useValue: routerSpy },
        { provide: SsDialogService, useValue: dialogSpy },
        { provide: SsToastService, useValue: alertSpy },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(ArticlesComponent, {
        // set:{imports} REPLACES the array — TPipe (and the date pipe) must ride
        // along or the template fails with NG0302.
        set: { imports: [DatePipe, TPipe], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ArticlesComponent);
    component = fixture.componentInstance;
    component['isMobile'].set(false);
    fixture.detectChanges();
  });

  it('loads page 1 without filters on init', () => {
    expect(articleSpy.getArticles).toHaveBeenCalledTimes(1);
    expect(lastQuery()).toEqual({
      page: 1,
      limit: 20,
      q: undefined,
      status: undefined,
      category: undefined,
    });
    expect(component['total']()).toBe(41);
    expect(component['totalPages']()).toBe(3);
  });

  it('renders one row per article: title, English title, category, reading minutes', () => {
    expect(rows().length).toBe(4);
    const first = rows()[0].textContent as string;
    expect(first).toContain('პადელის წესები');
    expect(first).toContain('Padel rules');
    expect(first).toContain('რჩევები');
    expect(first).toContain('5 წთ');
    expect(rows()[2].textContent).toContain('ადგილები');
    expect(rows()[3].textContent).toContain('—');
  });

  it('colours the status badges and dates scheduled / published rows', () => {
    const badges: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('[data-testid="article-status"]'),
    );
    expect(badges.map((b) => b.textContent!.trim())).toEqual([
      'დრაფტი',
      'დაგეგმილი',
      'გამოქვეყნებული',
      'არქივში',
    ]);
    expect(badges[0].className).toContain('ss-badge--neutral');
    expect(badges[1].className).toContain('ss-badge--warning');
    expect(badges[2].className).toContain('ss-badge--positive');
    expect(badges[3].className).toContain('ss-badge--muted');

    // scheduled → its go-live instant, published → its live-since instant
    expect(rows()[1].querySelector('[data-testid="article-status-date"]')).not.toBeNull();
    expect(rows()[2].querySelector('[data-testid="article-status-date"]')).not.toBeNull();
    expect(rows()[0].querySelector('[data-testid="article-status-date"]')).toBeNull();
    expect(component['statusDate'](scheduled)).toBe('2026-10-01T06:00:00.000Z');
    expect(component['statusDate'](published)).toBe('2026-09-01T06:00:00.000Z');
  });

  it('debounces the search box and reloads with q on page 1', fakeAsync(() => {
    component['page'].set(3);
    component['onSearchChange']('  წესები ');
    expect(articleSpy.getArticles).toHaveBeenCalledTimes(1); // not yet

    tick(400);
    expect(articleSpy.getArticles).toHaveBeenCalledTimes(2);
    expect(lastQuery().q).toBe('წესები');
    expect(lastQuery().page).toBe(1);
  }));

  it('status and category filters push their params and restart at page 1', () => {
    component['page'].set(2);
    component['onStatusFilterChange']('scheduled');
    expect(lastQuery()).toEqual(jasmine.objectContaining({ status: 'scheduled', page: 1 }));

    component['onCategoryFilterChange']('news');
    expect(lastQuery()).toEqual(
      jasmine.objectContaining({ status: 'scheduled', category: 'news', page: 1 }),
    );

    // '' is "any" — it drops the param again.
    component['onStatusFilterChange']('');
    expect(lastQuery().status).toBeUndefined();
    expect(lastQuery().category).toBe('news');
  });

  it('paging keeps the current filters', () => {
    component['onCategoryFilterChange']('places');
    component['onPageChange'](2);
    expect(lastQuery()).toEqual(jasmine.objectContaining({ page: 2, category: 'places' }));
  });

  it('offers only the quick moves the status machine allows', () => {
    expect(buttonsIn(rows()[0])).toEqual(['quick-published', 'quick-scheduled', 'quick-ready']); // draft
    expect(buttonsIn(rows()[1])).toEqual(['quick-published', 'quick-ready']); // scheduled

    // «დაგეგმვა» from the list: the schedule dialog's instant goes on the PATCH
    dialogSpy.open.and.returnValue(of('2026-10-01T06:00:00.000Z'));
    articleSpy.setStatus.and.returnValue(of({ ...draft, status: 'scheduled' }));
    (rows()[0].querySelector('[data-testid="quick-scheduled"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(articleSpy.setStatus).toHaveBeenCalledWith(
      draft._id,
      'scheduled',
      '2026-10-01T06:00:00.000Z',
    );
    expect(buttonsIn(rows()[2])).toEqual(['quick-archived']); // published
    expect(buttonsIn(rows()[3])).toEqual(['quick-ready']); // archived
  });

  it('"publish now" confirms, PATCHes the status endpoint and swaps the row in', () => {
    const button = rows()[0].querySelector('[data-testid="quick-published"]') as HTMLElement;
    button.click();

    expect(dialogSpy.open).toHaveBeenCalledTimes(1);
    expect(articleSpy.setStatus).toHaveBeenCalledOnceWith('a-1', 'published');
    expect(component['rows']()[0].status).toBe('published');
    expect(alertSpy.open).toHaveBeenCalledWith(
      'გამოქვეყნდა',
      jasmine.objectContaining({ appearance: 'success' }),
    );
    // the click acted in place — it did not open the editor
    expect(routerSpy.navigate).not.toHaveBeenCalled();
  });

  it('"mark ready" and "archive" call the status endpoint with their target', () => {
    articleSpy.setStatus.and.returnValue(of({ ...scheduled, status: 'ready' }));
    component['runQuickAction'](scheduled, 'ready');
    expect(articleSpy.setStatus).toHaveBeenCalledWith('a-2', 'ready');

    articleSpy.setStatus.and.returnValue(of({ ...published, status: 'archived' }));
    component['runQuickAction'](published, 'archived');
    expect(articleSpy.setStatus).toHaveBeenCalledWith('a-3', 'archived');
    expect(component['rows']()[2].status).toBe('archived');
  });

  it('a declined confirmation changes nothing', () => {
    dialogSpy.open.and.returnValue(of(false));
    component['runQuickAction'](draft, 'published');
    expect(articleSpy.setStatus).not.toHaveBeenCalled();
  });

  it('never fires a move the status machine forbids', () => {
    component['runQuickAction'](published, 'ready');
    expect(dialogSpy.open).not.toHaveBeenCalled();
    expect(articleSpy.setStatus).not.toHaveBeenCalled();
  });

  it('a rejected move (400) keeps the row and toasts', () => {
    articleSpy.setStatus.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 400 })),
    );
    component['runQuickAction'](draft, 'published');

    expect(component['rows']()[0].status).toBe('draft');
    expect(component['busyIds']().size).toBe(0);
    expect(alertSpy.open).toHaveBeenCalledWith(
      'სტატუსის შეცვლა ვერ მოხერხდა, სცადეთ თავიდან',
      jasmine.objectContaining({ appearance: 'error' }),
    );
  });

  it('a row click opens the editor, but a click on a row control does not', () => {
    rows()[0].click();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/articles', 'a-1']);

    routerSpy.navigate.calls.reset();
    (rows()[0].querySelector('[data-testid="article-delete"]') as HTMLElement).click();
    expect(routerSpy.navigate).not.toHaveBeenCalled();
  });

  it('"new article" goes to the create page', () => {
    component['addArticle']();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/articles/new']);
  });

  it('delete: confirm → DELETE → reload + toast', () => {
    articleSpy.getArticles.calls.reset();

    component['deleteArticle'](draft);

    expect(dialogSpy.open).toHaveBeenCalled();
    expect(articleSpy.deleteArticle).toHaveBeenCalledWith('a-1');
    expect(articleSpy.getArticles).toHaveBeenCalledTimes(1);
    expect(alertSpy.open).toHaveBeenCalledWith(
      'წაიშალა',
      jasmine.objectContaining({ appearance: 'success' }),
    );
  });

  it('delete does nothing when the confirm is declined', () => {
    dialogSpy.open.and.returnValue(of(false));
    component['deleteArticle'](draft);
    expect(articleSpy.deleteArticle).not.toHaveBeenCalled();
  });

  it('surfaces the error state when the list fetch fails', () => {
    articleSpy.getArticles.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );
    component['retry']();
    expect(component['hasError']()).toBeTrue();
  });
});
