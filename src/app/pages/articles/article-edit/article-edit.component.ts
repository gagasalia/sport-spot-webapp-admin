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
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  Observable,
  catchError,
  defaultIfEmpty,
  filter,
  finalize,
  map,
  merge,
  of,
  startWith,
  switchMap,
  take,
  tap,
} from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ArticleService } from '../../../services/http-services/article.service';
import { AcademyService } from '../../../services/http-services/academy.service';
import { FacilityService } from '../../../services/http-services/facility.service';
import {
  MediaFileTooLargeError,
  MediaService,
  MediaUnconfiguredError,
} from '../../../services/http-services/media.service';
import {
  ARTICLE_CATEGORIES,
  ARTICLE_EXCERPT_MAX,
  ARTICLE_FAQ_MAX,
  ARTICLE_RELATED_FACILITIES_MAX,
  ARTICLE_SEO_DESCRIPTION_MAX,
  ARTICLE_SEO_MIN_WORDS,
  ARTICLE_SEO_TITLE_MAX,
  ARTICLE_SLUG_MAX,
  ARTICLE_SLUG_RE,
  ARTICLE_STATUS_CLASSES,
  ARTICLE_STATUS_LABELS,
  ARTICLE_TAGS_MAX,
  ARTICLE_TAG_MAX_LENGTH,
  ARTICLE_TITLE_MAX,
  Article,
  ArticleCategory,
  ArticleCover,
  ArticleFaqItem,
  ArticleStatus,
  CreateArticleDto,
  UpdateArticleDto,
  articleCategoryLabel,
  canTransition,
  readingMinutesFor,
} from '../../../shared/models/article.model';
import { countArticleWords, isArticleHtmlEmpty } from '../../../shared/utils/article-html.util';
import { slugify } from '../../../shared/utils/slug.util';
import { tr } from '../../../shared/i18n/lang';
import { localizedName } from '../../../shared/i18n/localized';
import { TPipe } from '../../../shared/i18n/t.pipe';
import { SsToastService } from '../../../shared/ui/toast.service';
import { SsDialogService } from '../../../shared/ui/dialog.service';
import { SsConfirmComponent } from '../../../shared/ui/confirm.component';
import { PartnerFacilityOption, loadPartnerFacilities } from '../../venues/partner-facilities';
import { RichTextEditorComponent } from '../rich-text-editor/rich-text-editor.component';
import {
  ArticleScheduleData,
  ArticleScheduleDialogComponent,
} from '../article-schedule-dialog/article-schedule-dialog.component';
import { ARTICLE_ACTION_LABELS, articleStatusConfirm, articleStatusSuccess } from '../article-status';

export type ArticleLang = 'ka' | 'en';

/** Byline shown before the API has returned one (the API owns the value). */
export const ARTICLE_DEFAULT_AUTHOR = 'Sport Space რედაქცია';

/** Status-bar move buttons, in display order (only the valid ones render). */
const STATUS_ACTION_ORDER: readonly ArticleStatus[] = [
  'ready',
  'published',
  'scheduled',
  'archived',
  'draft',
];

/** Non-empty after trimming. */
export const requiredTrimmed: ValidatorFn = (control) =>
  typeof control.value === 'string' && control.value.trim() ? null : { required: true };

/** A rich-text body holding some text or an image. */
export const bodyRequired: ValidatorFn = (control) =>
  isArticleHtmlEmpty(control.value as string) ? { required: true } : null;

type FaqForm = FormGroup<{
  q: FormControl<string>;
  a: FormControl<string>;
  qEn: FormControl<string>;
  aEn: FormControl<string>;
}>;

/** The form controls behind one language tab. */
interface LangFields {
  title: string;
  excerpt: string;
  body: string;
  seoTitle: string;
  seoDescription: string;
}

const LANG_FIELDS: Readonly<Record<ArticleLang, LangFields>> = {
  ka: {
    title: 'title',
    excerpt: 'excerpt',
    body: 'bodyHtml',
    seoTitle: 'seoTitle',
    seoDescription: 'seoDescription',
  },
  en: {
    title: 'titleEn',
    excerpt: 'excerptEn',
    body: 'bodyHtmlEn',
    seoTitle: 'seoTitleEn',
    seoDescription: 'seoDescriptionEn',
  },
};

