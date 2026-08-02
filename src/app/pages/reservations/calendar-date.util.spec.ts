import { shiftIso, todayIso, weekDates } from './calendar-date.util';

describe('calendar-date.util', () => {
  it('todayIso formats the given date as local Y-M-D', () => {
    expect(todayIso(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('shiftIso moves forward and backward across month boundaries', () => {
    expect(shiftIso('2026-06-13', 1)).toBe('2026-06-14');
    expect(shiftIso('2026-06-01', -1)).toBe('2026-05-31');
    expect(shiftIso('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('weekDates returns Monday…Sunday for the week containing the date (Monday=0)', () => {
    // 2026-06-13 is a Saturday → Monday of that week is 2026-06-08.
    const week = weekDates('2026-06-13');
    expect(week.length).toBe(7);
    expect(week[0]).toBe('2026-06-08'); // Monday
    expect(week[6]).toBe('2026-06-14'); // Sunday
  });

  it('weekDates anchors a Monday to itself', () => {
    const week = weekDates('2026-06-08'); // Monday
    expect(week[0]).toBe('2026-06-08');
  });
});
