import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { ArticleService } from './article.service';
import { Article, CreateArticleDto, UpdateArticleDto } from '../../shared/models/article.model';
import { SKIP_ERROR_TOAST } from '../../shared/interceptors/error.interceptor';
import { environment } from '../../../environments/environment';

function wrap<T>(data: T, page?: unknown) {
  return { result: { data, page }, errors: [] };
}

const base = `${environment.apiUrl}/articles`;

const article: Article = {
  _id: 'a-1',
  title: 'პადელის წესები',
  titleEn: 'Padel rules',
  slug: 'padel-rules',
  bodyHtml: '<p>ტექსტი</p>',
  category: 'tips',
  tags: ['წესები'],
  faq: [],
  status: 'draft',
  relatedFacilities: [],
  wordCount: 1,
  readingMinutes: 1,
  author: 'Sport Space რედაქცია',
};

describe('ArticleService', () => {
  let service: ArticleService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ArticleService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ArticleService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getArticles GETs /articles with page, limit, q, status and category and unwraps rows + page', () => {
    let emitted: { data: Article[]; page?: { total: number } } | undefined;
    service
      .getArticles({ page: 2, limit: 20, q: 'წესები', status: 'published', category: 'tips' })
      .subscribe((r) => (emitted = r as never));

    const req = httpMock.expectOne(
      (r) =>
        r.url === base &&
        r.params.get('page') === '2' &&
        r.params.get('limit') === '20' &&
        r.params.get('q') === 'წესები' &&
        r.params.get('status') === 'published' &&
        r.params.get('category') === 'tips',
    );
    expect(req.request.method).toBe('GET');
    req.flush(wrap([article], { page: 2, size: 20, total: 41 }));

    expect(emitted!.data).toEqual([article]);
    expect(emitted!.page?.total).toBe(41);
  });

  it('getArticles leaves unset and empty filters out of the URL', () => {
    service.getArticles({ page: 1, limit: 20, q: '', status: undefined }).subscribe();

    const req = httpMock.expectOne((r) => r.url === base);
    expect(req.request.params.keys().sort()).toEqual(['limit', 'page']);
    req.flush(wrap([]));
  });

  it('getArticles defaults to an empty array when data is null', () => {
    let emitted: { data: Article[] } | undefined;
    service.getArticles({ page: 1, limit: 20 }).subscribe((r) => (emitted = r as never));
    httpMock.expectOne((r) => r.url === base).flush(wrap(null));
    expect(emitted!.data).toEqual([]);
  });

  it('getArticle GETs /articles/:id and unwraps the article', () => {
    let emitted: Article | undefined;
    service.getArticle('a-1').subscribe((r) => (emitted = r));

    const req = httpMock.expectOne(`${base}/a-1`);
    expect(req.request.method).toBe('GET');
    req.flush(wrap(article));
    expect(emitted).toEqual(article);
  });

  it('createArticle POSTs the dto quietly (the page owns the error toast)', () => {
    const dto: CreateArticleDto = {
      title: 'პადელის წესები',
      bodyHtml: '<p>ტექსტი</p>',
      category: 'tips',
      tags: [],
      faq: [],
      relatedFacilities: [],
    };
    let emitted: Article | undefined;
    service.createArticle(dto).subscribe((r) => (emitted = r));

    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dto);
    expect(req.request.context.get(SKIP_ERROR_TOAST)).toBeTrue();
    req.flush(wrap(article));
    expect(emitted).toEqual(article);
  });

  it('updateArticle PUTs the dto with explicit nulls untouched (cover: null removes the cover)', () => {
    const dto: UpdateArticleDto = { cover: null, titleEn: null, tags: [] };
    service.updateArticle('a-1', dto).subscribe();

    const req = httpMock.expectOne(`${base}/a-1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ cover: null, titleEn: null, tags: [] });
    expect(req.request.context.get(SKIP_ERROR_TOAST)).toBeTrue();
    req.flush(wrap(article));
  });

  it('setStatus PATCHes /articles/:id/status with { status } only', () => {
    let emitted: Article | undefined;
    service.setStatus('a-1', 'published').subscribe((r) => (emitted = r));

    const req = httpMock.expectOne(`${base}/a-1/status`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'published' });
    expect(req.request.context.get(SKIP_ERROR_TOAST)).toBeTrue();
    req.flush(wrap({ ...article, status: 'published' }));
    expect(emitted?.status).toBe('published');
  });

  it('setStatus sends publishAt with a scheduled move', () => {
    service.setStatus('a-1', 'scheduled', '2026-10-01T06:00:00.000Z').subscribe();

    const req = httpMock.expectOne(`${base}/a-1/status`);
    expect(req.request.body).toEqual({
      status: 'scheduled',
      publishAt: '2026-10-01T06:00:00.000Z',
    });
    req.flush(wrap({ ...article, status: 'scheduled' }));
  });

  it('setStatus never sends publishAt with any other status', () => {
    service.setStatus('a-1', 'ready', '2026-10-01T06:00:00.000Z').subscribe();

    const req = httpMock.expectOne(`${base}/a-1/status`);
    expect(req.request.body).toEqual({ status: 'ready' });
    req.flush(wrap({ ...article, status: 'ready' }));
  });

  it('deleteArticle DELETEs /articles/:id and maps the result to undefined', () => {
    let emitted: unknown = 'sentinel';
    service.deleteArticle('a-1').subscribe((r) => (emitted = r));

    const req = httpMock.expectOne(`${base}/a-1`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.context.get(SKIP_ERROR_TOAST)).toBeTrue();
    req.flush(wrap({ deleted: true }));
    expect(emitted).toBeUndefined();
  });
});
