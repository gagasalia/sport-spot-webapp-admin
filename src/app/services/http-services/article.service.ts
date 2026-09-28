import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiPage, ApiResponse } from '../../shared/models/api-response.model';
import {
  Article,
  ArticleListQuery,
  ArticleStatus,
  ArticleStatusChange,
  CreateArticleDto,
  UpdateArticleDto,
} from '../../shared/models/article.model';
import { SKIP_ERROR_TOAST } from '../../shared/interceptors/error.interceptor';

export interface PaginatedArticles {
  data: Article[];
  page?: ApiPage;
}

/**
 * Superadmin articles (blog) API (`/articles`, docs/26 §WP-3). Every payload
 * is the standard envelope (`{ result: { data, page? }, errors }`). Content
 * edits (PUT) and lifecycle moves (PATCH …/status) are separate calls — the
 * API owns the status machine and answers an invalid move with a 400.
 * Mutations opt out of the interceptor's generic error toast: the articles
 * pages always surface their own message, so the generic one would double it.
 */
@Injectable({ providedIn: 'root' })
export class ArticleService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/articles`;

  /** GET /articles — paginated; unset and empty filters are left out of the URL. */
  getArticles(query: ArticleListQuery): Observable<PaginatedArticles> {
    let params = new HttpParams().set('page', query.page).set('limit', query.limit);
    for (const key of ['q', 'status', 'category'] as const) {
      const value = query[key];
      if (value !== undefined && value !== '') {
        params = params.set(key, value);
      }
    }
    return this.http
      .get<ApiResponse<Article[]>>(this.apiUrl, { params })
      .pipe(map((res) => ({ data: res.result.data ?? [], page: res.result.page })));
  }

  /** GET /articles/:id */
  getArticle(id: string): Observable<Article> {
    return this.http
      .get<ApiResponse<Article>>(`${this.apiUrl}/${id}`)
      .pipe(map((res) => res.result.data));
  }

  /** POST /articles — a new article is always a draft. */
  createArticle(dto: CreateArticleDto): Observable<Article> {
    return this.http
      .post<ApiResponse<Article>>(this.apiUrl, dto, { context: this.quiet() })
      .pipe(map((res) => res.result.data));
  }

  /** PUT /articles/:id — partial; an explicit `null` clears an optional field. */
  updateArticle(id: string, dto: UpdateArticleDto): Observable<Article> {
    return this.http
      .put<ApiResponse<Article>>(`${this.apiUrl}/${id}`, dto, { context: this.quiet() })
      .pipe(map((res) => res.result.data));
  }

  /**
   * PATCH /articles/:id/status { status, publishAt? } — `publishAt` (ISO UTC)
   * travels only with `scheduled`, where the API requires it.
   */
  setStatus(id: string, status: ArticleStatus, publishAt?: string): Observable<Article> {
    const body: ArticleStatusChange =
      status === 'scheduled' && publishAt ? { status, publishAt } : { status };
    return this.http
      .patch<ApiResponse<Article>>(`${this.apiUrl}/${id}/status`, body, {
        context: this.quiet(),
      })
      .pipe(map((res) => res.result.data));
  }

  /** DELETE /articles/:id — the response body is ignored. */
  deleteArticle(id: string): Observable<void> {
    return this.http
      .delete<unknown>(`${this.apiUrl}/${id}`, { context: this.quiet() })
      .pipe(map(() => undefined));
  }

  private quiet(): HttpContext {
    return new HttpContext().set(SKIP_ERROR_TOAST, true);
  }
}
