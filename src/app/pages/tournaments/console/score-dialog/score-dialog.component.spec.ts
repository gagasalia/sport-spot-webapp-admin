import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';

import { ScoreDialogComponent, ScoreDialogData } from './score-dialog.component';
import { TournamentEngineService } from '../../../../services/http-services/tournament-engine.service';
import { switchLang } from '../../../../shared/i18n/lang';
import { DrawView, MatchView } from '../../../../shared/models/tournament-engine.model';
import { SS_DIALOG_CONTEXT, SsDialogService } from '../../../../shared/ui/dialog.service';

const view = { status: 'published' } as DrawView;

function match(patch: Partial<MatchView> = {}): MatchView {
  return {
    id: 'm1',
    stage: 'knockout',
    round: 1,
    order: 0,
    sides: [{ entrants: ['a'] }, { entrants: ['b'] }],
    status: 'ready',
    rated: false,
    ...patch,
  };
}

/** docs/33 §7: big cells, focus jumps on, inline server errors. */
describe('ScoreDialogComponent', () => {
  let fixture: ComponentFixture<ScoreDialogComponent>;
  let engine: jasmine.SpyObj<TournamentEngineService>;
  let completeWith: jasmine.Spy;
  let dialogs: { open: jasmine.Spy };

  async function setup(data: Partial<ScoreDialogData> = {}) {
    switchLang('ka');
    engine = jasmine.createSpyObj<TournamentEngineService>('TournamentEngineService', [
      'setResult',
      'clearResult',
    ]);
    engine.setResult.and.returnValue(of(view));
    engine.clearResult.and.returnValue(of(view));
    completeWith = jasmine.createSpy('completeWith');
    dialogs = { open: jasmine.createSpy('open').and.returnValue(of(true)) };
    const full: ScoreDialogData = {
      tournamentId: 't1',
      match: match(),
      scoring: { type: 'sets', bestOf: 3, superTiebreak: true },
      knockout: true,
      names: ['ნინო / ლუკა', 'ანა / გიო'],
      label: '1/4',
      ...data,
    };
    await TestBed.configureTestingModule({
      imports: [ScoreDialogComponent],
      providers: [
        { provide: SS_DIALOG_CONTEXT, useValue: { data: full, completeWith, dismiss: jasmine.createSpy('dismiss') } },
        { provide: TournamentEngineService, useValue: engine },
        { provide: SsDialogService, useValue: dialogs },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ScoreDialogComponent);
    fixture.detectChanges();
    document.body.appendChild(fixture.nativeElement);
  }

  afterEach(() => fixture?.nativeElement.remove());

  const el = (): HTMLElement => fixture.nativeElement;
  const cell = (i: number) => el().querySelector(`[data-cell="${i}"]`) as HTMLInputElement;
  const type = (input: HTMLInputElement, value: string) => {
    input.focus();
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const q = (id: string) => el().querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

  it('shows one cell per possible set and jumps on as each number completes', async () => {
    await setup();
    expect(el().querySelectorAll('[data-cell]').length).toBe(6);
    type(cell(0), '6');
    expect(document.activeElement).toBe(cell(1));
    type(cell(1), '4');
    expect(document.activeElement).toBe(cell(2));
  });

  it('in the super-tiebreak column a lone "1" waits for the second digit', async () => {
    await setup();
    type(cell(4), '1');
    expect(document.activeElement).toBe(cell(4));
    type(cell(4), '10');
    expect(document.activeElement).toBe(cell(5));
  });

  it('saves { sets } and completes with the fresh draw view', async () => {
    await setup();
    for (const [i, v] of [[0, '6'], [1, '4'], [2, '6'], [3, '3']] as const) type(cell(i), v);
    (q('score-save') as HTMLButtonElement).click();
    expect(engine.setResult).toHaveBeenCalledWith('t1', 'm1', { sets: [[6, 4], [6, 3]] });
    expect(completeWith).toHaveBeenCalledWith(view);
  });

  it('never sends an invalid score; the problem shows inline', async () => {
    await setup();
    type(cell(0), '6');
    type(cell(1), '4');
    (q('score-save') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(engine.setResult).not.toHaveBeenCalled();
    expect(q('score-errors')?.textContent).toContain('გამარჯვებულს ორი მოგებული სეტი სჭირდება');
  });

  it('shows the API’s invalid_result inline', async () => {
    await setup();
    engine.setResult.and.returnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { errors: [{ message: 'invalid_result: this stage is best of 3: the winner takes 2 sets' }] },
          }),
      ),
    );
    for (const [i, v] of [[0, '6'], [1, '4'], [2, '6'], [3, '3']] as const) type(cell(i), v);
    (q('score-save') as HTMLButtonElement).click();
    fixture.detectChanges();
    const error = q('score-server-error')!;
    expect(error.textContent).toContain('შედეგი არასწორია');
    expect(error.textContent).toContain('the winner takes 2 sets');
    expect(completeWith).not.toHaveBeenCalled();
  });

  it('points: typing one side fills the other from the target', async () => {
    await setup({ scoring: { type: 'points', pointsTarget: 24 }, knockout: false, match: match({ stage: 'social' }) });
    type(cell(0), '15');
    expect(cell(1).value).toBe('9');
    (q('score-save') as HTMLButtonElement).click();
    expect(engine.setResult).toHaveBeenCalledWith('t1', 'm1', { points: [15, 9] });
  });

  it('a walkover is one tap + the winner', async () => {
    await setup();
    q('outcome-walkover')!.click();
    fixture.detectChanges();
    expect(el().querySelector('[data-cell]')).toBeNull();
    q('winner-1')!.click();
    fixture.detectChanges();
    (q('score-save') as HTMLButtonElement).click();
    expect(engine.setResult).toHaveBeenCalledWith('t1', 'm1', { outcome: 'walkover', winner: 1 });
  });

  it('a finished match offers «შედეგის წაშლა» (after a confirm)', async () => {
    await setup({
      match: match({ status: 'done', outcome: 'played', winner: 0, score: { type: 'sets', sets: [[6, 4], [6, 4]] } }),
    });
    expect(cell(0).value).toBe('6');
    q('score-clear')!.click();
    expect(dialogs.open).toHaveBeenCalled();
    expect(engine.clearResult).toHaveBeenCalledWith('t1', 'm1');
    expect(completeWith).toHaveBeenCalledWith(view);
  });
});
