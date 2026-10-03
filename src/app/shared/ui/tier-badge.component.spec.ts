import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SsTierBadgeComponent } from './tier-badge.component';

describe('SsTierBadgeComponent (docs/25 §2.8)', () => {
  let fixture: ComponentFixture<SsTierBadgeComponent>;

  async function render(inputs: {
    tier?: number | null;
    stars?: number | null;
    calibrating?: boolean;
  }): Promise<HTMLElement> {
    await TestBed.configureTestingModule({ imports: [SsTierBadgeComponent] }).compileComponents();
    fixture = TestBed.createComponent(SsTierBadgeComponent);
    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value);
    }
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const stars = (host: HTMLElement) =>
    Array.from(host.querySelectorAll('[data-testid="tier-stars"] .tb-star'));

  it('every tier shows its own emblem with five stars under it', async () => {
    const host = await render({ tier: 1, stars: 2 });
    for (let tier = 1; tier <= 7; tier++) {
      fixture.componentRef.setInput('tier', tier);
      fixture.detectChanges();
      expect(host.querySelector('.tb-emblem')?.getAttribute('src')).toBe(
        `assets/ranking/tier-${tier}.svg`,
      );
      expect(stars(host).length).toBe(5);
    }
  });

  it('earned stars are solid, in the tier colour, under the emblem', async () => {
    const host = await render({ tier: 6, stars: 4 });
    expect(stars(host).filter((s) => s.classList.contains('is-on')).length).toBe(4);
    const row = host.querySelector<HTMLElement>('[data-testid="tier-stars"]')!;
    expect(row.style.getPropertyValue('--tb-star')).toBe('#e04a63');
    const emblem = host.querySelector('.tb-emblem')!.getBoundingClientRect();
    expect(row.getBoundingClientRect().top).toBeGreaterThanOrEqual(emblem.bottom);
    expect(host.querySelector('[data-testid="tier-name"]')?.textContent?.trim()).toBe('მასტერი');
  });

  it('calibrating: the neutral crest, no stars', async () => {
    const host = await render({ tier: null, stars: null, calibrating: true });
    expect(host.querySelector('.tb-emblem')?.getAttribute('src')).toBe(
      'assets/ranking/calibrating.svg',
    );
    expect(host.querySelector('[data-testid="tier-stars"]')).toBeNull();
    expect(host.querySelector('[data-testid="tier-name"]')?.textContent?.trim()).toBe('კალიბრაცია');
  });
});
