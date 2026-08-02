import {
  blockChunks,
  buildDayGrid,
  buildOccupations,
  buildWeekGrid,
  cellPriceTetri,
  hhmmToMinutes,
  holidayApplies,
  isBookableDuration,
  minutesToHHmm,
  mondayWeekday,
  openRangesFor,
  priceForWindow,
  selectionMinutes,
  toggleCell,
  type CellRef,
  type GridCourt,
} from './calendar-grid';
import { Booking } from '../../shared/models/booking.model';
import { FacilityScheduleDTO, WeeklyHoursDTO } from '../../shared/models/schedule.model';

/** Schedule open 09:00–13:00 every day, general 60 GEL/h, off-peak 40 before 11. */
function makeSchedule(overrides: Partial<FacilityScheduleDTO> = {}): FacilityScheduleDTO {
  const allDays = Object.fromEntries(
    [0, 1, 2, 3, 4, 5, 6].map((d) => [d, [{ start: '09:00', end: '13:00' }]]),
  ) as unknown as WeeklyHoursDTO;
  return {
    timezone: 'Asia/Tbilisi',
    weeklyHours: allDays,
    holidays: [],
    pricing: {
      currency: 'GEL',
      generalPriceTetri: 6000,
      offPeak: { start: '09:00', end: '11:00', priceTetri: 4000 },
    },
    ...overrides,
  };
}

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    _id: 'b-1',
    court: 'court-1',
    type: 'booking',
    date: '2026-06-10', // a Wednesday
    start: '09:00',
    end: '10:30',
    status: 'confirmed',
    customerName: 'გიო',
    priceTetri: 5000,
    paymentStatus: 'pay_at_venue',
    ...overrides,
  };
}

const courts: GridCourt[] = [
  { id: 'court-1', courtNumber: 1, label: 'კორტი 1' },
  { id: 'court-2', courtNumber: 2, label: 'კორტი 2' },
];

describe('calendar-grid time helpers', () => {
  it('hhmmToMinutes ↔ minutesToHHmm round-trips', () => {
    expect(hhmmToMinutes('09:30')).toBe(570);
    expect(minutesToHHmm(570)).toBe('09:30');
    expect(minutesToHHmm(0)).toBe('00:00');
  });

  it('hhmmToMinutes throws on malformed input', () => {
    expect(() => hhmmToMinutes('junk')).toThrow();
    expect(() => hhmmToMinutes('')).toThrow();
  });

  it('mondayWeekday: Monday=0 … Sunday=6', () => {
    expect(mondayWeekday('2026-06-08')).toBe(0); // Monday
    expect(mondayWeekday('2026-06-10')).toBe(2); // Wednesday
    expect(mondayWeekday('2026-06-14')).toBe(6); // Sunday
  });

  it('holidayApplies: exact date, or MM-DD when recurring', () => {
    expect(holidayApplies({ date: '2026-06-10', isClosed: true }, '2026-06-10')).toBeTrue();
    expect(holidayApplies({ date: '2026-06-10', isClosed: true }, '2027-06-10')).toBeFalse();
    expect(
      holidayApplies({ date: '2020-01-01', isClosed: true, isRecurring: true }, '2026-01-01'),
    ).toBeTrue();
  });
});

describe('openRangesFor', () => {
  it('returns the weekday hours as minute ranges', () => {
    expect(openRangesFor('2026-06-10', makeSchedule())).toEqual([{ start: 540, end: 780 }]);
  });

  it('an isClosed holiday wipes the day', () => {
    const schedule = makeSchedule({
      holidays: [{ date: '2026-06-10', isClosed: true }],
    });
    expect(openRangesFor('2026-06-10', schedule)).toEqual([]);
  });

  it('a timeRanges holiday subtracts its ranges from the open hours', () => {
    const schedule = makeSchedule({
      holidays: [
        { date: '2026-06-10', isClosed: false, timeRanges: [{ start: '10:00', end: '11:00' }] },
      ],
    });
    expect(openRangesFor('2026-06-10', schedule)).toEqual([
      { start: 540, end: 600 },
      { start: 660, end: 780 },
    ]);
  });
});

describe('pricing', () => {
  const pricing = makeSchedule().pricing!;

  it('cellPriceTetri: half the applicable hourly rate, off-peak half-open', () => {
    expect(cellPriceTetri(hhmmToMinutes('09:00'), pricing)).toBe(2000); // off-peak
    expect(cellPriceTetri(hhmmToMinutes('10:30'), pricing)).toBe(2000); // last off cell
    expect(cellPriceTetri(hhmmToMinutes('11:00'), pricing)).toBe(3000); // general
  });

  it('priceForWindow sums per cell across the off-peak boundary, rounded once', () => {
    // 10:30–12:00: cells 10:30 (off 2000), 11:00 + 11:30 (general 3000 each).
    expect(priceForWindow(hhmmToMinutes('10:30'), hhmmToMinutes('12:00'), pricing)).toBe(8000);
  });
});

