import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { RichTextEditorComponent } from './rich-text-editor.component';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RichTextEditorComponent],
  template: `<app-rich-text-editor [formControl]="body" placeholder="დაიწყეთ წერა…" />`,
})
class HostComponent {
  readonly body = new FormControl('', { nonNullable: true });
}

/**
 * These run the browser's real editing commands (ChromeHeadless), so they
 * check the HTML the form actually receives — not a mock of it.
 */
describe('RichTextEditorComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  const el = (): HTMLElement => fixture.nativeElement;
  const surface = (): HTMLElement => el().querySelector('[data-testid="rte-surface"]') as HTMLElement;
  const button = (id: string): HTMLButtonElement =>
    el().querySelector(`[data-testid="rte-${id}"]`) as HTMLButtonElement;

  /** Loads `html`, focuses the surface and selects `[start, end)` of the text node at `path`. */
  function load(html: string): void {
    host.body.setValue(html);
    fixture.detectChanges();
    surface().focus();
  }
  function select(node: Node, start: number, end = start): void {
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, end);
    const selection = document.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
  }
  const firstText = (selector: string): Text =>
    surface().querySelector(selector)!.firstChild as Text;

  it('renders a written value sanitized, without emitting or dirtying the control', () => {
    host.body.setValue(
      '<div>ერთი</div><script>alert(1)</script><p style="color:red" onclick="x()">ორი</p>',
    );
    fixture.detectChanges();

    expect(surface().innerHTML).toBe('<p>ერთი</p><p>ორი</p>');
    expect(host.body.value).toContain('<script>');
    expect(host.body.dirty).toBeFalse();
  });

  it('shows the placeholder only while empty', () => {
    expect(surface().classList).toContain('is-empty');
    expect(surface().getAttribute('data-placeholder')).toBe('დაიწყეთ წერა…');

    load('<p>ტექსტი</p>');
    expect(surface().classList).not.toContain('is-empty');
  });

  it('emits clean HTML on input and marks the control dirty', () => {
    surface().innerHTML =
      '<div>გამარჯობა <b>მსოფლიო</b> <span style="font-style:italic">დღეს</span></div>';
    surface().dispatchEvent(new Event('input'));

    expect(host.body.value).toBe('<p>გამარჯობა <strong>მსოფლიო</strong> <em>დღეს</em></p>');
    expect(host.body.dirty).toBeTrue();
  });

  it('a line typed straight into the empty surface becomes a paragraph', () => {
    surface().focus();
    const text = document.createTextNode('პირველი');
    surface().appendChild(text);
    select(text, 7);
    surface().dispatchEvent(new Event('input'));

    expect(surface().innerHTML).toBe('<p>პირველი</p>');
    expect(host.body.value).toBe('<p>პირველი</p>');
  });

  it('bold / italic wrap the selection in strong / em', () => {
    load('<p>პადელი სწრაფი თამაშია</p>');
    select(firstText('p'), 7, 13); // «სწრაფი»

    button('bold').click();
    expect(host.body.value).toBe('<p>პადელი <strong>სწრაფი</strong> თამაშია</p>');

    // the live DOM keeps Chrome's <b>; only the emitted value is normalized
    select(surface().querySelector('b, strong')!.firstChild!, 0, 6);
    button('italic').click();
    expect(host.body.value).toContain('<em>სწრაფი</em>');
  });

  it('H2 / H3 turn the current block into a heading and back', () => {
    load('<p>სათაური</p><p>ტექსტი</p>');
    select(firstText('p'), 2);

    button('h2').click();
    expect(host.body.value).toBe('<h2>სათაური</h2><p>ტექსტი</p>');
    fixture.detectChanges();
    expect(button('h2').classList).toContain('is-active');

    select(firstText('h2'), 2);
    button('h2').click();
    expect(host.body.value).toBe('<p>სათაური</p><p>ტექსტი</p>');

    select(firstText('p'), 2);
    button('h3').click();
    expect(host.body.value).toBe('<h3>სათაური</h3><p>ტექსტი</p>');
  });

  it('bullet and numbered lists', () => {
    load('<p>პირველი</p>');
    select(firstText('p'), 1);

    button('ul').click();
    expect(host.body.value).toBe('<ul><li>პირველი</li></ul>');

    select(firstText('li'), 1);
    button('ol').click();
    expect(host.body.value).toBe('<ol><li>პირველი</li></ol>');
  });

  it('blockquote toggles on and off', () => {
    load('<p>ციტატა</p>');
    select(firstText('p'), 1);

    button('quote').click();
    expect(host.body.value).toBe('<blockquote><p>ციტატა</p></blockquote>');

    const quoted = surface().querySelector('blockquote')!;
    const text = (quoted.querySelector('p') ?? quoted).firstChild as Text;
    select(text, 1);
    button('quote').click();
    expect(host.body.value).toBe('<p>ციტატა</p>');
  });

  it('links the selected text through the URL bar; an internal /path is allowed', () => {
    load('<p>იხილეთ ვაკის კორტები</p>');
    select(firstText('p'), 7, 20); // «ვაკის კორტები»

    button('link').click();
    fixture.detectChanges();
    const url = el().querySelector('[data-testid="rte-url"]') as HTMLInputElement;
    expect(url).not.toBeNull();

    url.value = 'javascript:alert(1)';
    url.dispatchEvent(new Event('input'));
    button('url-apply').click();
    fixture.detectChanges();
    expect(el().querySelector('[data-testid="rte-url-error"]')).not.toBeNull();
    expect(host.body.value).not.toContain('<a');

    url.value = '/padelis-kortebi/vake';
    url.dispatchEvent(new Event('input'));
    button('url-apply').click();
    fixture.detectChanges();

    expect(host.body.value).toBe(
      '<p>იხილეთ <a href="/padelis-kortebi/vake">ვაკის კორტები</a></p>',
    );
    expect(el().querySelector('[data-testid="rte-urlbar"]')).toBeNull();
  });

  it('edits and removes an existing link', () => {
    load('<p>იხილეთ <a href="https://a.ge">ბმული</a></p>');
    select(firstText('a'), 2);

    button('link').click();
    fixture.detectChanges();
    const url = el().querySelector('[data-testid="rte-url"]') as HTMLInputElement;
    expect(url.value).toBe('https://a.ge');

    (el().querySelector('[data-testid="rte-unlink"]') as HTMLButtonElement).click();
    expect(host.body.value).toBe('<p>იხილეთ ბმული</p>');
  });

  it('inserts an image by URL with its alt text', () => {
    load('<p>ტექსტი</p>');
    select(firstText('p'), 6);

    button('image').click();
    fixture.detectChanges();
    const url = el().querySelector('[data-testid="rte-url"]') as HTMLInputElement;
    const alt = el().querySelector('[data-testid="rte-alt"]') as HTMLInputElement;
    url.value = 'https://cdn.example/court.webp';
    url.dispatchEvent(new Event('input'));
    alt.value = 'კორტი ვაკეში';
    alt.dispatchEvent(new Event('input'));
    button('url-apply').click();

    expect(host.body.value).toContain(
      '<img src="https://cdn.example/court.webp" alt="კორტი ვაკეში">',
    );
  });

  it('Enter in the URL bar applies instead of submitting the surrounding form', () => {
    load('<p>ტექსტი</p>');
    select(firstText('p'), 0, 6);
    button('link').click();
    fixture.detectChanges();
    const url = el().querySelector('[data-testid="rte-url"]') as HTMLInputElement;
    url.value = 'sportspace.ge';
    url.dispatchEvent(new Event('input'));

    const enter = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    url.dispatchEvent(enter);

    expect(enter.defaultPrevented).toBeTrue();
    expect(host.body.value).toBe('<p><a href="https://sportspace.ge">ტექსტი</a></p>');
  });

  it('sanitizes pasted HTML before it lands in the document', () => {
    load('<p>ა</p>');
    select(firstText('p'), 1);
    const data = new DataTransfer();
    data.setData(
      'text/html',
      '<meta charset="utf-8"><b style="font-weight:normal" id="docs-internal-guid-1">' +
        '<p style="margin:0"><span style="font-weight:700">მუქი</span> ტექსტი</p>' +
        '<p><img src="x" onerror="alert(1)"><iframe src="https://evil"></iframe>ბოლო</p></b>',
    );
    const paste = new ClipboardEvent('paste', {
      clipboardData: data,
      cancelable: true,
      bubbles: true,
    });
    surface().dispatchEvent(paste);

    expect(paste.defaultPrevented).toBeTrue();
    expect(surface().innerHTML).not.toContain('onerror');
    expect(surface().innerHTML).not.toContain('iframe');
    expect(host.body.value).toContain('<strong>მუქი</strong> ტექსტი');
    expect(host.body.value).toContain('ბოლო');
    expect(host.body.value).not.toContain('style=');
  });

  it('stops editing while the control is disabled', () => {
    host.body.disable();
    fixture.detectChanges();
    expect(surface().getAttribute('contenteditable')).toBe('false');
    expect(button('bold').disabled).toBeTrue();
  });
});
