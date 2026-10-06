import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { TournamentEngineService } from './tournament-engine.service';
import { environment } from '../../../environments/environment';
import { SKIP_ERROR_TOAST } from '../../shared/interceptors/error.interceptor';
import { DrawView } from '../../shared/models/tournament-engine.model';

const base = `${environment.apiUrl}/tournaments/t1`;

const view: DrawView = {
  structure: null,
  status: 'none',
  stage: 'registration',
  entrants: [],
  groups: [],
  knockout: null,
  social: null,
  matches: [],
  podium: [],
};

function wrap<T>(data: T) {
  return { result: { data }, errors: [] };
}

/** docs/33 §5 — every engine route the console calls. */
describe('TournamentEngineService', () => {
  let service: TournamentEngineService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TournamentEngineService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TournamentEngineService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** One call: method, URL, body; quiet (the console shows errors inline). */
  function expectCall(
    url: string,
    method: string,
    body: unknown,
    answer: unknown = view,
  ): void {
    const req = http.expectOne(url);
    expect(req.request.method).toBe(method);
    if (body !== undefined) expect(req.request.body).toEqual(body);
    expect(req.request.context.get(SKIP_ERROR_TOAST)).toBeTrue();
    req.flush(wrap(answer));
  }

  it('reads the draw view, the categories and the courts', () => {
    let draw: DrawView | undefined;
    let categories = -1;
    let courts = -1;
    service.getDraw('t1').subscribe((v) => (draw = v));
    service.getCategories('t1').subscribe((list) => (categories = list.length));
    service.getCourts('t1').subscribe((list) => (courts = list.length));

    expectCall(`${base}/draw`, 'GET', undefined);
    expectCall(`${base}/categories`, 'GET', undefined, [{ _id: 't1' }, { _id: 't2' }]);
    expectCall(`${base}/courts`, 'GET', undefined, [{ _id: 'c1', name: 'კორტი 1' }]);
    expect(draw).toEqual(view);
    expect(categories).toBe(2);
    expect(courts).toBe(1);
  });

  it('POSTs a new category', () => {
    const dto = {
      label: 'ქალები',
      type: 'doubles' as const,
      format: 'round_robin' as const,
      entryFeeTetri: 4000,
      maxParticipants: 8,
    };
    let id = '';
    service.addCategory('t1', dto).subscribe((t) => (id = t._id));
    expectCall(`${base}/categories`, 'POST', dto, { _id: 't2' });
    expect(id).toBe('t2');
  });

  it('PUTs the structure and the seeds', () => {
    service.setStructure('t1', { scoring: { type: 'sets', bestOf: 3 }, rated: true }).subscribe();
    expectCall(`${base}/structure`, 'PUT', { scoring: { type: 'sets', bestOf: 3 }, rated: true });

    service.setSeeds('t1', { order: ['r2', 'r1'] }).subscribe();
    expectCall(`${base}/seeds`, 'PUT', { order: ['r2', 'r1'] });

    service.setSeeds('t1', { method: 'rating' }).subscribe();
    expectCall(`${base}/seeds`, 'PUT', { method: 'rating' });
  });

  it('adds, edits and removes an entrant by hand', () => {
    service.addEntrant('t1', { playerName: 'გიორგი', playerPhone: '555000001' }).subscribe();
    expectCall(`${base}/registrations`, 'POST', { playerName: 'გიორგი', playerPhone: '555000001' }, { _id: 'r9' });

    service.updateEntrant('t1', 'r9', { partnerName: 'ნიკა' }).subscribe();
    expectCall(`${base}/registrations/r9`, 'PATCH', { partnerName: 'ნიკა' }, { _id: 'r9' });

    service.removeEntrant('t1', 'r9').subscribe();
    expectCall(`${base}/registrations/r9`, 'DELETE', null, { _id: 'r9' });
  });

  it('generates, publishes and resets the draw (force only when asked)', () => {
    service.generateDraw('t1', false).subscribe();
    expectCall(`${base}/draw`, 'POST', { shuffle: false });

    service.publishDraw('t1').subscribe();
    expectCall(`${base}/draw/publish`, 'POST', {});

    service.resetDraw('t1').subscribe();
    expectCall(`${base}/draw`, 'DELETE', null);

    service.resetDraw('t1', true).subscribe();
    expectCall(`${base}/draw?force=true`, 'DELETE', null);
  });

  it('swaps entrants, closes / reopens the groups and makes the next round', () => {
    service.swapEntrants('t1', 'a', 'b').subscribe();
    expectCall(`${base}/draw/swap`, 'PATCH', { a: 'a', b: 'b' });

    service.closeGroups('t1', { orders: { A: ['x', 'y'] }, force: true }).subscribe();
    expectCall(`${base}/draw/groups/close`, 'POST', { orders: { A: ['x', 'y'] }, force: true });

    service.reopenGroups('t1').subscribe();
    expectCall(`${base}/draw/groups/close`, 'DELETE', null);

    service.nextRound('t1').subscribe();
    expectCall(`${base}/draw/rounds/next`, 'POST', {});
  });

  it('enters and clears a result', () => {
    service.setResult('t1', 'm1', { sets: [[6, 4], [6, 3]] }).subscribe();
    expectCall(`${base}/matches/m1/result`, 'PATCH', { sets: [[6, 4], [6, 3]] });

    service.setResult('t1', 'm1', { outcome: 'walkover', winner: 1 }).subscribe();
    expectCall(`${base}/matches/m1/result`, 'PATCH', { outcome: 'walkover', winner: 1 });

    service.clearResult('t1', 'm1').subscribe();
    expectCall(`${base}/matches/m1/result`, 'DELETE', null);
  });

  it('schedules one match, the whole draw, and shifts it', () => {
    service.scheduleMatch('t1', 'm1', { court: null, scheduledAt: '2026-10-18T06:00:00.000Z' }).subscribe();
    expectCall(`${base}/matches/m1`, 'PATCH', { court: null, scheduledAt: '2026-10-18T06:00:00.000Z' });

    const dto = {
      courts: [{ name: 'კორტი 1', courtId: 'c1' }],
      sessions: [{ date: '2026-10-18', from: '10:00', to: '18:00' }],
      matchMinutes: 45,
      wholeEvent: false,
    };
    let scheduled = -1;
    service.autoSchedule('t1', dto).subscribe((r) => (scheduled = r.scheduled));
    expectCall(`${base}/schedule/auto`, 'POST', dto, { scheduled: 12, unplaced: 0, draw: view });
    expect(scheduled).toBe(12);

    service.shiftSchedule('t1', { minutes: 15 }).subscribe();
    expectCall(`${base}/schedule/shift`, 'POST', { minutes: 15 });
  });
});
