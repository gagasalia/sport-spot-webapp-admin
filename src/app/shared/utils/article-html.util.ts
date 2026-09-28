/**
 * The article body vocabulary (docs/26 §WP-3) and its whitelist sanitizer.
 *
 * The admin rich-text editor is a plain `contenteditable`, so what the browser
 * leaves in the DOM (`<b>`, `<div>`, inline styles, pasted Word/Google Docs
 * markup …) is never stored as-is: every value that leaves the editor, and
 * every stored value that enters it, is rebuilt from scratch with only
 *
 *   blocks  `p` `h2` `h3` `ul` `ol` `li` `blockquote`
 *   inline  `strong` `em` `a[href]` `img[src|alt]` `br`
 *
 * No attribute other than `href`, `src` and `alt` survives; links must be
 * http(s), mailto:, tel: or site-relative (`/padelis-kortebi/vake`) and
 * images http(s) — so the player app can render the HTML without a second
 * sanitizing pass breaking anything. Parsing goes through `DOMParser`, whose
 * documents are inert (no script runs, no image loads).
 */

const BLOCK_SELECTOR =
  'p,div,h1,h2,h3,h4,h5,h6,ul,ol,li,blockquote,table,section,article,header,footer,main,aside,nav,figure,pre,dl';

/** Elements dropped together with everything inside them. */
const DROPPED = new Set([
  'SCRIPT',
  'STYLE',
  'IFRAME',
  'FRAME',
  'OBJECT',
  'EMBED',
  'NOSCRIPT',
  'TEMPLATE',
  'SVG',
  'MATH',
  'HEAD',
  'TITLE',
  'META',
  'LINK',
  'BUTTON',
  'INPUT',
  'SELECT',
  'OPTION',
  'TEXTAREA',
  'FORM',
  'CANVAS',
  'VIDEO',
  'AUDIO',
  'SOURCE',
  'PICTURE',
  'HR',
]);

/** Block wrappers that carry no meaning of their own — only their content is kept. */
const CONTAINERS = new Set([
  'BODY',
  'HTML',
  'DIV',
  'SECTION',
  'ARTICLE',
  'HEADER',
  'FOOTER',
  'MAIN',
  'ASIDE',
  'NAV',
  'FIGURE',
  'FIGCAPTION',
  'TABLE',
  'THEAD',
  'TBODY',
  'TFOOT',
  'TR',
  'TD',
  'TH',
  'CAPTION',
  'PRE',
  'ADDRESS',
  'CENTER',
  'DL',
  'DT',
  'DD',
  'DETAILS',
  'SUMMARY',
  'HGROUP',
]);

/** Formatting already applied by an ancestor — a nested duplicate is dropped. */
interface InlineContext {
  bold: boolean;
  italic: boolean;
  link: boolean;
}

const PLAIN: InlineContext = { bold: false, italic: false, link: false };

let outputDoc: Document | null = null;

/** A detached document the clean tree is built in (never rendered). */
function doc(): Document {
  return (outputDoc ??= document.implementation.createHTMLDocument(''));
}

function parse(html: string): HTMLElement {
  return new DOMParser().parseFromString(html, 'text/html').body;
}

/** Rebuilds a stored / pasted HTML string with the article whitelist. */
export function sanitizeArticleHtml(html: string | null | undefined): string {
  if (!html || !html.trim()) {
    return '';
  }
  return sanitizeArticleNode(parse(html));
}

/**
 * Serializes the children of `root` (e.g. the live editor surface) with the
 * article whitelist. `root` itself is only read, never modified.
 */
export function sanitizeArticleNode(root: Node): string {
  const out = doc().createElement('div');
  appendBlocks(root, out, false);
  return out.innerHTML;
}

function tagOf(node: Element): string {
  return node.tagName.toUpperCase();
}

function isElement(node: Node): node is Element {
  return node.nodeType === Node.ELEMENT_NODE;
}

function isText(node: Node): boolean {
  return node.nodeType === Node.TEXT_NODE;
}

