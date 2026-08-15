import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  inject,
  input,
  linkedSignal,
} from '@angular/core';

const PREVIEW_SIZE = 220;
const GAP = 10;
const EDGE = 8;
const HOVER_DELAY_MS = 300;

/**
 * Circular user avatar in the ss-* kit's visual language: the profile picture
 * when the user has one (players set them in the player app — a builder SVG
 * or an uploaded photo), the initials circle otherwise. Replaces the static
 * `.ss-avatar` spans wherever a user row also carries `avatarUrl`.
 *
 * When a picture exists it can be enlarged from anywhere it is rendered:
 * hover-capable devices get a floating large preview after a HOVER_DELAY_MS
 * dwell — a pointer merely passing over never opens it, and clicks keep
 * their normal behavior (e.g. opening the customer row); touch devices open
 * the large photo in a centered overlay on tap instead of the row action. The
 * preview/overlay are appended to <body> (styles: .ss-ava-zoom-pop/-scrim in
 * sport-spot-theme.css) so ancestor overflow can never clip them.
 */
@Component({
  selector: 'ss-avatar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (url() && !broken()) {
      <img
        [src]="url()"
        alt=""
        loading="lazy"
        decoding="async"
        (error)="broken.set(true)"
      />
    } @else {
      <span aria-hidden="true">{{ initials() }}</span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
      width: var(--ss-ava-size, 36px);
      height: var(--ss-ava-size, 36px);
      border-radius: 50%;
      overflow: hidden;
      background: var(--accent-soft);
      color: var(--tui-text-action);
      border: 1px solid var(--accent-line);
      font-size: calc(var(--ss-ava-size, 36px) * 0.36);
      font-weight: 700;
      letter-spacing: 0.02em;
      user-select: none;
    }
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  `,
  host: {
    '[style.--ss-ava-size.px]': 'size()',
    '(mouseenter)': 'onEnter()',
    '(mouseleave)': 'onLeave()',
    '(click)': 'onClick($event)',
  },
})
export class SsAvatarComponent implements OnDestroy {
  readonly name = input<string | null | undefined>('');
  readonly url = input<string | null | undefined>(null);
  readonly size = input(36);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private hoverEl: HTMLElement | null = null;
  private overlayEl: HTMLElement | null = null;
  private hoverTimer: ReturnType<typeof setTimeout> | null = null;

  /** A failed image falls back to initials; a new url gets a fresh chance. */
  protected readonly broken = linkedSignal({
    source: this.url,
    computation: () => false,
  });

  /**
   * First letters of the first two words. Only Latin is uppercased —
   * uppercasing Georgian yields Mtavruli forms the admin app never uses.
   */
  protected readonly initials = computed(() => {
    const parts = (this.name() ?? '').trim().split(/\s+/).filter(Boolean);
    const raw = (parts[0]?.charAt(0) ?? '') + (parts[1]?.charAt(0) ?? '');
    return raw.replace(/[a-z]/g, (c) => c.toUpperCase()) || '•';
  });

  private zoomUrl(): string | null {
    const url = this.url();
    return url && !this.broken() ? url : null;
  }

  private canHover(): boolean {
    return typeof matchMedia !== 'undefined' && matchMedia('(hover: hover)').matches;
  }

  protected onEnter(): void {
    const url = this.zoomUrl();
    if (!url || !this.canHover() || this.hoverEl || this.hoverTimer !== null) {
      return;
    }
    this.hoverTimer = setTimeout(() => {
      this.hoverTimer = null;
      this.openPreview(url);
    }, HOVER_DELAY_MS);
  }

  private openPreview(url: string): void {
    const rect = this.host.nativeElement.getBoundingClientRect();
    const pop = document.createElement('div');
    pop.className = 'ss-ava-zoom-pop';
    const img = document.createElement('img');
    img.src = url;
    img.alt = '';
    pop.appendChild(img);

    // Prefer below the avatar, flip above when out of room; clamp to viewport.
    let left = rect.left + rect.width / 2 - PREVIEW_SIZE / 2;
    left = Math.max(EDGE, Math.min(left, window.innerWidth - PREVIEW_SIZE - EDGE));
    let top = rect.bottom + GAP;
    if (top + PREVIEW_SIZE > window.innerHeight - EDGE) {
      top = rect.top - GAP - PREVIEW_SIZE;
    }
    top = Math.max(EDGE, top);
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;

    document.body.appendChild(pop);
    this.hoverEl = pop;
  }

  protected onLeave(): void {
    if (this.hoverTimer !== null) {
      clearTimeout(this.hoverTimer);
      this.hoverTimer = null;
    }
    this.hoverEl?.remove();
    this.hoverEl = null;
  }

  protected onClick(event: Event): void {
    const url = this.zoomUrl();
    // Desktop clicks pass through untouched — hover already shows the photo.
    if (!url || this.canHover() || this.overlayEl) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    const scrim = document.createElement('div');
    scrim.className = 'ss-ava-zoom-scrim';
    const img = document.createElement('img');
    img.src = url;
    img.alt = '';
    scrim.appendChild(img);
    scrim.addEventListener('click', () => this.closeOverlay());
    document.body.appendChild(scrim);
    this.overlayEl = scrim;
  }

  private closeOverlay(): void {
    this.overlayEl?.remove();
    this.overlayEl = null;
  }

  ngOnDestroy(): void {
    this.onLeave();
    this.closeOverlay();
  }
}
