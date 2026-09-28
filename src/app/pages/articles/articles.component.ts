import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, debounceTime, defaultIfEmpty, filter, map, switchMap, take } from 'rxjs';
import { ArticleService } from '../../services/http-services/article.service';
import {
  ARTICLE_CATEGORIES,
  ARTICLE_STATUSES,
  ARTICLE_STATUS_CLASSES,
  ARTICLE_STATUS_LABELS,
  Article,
  ArticleCategory,
  ArticleStatus,
  articleCategoryLabel,
  canTransition,
} from '../../shared/models/article.model';
import { tr } from '../../shared/i18n/lang';
import { TPipe } from '../../shared/i18n/t.pipe';
import { SsToastService } from '../../shared/ui/toast.service';
import { SsDialogService } from '../../shared/ui/dialog.service';
import { SsConfirmComponent, SsConfirmData } from '../../shared/ui/confirm.component';
import {
  ARTICLE_QUICK_ACTIONS,
  ARTICLE_QUICK_ACTION_LABELS,
  articleStatusConfirm,
  articleStatusSuccess,
} from './article-status';
import {
  ArticleScheduleData,
  ArticleScheduleDialogComponent,
} from './article-schedule-dialog/article-schedule-dialog.component';

const PAGE_SIZE = 20;

/**
 * სტატიები — the superadmin list of blog articles (docs/26 §WP-3):
 * searchable, filterable by status and category, with the lifecycle's quick
 * moves per row (publish now / mark ready / archive — only the ones the
 * status machine allows, each confirmed), delete-with-confirm and a row
 * click into the full-page editor (`/articles/:id`).
 */