function appendBlocks(src: Node, dest: Element, inQuote: boolean): void {
  let para: HTMLElement | null = null;
  const flush = (): void => {
    if (para) {
      finishBlock(para, dest);
      para = null;
    }
  };
  const openPara = (): HTMLElement => (para ??= doc().createElement('p'));

  for (const child of Array.from(src.childNodes)) {
    if (isText(child)) {
      if ((child.textContent ?? '').trim() || para) {
        appendInline(child, openPara(), PLAIN);
      }
      continue;
    }
    if (!isElement(child)) {
      continue;
    }
    const tag = tagOf(child);
    if (DROPPED.has(tag)) {
      continue;
    }
    if (tag === 'BR') {
      // A line break between top-level inline runs starts a new paragraph.
      flush();
      continue;
    }
    const heading = /^H[1-6]$/.test(tag);
    if (heading || tag === 'P' || tag === 'LI') {
      flush();
      if (child.querySelector(BLOCK_SELECTOR)) {
        // Chrome's list command nests the list in the paragraph
        // (`<p><ul>…</ul></p>`) — such a block is only a wrapper.
        appendBlocks(child, dest, inQuote);
      } else {
        const level = !heading || inQuote ? 'p' : tag === 'H1' || tag === 'H2' ? 'h2' : 'h3';
        finishBlock(inlineBlock(child, level), dest);
      }
      continue;
    }
    if (tag === 'BLOCKQUOTE') {
      flush();
      if (inQuote) {
        appendBlocks(child, dest, true);
      } else {
        const quote = doc().createElement('blockquote');
        appendBlocks(child, quote, true);
        if (quote.childNodes.length) {
          dest.appendChild(quote);
        }
      }
      continue;
    }
    if (tag === 'UL' || tag === 'OL') {
      flush();
      const list = buildList(child);
      if (list) {
        dest.appendChild(list);
      }
      continue;
    }
    if (CONTAINERS.has(tag) || child.querySelector(BLOCK_SELECTOR)) {
      // A wrapper (or an inline element holding blocks, like Google Docs'
      // `<b id="docs-internal-guid-…">`) contributes its content only.
      flush();
      appendBlocks(child, dest, inQuote);
      continue;
    }
    appendInline(child, openPara(), PLAIN);
  }
  flush();
}

function inlineBlock(src: Element, tag: 'p' | 'h2' | 'h3'): HTMLElement {
  const block = doc().createElement(tag);
  appendInlineChildren(src, block, PLAIN);
  return block;
}

function buildList(src: Element): HTMLElement | null {
  const list = doc().createElement(tagOf(src) === 'OL' ? 'ol' : 'ul');
  let loose: HTMLElement | null = null;
  for (const child of Array.from(src.childNodes)) {
    if (isElement(child) && tagOf(child) === 'LI') {
      loose = null;
      const item = doc().createElement('li');
      appendListItem(child, item);
      trimTrailingBreaks(item);
      if (hasContent(item)) {
        list.appendChild(item);
      }
      continue;
    }
    if (isElement(child) && (tagOf(child) === 'UL' || tagOf(child) === 'OL')) {
      // A list nested directly in a list (execCommand's indent) belongs to
      // the previous item.
      const nested = buildList(child);
      if (nested) {
        const host = list.lastElementChild ?? list.appendChild(doc().createElement('li'));
        host.appendChild(nested);
      }
      continue;
    }
    if (isText(child) && !(child.textContent ?? '').trim()) {
      continue;
    }
    if (!loose) {
      loose = doc().createElement('li');
      list.appendChild(loose);
    }
    appendInline(child, loose, PLAIN);
  }
  for (const item of Array.from(list.children)) {
    if (!hasContent(item)) {
      item.remove();
    }
  }
  return list.children.length ? list : null;
}

function appendListItem(src: Element, item: HTMLElement): void {
  for (const child of Array.from(src.childNodes)) {
    if (isElement(child) && (tagOf(child) === 'UL' || tagOf(child) === 'OL')) {
      const nested = buildList(child);
      if (nested) {
        item.appendChild(nested);
      }
      continue;
    }
    appendInline(child, item, PLAIN);
  }
}

function appendInlineChildren(src: Node, dest: Element, ctx: InlineContext): void {
  for (const child of Array.from(src.childNodes)) {
    appendInline(child, dest, ctx);
  }
}

function appendInline(node: Node, dest: Element, ctx: InlineContext): void {
  if (isText(node)) {
    const text = (node.textContent ?? '').replace(/\u00a0/g, ' ');
    if (text) {
      dest.appendChild(doc().createTextNode(text));
    }
    return;
  }
  if (!isElement(node)) {
    return;
  }
  const tag = tagOf(node);
  if (DROPPED.has(tag)) {
    return;
  }
  if (tag === 'BR') {
    if (dest.childNodes.length) {
      dest.appendChild(doc().createElement('br'));
    }
    return;
  }
  if (tag === 'IMG') {
    const src = normalizeImageUrl(node.getAttribute('src'));
    if (src) {
      const img = doc().createElement('img');
      img.setAttribute('src', src);
      img.setAttribute('alt', (node.getAttribute('alt') ?? '').trim());
      dest.appendChild(img);
    }
    return;
  }
  if (tag === 'A') {
    const href = ctx.link ? null : normalizeLinkUrl(node.getAttribute('href'));
    if (!href) {
      appendInlineChildren(node, dest, ctx);
      return;
    }
    const link = doc().createElement('a');
    link.setAttribute('href', href);
    appendInlineChildren(node, link, { ...ctx, link: true });
    appendWrapper(link, dest);
    return;
  }
  if (node.matches(BLOCK_SELECTOR)) {
    // A block inside inline content (`<li><p>…</p><p>…</p></li>`) keeps its
    // text on a new line.
    const last = dest.lastChild;
    if (last && !(isElement(last) && tagOf(last) === 'BR')) {
      dest.appendChild(doc().createElement('br'));
    }
    appendInlineChildren(node, dest, ctx);
    return;
  }

  const style = (node.getAttribute('style') ?? '').toLowerCase();
  // Google Docs wraps everything in `<b style="font-weight:normal">` and
  // marks real bold / italic with inline styles on spans.
  const bold =
    tag === 'STRONG' ||
    (tag === 'B' && !/font-weight\s*:\s*(normal|[1-4]00)/.test(style)) ||
    /font-weight\s*:\s*(bold|[6-9]00)/.test(style);
  const italic =
    tag === 'EM' ||
    (tag === 'I' && !/font-style\s*:\s*normal/.test(style)) ||
    /font-style\s*:\s*italic/.test(style);

  let target = dest;
  let inner = ctx;
  let em: HTMLElement | null = null;
  let strong: HTMLElement | null = null;
  if (bold && !ctx.bold) {
    strong = doc().createElement('strong');
    target = strong;
    inner = { ...inner, bold: true };
  }
  if (italic && !ctx.italic) {
    em = doc().createElement('em');
    strong?.appendChild(em);
    target = em;
    inner = { ...inner, italic: true };
  }
  appendInlineChildren(node, target, inner);
  if (strong) {
    if (em && !hasContent(em)) {
      em.replaceWith(...(em.textContent ? [doc().createTextNode(' ')] : []));
    }
    appendWrapper(strong, dest);
  } else if (em) {
    appendWrapper(em, dest);
  }
}