describe('buildOccupations', () => {
  it('skips cancelled docs; completed still occupies', () => {
    const occ = buildOccupations([
      makeBooking({ status: 'cancelled' }),
      makeBooking({ _id: 'b-2', start: '11:00', end: '12:00', status: 'completed' }),
    ]);
    expect(occ.length).toBe(1);
    expect(occ[0].booking._id).toBe('b-2');
  });

  it('merges adjacent block docs sharing a blockGroupId into one occupation', () => {
    const occ = buildOccupations([
      makeBooking({ _id: 'blk-2', type: 'block', start: '10:30', end: '12:00', blockGroupId: 'g1' }),
      makeBooking({ _id: 'blk-1', type: 'block', start: '09:00', end: '10:30', blockGroupId: 'g1' }),
    ]);
    expect(occ.length).toBe(1);
    expect(occ[0].startMin).toBe(hhmmToMinutes('09:00'));
    expect(occ[0].endMin).toBe(hhmmToMinutes('12:00'));
    expect(occ[0].isBlock).toBeTrue();
  });

  it('does NOT merge blocks with different groups or non-adjacent windows', () => {
    const occ = buildOccupations([
      makeBooking({ _id: 'blk-1', type: 'block', start: '09:00', end: '10:00', blockGroupId: 'g1' }),
      makeBooking({ _id: 'blk-2', type: 'block', start: '10:30', end: '11:00', blockGroupId: 'g1' }),
      makeBooking({ _id: 'blk-3', type: 'block', start: '11:00', end: '11:30', blockGroupId: 'g2' }),
    ]);
    expect(occ.length).toBe(3);
  });

  it('flags player bookings via the user field', () => {
    const occ = buildOccupations([makeBooking({ user: 'u-1' })]);
    expect(occ[0].byUser).toBeTrue();
    expect(buildOccupations([makeBooking()])[0].byUser).toBeFalse();
  });
});

describe('buildDayGrid', () => {
  it('emits one 30-min row per open cell with free cells carrying prices', () => {
    const grid = buildDayGrid(courts, '2026-06-10', makeSchedule(), []);
    // 09:00–13:00 → 8 cells.
    expect(grid.rows.length).toBe(8);
    expect(grid.rows[0].start).toBe('09:00');
    expect(grid.rows[7].start).toBe('12:30');
    const free = grid.rows[0].cells[0];
    expect(free.kind).toBe('free');
    expect(free.span).toBe(1);
    expect(free.priceTetri).toBe(2000);
  });

  it('a 90-min booking spans 3 rows: first cell span=3, the rest covered', () => {
    const grid = buildDayGrid(courts, '2026-06-10', makeSchedule(), [makeBooking()]);
    const first = grid.rows[0].cells[0];
    expect(first.kind).toBe('booking');
    expect(first.span).toBe(3);
    expect(first.covered).toBeFalse();
    expect(first.end).toBe('10:30');
    // Covered rows are marked so the template skips their <td>.
    expect(grid.rows[1].cells[0].covered).toBeTrue();
    expect(grid.rows[2].cells[0].covered).toBeTrue();
    // The other court's column is unaffected.
    expect(grid.rows[0].cells[1].kind).toBe('free');
  });

  it('bookings outside open hours still get rows (union axis); off-hours cells are closed', () => {
    const grid = buildDayGrid(
      courts,
      '2026-06-10',
      makeSchedule(),
      [makeBooking({ start: '14:00', end: '15:00' })],
    );
    const row = grid.rows.find((r) => r.start === '14:00');
    expect(row).toBeTruthy();
    expect(row!.cells[0].kind).toBe('booking');
    // Same row, other court: outside open hours → closed.
    expect(row!.cells[1].kind).toBe('closed');
  });

  it('marks past cells (start <= now) for today only', () => {
    const grid = buildDayGrid(courts, '2026-06-10', makeSchedule(), [], hhmmToMinutes('10:00'));
    expect(grid.rows.find((r) => r.start === '09:30')!.cells[0].kind).toBe('past');
    expect(grid.rows.find((r) => r.start === '10:00')!.cells[0].kind).toBe('past'); // <= now
    expect(grid.rows.find((r) => r.start === '10:30')!.cells[0].kind).toBe('free');
  });

  it('returns no rows without a schedule or on a fully-closed day', () => {
    expect(buildDayGrid(courts, '2026-06-10', null, []).rows).toEqual([]);
    const closed = makeSchedule({ holidays: [{ date: '2026-06-10', isClosed: true }] });
    expect(buildDayGrid(courts, '2026-06-10', closed, []).rows).toEqual([]);
  });
});

