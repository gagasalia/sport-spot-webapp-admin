/**
 * The console's stepper (docs/33 §7 "Organizer flow as steps"):
 * მონაწილეები → ფორმატი → კენჭისყრა → განრიგი → მატჩები. Each step is
 * DONE, CURRENT (actionable now, not done) or WAITING (an earlier step must
 * finish first); the console opens on the first step that still needs work.
 * Pure.
 */
import { liveLabels } from '../../../shared/i18n/lang';
import { TournamentFormat, TournamentType } from '../../../shared/models/tournament.model';
import { DrawView } from '../../../shared/models/tournament-engine.model';
import { minimumEntrants } from './engine-structure.util';

export type StepKey = 'entrants' | 'structure' | 'draw' | 'schedule' | 'matches';
export type StepState = 'done' | 'current' | 'waiting';

export const STEP_KEYS: readonly StepKey[] = ['entrants', 'structure', 'draw', 'schedule', 'matches'];

export const STEP_LABELS: Record<StepKey, string> = liveLabels({
  entrants: 'მონაწილეები',
  structure: 'ფორმატი',
  draw: 'კენჭისყრა',
  schedule: 'განრიგი',
  matches: 'მატჩები',
});

export interface StepInput {
  format: TournamentFormat;
  type: TournamentType;
  draw: DrawView | null;
}

function facts(input: StepInput) {
  const draw = input.draw;
  const hasDraw = !!draw && draw.status !== 'none';
  const structure = draw?.structure ?? null;
  const entrants = draw?.entrants.length ?? 0;
  const matches = draw?.matches ?? [];
  return {
    hasDraw,
    entrantsDone: hasDraw || entrants >= minimumEntrants(input.format, input.type, structure),
    structureDone: hasDraw || !!structure,
    drawDone: draw?.status === 'published',
    // Every match still to play has a time.
    scheduleDone: hasDraw && matches.every((m) => m.status === 'done' || !!m.scheduledAt),
    matchesDone: draw?.stage === 'finished',
    anyResult: matches.some((m) => m.status === 'done'),
  };
}

export function stepStates(input: StepInput): Record<StepKey, StepState> {
  const f = facts(input);
  const state = (done: boolean, ready: boolean): StepState =>
    done ? 'done' : ready ? 'current' : 'waiting';
  return {
    entrants: state(f.entrantsDone, true),
    structure: state(f.structureDone, true),
    draw: state(f.drawDone, f.hasDraw || (f.entrantsDone && f.structureDone)),
    schedule: state(f.scheduleDone, f.hasDraw),
    matches: state(f.matchesDone, f.hasDraw),
  };
}

/**
 * Where the console opens: the first step that still needs work. Scheduling
 * is optional — once play has started the console goes to the matches; a
 * finished tournament opens on the draw (its podium).
 */
export function initialStep(input: StepInput): StepKey {
  const f = facts(input);
  if (!f.hasDraw) {
    if (!f.entrantsDone) return 'entrants';
    if (!f.structureDone) return 'structure';
    return 'draw';
  }
  if (!f.drawDone) return 'draw';
  if (f.matchesDone) return 'draw';
  if (!f.scheduleDone && !f.anyResult) return 'schedule';
  return 'matches';
}