/** Keeps a formatting wrapper only when it wraps something visible. */
function appendWrapper(wrapper: HTMLElement, dest: Element): void {
  if (hasContent(wrapper)) {
    dest.appendChild(wrapper);
    return;
  }
  // `a<strong> </strong>b` must not glue the words together.
  if (wrapper.textContent) {
    dest.appendChild(doc().createTextNode(' '));
  }
}

function finishBlock(block: HTMLElement, dest: Element): void {
  trimTrailingBreaks(block);
  if (hasContent(block)) {
    dest.appendChild(block);
  }
}

function trimTrailingBreaks(block: Element): void {
  let last = block.lastChild;
  while (
    last &&
    ((isElement(last) && tagOf(last) === 'BR') ||
      (isText(last) && !(last.textContent ?? '').trim()))
  ) {
    last.remove();
    last = block.lastChild;
  }
}

function hasContent(el: Element): boolean {
  return !!(el.textContent ?? '').trim() || !!el.querySelector('img');
}

// ── URLs ────────────────────────────────────────────────────────────────────

/**
 * A link target the article may carry, or null: http(s), mailto:, tel:,
 * site-relative paths (`/padelis-kortebi/vake` — the internal links docs/26
 * asks every post for) and in-page anchors. A bare domain gains `https://`.
 */
export function normalizeLinkUrl(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim();
  if (!value || /\s/.test(value)) {
    return null;
  }
  if (/^\/\/[^/]/.test(value)) {
    return `https:${value}`;
  }
  if (/^https?:\/\/[^/]/i.test(value)) {
    return value;
  }
  if (/^mailto:[^@]+@[^@]+$/i.test(value) || /^tel:\+?[\d()-]+$/i.test(value)) {
    return value;
  }
  if (/^\/(?!\/)/.test(value) || /^#[\w-]+$/.test(value)) {
    return value;
  }
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?([/?#].*)?$/i.test(value)) {
    return `https://${value}`;
  }
  return null;
}

/** An image source the article may carry (absolute http/https), or null. */
export function normalizeImageUrl(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim();
  if (!value || /\s/.test(value)) {
    return null;
  }
  if (/^\/\/[^/]/.test(value)) {
    return `https:${value}`;
  }
  return /^https?:\/\/[^/]/i.test(value) ? value : null;
}

// ── text + counts ───────────────────────────────────────────────────────────

/** Plain text of an HTML body, with a space at every block / line boundary. */
export function articleHtmlToText(html: string | null | undefined): string {
  if (!html) {
    return '';
  }
  const spaced = html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|h[1-6]|li|blockquote|div|ul|ol)>/gi, '$& ');
  return (parse(spaced).textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** Words a reader would count: whitespace-separated runs holding a letter or digit. */
export function countArticleWords(html: string | null | undefined): number {
  const text = articleHtmlToText(html);
  if (!text) {
    return 0;
  }
  return text.split(' ').filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

/** True when the body has neither text nor an image. */
export function isArticleHtmlEmpty(html: string | null | undefined): boolean {
  if (!html || !html.trim()) {
    return true;
  }
  return !articleHtmlToText(html) && !/<img\b/i.test(html);
}

/** Plain pasted text → paragraphs (blank lines) with line breaks (single newlines). */
export function plainTextToArticleHtml(text: string | null | undefined): string {
  const escape = (s: string): string =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return (text ?? '')
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${block.split('\n').map(escape).join('<br>')}</p>`)
    .join('');
}
