import {
  articleHtmlToText,
  countArticleWords,
  isArticleHtmlEmpty,
  normalizeImageUrl,
  normalizeLinkUrl,
  plainTextToArticleHtml,
  sanitizeArticleHtml,
  sanitizeArticleNode,
} from './article-html.util';

describe('article-html.util', () => {
  describe('sanitizeArticleHtml', () => {
    it('keeps the article vocabulary as-is', () => {
      const html =
        '<h2>სათაური</h2><h3>ქვე</h3><p>ა <strong>ბ</strong> <em>გ</em> <a href="/blog/x">დ</a><br>ე</p>' +
        '<ul><li>1</li><li>2<ol><li>2.1</li></ol></li></ul><blockquote><p>ციტატა</p></blockquote>' +
        '<p><img src="https://cdn.example/a.webp" alt="ა"></p>';
      expect(sanitizeArticleHtml(html)).toBe(html);
    });

    it('drops scripts, handlers, styles, classes and unknown attributes', () => {
      expect(
        sanitizeArticleHtml(
          '<p class="x" style="color:red" onclick="evil()">ა<script>alert(1)</script>' +
            '<iframe src="https://evil"></iframe><span data-x="1">ბ</span></p><style>p{}</style>',
        ),
      ).toBe('<p>აბ</p>');
    });

    it('rejects dangerous URLs but keeps the text', () => {
      expect(
        sanitizeArticleHtml(
          '<p><a href="javascript:alert(1)">ა</a> <img src="x" onerror="alert(1)">' +
            '<img src="data:image/png;base64,AAAA"></p>',
        ),
      ).toBe('<p>ა</p>');
    });

    it('normalizes browser / pasted markup: b→strong, i→em, div→p, h1→h2, h4→h3', () => {
      expect(
        sanitizeArticleHtml('<h1>ა</h1><h4>ბ</h4><div>გ <b>დ</b> <i>ე</i></div><div><br></div>'),
      ).toBe('<h2>ა</h2><h3>ბ</h3><p>გ <strong>დ</strong> <em>ე</em></p>');
    });

    it('unwraps the Google Docs wrapper and maps its styled spans', () => {
      expect(
        sanitizeArticleHtml(
          '<b style="font-weight:normal;" id="docs-internal-guid-1"><p dir="ltr">' +
            '<span style="font-weight:700;font-style:italic">ა</span><span> ბ</span></p></b>',
        ),
      ).toBe('<p><strong><em>ა</em></strong> ბ</p>');
    });

    it('wraps loose top-level text into paragraphs and splits on <br>', () => {
      expect(sanitizeArticleHtml('ერთი<br>ორი <strong>სამი</strong>')).toBe(
        '<p>ერთი</p><p>ორი <strong>სამი</strong></p>',
      );
    });

    it('flattens paragraphs inside list items and drops empty blocks', () => {
      expect(
        sanitizeArticleHtml('<ul><li><p>ა</p><p>ბ</p></li><li> </li></ul><p>&nbsp;</p><h2></h2>'),
      ).toBe('<ul><li>ა<br>ბ</li></ul>');
    });

    it('unwraps the list Chrome nests inside a paragraph', () => {
      const surface = document.createElement('div');
      surface.innerHTML = '<p>ა</p>';
      // what `insertUnorderedList` leaves in a contenteditable
      surface.querySelector('p')!.innerHTML = '<ul><li>ბ</li></ul>';
      expect(sanitizeArticleNode(surface)).toBe('<ul><li>ბ</li></ul>');
    });

    it('turns non-breaking spaces into plain spaces', () => {
      expect(sanitizeArticleHtml('<p>ა&nbsp;ბ</p>')).toBe('<p>ა ბ</p>');
    });

    it('returns an empty string for empty input', () => {
      expect(sanitizeArticleHtml('')).toBe('');
      expect(sanitizeArticleHtml(null)).toBe('');
      expect(sanitizeArticleHtml('<p><br></p>')).toBe('');
    });
  });

  describe('URLs', () => {
    it('accepts http(s), mailto, tel, site-relative paths and anchors', () => {
      expect(normalizeLinkUrl('https://sportspace.ge/blog')).toBe('https://sportspace.ge/blog');
      expect(normalizeLinkUrl('/padelis-kortebi/vake')).toBe('/padelis-kortebi/vake');
      expect(normalizeLinkUrl('mailto:info@sportspace.ge')).toBe('mailto:info@sportspace.ge');
      expect(normalizeLinkUrl('tel:+995555000000')).toBe('tel:+995555000000');
      expect(normalizeLinkUrl('#faq')).toBe('#faq');
    });

    it('adds https:// to a bare domain and rejects everything else', () => {
      expect(normalizeLinkUrl('sportspace.ge/blog')).toBe('https://sportspace.ge/blog');
      expect(normalizeLinkUrl('javascript:alert(1)')).toBeNull();
      expect(normalizeLinkUrl('data:text/html,x')).toBeNull();
      expect(normalizeLinkUrl('ftp://x.ge')).toBeNull();
      expect(normalizeLinkUrl('two words')).toBeNull();
      expect(normalizeLinkUrl('')).toBeNull();
    });

    it('images must be absolute http(s)', () => {
      expect(normalizeImageUrl('https://cdn.example/a.webp')).toBe('https://cdn.example/a.webp');
      expect(normalizeImageUrl('//cdn.example/a.webp')).toBe('https://cdn.example/a.webp');
      expect(normalizeImageUrl('/local.webp')).toBeNull();
      expect(normalizeImageUrl('data:image/png;base64,AAAA')).toBeNull();
    });
  });

  describe('text + counts', () => {
    it('extracts text with a space at every block boundary', () => {
      expect(articleHtmlToText('<h2>ა</h2><p>ბ<br>გ</p><ul><li>დ</li><li>ე</li></ul>')).toBe(
        'ა ბ გ დ ე',
      );
    });

    it('counts words, not punctuation', () => {
      expect(countArticleWords('<p>პადელი — სწრაფი, სახალისო თამაში!</p><p>2026 წელს</p>')).toBe(6);
      expect(countArticleWords('')).toBe(0);
      expect(countArticleWords(null)).toBe(0);
    });

    it('an image alone is content; empty markup is not', () => {
      expect(isArticleHtmlEmpty('<p><br></p>')).toBeTrue();
      expect(isArticleHtmlEmpty('   ')).toBeTrue();
      expect(isArticleHtmlEmpty('<p><img src="https://cdn.example/a.webp" alt=""></p>')).toBeFalse();
      expect(isArticleHtmlEmpty('<p>ა</p>')).toBeFalse();
    });
  });

  it('plainTextToArticleHtml: blank lines → paragraphs, newlines → <br>, escaped', () => {
    expect(plainTextToArticleHtml('ერთი\nორი\n\n<სამი> & ოთხი\r\n')).toBe(
      '<p>ერთი<br>ორი</p><p>&lt;სამი&gt; &amp; ოთხი</p>',
    );
  });
});