/**
 * Article create/edit page (`/articles/new`, `/articles/:id`) — docs/26
 * §WP-3's blog editor. A KA / EN tab switch carries the per-language texts
 * (title, excerpt, rich-text body, SEO title/description); slug, category,
 * tags, cover, FAQ and related facilities are shared.
 *
 * Content and lifecycle are separate API calls: «შენახვა» PUTs (or POSTs) the
 * content, and every status button saves first when the form is dirty, THEN
 * PATCHes the status — so "publish now" always publishes what is on screen.
 * Only the moves the status machine allows are offered. On create, empty
 * optionals are left out; on edit a cleared optional is sent as `null` (a
 * removed cover is `cover: null`).
 */
@Component({
  selector: 'app-article-edit',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    DatePipe,
    NgTemplateOutlet,
    TPipe,
    RichTextEditorComponent,
  ],
  templateUrl: './article-edit.component.html',
  styleUrl: './article-edit.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticleEditComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly articleService = inject(ArticleService);
  private readonly academyService = inject(AcademyService);
  private readonly facilityService = inject(FacilityService);
  private readonly mediaService = inject(MediaService);
  private readonly dialogs = inject(SsDialogService);
  private readonly alerts = inject(SsToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly categoryOptions = ARTICLE_CATEGORIES;
  protected readonly langs: readonly ArticleLang[] = ['ka', 'en'];
  protected readonly langFields = LANG_FIELDS;
  protected readonly seoMinWords = ARTICLE_SEO_MIN_WORDS;
  protected readonly defaultAuthor = ARTICLE_DEFAULT_AUTHOR;

  /** Input `maxlength`s and counters — the API's caps. */
  protected readonly limits = {
    title: ARTICLE_TITLE_MAX,
    excerpt: ARTICLE_EXCERPT_MAX,
    seoTitle: ARTICLE_SEO_TITLE_MAX,
    seoDescription: ARTICLE_SEO_DESCRIPTION_MAX,
    slug: ARTICLE_SLUG_MAX,
    tags: ARTICLE_TAGS_MAX,
    tagLength: ARTICLE_TAG_MAX_LENGTH,
    faq: ARTICLE_FAQ_MAX,
    related: ARTICLE_RELATED_FACILITIES_MAX,
  };

  /** The edited article's id; null on `/articles/new` until the first save. */
  protected readonly articleId = signal<string | null>(null);
  /** The article as the API last returned it (status, dates, byline). */
  protected readonly article = signal<Article | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly hasError = signal(false);
  /** A save and/or status call is in flight — every action is disabled. */
  protected readonly isSaving = signal(false);
  protected readonly isUploadingCover = signal(false);
  protected readonly dirty = signal(false);
  protected readonly activeLang = signal<ArticleLang>('ka');
  protected readonly facilityOptions = signal<PartnerFacilityOption[]>([]);
  /** RAW Georgian message of the last rejected tag, if any. */
  protected readonly tagError = signal<string | null>(null);

  /** The slug follows the title (Latin transliteration) until the operator edits it. */
  private slugAuto = true;
  /** Set by a successful create — the page moves to `/articles/:id` once the flow ends. */
  private createdId: string | null = null;
  private destroyed = false;

  readonly form = this.fb.group({
    title: ['', [requiredTrimmed, Validators.maxLength(ARTICLE_TITLE_MAX)]],
    titleEn: ['', [Validators.maxLength(ARTICLE_TITLE_MAX)]],
    excerpt: ['', [Validators.maxLength(ARTICLE_EXCERPT_MAX)]],
    excerptEn: ['', [Validators.maxLength(ARTICLE_EXCERPT_MAX)]],
    bodyHtml: ['', [bodyRequired]],
    bodyHtmlEn: [''],
    seoTitle: ['', [Validators.maxLength(ARTICLE_SEO_TITLE_MAX)]],
    seoTitleEn: ['', [Validators.maxLength(ARTICLE_SEO_TITLE_MAX)]],
    seoDescription: ['', [Validators.maxLength(ARTICLE_SEO_DESCRIPTION_MAX)]],
    seoDescriptionEn: ['', [Validators.maxLength(ARTICLE_SEO_DESCRIPTION_MAX)]],
    slug: ['', [Validators.pattern(ARTICLE_SLUG_RE), Validators.maxLength(ARTICLE_SLUG_MAX)]],
    category: this.fb.control<ArticleCategory>('tips'),
    tags: this.fb.control<string[]>([], [Validators.maxLength(ARTICLE_TAGS_MAX)]),
    cover: this.fb.control<ArticleCover | null>(null),
    faq: this.fb.array<FaqForm>([], [Validators.maxLength(ARTICLE_FAQ_MAX)]),
    relatedFacilities: this.fb.control<string[]>(
      [],
      [Validators.maxLength(ARTICLE_RELATED_FACILITIES_MAX)],
    ),
  });

  /** The whole form as a signal — derived values below re-run only when their slice changes. */
  protected readonly v = toSignal(
    this.form.valueChanges.pipe(
      startWith(null),
      map(() => this.form.getRawValue()),
    ),
    { requireSync: true },
  );

  private readonly bodyKa = computed(() => this.v().bodyHtml);
  private readonly bodyEn = computed(() => this.v().bodyHtmlEn);
  protected readonly kaWords = computed(() => countArticleWords(this.bodyKa()));
  protected readonly enWords = computed(() => countArticleWords(this.bodyEn()));
  protected readonly kaReadingMinutes = computed(() => readingMinutesFor(this.kaWords()));
  protected readonly tags = computed(() => this.v().tags);
  protected readonly cover = computed(() => this.v().cover);
  protected readonly relatedIds = computed(() => this.v().relatedFacilities);

  /** Tab badges: which language has any content yet. */
  protected readonly hasContent = computed<Record<ArticleLang, boolean>>(() => {
    const v = this.v();
    return {
      ka: !!(v.title.trim() || v.excerpt.trim() || !isArticleHtmlEmpty(this.bodyKa())),
      en: !!(v.titleEn.trim() || v.excerptEn.trim() || !isArticleHtmlEmpty(this.bodyEn())),
    };
  });

  protected readonly status = computed<ArticleStatus>(() => this.article()?.status ?? 'draft');
  protected readonly statusActions = computed(() =>
    STATUS_ACTION_ORDER.filter((target) => canTransition(this.status(), target)),
  );
  protected readonly canSave = computed(
    () => !this.isSaving() && (this.articleId() === null || this.dirty()),
  );
  /** Player-app page of a live article. */
  protected readonly previewUrl = computed(() => {
    const article = this.article();
    return article?.status === 'published' && article.slug
      ? `${environment.siteUrl}/blog/${article.slug}`
      : null;
  });

  /** Chips of the picked facilities; an id the picker does not know still shows. */
  protected readonly selectedFacilities = computed(() => {
    const byId = new Map(this.facilityOptions().map((o) => [o.id, o]));
    return this.relatedIds().map((id) => {
      const option = byId.get(id);
      return { id, label: option ? this.facilityLabel(option) : null };
    });
  });

  /** Picker options not yet chosen, grouped by academy for the <optgroup>s. */
  protected readonly facilityGroups = computed(() => {
    const chosen = new Set(this.relatedIds());
    const groups = new Map<string, PartnerFacilityOption[]>();
    for (const option of this.facilityOptions()) {
      if (chosen.has(option.id)) continue;
      const list = groups.get(option.academyName) ?? [];
      list.push(option);
      groups.set(option.academyName, list);
    }
    return [...groups.entries()].map(([academyName, options]) => ({ academyName, options }));
  });

  protected get isEditMode(): boolean {
    return this.articleId() !== null;
  }

  protected get faq() {
    return this.form.controls.faq;
  }

  /** Leaving the tab with unsaved text asks the browser's "leave site?" question. */
  @HostListener('window:beforeunload', ['$event'])
  protected onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.dirty()) {
      event.preventDefault();
    }
  }

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => (this.destroyed = true));

    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.dirty.set(this.form.dirty));
    merge(this.form.controls.title.valueChanges, this.form.controls.titleEn.valueChanges)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncAutoSlug());

    loadPartnerFacilities(this.academyService, this.facilityService)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((options) => this.facilityOptions.set(options));

    this.route.paramMap
      .pipe(
        map((params) => params.get('id')),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((id) => {
        this.articleId.set(id);
        if (id) {
          this.load(id);
        }
      });
  }

  protected retry(): void {
    const id = this.articleId();
    if (id) this.load(id);
  }

  private load(id: string): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.articleService
      .getArticle(id)
      .pipe(take(1))
      .subscribe({
        next: (article) => {
          this.article.set(article);
          this.patchForm(article);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
          this.hasError.set(true);
        },
      });
  }

  private patchForm(a: Article): void {
    const faq = a.faq ?? [];
    this.faq.clear({ emitEvent: false });
    for (const item of faq) {
      this.faq.push(this.buildFaq(item), { emitEvent: false });
    }
    // Resetting the title would re-derive the slug — decide auto-ness after.
    this.slugAuto = false;
    this.form.reset({
      title: a.title ?? '',
      titleEn: a.titleEn ?? '',
      excerpt: a.excerpt ?? '',
      excerptEn: a.excerptEn ?? '',
      bodyHtml: a.bodyHtml ?? '',
      bodyHtmlEn: a.bodyHtmlEn ?? '',
      seoTitle: a.seoTitle ?? '',
      seoTitleEn: a.seoTitleEn ?? '',
      seoDescription: a.seoDescription ?? '',
      seoDescriptionEn: a.seoDescriptionEn ?? '',
      slug: a.slug ?? '',
      category: a.category ?? 'tips',
      tags: [...(a.tags ?? [])],
      cover: a.cover ?? null,
      faq: faq.map((f) => ({ q: f.q ?? '', a: f.a ?? '', qEn: f.qEn ?? '', aEn: f.aEn ?? '' })),
      relatedFacilities: [...(a.relatedFacilities ?? [])],
    });
    // A draft whose slug still equals the derived one keeps following the title.
    this.slugAuto =
      a.status === 'draft' &&
      (!a.slug || a.slug === slugify(a.titleEn?.trim() || a.title, ARTICLE_SLUG_MAX));
    this.dirty.set(false);
  }

  private buildFaq(item?: ArticleFaqItem): FaqForm {
    return this.fb.group({
      q: [item?.q ?? '', [requiredTrimmed]],
      a: [item?.a ?? '', [requiredTrimmed]],
      qEn: [item?.qEn ?? ''],
      aEn: [item?.aEn ?? ''],
    });
  }

  // ── slug ───────────────────────────────────────────────────────────────────

  /** While a draft's slug is automatic it mirrors `titleEn || title`, transliterated. */
  private syncAutoSlug(): void {
    if (!this.slugAuto || this.status() !== 'draft') return;
    const { title, titleEn, slug } = this.form.controls;
    const next = slugify(titleEn.value.trim() || title.value, ARTICLE_SLUG_MAX);
    if (next !== slug.value) {
      slug.setValue(next);
    }
  }

  /** A hand-edited slug stops following the title; clearing it hands it back. */
  protected onSlugInput(value: string): void {
    this.slugAuto = !value.trim();
  }

  // ── tags ───────────────────────────────────────────────────────────────────

  protected onTagKeydown(event: KeyboardEvent, input: HTMLInputElement): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.addTags(input.value);
      input.value = '';
    } else if (event.key === 'Backspace' && !input.value) {
      const count = this.form.controls.tags.value.length;
      if (count) this.removeTag(count - 1);
    }
  }

  protected onTagBlur(input: HTMLInputElement): void {
    if (input.value.trim()) {
      this.addTags(input.value);
      input.value = '';
    }
  }

  /** Comma-separated input → trimmed, de-duplicated (case-insensitive) chips, ≤10. */
  protected addTags(raw: string): void {
    const tags = [...this.form.controls.tags.value];
    const seen = new Set(tags.map((t) => t.toLowerCase()));
    this.tagError.set(null);
    for (const part of raw.split(',')) {
      const tag = part.trim().replace(/^#+/, '').replace(/\s+/g, ' ').trim();
      if (!tag || seen.has(tag.toLowerCase())) continue;
      if (tag.length > ARTICLE_TAG_MAX_LENGTH) {
        this.tagError.set('თეგი მაქსიმუმ 50 სიმბოლოა');
        continue;
      }
      if (tags.length >= ARTICLE_TAGS_MAX) {
        this.tagError.set('მაქსიმუმ 10 თეგი');
        break;
      }
      tags.push(tag);
      seen.add(tag.toLowerCase());
    }
    if (tags.length !== this.form.controls.tags.value.length) {
      this.setDirty(this.form.controls.tags, tags);
    }
  }

  protected removeTag(index: number): void {
    this.tagError.set(null);
    this.setDirty(
      this.form.controls.tags,
      this.form.controls.tags.value.filter((_, i) => i !== index),
    );
  }

  // ── cover ──────────────────────────────────────────────────────────────────

  protected onCoverSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) this.uploadCover(file);
  }

  protected onCoverDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  protected onCoverDrop(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) this.uploadCover(file);
  }

  private uploadCover(file: File): void {
    if (!file.type.startsWith('image/')) {
      this.toastError('გთხოვთ აირჩიოთ სურათის ფაილი');
      return;
    }
    this.isUploadingCover.set(true);
    this.mediaService
      .uploadImage(file, 'article-cover')
      .pipe(
        take(1),
        finalize(() => this.isUploadingCover.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (media) =>
          this.setDirty(this.form.controls.cover, {
            url: media.url,
            type: media.type,
            ...(media.thumbUrl ? { thumbUrl: media.thumbUrl } : {}),
            ...(media.key ? { key: media.key } : {}),
            ...(media.thumbKey ? { thumbKey: media.thumbKey } : {}),
          }),
        error: (error: unknown) => {
          if (error instanceof MediaUnconfiguredError) {
            this.toastError('სურათების ატვირთვა ამ გარემოში არ არის კონფიგურირებული');
          } else if (error instanceof MediaFileTooLargeError) {
            this.toastError('ფაილი ძალიან დიდია. მაქსიმალური ზომაა 10 MB.');
          } else {
            this.toastError('შეცდომა სურათის ატვირთვისას');
          }
        },
      });
  }

  /** Removal is saved as `cover: null` (the API then releases the media). */
  protected removeCover(): void {
    this.setDirty(this.form.controls.cover, null);
  }

  // ── FAQ ────────────────────────────────────────────────────────────────────

  protected addFaq(): void {
    if (this.faq.length >= ARTICLE_FAQ_MAX) return;
    this.faq.markAsDirty();
    this.faq.push(this.buildFaq());
  }

  protected removeFaq(index: number): void {
    this.faq.markAsDirty();
    this.faq.removeAt(index);
  }

  // ── related facilities ─────────────────────────────────────────────────────

  protected addRelated(select: HTMLSelectElement): void {
    const id = select.value;
    select.value = '';
    const ids = this.form.controls.relatedFacilities.value;
    if (!id || ids.includes(id) || ids.length >= ARTICLE_RELATED_FACILITIES_MAX) return;
    this.setDirty(this.form.controls.relatedFacilities, [...ids, id]);
  }

  protected removeRelated(id: string): void {
    this.setDirty(
      this.form.controls.relatedFacilities,
      this.form.controls.relatedFacilities.value.filter((x) => x !== id),
    );
  }

  protected facilityLabel(option: PartnerFacilityOption): string {
    return localizedName(option.facility) || option.id;
  }

  // ── save + status ──────────────────────────────────────────────────────────

  protected save(): void {
    if (this.isSaving()) return;
    if (this.form.invalid) {
      this.flagInvalid();
      return;
    }
    const creating = this.articleId() === null;
    this.isSaving.set(true);
    this.persist()
      .pipe(
        finalize(() => this.isSaving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () =>
          this.alerts
            .open(tr(creating ? 'შეიქმნა' : 'შეინახა'), { appearance: 'success' })
            .pipe(take(1))
            .subscribe(),
        complete: () => this.leaveCreateRoute(),
      });
  }

  /**
   * One lifecycle move: confirm (publish / archive) or pick the time
   * (schedule) → save if dirty → PATCH the status. A failed save stops the
   * flow before the status call.
   */
  protected changeStatus(target: ArticleStatus): void {
    if (this.isSaving() || !canTransition(this.status(), target)) return;
    if (this.needsSave() && this.form.invalid) {
      this.flagInvalid();
      return;
    }
    this.gate(target)
      .pipe(
        filter((gate): gate is { publishAt?: string } => gate !== null),
        switchMap((gate) => {
          this.isSaving.set(true);
          return this.persist().pipe(
            switchMap((saved) =>
              this.articleService.setStatus(saved._id, target, gate.publishAt).pipe(
                catchError((err: HttpErrorResponse) => {
                  this.onStatusError(err, target);
                  return EMPTY;
                }),
              ),
            ),
            finalize(() => this.isSaving.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (updated) => {
          this.article.set(updated);
          this.alerts
            .open(articleStatusSuccess(target), { appearance: 'success' })
            .pipe(take(1))
            .subscribe();
        },
        complete: () => this.leaveCreateRoute(),
      });
  }

  /** The pre-flight of a move: `null` = the operator backed out. */
  private gate(target: ArticleStatus): Observable<{ publishAt?: string } | null> {
    if (target === 'scheduled') {
      return this.dialogs
        .open<string>(ArticleScheduleDialogComponent, {
          label: tr('გამოქვეყნების დაგეგმვა'),
          size: 's',
          data: { publishAt: this.article()?.publishAt ?? null } as ArticleScheduleData,
        })
        .pipe(
          take(1),
          map((publishAt) => ({ publishAt })),
          defaultIfEmpty(null),
        );
    }
    const title = this.form.controls.title.value.trim() || this.article()?.title || '';
    const confirm =
      target === 'published' || target === 'archived' ? articleStatusConfirm(target, title) : null;
    if (!confirm) {
      return of({});
    }
    return this.dialogs
      .open<boolean>(SsConfirmComponent, { label: confirm.label, size: 's', data: confirm.data })
      .pipe(
        take(1),
        map((ok) => (ok ? {} : null)),
        defaultIfEmpty(null),
      );
  }

  private needsSave(): boolean {
    return this.articleId() === null || this.form.dirty;
  }

  /**
   * Saves when there is something to save and emits the stored article
   * (unchanged content emits the loaded one without a request). Errors are
   * toasted here and end the stream.
   */
  private persist(): Observable<Article> {
    const id = this.articleId();
    const current = this.article();
    if (id && current && !this.form.dirty) {
      return of(current);
    }
    if (this.form.invalid) {
      this.flagInvalid();
      return EMPTY;
    }
    const request = id
      ? this.articleService.updateArticle(id, this.buildUpdateDto())
      : this.articleService.createArticle(this.buildCreateDto());
    return request.pipe(
      tap((saved) => this.applySaved(saved, !id)),
      catchError((err: HttpErrorResponse) => {
        this.onSaveError(err);
        return EMPTY;
      }),
    );
  }

  private applySaved(saved: Article, created: boolean): void {
    this.article.set(saved);
    this.articleId.set(saved._id);
    if (created) {
      this.createdId = saved._id;
    }
    // The API derives the slug when it was left empty.
    if (saved.slug && saved.slug !== this.form.controls.slug.value) {
      this.form.controls.slug.setValue(saved.slug, { emitEvent: false });
    }
    this.form.markAsPristine();
    this.dirty.set(false);
  }

  /** After a create, the URL becomes `/articles/:id` (the editor reloads it). */
  private leaveCreateRoute(): void {
    const id = this.createdId;
    this.createdId = null;
    if (id && !this.destroyed) {
      this.router.navigate(['/articles', id], { replaceUrl: true });
    }
  }

  private onSaveError(err: HttpErrorResponse): void {
    if (err?.status === 409) {
      this.form.controls.slug.setErrors({ conflict: true });
      this.form.controls.slug.markAsTouched();
      this.toastError('ეს slug უკვე დაკავებულია');
      return;
    }
    this.toastError(
      err?.status === 400
        ? 'შეამოწმე ველები — მოთხოვნა ვერ დამუშავდა'
        : 'შენახვა ვერ მოხერხდა, სცადეთ თავიდან',
    );
  }

  private onStatusError(err: HttpErrorResponse, target: ArticleStatus): void {
    this.toastError(
      target === 'scheduled' && err?.status === 400
        ? 'დაგეგმვა ვერ მოხერხდა — აირჩიეთ მომავალი დრო'
        : 'სტატუსის შეცვლა ვერ მოხერხდა, სცადეთ თავიდან',
    );
  }

  /** Touches every field, jumps to the tab holding the error and toasts. */
  private flagInvalid(): void {
    this.form.markAllAsTouched();
    const invalid = (lang: ArticleLang) =>
      Object.values(LANG_FIELDS[lang]).some((name) => this.form.get(name)?.invalid);
    const here = this.activeLang();
    const there: ArticleLang = here === 'ka' ? 'en' : 'ka';
    if (!invalid(here) && invalid(there)) {
      this.activeLang.set(there);
    }
    this.toastError('გთხოვთ შეავსოთ ყველა სავალდებულო ველი');
  }

  /**
   * The full content with every empty optional as `null` — the EDIT body
   * as-is (null = unset server-side). Status and dates are not part of it.
   */
  private buildUpdateDto(): UpdateArticleDto {
    const v = this.form.getRawValue();
    const text = (value: string): string | null => value.trim() || null;
    const dto: UpdateArticleDto = {
      title: v.title.trim(),
      titleEn: text(v.titleEn),
      slug: text(v.slug),
      excerpt: text(v.excerpt),
      excerptEn: text(v.excerptEn),
      bodyHtml: v.bodyHtml,
      bodyHtmlEn: isArticleHtmlEmpty(v.bodyHtmlEn) ? null : v.bodyHtmlEn,
      cover: v.cover ?? null,
      category: v.category,
      tags: [...v.tags],
      faq: v.faq.map((f) => ({
        q: f.q.trim(),
        a: f.a.trim(),
        ...(f.qEn.trim() ? { qEn: f.qEn.trim() } : {}),
        ...(f.aEn.trim() ? { aEn: f.aEn.trim() } : {}),
      })),
      seoTitle: text(v.seoTitle),
      seoTitleEn: text(v.seoTitleEn),
      seoDescription: text(v.seoDescription),
      seoDescriptionEn: text(v.seoDescriptionEn),
      relatedFacilities: [...v.relatedFacilities],
    };
    // An existing article always has a slug — never ask the API to unset it.
    if (dto.slug === null) delete dto.slug;
    return dto;
  }

  /** CREATE: the same body with the empty optional keys left out. */
  private buildCreateDto(): CreateArticleDto {
    const full = this.buildUpdateDto();
    return Object.fromEntries(
      Object.entries(full).filter(([, value]) => value !== null && value !== undefined),
    ) as unknown as CreateArticleDto;
  }

  private setDirty<T>(control: FormControl<T>, value: T): void {
    // Dirty BEFORE the value, so the valueChanges listener sees a dirty form.
    control.markAsDirty();
    control.setValue(value);
  }

  private toastError(georgian: string): void {
    this.alerts.open(tr(georgian), { appearance: 'error' }).pipe(take(1)).subscribe();
  }

  // ── template helpers ───────────────────────────────────────────────────────

  protected ctrl(name: string): AbstractControl {
    return this.form.get(name) as AbstractControl;
  }

  /** Characters typed into a text control (for the live «N/70» counters). */
  protected lengthOf(name: string): number {
    return String(this.form.get(name)?.value ?? '').length;
  }

  /** A tab shows a red dot once one of its touched fields is invalid. */
  protected tabHasError(lang: ArticleLang): boolean {
    return Object.values(LANG_FIELDS[lang]).some((name) => {
      const control = this.form.get(name);
      return !!control && control.invalid && control.touched;
    });
  }

  protected statusLabel(status: ArticleStatus): string {
    return ARTICLE_STATUS_LABELS[status] ?? status;
  }

  protected statusClass(status: ArticleStatus): string {
    return ARTICLE_STATUS_CLASSES[status] ?? ARTICLE_STATUS_CLASSES.draft;
  }

  protected categoryLabel(category: ArticleCategory): string {
    return articleCategoryLabel(category);
  }

  protected actionLabel(target: ArticleStatus): string {
    return ARTICLE_ACTION_LABELS[target];
  }

  /** True once `control` was touched and fails `error` (or any error when omitted). */
  protected showError(control: AbstractControl | null, error?: string): boolean {
    if (!control || !control.touched) return false;
    return error ? control.hasError(error) : control.invalid;
  }
}
