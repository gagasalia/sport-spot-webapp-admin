import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';

import { ArticleEditComponent } from './article-edit.component';
import { RichTextEditorComponent } from '../rich-text-editor/rich-text-editor.component';
import { ArticleScheduleDialogComponent } from '../article-schedule-dialog/article-schedule-dialog.component';
import { TPipe } from '../../../shared/i18n/t.pipe';
import { ArticleService } from '../../../services/http-services/article.service';
import { AcademyService } from '../../../services/http-services/academy.service';
import { FacilityService } from '../../../services/http-services/facility.service';
import { MediaService } from '../../../services/http-services/media.service';
import {
  Article,
  ArticleStatus,
  CreateArticleDto,
  UpdateArticleDto,
} from '../../../shared/models/article.model';
import { Facility } from '../../../shared/models/facility.model';
import { SsToastService } from '../../../shared/ui/toast.service';
import { SsDialogService } from '../../../shared/ui/dialog.service';
import { SsConfirmComponent } from '../../../shared/ui/confirm.component';
import { environment } from '../../../../environments/environment';

const BODY = '<h2>წესები</h2><p>პადელი არის <strong>სწრაფი</strong> თამაში.</p>';

const existing: Article = {
  _id: 'a-1',
  title: 'პადელის წესები',
  titleEn: 'Padel rules',
  // hand-made (≠ the slug derived from the title) — it must never be re-derived
  slug: 'padel-rules-guide',
  excerpt: 'მოკლედ',
  bodyHtml: BODY,
  bodyHtmlEn: '<p>Padel is fast.</p>',
  cover: {
    url: 'https://cdn.example/cover-web.webp',
    thumbUrl: 'https://cdn.example/cover-thumb.webp',
    key: 'article-cover/c-web.webp',
    thumbKey: 'article-cover/c-thumb.webp',
    type: 'image/webp',
  },
  category: 'tips',
  tags: ['წესები', 'დამწყებები'],
  faq: [{ q: 'რა არის პადელი?', a: 'ჩოგბურთის ნათესავი.', qEn: 'What is padel?' }],
  status: 'draft',
  seoTitle: 'პადელის წესები დამწყებთათვის',
  relatedFacilities: ['f-1'],
  wordCount: 6,
  readingMinutes: 1,
  author: 'Sport Space რედაქცია',
  updatedAt: '2026-09-20T08:00:00.000Z',
};

