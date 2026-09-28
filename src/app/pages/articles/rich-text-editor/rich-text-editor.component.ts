import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  Injector,
  OnInit,
  ViewChild,
  ViewEncapsulation,
  afterNextRender,
  forwardRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TPipe } from '../../../shared/i18n/t.pipe';
import {
  normalizeImageUrl,
  normalizeLinkUrl,
  plainTextToArticleHtml,
  sanitizeArticleHtml,
  sanitizeArticleNode,
} from '../../../shared/utils/article-html.util';

/** What the caret sits in — drives the toolbar's pressed states. */
export interface RichTextState {
  block: 'p' | 'h2' | 'h3';
  bold: boolean;
  italic: boolean;
  ul: boolean;
  ol: boolean;
  quote: boolean;
  link: boolean;
}

const IDLE: RichTextState = {
  block: 'p',
  bold: false,
  italic: false,
  ul: false,
  ol: false,
  quote: false,
  link: false,
};

type UrlMode = 'link' | 'image';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Article body editor — a `contenteditable` surface with a toolbar (H2/H3,
 * bold, italic, bullet/numbered list, blockquote, link, image-by-URL, clear
 * formatting), used as a reactive-forms control whose value is CLEAN HTML.
 *
 * Why not `@taiga-ui/editor`: the admin dropped Taiga for the in-house ss-kit
 * (no `@taiga-ui/*` dependency is declared any more), and the editor would
 * drag the whole Taiga core + TipTap back in for one field. The browser's own
 * editing commands cover this toolbar; what they leave in the DOM (`<b>`,
 * `<div>`, pasted Word/Docs styles) never reaches the form — every emitted
 * value is rebuilt by the article whitelist (`sanitizeArticleNode`), and
 * pastes are sanitized before they are inserted.
 */
@Component({
  selector: 'app-rich-text-editor',
  standalone: true,
  imports: [TPipe],
  templateUrl: './rich-text-editor.component.html',
  styleUrl: './rich-text-editor.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The surface's content is set outside Angular's template (innerHTML), so
  // emulated encapsulation could not reach it; every selector is `.rte`-scoped.
  encapsulation: ViewEncapsulation.None,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RichTextEditorComponent),
      multi: true,
    },
  ],
})
export class RichTextEditorComponent implements ControlValueAccessor, OnInit {
  readonly placeholder = input('');
  /** Content language — sets `lang` (and the Georgian font) on the surface. */
  readonly lang = input<'ka' | 'en'>('ka');
  /** Accessible name of the text surface. */
  readonly label = input('');
  readonly invalid = input(false);

  @ViewChild('surface', { static: true })
  private readonly surfaceRef?: ElementRef<HTMLDivElement>;
  @ViewChild('urlInput') private readonly urlInputRef?: ElementRef<HTMLInputElement>;

  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  protected readonly disabled = signal(false);
  protected readonly isEmpty = signal(true);
  protected readonly state = signal<RichTextState>(IDLE);
  protected readonly urlMode = signal<UrlMode | null>(null);
  protected readonly urlValue = signal('');
  protected readonly altValue = signal('');
  protected readonly urlError = signal(false);
  protected readonly editingLink = signal(false);

