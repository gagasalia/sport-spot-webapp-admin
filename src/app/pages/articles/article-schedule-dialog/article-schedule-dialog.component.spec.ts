import { ComponentFixture, TestBed } from '@angular/core/testing';

import {
  ArticleScheduleDialogComponent,
  isoToLocalParts,
  localDateTime,
  localDateTimeToIso,
} from './article-schedule-dialog.component';
import { SS_DIALOG_CONTEXT, SsDialogContext } from '../../../shared/ui/dialog.service';

const pad = (n: number) => String(n).padStart(2, '0');
/** A local wall-clock time `days` from now, as the dialog's input values. */
function localParts(days: number, hour: number, minute = 0): { date: string; time: string } {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(hour)}:${pad(minute)}`,
  };
}

describe('article schedule time conversion', () => {
  it('reads the inputs as LOCAL wall-clock time and sends the UTC instant', () => {
    // Built from parts, so the expectation holds in any test-runner time zone.
    expect(localDateTimeToIso('2026-10-01', '10:30')).toBe(
      new Date(2026, 9, 1, 10, 30).toISOString(),
    );
    expect(localDateTimeToIso('2026-10-01', '10:30')).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/);
  });

  it('rejects malformed and non-existent values', () => {
    expect(localDateTime('2026-02-31', '10:00')).toBeNull();
    expect(localDateTime('2026-10-01', '24:00')).toBeNull();
    expect(localDateTime('', '10:00')).toBeNull();
    expect(localDateTime('2026-10-01', '')).toBeNull();
  });

  it('round-trips an ISO instant through the local inputs', () => {
    const iso = new Date(2026, 9, 1, 7, 5).toISOString();
    expect(isoToLocalParts(iso)).toEqual({ date: '2026-10-01', time: '07:05' });
    expect(isoToLocalParts('nope')).toBeNull();
    expect(isoToLocalParts(null)).toBeNull();
  });
});

describe('ArticleScheduleDialogComponent', () => {
  let fixture: ComponentFixture<ArticleScheduleDialogComponent>;
  let component: ArticleScheduleDialogComponent;
  let context: jasmine.SpyObj<SsDialogContext<string, unknown>>;

  async function setup(publishAt?: string | null) {
    context = jasmine.createSpyObj<SsDialogContext<string, unknown>>(
      'SsDialogContext',
      ['completeWith', 'dismiss'],
      { data: { publishAt } },
    );
    await TestBed.configureTestingModule({
      imports: [ArticleScheduleDialogComponent],
      providers: [{ provide: SS_DIALOG_CONTEXT, useValue: context }],
    }).compileComponents();
    fixture = TestBed.createComponent(ArticleScheduleDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  const el = (): HTMLElement => fixture.nativeElement;
  const submit = () => {
    (el().querySelector('[data-testid="schedule-submit"]') as HTMLButtonElement).click();
    fixture.detectChanges();
  };

  it('defaults to tomorrow at 18:00 local time', async () => {
    await setup();
    expect(component.form.getRawValue()).toEqual(localParts(1, 18));
    expect(el().querySelector('[data-testid="schedule-preview"]')!.textContent).toContain('18:00');
  });

  it('starts from the current publishAt when it is still ahead', async () => {
    const ahead = localParts(3, 18, 45);
    const iso = localDateTimeToIso(ahead.date, ahead.time)!;
    await setup(iso);
    expect(component.form.getRawValue()).toEqual(ahead);
  });

  it('completes with the ISO UTC instant of the picked local time', async () => {
    await setup();
    const pick = localParts(2, 9, 15);
    component.form.setValue(pick);
    fixture.detectChanges();

    submit();

    expect(context.completeWith).toHaveBeenCalledOnceWith(
      localDateTimeToIso(pick.date, pick.time)!,
    );
    const sent = context.completeWith.calls.mostRecent().args[0];
    expect(sent.endsWith('Z')).toBeTrue();
    // echoing the value back gives the same local wall-clock time
    expect(isoToLocalParts(sent)).toEqual(pick);
  });

  it('refuses a time in the past', async () => {
    await setup();
    component.form.setValue(localParts(-1, 10));
    submit();

    expect(context.completeWith).not.toHaveBeenCalled();
    expect(el().querySelector('[data-testid="schedule-error"]')!.textContent).toContain(
      'აირჩიეთ მომავალი დრო',
    );
  });

  it('refuses an empty time', async () => {
    await setup();
    component.form.setValue({ date: localParts(1, 10).date, time: '' });
    submit();
    expect(context.completeWith).not.toHaveBeenCalled();
    expect(el().querySelector('[data-testid="schedule-error"]')).not.toBeNull();
  });

  it('cancel dismisses without a value', async () => {
    await setup();
    (el().querySelector('.ss-btn--flat') as HTMLButtonElement).click();
    expect(context.dismiss).toHaveBeenCalled();
    expect(context.completeWith).not.toHaveBeenCalled();
  });
});