describe('ArticleEditComponent', () => {
  let component: ArticleEditComponent;
  let fixture: ComponentFixture<ArticleEditComponent>;
  let articleSpy: jasmine.SpyObj<ArticleService>;
  let mediaSpy: jasmine.SpyObj<MediaService>;
  let routerSpy: jasmine.SpyObj<Router>;
  let dialogSpy: jasmine.SpyObj<SsDialogService>;
  let alertSpy: jasmine.SpyObj<SsToastService>;

  async function setup(id?: string, loaded: Article = existing) {
    articleSpy = jasmine.createSpyObj<ArticleService>('ArticleService', [
      'getArticle',
      'createArticle',
      'updateArticle',
      'setStatus',
    ]);
    articleSpy.getArticle.and.returnValue(of(loaded));
    articleSpy.createArticle.and.callFake((dto) =>
      of({ ...existing, ...dto, _id: 'a-new', status: 'draft' } as Article),
    );
    articleSpy.updateArticle.and.callFake((articleId) => of({ ...loaded, _id: articleId }));
    articleSpy.setStatus.and.callFake((articleId, status, publishAt) =>
      of({ ...loaded, _id: articleId, status, publishAt: publishAt ?? null }),
    );

    const academySpy = jasmine.createSpyObj<AcademyService>('AcademyService', [
      'getAllAcademies',
    ]);
    academySpy.getAllAcademies.and.returnValue(of([{ _id: 'aca-1', name: 'A1' } as never]));
    const facilitySpy = jasmine.createSpyObj<FacilityService>('FacilityService', [
      'getFacilitiesByAcademy',
    ]);
    facilitySpy.getFacilitiesByAcademy.and.returnValue(
      of(
        ['f-1', 'f-2', 'f-3', 'f-4', 'f-5', 'f-6', 'f-7'].map(
          (fid, i) => ({ _id: fid, name: `ობიექტი ${i + 1}` }) as Facility,
        ),
      ),
    );

    mediaSpy = jasmine.createSpyObj<MediaService>('MediaService', ['uploadImage']);
    mediaSpy.uploadImage.and.returnValue(
      of({
        url: 'https://cdn.example/new-web.webp',
        thumbUrl: 'https://cdn.example/new-thumb.webp',
        key: 'article-cover/new-web.webp',
        thumbKey: 'article-cover/new-thumb.webp',
        type: 'image/webp',
        size: 1234,
      }),
    );

    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);
    routerSpy.navigate.and.resolveTo(true);
    dialogSpy = jasmine.createSpyObj<SsDialogService>('SsDialogService', ['open']);
    dialogSpy.open.and.returnValue(of(true));
    alertSpy = jasmine.createSpyObj<SsToastService>('SsToastService', ['open']);
    alertSpy.open.and.returnValue(of(undefined));

    await TestBed.configureTestingModule({
      imports: [ArticleEditComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap(id ? { id } : {})) },
        },
        { provide: ArticleService, useValue: articleSpy },
        { provide: AcademyService, useValue: academySpy },
        { provide: FacilityService, useValue: facilitySpy },
        { provide: MediaService, useValue: mediaSpy },
        { provide: Router, useValue: routerSpy },
        { provide: SsDialogService, useValue: dialogSpy },
        { provide: SsToastService, useValue: alertSpy },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(ArticleEditComponent, {
        // set:{imports} REPLACES the array — TPipe (plus the date pipe, the
        // panel outlet and the body editor's value accessor) must ride along.
        set: {
          imports: [
            ReactiveFormsModule,
            DatePipe,
            NgTemplateOutlet,
            TPipe,
            RichTextEditorComponent,
          ],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ArticleEditComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  const form = () => component.form;
  const el = (): HTMLElement => fixture.nativeElement;
  const q = (testid: string): HTMLElement | null =>
    el().querySelector(`[data-testid="${testid}"]`);
  const createBody = (): CreateArticleDto => articleSpy.createArticle.calls.mostRecent().args[0];
  const updateBody = (): UpdateArticleDto => articleSpy.updateArticle.calls.mostRecent().args[1];
  const actionIds = (): string[] => {
    fixture.detectChanges();
    return Array.from(el().querySelectorAll('[data-testid^="action-"]')).map(
      (b) => (b as HTMLElement).dataset['testid'] as string,
    );
  };
  const fillValid = () =>
    form().patchValue({ title: 'პადელის წესები', bodyHtml: '<p>პადელი სწრაფი თამაშია.</p>' });

  describe('create mode (/articles/new)', () => {
    beforeEach(async () => setup());

    it('starts as an invalid draft until the KA title and body are filled', () => {
      expect(component['isEditMode']).toBeFalse();
      expect(articleSpy.getArticle).not.toHaveBeenCalled();
      expect(form().controls.title.hasError('required')).toBeTrue();
      expect(form().controls.bodyHtml.hasError('required')).toBeTrue();

      // whitespace and empty markup do not count
      form().patchValue({ title: '   ', bodyHtml: '<p><br></p>' });
      expect(form().invalid).toBeTrue();

      fillValid();
      expect(form().valid).toBeTrue();
      expect(q('editor-status')!.textContent!.trim()).toBe('დრაფტი');
    });

    it('mirrors the API caps: title 160, excerpt 300, SEO title 70, SEO description 170', () => {
      fillValid();
      form().controls.title.setValue('x'.repeat(161));
      expect(form().controls.title.hasError('maxlength')).toBeTrue();
      form().controls.excerptEn.setValue('x'.repeat(301));
      expect(form().controls.excerptEn.hasError('maxlength')).toBeTrue();
      form().controls.seoTitle.setValue('x'.repeat(71));
      expect(form().controls.seoTitle.hasError('maxlength')).toBeTrue();
      form().controls.seoDescriptionEn.setValue('x'.repeat(171));
      expect(form().controls.seoDescriptionEn.hasError('maxlength')).toBeTrue();
    });

    it('the EN texts are optional', () => {
      fillValid();
      form().patchValue({ titleEn: '', bodyHtmlEn: '' });
      expect(form().valid).toBeTrue();
    });

    it('validates the slug format', () => {
      fillValid();
      form().controls.slug.setValue('Padel Rules');
      expect(form().controls.slug.hasError('pattern')).toBeTrue();
      form().controls.slug.setValue('padel-rules-2026');
      expect(form().controls.slug.valid).toBeTrue();
    });

    describe('KA / EN tabs', () => {
      it('shows the KA panel first and swaps the fields on the EN tab', () => {
        expect(q('panel-ka')).not.toBeNull();
        expect(q('panel-en')).toBeNull();

        q('tab-en')!.click();
        fixture.detectChanges();

        expect(component['activeLang']()).toBe('en');
        expect(q('panel-ka')).toBeNull();
        expect(q('panel-en')).not.toBeNull();
        expect(q('tab-en')!.getAttribute('aria-selected')).toBe('true');

        // the EN panel's inputs are bound to the *En controls
        const title = q('field-title') as HTMLInputElement;
        title.value = 'Padel rules';
        title.dispatchEvent(new Event('input'));
        expect(form().controls.titleEn.value).toBe('Padel rules');
        expect(form().controls.title.value).toBe('');
      });

      it('badges show which language has content', () => {
        fixture.detectChanges();
        expect(q('tab-ka-badge')!.className).toContain('ss-badge--neutral');
        expect(q('tab-en-badge')!.className).toContain('ss-badge--neutral');

        form().controls.title.setValue('პადელის წესები');
        fixture.detectChanges();
        expect(q('tab-ka-badge')!.className).toContain('ss-badge--positive');
        expect(q('tab-ka-badge')!.textContent!.trim()).toBe('შევსებულია');
        expect(q('tab-en-badge')!.textContent!.trim()).toBe('ცარიელია');

        form().controls.bodyHtmlEn.setValue('<p>Hello</p>');
        fixture.detectChanges();
        expect(q('tab-en-badge')!.className).toContain('ss-badge--positive');
      });

      it('an invalid save jumps to the tab holding the error', () => {
        fillValid();
        form().controls.seoTitleEn.setValue('x'.repeat(71));
        expect(component['activeLang']()).toBe('ka');

        component['save']();

        expect(component['activeLang']()).toBe('en');
        expect(articleSpy.createArticle).not.toHaveBeenCalled();
      });
    });

    it('the slug follows the title (transliterated) until it is edited by hand', () => {
      form().controls.title.setValue('პადელის წესები');
      expect(form().controls.slug.value).toBe('padelis-tsesebi');

      // an English title wins
      form().controls.titleEn.setValue('Padel Rules for Beginners!');
      expect(form().controls.slug.value).toBe('padel-rules-for-beginners');

      component['onSlugInput']('my-slug');
      form().controls.slug.setValue('my-slug');
      form().controls.titleEn.setValue('Something else');
      expect(form().controls.slug.value).toBe('my-slug');
    });

    it('counts KA body words live with reading minutes and the SEO hint', () => {
      form().controls.bodyHtml.setValue('<p>ერთი ორი სამი</p><ul><li>ოთხი</li></ul>');
      fixture.detectChanges();
      expect(component['kaWords']()).toBe(4);
      expect(component['kaReadingMinutes']()).toBe(1);
      const counter = q('ka-words')!;
      expect(counter.textContent).toContain('4 სიტყვა');
      expect(counter.textContent).toContain('SEO: ≥900 სიტყვა');
      expect(counter.classList).toContain('is-low');

      form().controls.bodyHtml.setValue(`<p>${'სიტყვა '.repeat(950)}</p>`);
      fixture.detectChanges();
      expect(component['kaWords']()).toBe(950);
      expect(component['kaReadingMinutes']()).toBe(5);
      expect(q('ka-words')!.classList).not.toContain('is-low');
    });

    it('shows live SEO character counters', () => {
      form().controls.seoTitle.setValue('x'.repeat(12));
      fixture.detectChanges();
      expect(q('seo-title-count')!.textContent!.trim()).toBe('12/70');
      expect(q('seo-description-count')!.textContent!.trim()).toBe('0/170');
    });

    it('create POSTs the content with empty optionals left out, then opens /articles/:id', () => {
      form().patchValue({
        title: ' პადელის წესები ',
        bodyHtml: '<p>ტექსტი</p>',
        category: 'news',
        excerptEn: '   ',
      });
      component['addTags']('წესები, #დამწყებები');

      component['save']();

      expect(createBody()).toEqual({
        title: 'პადელის წესები',
        slug: 'padelis-tsesebi',
        bodyHtml: '<p>ტექსტი</p>',
        category: 'news',
        tags: ['წესები', 'დამწყებები'],
        faq: [],
        relatedFacilities: [],
      });
      expect('status' in createBody()).toBeFalse();
      expect('cover' in createBody()).toBeFalse();
      expect(alertSpy.open).toHaveBeenCalledWith(
        'შეიქმნა',
        jasmine.objectContaining({ appearance: 'success' }),
      );
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/articles', 'a-new'], {
        replaceUrl: true,
      });
    });

    it('an invalid save touches every field, toasts and sends nothing', () => {
      component['save']();

      expect(articleSpy.createArticle).not.toHaveBeenCalled();
      expect(form().controls.title.touched).toBeTrue();
      expect(alertSpy.open).toHaveBeenCalledWith(
        'გთხოვთ შეავსოთ ყველა სავალდებულო ველი',
        jasmine.objectContaining({ appearance: 'error' }),
      );
    });

    it('a 409 marks the slug as taken and stays on the page', () => {
      articleSpy.createArticle.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 409 })),
      );
      fillValid();

      component['save']();

      expect(form().controls.slug.hasError('conflict')).toBeTrue();
      expect(routerSpy.navigate).not.toHaveBeenCalled();
      expect(component['isSaving']()).toBeFalse();
    });

    it('a status move on a new article creates it first, then PATCHes with the new id', () => {
      fillValid();

      component['changeStatus']('ready');

      expect(articleSpy.createArticle).toHaveBeenCalledTimes(1);
      expect(articleSpy.setStatus).toHaveBeenCalledOnceWith('a-new', 'ready', undefined);
      expect(articleSpy.createArticle).toHaveBeenCalledBefore(articleSpy.setStatus);
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/articles', 'a-new'], {
        replaceUrl: true,
      });
    });

    it('offers ready / publish now / schedule for a new draft', () => {
      expect(actionIds()).toEqual(['action-ready', 'action-published', 'action-scheduled']);
      expect(q('preview-link')).toBeNull();
    });

    describe('tags', () => {
      it('adds on Enter / comma, strips #, de-duplicates and removes', () => {
        const input = document.createElement('input');
        input.value = '#პადელი';
        component['onTagKeydown'](new KeyboardEvent('keydown', { key: 'Enter' }), input);
        expect(input.value).toBe('');
        component['addTags']('ვაკე, პადელი ,  ');
        expect(form().controls.tags.value).toEqual(['პადელი', 'ვაკე']);
        expect(form().dirty).toBeTrue();

        component['removeTag'](0);
        expect(form().controls.tags.value).toEqual(['ვაკე']);
      });

      it('stops at 10 tags', () => {
        component['addTags'](Array.from({ length: 12 }, (_, i) => `t${i}`).join(','));
        expect(form().controls.tags.value.length).toBe(10);
        expect(component['tagError']()).toBe('მაქსიმუმ 10 თეგი');
      });
    });

    describe('FAQ', () => {
      it('adds and removes entries; an added entry needs the KA question and answer', () => {
        fillValid();
        component['addFaq']();
        fixture.detectChanges();
        expect(el().querySelectorAll('[data-testid="faq-item"]').length).toBe(1);
        expect(form().invalid).toBeTrue();

        component['faq'].at(0).patchValue({ q: 'რა?', a: 'ეს.' });
        expect(form().valid).toBeTrue();

        component['removeFaq'](0);
        expect(component['faq'].length).toBe(0);
      });

      it('stops at 10 entries', () => {
        for (let i = 0; i < 12; i++) component['addFaq']();
        expect(component['faq'].length).toBe(10);
      });
    });

    describe('related facilities', () => {
      it('adds from the picker up to 6 and removes', () => {
        const select = document.createElement('select');
        for (const id of ['f-1', 'f-2', 'f-3', 'f-4', 'f-5', 'f-6', 'f-7', 'f-1']) {
          select.innerHTML = `<option value="${id}">${id}</option>`;
          select.value = id;
          component['addRelated'](select);
        }
        expect(form().controls.relatedFacilities.value).toEqual([
          'f-1',
          'f-2',
          'f-3',
          'f-4',
          'f-5',
          'f-6',
        ]);
        expect(component['facilityGroups']()).toEqual([
          { academyName: 'A1', options: [jasmine.objectContaining({ id: 'f-7' }) as never] },
        ]);

        component['removeRelated']('f-2');
        expect(form().controls.relatedFacilities.value).not.toContain('f-2');
      });
    });

    describe('cover', () => {
      it('uploads through the media pipeline with the article-cover scope', () => {
        const file = new File(['x'], 'cover.jpg', { type: 'image/jpeg' });
        component['onCoverDrop']({
          preventDefault: () => undefined,
          dataTransfer: { files: [file] },
        } as unknown as DragEvent);

        expect(mediaSpy.uploadImage).toHaveBeenCalledWith(file, 'article-cover');
        expect(form().controls.cover.value).toEqual({
          url: 'https://cdn.example/new-web.webp',
          thumbUrl: 'https://cdn.example/new-thumb.webp',
          key: 'article-cover/new-web.webp',
          thumbKey: 'article-cover/new-thumb.webp',
          type: 'image/webp',
        });
        fixture.detectChanges();
        expect(q('cover-preview')!.querySelector('img')!.getAttribute('src')).toBe(
          'https://cdn.example/new-thumb.webp',
        );
      });

      it('rejects a non-image file without uploading', () => {
        const file = new File(['x'], 'notes.txt', { type: 'text/plain' });
        component['onCoverDrop']({
          preventDefault: () => undefined,
          dataTransfer: { files: [file] },
        } as unknown as DragEvent);
        expect(mediaSpy.uploadImage).not.toHaveBeenCalled();
      });
    });
  });

  describe('edit mode (/articles/:id)', () => {
    beforeEach(async () => setup('a-1'));

    it('loads the article and patches every field, pristine', () => {
      expect(component['isEditMode']).toBeTrue();
      expect(articleSpy.getArticle).toHaveBeenCalledWith('a-1');
      const v = form().getRawValue();
      expect(v.title).toBe('პადელის წესები');
      expect(v.titleEn).toBe('Padel rules');
      expect(v.bodyHtml).toBe(BODY);
      expect(v.tags).toEqual(['წესები', 'დამწყებები']);
      expect(v.faq).toEqual([
        { q: 'რა არის პადელი?', a: 'ჩოგბურთის ნათესავი.', qEn: 'What is padel?', aEn: '' },
      ]);
      expect(v.cover?.url).toBe('https://cdn.example/cover-web.webp');
      expect(v.relatedFacilities).toEqual(['f-1']);
      expect(form().valid).toBeTrue();
      expect(form().dirty).toBeFalse();
      expect(component['dirty']()).toBeFalse();
      // nothing changed → nothing to save
      expect((q('article-save') as HTMLButtonElement).disabled).toBeTrue();
    });

    it('renders the stored body in the rich-text editor', () => {
      const surface = q('rte-surface')!;
      expect(surface.querySelector('h2')!.textContent).toBe('წესები');
      expect(surface.querySelector('strong')!.textContent).toBe('სწრაფი');
    });

    it('keeps a hand-made slug when the title changes', () => {
      form().controls.titleEn.setValue('Completely new');
      expect(form().controls.slug.value).toBe('padel-rules-guide');
    });

    it('PUTs the edit: cleared optionals as null, removed cover as cover: null', () => {
      form().patchValue({ titleEn: '', excerpt: '', bodyHtmlEn: '<p></p>' });
      component['removeCover']();
      fixture.detectChanges();
      expect(q('cover-preview')).toBeNull();

      component['save']();

      expect(articleSpy.updateArticle).toHaveBeenCalledWith('a-1', jasmine.any(Object));
      const body = updateBody();
      expect(body.cover).toBeNull();
      expect('cover' in body).toBeTrue();
      expect(body.titleEn).toBeNull();
      expect(body.excerpt).toBeNull();
      expect(body.bodyHtmlEn).toBeNull();
      expect(body.title).toBe('პადელის წესები');
      expect(body.slug).toBe('padel-rules-guide');
      expect(body.bodyHtml).toBe(BODY);
      expect(body.faq).toEqual([
        { q: 'რა არის პადელი?', a: 'ჩოგბურთის ნათესავი.', qEn: 'What is padel?' },
      ]);
      expect(body.relatedFacilities).toEqual(['f-1']);
      expect('status' in body).toBeFalse();
      expect(alertSpy.open).toHaveBeenCalledWith(
        'შეინახა',
        jasmine.objectContaining({ appearance: 'success' }),
      );
      expect(component['dirty']()).toBeFalse();
      expect(routerSpy.navigate).not.toHaveBeenCalled();
    });

    it('never asks the API to unset the slug', () => {
      form().controls.slug.setValue('');
      form().markAsDirty();
      component['save']();
      expect('slug' in updateBody()).toBeFalse();
    });

    it('"publish now" on a clean article confirms and PATCHes without a PUT', () => {
      q('action-published')!.click();

      expect(dialogSpy.open).toHaveBeenCalledWith(SsConfirmComponent, jasmine.any(Object));
      expect(articleSpy.updateArticle).not.toHaveBeenCalled();
      expect(articleSpy.setStatus).toHaveBeenCalledOnceWith('a-1', 'published', undefined);
      expect(component['status']()).toBe('published');
      expect(alertSpy.open).toHaveBeenCalledWith(
        'გამოქვეყნდა',
        jasmine.objectContaining({ appearance: 'success' }),
      );
    });

    it('a status move on a dirty article saves first, then PATCHes', () => {
      form().controls.excerpt.setValue('ახალი აღწერა');
      form().controls.excerpt.markAsDirty();

      component['changeStatus']('ready');

      expect(articleSpy.updateArticle).toHaveBeenCalledTimes(1);
      expect(updateBody().excerpt).toBe('ახალი აღწერა');
      expect(articleSpy.setStatus).toHaveBeenCalledOnceWith('a-1', 'ready', undefined);
      expect(articleSpy.updateArticle).toHaveBeenCalledBefore(articleSpy.setStatus);
    });

    it('a failed save stops the flow before the status call', () => {
      articleSpy.updateArticle.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 500 })),
      );
      form().controls.excerpt.setValue('x');
      form().controls.excerpt.markAsDirty();

      component['changeStatus']('ready');

      expect(articleSpy.setStatus).not.toHaveBeenCalled();
      expect(component['isSaving']()).toBeFalse();
    });

    it('a declined publish confirmation changes nothing', () => {
      dialogSpy.open.and.returnValue(of(false));
      component['changeStatus']('published');
      expect(articleSpy.setStatus).not.toHaveBeenCalled();
    });

    it('schedule opens the picker and PATCHes scheduled with the ISO publishAt', () => {
      const iso = '2026-10-01T06:30:00.000Z';
      dialogSpy.open.and.returnValue(of(iso));

      q('action-scheduled')!.click();
      fixture.detectChanges();

      expect(dialogSpy.open.calls.mostRecent().args[0]).toBe(ArticleScheduleDialogComponent);
      expect(articleSpy.setStatus).toHaveBeenCalledOnceWith('a-1', 'scheduled', iso);
      expect(component['status']()).toBe('scheduled');
      expect(alertSpy.open).toHaveBeenCalledWith(
        'დაიგეგმა',
        jasmine.objectContaining({ appearance: 'success' }),
      );
      // the chosen instant is echoed back in local time
      expect(q('scheduled-at')).not.toBeNull();
    });

    it('a dismissed schedule picker changes nothing', () => {
      dialogSpy.open.and.returnValue(of());
      component['changeStatus']('scheduled');
      expect(articleSpy.setStatus).not.toHaveBeenCalled();
    });

    it('a rejected move (400) toasts and keeps the status', () => {
      articleSpy.setStatus.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 400 })),
      );
      component['changeStatus']('ready');
      expect(component['status']()).toBe('draft');
      expect(alertSpy.open).toHaveBeenCalledWith(
        'სტატუსის შეცვლა ვერ მოხერხდა, სცადეთ თავიდან',
        jasmine.objectContaining({ appearance: 'error' }),
      );
    });

    it('never runs a move the status machine forbids', () => {
      component['changeStatus']('archived');
      expect(dialogSpy.open).not.toHaveBeenCalled();
      expect(articleSpy.setStatus).not.toHaveBeenCalled();
    });
  });

  describe('status bar per status', () => {
    const actionsFor = async (status: ArticleStatus, extra: Partial<Article> = {}) => {
      await setup('a-1', { ...existing, status, ...extra });
      return actionIds();
    };

    it('ready → publish now, schedule', async () => {
      expect(await actionsFor('ready')).toEqual(['action-published', 'action-scheduled']);
    });

    it('scheduled → ready, publish now, back to draft — and shows the go-live time', async () => {
      expect(
        await actionsFor('scheduled', { publishAt: '2026-10-01T06:00:00.000Z' }),
      ).toEqual(['action-ready', 'action-published', 'action-draft']);
      expect(q('scheduled-at')).not.toBeNull();
    });

    it('published → archive, with the player-app preview link', async () => {
      expect(
        await actionsFor('published', { publishedAt: '2026-09-01T06:00:00.000Z' }),
      ).toEqual(['action-archived']);
      expect(q('preview-link')!.getAttribute('href')).toBe(
        `${environment.siteUrl}/blog/padel-rules-guide`,
      );
      expect(q('published-at')).not.toBeNull();
    });

    it('archived → ready, back to draft (no preview)', async () => {
      expect(await actionsFor('archived')).toEqual(['action-ready', 'action-draft']);
      expect(q('preview-link')).toBeNull();
    });

    it('a published article does not re-derive its slug', async () => {
      await setup('a-1', { ...existing, status: 'published', slug: 'padel-rules' });
      form().controls.titleEn.setValue('Padel Rules');
      expect(form().controls.slug.value).toBe('padel-rules');
    });

    it('a draft whose slug still matches its title keeps following the title', async () => {
      await setup('a-1', { ...existing, titleEn: 'Padel Rules', slug: 'padel-rules' });
      form().controls.titleEn.setValue('Padel Rules 2026');
      expect(form().controls.slug.value).toBe('padel-rules-2026');
    });
  });

  describe('when the article cannot be loaded', () => {
    beforeEach(async () => {
      await setup();
      articleSpy.getArticle.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 404 })),
      );
      component['articleId'].set('a-404');
      component['retry']();
    });

    it('shows the error state', () => {
      expect(component['hasError']()).toBeTrue();
      expect(component['isLoading']()).toBeFalse();
    });
  });
});