  /** The last value written or emitted — equal values are never re-emitted. */
  private value = '';
  /** The caret / selection inside the surface, kept while the URL bar has focus. */
  private savedRange: Range | null = null;
  private onChange: (html: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  ngOnInit(): void {
    this.render();
  }

  // ── ControlValueAccessor ─────────────────────────────────────────────────

  writeValue(value: string | null): void {
    this.value = sanitizeArticleHtml(value);
    this.isEmpty.set(!this.value);
    this.savedRange = null;
    this.render();
  }

  registerOnChange(fn: (html: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }

  // ── surface events ───────────────────────────────────────────────────────

  protected onFocus(): void {
    // Enter makes a <p> (not a <div>); bold / italic stay tags, not styles.
    this.command('defaultParagraphSeparator', 'p');
    this.command('styleWithCSS', 'false');
  }

  protected onInput(): void {
    this.wrapLooseLine();
    this.emit();
    this.refreshState();
  }

  protected onBlur(): void {
    this.onTouched();
  }

  /** Pasted markup is sanitized BEFORE it lands in the DOM. */
  protected onPaste(event: ClipboardEvent): void {
    const data = event.clipboardData;
    if (!data || this.disabled()) {
      return;
    }
    event.preventDefault();
    const html = data.getData('text/html');
    let clean = html
      ? sanitizeArticleHtml(html)
      : plainTextToArticleHtml(data.getData('text/plain'));
    if (!clean) {
      return;
    }
    // A single paragraph goes INTO the current one instead of splitting it.
    if (clean.startsWith('<p>') && clean.endsWith('</p>') && clean.indexOf('<p>', 1) === -1) {
      clean = clean.slice(3, -4);
    }
    this.exec('insertHTML', clean);
  }

  /** Dropped files would land as blobs — images come in by URL or as the cover. */
  protected onDrop(event: DragEvent): void {
    if (event.dataTransfer?.files?.length) {
      event.preventDefault();
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.openUrlBar('link');
    }
  }

  @HostListener('document:selectionchange')
  protected onSelectionChange(): void {
    const range = this.rangeInside();
    if (range) {
      this.savedRange = range.cloneRange();
      this.refreshState();
    }
  }

  // ── toolbar ──────────────────────────────────────────────────────────────

  /** Paragraph / H2 / H3 — pressing the active heading again turns it back into text. */
  protected setBlock(tag: 'p' | 'h2' | 'h3'): void {
    const current = this.state();
    if (current.ul) {
      this.exec('insertUnorderedList');
    } else if (current.ol) {
      this.exec('insertOrderedList');
    }
    const target = tag !== 'p' && this.state().block === tag ? 'p' : tag;
    this.exec('formatBlock', `<${target}>`);
  }

  protected toggleBold(): void {
    this.exec('bold');
  }

  protected toggleItalic(): void {
    this.exec('italic');
  }

  protected toggleList(kind: 'ul' | 'ol'): void {
    this.exec(kind === 'ul' ? 'insertUnorderedList' : 'insertOrderedList');
  }

  protected toggleQuote(): void {
    if (!this.state().quote) {
      this.exec('formatBlock', '<blockquote>');
      return;
    }
    this.exec('outdent');
    if (this.state().quote) {
      this.exec('formatBlock', '<p>');
    }
  }

  protected clearFormatting(): void {
    this.exec('removeFormat');
  }

  // ── link / image URL bar ─────────────────────────────────────────────────

  protected openUrlBar(mode: UrlMode): void {
    if (this.disabled()) {
      return;
    }
    // The URL input is about to take focus — pin the selection it applies to.
    const live = this.rangeInside();
    if (live) {
      this.savedRange = live.cloneRange();
    }
    const link = mode === 'link' ? this.linkAtSelection() : null;
    this.urlMode.set(mode);
    this.urlValue.set(link?.getAttribute('href') ?? '');
    this.altValue.set('');
    this.urlError.set(false);
    this.editingLink.set(!!link);
    afterNextRender(() => this.urlInputRef?.nativeElement.focus(), { injector: this.injector });
  }

  protected onUrlKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      // The editor sits inside the article <form> — Enter must not submit it.
      event.preventDefault();
      this.applyUrl();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.closeUrlBar();
    }
  }

  protected applyUrl(): void {
    if (this.urlMode() === 'image') {
      const src = normalizeImageUrl(this.urlValue());
      if (!src) {
        this.urlError.set(true);
        return;
      }
      const alt = this.altValue().trim();
      this.closeUrlBar(false);
      this.exec('insertHTML', `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}">`);
      return;
    }

    const href = normalizeLinkUrl(this.urlValue());
    if (!href) {
      this.urlError.set(true);
      return;
    }
    const existing = this.linkAtSelection();
    const target = this.rangeInside() ?? this.savedRange;
    const collapsed = !target || target.collapsed;
    this.closeUrlBar(false);
    if (existing) {
      existing.setAttribute('href', href);
      this.restoreSelection();
      this.emit();
      this.refreshState();
    } else if (collapsed) {
      this.exec('insertHTML', `<a href="${escapeHtml(href)}">${escapeHtml(href)}</a>`);
    } else {
      this.exec('createLink', href);
    }
  }

  protected removeLink(): void {
    const link = this.linkAtSelection();
    this.closeUrlBar(false);
    if (!link) {
      return;
    }
    // Select the whole link, so unlink removes all of it, not just the caret's word.
    const range = this.document.createRange();
    range.selectNodeContents(link);
    this.surface?.focus({ preventScroll: true });
    const selection = this.document.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    this.exec('unlink');
  }

