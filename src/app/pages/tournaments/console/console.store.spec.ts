import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { TournamentConsoleStore } from './console.store';
import { TournamentService } from '../../../services/http-services/tournament.service';
import { TournamentEngineService } from '../../../services/http-services/tournament-engine.service';
import { SsDialogService } from '../../../shared/ui/dialog.service';
import { Tournament } from '../../../shared/models/tournament.model';
import { DrawView, MatchView } from '../../../shared/models/tournament-engine.model';

const tournament: Tournament = {
  _id: 't1',
  name: 'Autumn Open',
  sportType: 'padel',
  type: 'doubles',
  format: 'knockout',
  level: 'any',
  category: 'men',
  startDate: '2026-10-18',
  startTime: '10:00',
  entryFeeTetri: 0,
  currency: 'GEL',
  maxParticipants: 16,
  registeredCount: 2,
  status: 'published',
};

const ready: MatchView = {
  id: 'm1',
  stage: 'knockout',
  round: 1,
  order: 0,
  sides: [{ entrants: ['a'] }, { entrants: ['b'] }],
  status: 'ready',
  rated: false,
};

function draw(patch: Partial<DrawView> = {}): DrawView {
  return {
    structure: { scoring: { type: 'sets', bestOf: 3, superTiebreak: true }, rated: true },
    status: 'published',
    stage: 'knockout',
    entrants: [
      { id: 'a', name: 'A', players: [] },
      { id: 'b', name: 'B', players: [] },
    ],
    groups: [],
    knockout: { rounds: [{ round: 1, name: 'final', slots: 1, matches: ['m1'] }], thirdPlace: null },
    social: null,
    matches: [ready],
    podium: [],
    ...patch,
  };
}

/** One console page's state: one load, then every write's view replaces it. */
describe('TournamentConsoleStore', () => {
  let store: TournamentConsoleStore;
  let tournaments: jasmine.SpyObj<TournamentService>;
  let engine: jasmine.SpyObj<TournamentEngineService>;
  let dialogs: { open: jasmine.Spy };

  beforeEach(() => {
    tournaments = jasmine.createSpyObj<TournamentService>('TournamentService', [
      'getTournament',
      'getRegistrations',
    ]);
    engine = jasmine.createSpyObj<TournamentEngineService>('TournamentEngineService', [
      'getDraw',
      'getCourts',
      'getCategories',
    ]);
    tournaments.getTournament.and.returnValue(of(tournament));
    tournaments.getRegistrations.and.returnValue(
      of([{ _id: 'a', tournament: 't1', status: 'registered', paymentStatus: 'paid', source: 'operator' }]),
    );
    engine.getDraw.and.returnValue(of(draw()));
    engine.getCourts.and.returnValue(of([{ _id: 'c1', name: 'კორტი 1' }]));
    engine.getCategories.and.returnValue(of([tournament]));
    dialogs = { open: jasmine.createSpy('open').and.returnValue(of(draw({ stage: 'finished' }))) };

    TestBed.configureTestingModule({
      providers: [
        TournamentConsoleStore,
        { provide: TournamentService, useValue: tournaments },
        { provide: TournamentEngineService, useValue: engine },
        { provide: SsDialogService, useValue: dialogs },
      ],
    });
    store = TestBed.inject(TournamentConsoleStore);
  });

  it('loads the tournament, its draw view, the registration rows and the courts', () => {
    store.load('t1').subscribe();
    expect(store.loading()).toBeFalse();
    expect(store.tournament()?._id).toBe('t1');
    expect(store.entrants().length).toBe(2);
    expect(store.registrationById().get('a')?.source).toBe('operator');
    expect(store.courts().length).toBe(1);
    // a plain tournament is its own only category — no categories read
    expect(engine.getCategories).not.toHaveBeenCalled();
    expect(store.categories().map((c) => c._id)).toEqual(['t1']);
    expect(store.playable()).toBeTrue();
    expect(store.editable()).toBeTrue();
  });

  it('an event reads its categories for the switcher', () => {
    tournaments.getTournament.and.returnValue(of({ ...tournament, event: { id: 'ev', order: 0 } }));
    engine.getCategories.and.returnValue(of([tournament, { ...tournament, _id: 't2' }]));
    store.load('t1').subscribe();
    expect(engine.getCategories).toHaveBeenCalledWith('t1');
    expect(store.categories().length).toBe(2);
  });

  it('a failed load shows the retry state', () => {
    engine.getDraw.and.returnValue(throwError(() => new Error('down')));
    store.load('t1').subscribe();
    expect(store.loadError()).toBeTrue();
    expect(store.loading()).toBeFalse();
  });

  it('a write’s view replaces the state — no re-read', () => {
    store.load('t1').subscribe();
    engine.getDraw.calls.reset();
    store.applyDraw(draw({ status: 'draft', matches: [] }));
    expect(store.draw()?.status).toBe('draft');
    expect(store.tournament()?.draw).toEqual({ status: 'draft' });
    expect(engine.getDraw).not.toHaveBeenCalled();
  });

  it('a completed tournament is not editable but still playable; a cancelled one neither', () => {
    tournaments.getTournament.and.returnValue(of({ ...tournament, status: 'completed' }));
    store.load('t1').subscribe();
    expect(store.editable()).toBeFalse();
    expect(store.playable()).toBeTrue();
    tournaments.getTournament.and.returnValue(of({ ...tournament, status: 'cancelled' }));
    store.load('t1').subscribe();
    expect(store.playable()).toBeFalse();
  });

  it('opens the score dialog for a match with both sides known and applies its view', () => {
    store.load('t1').subscribe();
    store.openScore(ready);
    expect(dialogs.open).toHaveBeenCalledTimes(1);
    expect(store.draw()?.stage).toBe('finished');

    store.openScore({ ...ready, id: 'm2', sides: [{ entrants: ['a'] }, { entrants: [] }] });
    expect(dialogs.open).toHaveBeenCalledTimes(1);
  });

  it('refreshEntrants re-reads the view, the rows and the live count', () => {
    store.load('t1').subscribe();
    tournaments.getTournament.and.returnValue(of({ ...tournament, registeredCount: 3 }));
    engine.getDraw.and.returnValue(of(draw({ status: 'none', matches: [] })));
    store.refreshEntrants().subscribe();
    expect(store.draw()?.status).toBe('none');
    expect(store.tournament()?.registeredCount).toBe(3);
  });
});
