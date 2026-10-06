import { MatchView } from '../../../shared/models/tournament-engine.model';
import {
  buildScheduleGrid,
  defaultMatchMinutes,
  defaultSessions,
  fromMinutes,
  isoToWallClock,
  sessionsError,
  shortDay,
  wallClockToIso,
} from './schedule.util';
import { nextDay, scheduleCourts } from './steps/schedule-step.component';

function match(id: string, patch: Partial<MatchView> = {}): MatchView {
  return {
    id,
    stage: 'group',
    group: 'A',
    round: 1,
    order: 0,
    sides: [{ entrants: ['a'] }, { entrants: ['b'] }],
    status: 'ready',
    rated: false,
    ...patch,
  };
}

/** The «განრიგი» step's helpers (docs/33 §3, single-tz MVP: Tbilisi = UTC+4). */
describe('schedule.util', () => {
  it('wall clock ↔ instant at Tbilisi time (UTC+4, no DST)', () => {
    expect(wallClockToIso('2026-10-18', '10:00')).toBe('2026-10-18T06:00:00.000Z');
    expect(wallClockToIso('2026-01-05', '02:30')).toBe('2026-01-04T22:30:00.000Z');
    expect(isoToWallClock('2026-10-18T06:00:00.000Z')).toEqual({ date: '2026-10-18', time: '10:00' });
    expect(isoToWallClock('2026-01-04T22:30:00.000Z')).toEqual({ date: '2026-01-05', time: '02:30' });
  });

  it('defaults: the start day from the start time for 8 hours (never past midnight)', () => {
    expect(defaultSessions('2026-10-18', '10:00')).toEqual([
      { date: '2026-10-18', from: '10:00', to: '18:00' },
    ]);
    expect(defaultSessions('2026-10-18', '19:30')).toEqual([
      { date: '2026-10-18', from: '19:30', to: '23:59' },
    ]);
    expect(fromMinutes(-5)).toBe('00:00');
  });

  it('a sets match takes 45 minutes, a points game 15', () => {
    expect(defaultMatchMinutes({ scoring: { type: 'sets', bestOf: 3, superTiebreak: true }, rated: true })).toBe(45);
    expect(defaultMatchMinutes({ scoring: { type: 'points', pointsTarget: 24 }, rated: true })).toBe(15);
    expect(defaultMatchMinutes(null)).toBe(45);
  });

  it('flags sessions a match cannot fit in', () => {
    expect(sessionsError([{ date: '2026-10-18', from: '10:00', to: '18:00' }], 45)).toBeNull();
    expect(sessionsError([], 45)).toBe('დაამატეთ ერთი სესია მაინც');
    expect(sessionsError([{ date: '', from: '10:00', to: '18:00' }], 45)).toBe('მიუთითეთ სესიის თარიღი');
    expect(sessionsError([{ date: '2026-10-18', from: '10:00', to: '10:30' }], 45)).toBe(
      'სესიაში ერთი მატჩიც ვერ ეტევა',
    );
    expect(sessionsError([{ date: '2026-10-18', from: '10:00', to: '18:00' }], 5)).toBe(
      'მატჩის ხანგრძლივობა — 10-დან 240 წუთამდე',
    );
  });

  it('builds the time × court grid: days, slot rows, the facility’s court order, clashes', () => {
    const at = (date: string, time: string) => wallClockToIso(date, time);
    const grid = buildScheduleGrid(
      [
        match('m1', { court: 'კორტი 2', scheduledAt: at('2026-10-18', '10:00') }),
        match('m2', { court: 'კორტი 1', scheduledAt: at('2026-10-18', '10:00') }),
        match('m3', { court: 'კორტი 1', scheduledAt: at('2026-10-18', '10:45') }),
        match('m4', { court: 'ცენტრალური', scheduledAt: at('2026-10-19', '09:00') }),
        match('m5', { court: 'კორტი 1', scheduledAt: at('2026-10-18', '10:45') }),
        match('m6', { scheduledAt: at('2026-10-19', '09:00') }),
        match('m7'),
      ],
      ['კორტი 1', 'კორტი 2'],
    );
    // facility courts in their order, then free text, then "no court"
    expect(grid.courts).toEqual(['კორტი 1', 'კორტი 2', 'ცენტრალური', '']);
    expect(grid.days.map((d) => d.date)).toEqual(['2026-10-18', '2026-10-19']);
    expect(grid.days[0].rows.map((r) => r.time)).toEqual(['10:00', '10:45']);
    const ids = (cell: MatchView[]) => cell.map((m) => m.id);
    expect(grid.days[0].rows[0].cells.map(ids)).toEqual([['m2'], ['m1'], [], []]);
    // two matches on one court at once — both kept, the clash shows
    expect(grid.days[0].rows[1].cells.map(ids)).toEqual([['m3', 'm5'], [], [], []]);
    expect(grid.days[1].rows[0].cells.map(ids)).toEqual([[], [], ['m4'], ['m6']]);
    expect(grid.unscheduled.map((m) => m.id)).toEqual(['m7']);
    expect(shortDay('2026-10-18')).toBe('18.10');
  });

  it('auto-schedule courts: ticked facility courts (with their id) + typed extras, no duplicates', () => {
    const facility = [
      { _id: 'c1', name: 'კორტი 1' },
      { _id: 'c2', name: 'კორტი 2' },
    ];
    expect(scheduleCourts(facility, new Set(['c2']), ' ცენტრალური , კორტი 2,, ')).toEqual([
      { name: 'კორტი 2', courtId: 'c2' },
      { name: 'ცენტრალური' },
    ]);
    expect(nextDay('2026-12-31')).toBe('2027-01-01');
  });
});