describe('buildWeekGrid', () => {
  const days = ['2026-06-08', '2026-06-09', '2026-06-10'].map((date) => ({
    date,
    bookings: [] as Booking[],
  }));

  it('one column per day; only the requested court is painted', () => {
    const withBookings = days.map((d) =>
      d.date === '2026-06-09'
        ? {
            ...d,
            bookings: [
              makeBooking({ date: d.date }),
              makeBooking({ _id: 'x', court: 'court-2', date: d.date, start: '11:00', end: '12:00' }),
            ],
          }
        : d,
    );
    const grid = buildWeekGrid('court-1', withBookings, makeSchedule());
    expect(grid.days.length).toBe(3);
    const row = grid.rows.find((r) => r.start === '09:00')!;
    expect(row.cells[0].kind).toBe('free'); // Mon
    expect(row.cells[1].kind).toBe('booking'); // Tue (court-1's booking)
    expect(row.cells[1].span).toBe(3);
    // court-2's booking must NOT appear in this court's grid.
    expect(grid.rows.find((r) => r.start === '11:00')!.cells[1].kind).toBe('free');
  });

  it('marks past cells only in the today column', () => {
    const grid = buildWeekGrid(
      'court-1',
      days,
      makeSchedule(),
      '2026-06-09',
      hhmmToMinutes('23:59'),
    );
    const row = grid.rows.find((r) => r.start === '09:00')!;
    expect(row.cells[0].kind).toBe('free'); // other day untouched
    expect(row.cells[1].kind).toBe('past'); // today, fully past
    expect(row.cells[2].kind).toBe('free');
  });
});

describe('toggleCell selection', () => {
  const ref = (start: string): CellRef => ({ courtId: 'court-1', date: '2026-06-10', start });

  it('starts, extends at both ends, and reports minutes', () => {
    let sel = toggleCell([], ref('10:00'));
    sel = toggleCell(sel, ref('10:30')); // append
    sel = toggleCell(sel, ref('09:30')); // prepend
    expect(sel.map((c) => c.start)).toEqual(['09:30', '10:00', '10:30']);
    expect(selectionMinutes(sel)).toBe(90);
  });

  it('clicking the first/last selected cell shrinks; the only cell clears', () => {
    let sel = toggleCell([], ref('10:00'));
    sel = toggleCell(sel, ref('10:30'));
    sel = toggleCell(sel, ref('10:30')); // deselect last
    expect(sel.map((c) => c.start)).toEqual(['10:00']);
    sel = toggleCell(sel, ref('10:00')); // deselect only
    expect(sel).toEqual([]);
  });

  it('non-adjacent, other-court, other-date or middle clicks restart the selection', () => {
    const base = [ref('10:00'), ref('10:30'), ref('11:00')];
    expect(toggleCell(base, ref('12:30'))).toEqual([ref('12:30')]); // gap
    expect(toggleCell(base, ref('10:30'))).toEqual([ref('10:30')]); // middle
    const otherCourt: CellRef = { courtId: 'court-2', date: '2026-06-10', start: '10:00' };
    expect(toggleCell(base, otherCourt)).toEqual([otherCourt]);
    const otherDate: CellRef = { courtId: 'court-1', date: '2026-06-11', start: '10:00' };
    expect(toggleCell(base, otherDate)).toEqual([otherDate]);
  });

  it('isBookableDuration accepts exactly 60/90/120', () => {
    expect(isBookableDuration(30)).toBeFalse();
    expect(isBookableDuration(60)).toBeTrue();
    expect(isBookableDuration(90)).toBeTrue();
    expect(isBookableDuration(120)).toBeTrue();
    expect(isBookableDuration(150)).toBeFalse();
  });
});

describe('blockChunks', () => {
  const m = hhmmToMinutes;

  it('uniform spans go as one chunk with the largest dividing unit', () => {
    expect(blockChunks(m('10:00'), m('11:00'))).toEqual([
      { start: '10:00', end: '11:00', durationMinutes: 60 },
    ]);
    expect(blockChunks(m('10:00'), m('11:30'))).toEqual([
      { start: '10:00', end: '11:30', durationMinutes: 90 },
    ]);
    expect(blockChunks(m('10:00'), m('12:00'))).toEqual([
      { start: '10:00', end: '12:00', durationMinutes: 120 },
    ]);
    expect(blockChunks(m('10:00'), m('14:00'))).toEqual([
      { start: '10:00', end: '14:00', durationMinutes: 120 },
    ]);
  });

  it('ragged spans (≡30 mod 60) split into a 90-head + 60-divisible tail', () => {
    expect(blockChunks(m('10:00'), m('12:30'))).toEqual([
      { start: '10:00', end: '11:30', durationMinutes: 90 },
      { start: '11:30', end: '12:30', durationMinutes: 60 },
    ]);
    expect(blockChunks(m('09:00'), m('12:30'))).toEqual([
      { start: '09:00', end: '10:30', durationMinutes: 90 },
      { start: '10:30', end: '12:30', durationMinutes: 60 },
    ]);
  });

  it('spans under 60 minutes are not blockable', () => {
    expect(blockChunks(m('10:00'), m('10:30'))).toEqual([]);
  });
});