@Component({
  selector: 'app-articles',
  standalone: true,
  imports: [FormsModule, DatePipe, TPipe],
  templateUrl: './articles.component.html',
  styleUrl: './articles.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticlesComponent implements OnInit {
  private readonly articleService = inject(ArticleService);
  private readonly router = inject(Router);
  private readonly dialogs = inject(SsDialogService);
  private readonly alerts = inject(SsToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly statusOptions = ARTICLE_STATUSES;
  protected readonly categoryOptions = ARTICLE_CATEGORIES;

  // filters ('' = any)
  protected readonly q = signal('');
  protected readonly statusFilter = signal<ArticleStatus | ''>('');
  protected readonly categoryFilter = signal<ArticleCategory | ''>('');

  // list state
  protected readonly rows = signal<Article[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly hasError = signal(false);
  protected readonly page = signal(1);
  protected readonly total = signal(0);
  protected readonly limit = PAGE_SIZE;
  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.limit)),
  );
  protected readonly isMobile = signal(window.innerWidth <= 768);
  /** Row ids with a status move in flight — their buttons are disabled. */
  protected readonly busyIds = signal<ReadonlySet<string>>(new Set());

  /** Drops stale responses when the user types faster than the API answers. */
  private requestSeq = 0;
  private readonly search$ = new Subject<void>();

  @HostListener('window:resize')
  protected onResize(): void {
    this.isMobile.set(window.innerWidth <= 768);
  }

  ngOnInit(): void {
    this.search$
      .pipe(debounceTime(400), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.page.set(1);
        this.load();
      });
    this.load();
  }

  // ── filters ────────────────────────────────────────────────────────────────

  protected onSearchChange(value: string): void {
    this.q.set(value);
    this.search$.next();
  }

  protected onStatusFilterChange(status: ArticleStatus | ''): void {
    this.statusFilter.set(status);
    this.reloadFromFirstPage();
  }

  protected onCategoryFilterChange(category: ArticleCategory | ''): void {
    this.categoryFilter.set(category);
    this.reloadFromFirstPage();
  }

  protected onPageChange(page: number): void {
    this.page.set(page);
    this.load();
  }

  protected retry(): void {
    this.load();
  }

  private reloadFromFirstPage(): void {
    this.page.set(1);
    this.load();
  }

  private load(): void {
    const seq = ++this.requestSeq;
    this.isLoading.set(true);
    this.hasError.set(false);
    this.articleService
      .getArticles({
        page: this.page(),
        limit: this.limit,
        q: this.q().trim() || undefined,
        status: this.statusFilter() || undefined,
        category: this.categoryFilter() || undefined,
      })
      .pipe(take(1))
      .subscribe({
        next: ({ data, page }) => {
          if (seq !== this.requestSeq) return;
          this.rows.set(data);
          this.total.set(page?.total ?? data.length);
          this.isLoading.set(false);
        },
        error: () => {
          if (seq !== this.requestSeq) return;
          this.isLoading.set(false);
          this.hasError.set(true);
        },
      });
  }

  // ── navigation ─────────────────────────────────────────────────────────────

  protected addArticle(): void {
    this.router.navigate(['/articles/new']);
  }

  protected editArticle(article: Article): void {
    this.router.navigate(['/articles', article._id]);
  }

  /**
   * Row click / Enter opens the editor — unless the event started on one of
   * the row's own controls (quick moves, delete), which act in place.
   */
  protected onRowActivate(event: Event, article: Article): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, select, a, input')) return;
    this.editArticle(article);
  }

  // ── quick status moves + delete ────────────────────────────────────────────

  /** The quick moves the status machine allows from this row's status. */
  protected quickActions(article: Article): ArticleStatus[] {
    return ARTICLE_QUICK_ACTIONS.filter((target) => canTransition(article.status, target));
  }

  protected quickActionLabel(target: ArticleStatus): string {
    return ARTICLE_QUICK_ACTION_LABELS[target];
  }

  /**
   * Confirm (publish / archive / ready) or pick the go-live time (schedule)
   * → PATCH status → swap in the returned row + toast.
   */
  protected runQuickAction(article: Article, target: ArticleStatus): void {
    if (!canTransition(article.status, target) || this.busyIds().has(article._id)) return;
    this.gate(article, target)
      .pipe(
        filter((gate): gate is { publishAt?: string } => gate !== null),
        switchMap((gate) => {
          this.setBusy(article._id, true);
          return gate.publishAt
            ? this.articleService.setStatus(article._id, target, gate.publishAt)
            : this.articleService.setStatus(article._id, target);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (updated) => {
          this.setBusy(article._id, false);
          this.rows.update((list) => list.map((a) => (a._id === updated._id ? updated : a)));
          this.alerts
            .open(articleStatusSuccess(target), { appearance: 'success' })
            .pipe(take(1))
            .subscribe();
        },
        error: () => {
          this.setBusy(article._id, false);
          this.alerts
            .open(tr('სტატუსის შეცვლა ვერ მოხერხდა, სცადეთ თავიდან'), { appearance: 'error' })
            .pipe(take(1))
            .subscribe();
        },
      });
  }

  /**
   * The pre-flight of a quick move: the schedule dialog (→ its ISO instant) or
   * the confirmation; `null` = the operator backed out. Mirrors the editor.
   */
  private gate(article: Article, target: ArticleStatus): Observable<{ publishAt?: string } | null> {
    if (target === 'scheduled') {
      return this.dialogs
        .open<string>(ArticleScheduleDialogComponent, {
          label: tr('გამოქვეყნების დაგეგმვა'),
          size: 's',
          data: { publishAt: article.publishAt ?? null } as ArticleScheduleData,
        })
        .pipe(
          take(1),
          map((publishAt) => ({ publishAt })),
          defaultIfEmpty(null),
        );
    }
    const confirm = articleStatusConfirm(target, article.title);
    if (!confirm) {
      return new Observable<{ publishAt?: string } | null>((sub) => {
        sub.next(null);
        sub.complete();
      });
    }
    return this.dialogs
      .open<boolean>(SsConfirmComponent, { label: confirm.label, size: 's', data: confirm.data })
      .pipe(
        take(1),
        map((yes) => (yes ? {} : null)),
        defaultIfEmpty(null),
      );
  }

  private setBusy(id: string, busy: boolean): void {
    this.busyIds.update((ids) => {
      const next = new Set(ids);
      if (busy) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  protected deleteArticle(article: Article): void {
    this.dialogs
      .open<boolean>(SsConfirmComponent, {
        label: tr('სტატიის წაშლა'),
        size: 's',
        data: {
          content: `${tr('ნამდვილად წავშალოთ სტატია')} „${article.title}“?`,
          yes: tr('წაშლა'),
          no: tr('გაუქმება'),
          appearance: 'destructive',
        } as SsConfirmData,
      })
      .pipe(
        take(1),
        filter(Boolean),
        switchMap(() => this.articleService.deleteArticle(article._id)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.load();
          this.alerts.open(tr('წაიშალა'), { appearance: 'success' }).pipe(take(1)).subscribe();
        },
        error: () => {
          this.alerts
            .open(tr('წაშლა ვერ მოხერხდა, სცადეთ თავიდან'), { appearance: 'error' })
            .pipe(take(1))
            .subscribe();
        },
      });
  }

  // ── display helpers ────────────────────────────────────────────────────────

  protected statusLabel(status: ArticleStatus): string {
    return ARTICLE_STATUS_LABELS[status] ?? status;
  }

  protected statusClass(status: ArticleStatus): string {
    return ARTICLE_STATUS_CLASSES[status] ?? ARTICLE_STATUS_CLASSES.draft;
  }

  protected categoryLabel(category: ArticleCategory): string {
    return articleCategoryLabel(category);
  }

  /** The instant under the status badge: go-live time when scheduled, live-since when published. */
  protected statusDate(article: Article): string | null {
    if (article.status === 'scheduled') return article.publishAt ?? null;
    if (article.status === 'published') return article.publishedAt ?? null;
    return null;
  }
}
