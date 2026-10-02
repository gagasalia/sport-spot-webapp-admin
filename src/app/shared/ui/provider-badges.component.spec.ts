import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SsProviderBadgesComponent } from './provider-badges.component';
import { IdentityFields } from '../utils/external-login.util';

describe('SsProviderBadgesComponent', () => {
  let fixture: ComponentFixture<SsProviderBadgesComponent>;

  async function render(account: IdentityFields | null | undefined): Promise<HTMLElement> {
    await TestBed.configureTestingModule({ imports: [SsProviderBadgesComponent] }).compileComponents();
    fixture = TestBed.createComponent(SsProviderBadgesComponent);
    fixture.componentRef.setInput('account', account);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const chips = (host: HTMLElement) =>
    Array.from(host.querySelectorAll('.ss-badge')).map((c) => ({
      id: c.getAttribute('automation-id'),
      text: c.textContent!.trim(),
    }));

  it('a Facebook-only account renders one Facebook chip', async () => {
    const host = await render({ facebookLinked: true });
    expect(chips(host)).toEqual([{ id: 'facebook-badge', text: 'Facebook' }]);
    expect(host.classList).not.toContain('is-empty');
  });

  it('both providers render Google then Facebook', async () => {
    const host = await render({ googleLinked: true, facebookLinked: true });
    expect(chips(host)).toEqual([
      { id: 'google-badge', text: 'Google' },
      { id: 'facebook-badge', text: 'Facebook' },
    ]);
  });

  it('nothing linked → no chips and a collapsed host', async () => {
    const host = await render({ phone: '+995599000111' });
    expect(chips(host)).toEqual([]);
    expect(host.classList).toContain('is-empty');
    expect(getComputedStyle(host).display).toBe('none');
  });

  it('tolerates a missing account', async () => {
    const host = await render(undefined);
    expect(chips(host)).toEqual([]);
  });

  it('follows input changes', async () => {
    const host = await render({ googleLinked: true });
    expect(chips(host).map((c) => c.text)).toEqual(['Google']);
    fixture.componentRef.setInput('account', { googleLinked: true, facebookId: 'f' });
    fixture.detectChanges();
    expect(chips(host).map((c) => c.text)).toEqual(['Google', 'Facebook']);
  });
});
