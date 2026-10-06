import { DrawView, MatchView } from '../../../shared/models/tournament-engine.model';
import { initialStep, stepStates } from './console-steps.util';

function entrants(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: `e${i}`, name: `E${i}`, players: [] }));
}

function match(id: string, patch: Partial<MatchView> = {}): MatchView {
  return {
    id,
    stage: 'knockout',
    round: 1,
    order: 0,
    sides: [{ entrants: ['e0'] }, { entrants: ['e1'] }],
    status: 'ready',
    rated: false,
    ...patch,
  };
}

function view(patch: Partial<DrawView> = {}): DrawView {
  return {
    structure: null,
    status: 'none',
    stage: 'registration',
    entrants: [],
    groups: [],
    knockout: null,
    social: null,
    matches: [],
    podium: [],
    ...patch,
  };
}

const knockout = { scoring: { type: 'sets' as const, bestOf: 3 as const, superTiebreak: true }, rated: true };

/** The stepper (docs/33 §7): done / current / waiting, and where the console opens. */
describe('console-steps.util', () => {
  const input = (draw: DrawView | null) => ({ format: 'knockout' as const, type: 'doubles' as const, draw });

  it('a fresh tournament: entrants first, the draw waits', () => {
    const states = stepStates(input(view()));
    expect(states).toEqual({
      entrants: 'current',
      structure: 'current',
      draw: 'waiting',
      schedule: 'waiting',
      matches: 'waiting',
    });
    expect(initialStep(input(view()))).toBe('entrants');
  });

  it('enough entrants but no structure: opens on «ფორმატი»', () => {
    const draw = view({ entrants: entrants(4) });
    expect(stepStates(input(draw)).entrants).toBe('done');
    expect(initialStep(input(draw))).toBe('structure');
  });

  it('entrants + structure: the draw is current', () => {
    const draw = view({ entrants: entrants(4), structure: knockout });
    expect(stepStates(input(draw)).draw).toBe('current');
    expect(initialStep(input(draw))).toBe('draw');
  });

  it('groups need two entrants per group before the draw step is ready', () => {
    const groups = {
      scoring: { type: 'sets' as const, bestOf: 1 as const, superTiebreak: false },
      groups: { count: 4, rounds: 1, advancement: ['direct' as const], wildcards: 0 },
      rated: true,
    };
    const draw = view({ entrants: entrants(6), structure: groups });
    const states = stepStates({ format: 'groups_playoffs', type: 'doubles', draw });
    expect(states.entrants).toBe('current');
    expect(states.draw).toBe('waiting');
  });

  it('a draft draw still needs publishing; schedule and matches unlock', () => {
    const draw = view({ status: 'draft', structure: knockout, entrants: entrants(4), matches: [match('m1')] });
    const states = stepStates(input(draw));
    expect(states.entrants).toBe('done');
    expect(states.structure).toBe('done');
    expect(states.draw).toBe('current');
    expect(states.schedule).toBe('current');
    expect(states.matches).toBe('current');
    expect(initialStep(input(draw))).toBe('draw');
  });

  it('published and unscheduled: opens on the schedule', () => {
    const draw = view({ status: 'published', structure: knockout, matches: [match('m1')] });
    expect(stepStates(input(draw)).draw).toBe('done');
    expect(initialStep(input(draw))).toBe('schedule');
  });

  it('play has started (a result is in): opens on the matches, scheduling is optional', () => {
    const draw = view({
      status: 'published',
      stage: 'knockout',
      structure: knockout,
      matches: [match('m1', { status: 'done', winner: 0 }), match('m2', { order: 1 })],
    });
    expect(stepStates(input(draw)).schedule).toBe('current');
    expect(initialStep(input(draw))).toBe('matches');
  });

  it('scheduled matches mark the schedule done', () => {
    const draw = view({
      status: 'published',
      structure: knockout,
      matches: [match('m1', { scheduledAt: '2026-10-18T06:00:00.000Z' })],
    });
    expect(stepStates(input(draw)).schedule).toBe('done');
    expect(initialStep(input(draw))).toBe('matches');
  });

  it('a finished tournament opens on the draw (its podium)', () => {
    const draw = view({
      status: 'published',
      stage: 'finished',
      structure: knockout,
      matches: [match('m1', { status: 'done', winner: 0 })],
      podium: [{ place: 1, entrants: ['e0'] }],
    });
    expect(stepStates(input(draw)).matches).toBe('done');
    expect(initialStep(input(draw))).toBe('draw');
  });
});