  protected closeUrlBar(refocus = true): void {
    this.urlMode.set(null);
    this.urlError.set(false);
    if (refocus) {
      this.restoreSelection();
    }
  }

  // ── plumbing ─────────────────────────────────────────────────────────────

  private get surface(): HTMLDivElement | null {
    return this.surfaceRef?.nativeElement ?? null;
  }

  private render(): void {
    const surface = this.surface;
    if (surface && surface.innerHTML !== this.value) {
      surface.innerHTML = this.value;
    }
  }

  /** Emits the sanitized surface when it differs from the last known value. */
  private emit(): void {
    const surface = this.surface;
    if (!surface) {
      return;
    }
    const html = sanitizeArticleNode(surface);
    this.isEmpty.set(!html);
    if (html !== this.value) {
      this.value = html;
      this.onChange(html);
    }
  }

  /**
   * Typing into an empty surface (or after select-all + delete) puts the text
   * straight into the surface; make that line a real <p> right away, so it is
   * styled like the rest and block commands (H2, lists) act on it cleanly.
   */
  private wrapLooseLine(): void {
    const node = this.rangeInside()?.startContainer;
    if (node && node.nodeType === Node.TEXT_NODE && node.parentNode === this.surface) {
      this.command('formatBlock', '<p>');
    }
  }

  private exec(command: string, value?: string): void {
    if (this.disabled()) {
      return;
    }
    this.restoreSelection();
    this.command(command, value);
    this.emit();
    this.refreshState();
  }

  /**
   * The browser's editing commands (`document.execCommand`) — deprecated on
   * paper, yet still the only API that edits a contenteditable WITH native
   * undo/redo, and supported by every browser the panel targets.
   */
  private command(name: string, value?: string): boolean {
    try {
      return this.document.execCommand(name, false, value);
    } catch {
      return false;
    }
  }

  private rangeInside(): Range | null {
    const surface = this.surface;
    const selection = this.document.getSelection();
    if (!surface || !selection || selection.rangeCount === 0) {
      return null;
    }
    const range = selection.getRangeAt(0);
    return surface.contains(range.commonAncestorContainer) ? range : null;
  }

  /**
   * Focuses the surface with the right selection: the live one when it is
   * inside the surface (toolbar clicks keep it), else the one saved before
   * focus moved away (the URL bar), else the caret at the end.
   */
  private restoreSelection(): void {
    const surface = this.surface;
    const selection = this.document.getSelection();
    if (!surface || !selection) {
      return;
    }
    const live = this.rangeInside()?.cloneRange() ?? null;
    surface.focus({ preventScroll: true });
    const range =
      live ??
      (this.savedRange && surface.contains(this.savedRange.commonAncestorContainer)
        ? this.savedRange
        : null);
    if (range) {
      selection.removeAllRanges();
      selection.addRange(range);
      this.savedRange = range.cloneRange();
    } else {
      const end = this.document.createRange();
      end.selectNodeContents(surface);
      end.collapse(false);
      selection.removeAllRanges();
      selection.addRange(end);
    }
  }

  /** The closest `selector` match around the caret, inside the surface only. */
  private around(selector: string, range: Range | null = this.rangeInside()): Element | null {
    const surface = this.surface;
    if (!surface || !range) {
      return null;
    }
    const node = range.startContainer;
    const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
    const found = element?.closest(selector) ?? null;
    return found && found !== surface && surface.contains(found) ? found : null;
  }

  private linkAtSelection(): HTMLAnchorElement | null {
    return this.around('a[href]', this.rangeInside() ?? this.savedRange) as HTMLAnchorElement | null;
  }

  private refreshState(): void {
    const range = this.rangeInside();
    if (!range) {
      return;
    }
    const heading = this.around('h2, h3', range);
    const list = this.around('ul, ol', range);
    this.state.set({
      block: heading ? (heading.tagName.toLowerCase() as 'h2' | 'h3') : 'p',
      bold: !!this.around('b, strong', range),
      italic: !!this.around('i, em', range),
      ul: list?.tagName === 'UL',
      ol: list?.tagName === 'OL',
      quote: !!this.around('blockquote', range),
      link: !!this.around('a[href]', range),
    });
  }
}
