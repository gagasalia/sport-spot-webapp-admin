import {
  GridCourt,
  WeekDayData,
  buildDayGrid,
  buildSlotRows,
  buildWeekGrid,
  cellFor,
  hhmmToMinutes,
  indexBookings,
} from './calendar-grid';
import {
  AvailabilityByCourt,
  Booking,
} from '../../shared/models/booking.model';

function booking(over: Partial<Booking>): Booking {
  return {
    _id: over._id ?? 'b1',
    court: over.court ?? 'court-1',
    type: over.type ?? 'booking',
    date: over.date ?? '2026-06-13',
    start: over.start ?? '09:00',
    end: over.end ?? '10:30',
    status: over.status ?? 'confirmed',
    ...over,
  };
}

const COURTS: GridCourt[] = [
  { id: 'court-1', courtNumber: 1, label: 'კორტი 1' },
  { id: 'court-2', courtNumber: 2, label: 'კორტი 2' },
];

describe('calendar-grid (pure grid builder)', () => {
  describe('hhmmToMinutes', () => {
    it('converts HH:mm to minutes since midnight', () => {
      expect(hhmmToMinutes('00:00')).toBe(0);
      expect(hhmmToMinutes('09:30')).toBe(570);
      expect(hhmmToMinutes('22:00')).toBe(1320);
    });

    it('throws on malformed input instead of silently treating it as 0', () => {
      expect(() => hhmmToMinutes('garbage')).toThrowError(/invalid/);
      expect(() => hhmmToMinutes('9')).toThrowError(/invalid/);
      expect(() => hhmmToMinutes('')).toThrowError(/invalid/);
      expect(() => hhmmToMinutes('09:xx')).toThrowError(/invalid/);
    });
  });

  describe('buildSlotRows', () => {
    it('derives ordered slot rows from availability', () => {
      const avail: AvailabilityByCourt = {
        'court-1': [
          { start: '10:30', end: '12:00', priceTetri: 5000 },
          { start: '09:00', end: '10:30', priceTetri: 5000 },
        ],
      };
      const rows = buildSlotRows(avail, []);
      expect(rows.map((r) => r.start)).toEqual(['09:00', '10:30']);
    });

    it('includes fully-booked slots that are absent from availability (the union)', () => {
      // 09:00 is taken on every court → absent from availability, present only in bookings.
      const avail: AvailabilityByCourt = {
        'court-1': [{ start: '10:30', end: '12:00', priceTetri: 5000 }],
      };
      const bookings = [booking({ start: '09:00', end: '10:30', court: 'court-1' })];
      const rows = buildSlotRows(avail, bookings);
      expect(rows.map((r) => r.start)).toEqual(['09:00', '10:30']);
    });

    it('de-duplicates a slot start shared across courts into one row', () => {
      const avail: AvailabilityByCourt = {
        'court-1': [{ start: '09:00', end: '10:30', priceTetri: 5000 }],
        'court-2': [{ start: '09:00', end: '10:30', priceTetri: 6000 }],
      };
      const rows = buildSlotRows(avail, []);
      expect(rows.length).toBe(1);
      expect(rows[0]).toEqual({ start: '09:00', end: '10:30' });
    });

    it('keeps the longest end when a start has ragged durations', () => {
      const avail: AvailabilityByCourt = {
        'court-1': [{ start: '09:00', end: '10:30', priceTetri: 5000 }],
        'court-2': [{ start: '09:00', end: '11:00', priceTetri: 6000 }],
      };
      const rows = buildSlotRows(avail, []);
      expect(rows[0].end).toBe('11:00');
    });

    it('returns an empty array for a closed/empty day', () => {
      expect(buildSlotRows({}, [])).toEqual([]);
    });
  });

  describe('indexBookings', () => {
    it('indexes confirmed bookings by court|start', () => {
      const b = booking({ _id: 'x', court: 'court-2', start: '09:00' });
      const index = indexBookings([b]);
      expect(index.get('court-2|09:00')).toBe(b);
    });

    it('ignores cancelled bookings (the slot is free again)', () => {
      const b = booking({ status: 'cancelled', court: 'court-1', start: '09:00' });
      const index = indexBookings([b]);
      expect(index.has('court-1|09:00')).toBeFalse();
    });

    it('keeps completed bookings (a played slot is still occupied, not free)', () => {
      const b = booking({ _id: 'done', status: 'completed', court: 'court-1', start: '09:00' });
      const index = indexBookings([b]);
      expect(index.get('court-1|09:00')).toBe(b);
    });

    it('keeps the first when two confirmed docs collide on a key', () => {
      const first = booking({ _id: 'first', court: 'court-1', start: '09:00' });
      const second = booking({ _id: 'second', court: 'court-1', start: '09:00' });
      const index = indexBookings([first, second]);
      expect(index.get('court-1|09:00')?._id).toBe('first');
    });
  });

  describe('cellFor', () => {
    const slot = { start: '09:00', end: '10:30' };
    const avail: AvailabilityByCourt = {
      'court-1': [{ start: '09:00', end: '10:30', priceTetri: 5000 }],
    };

    it('returns a free cell with price when the slot is available', () => {
      const cell = cellFor('court-1', slot, new Map(), avail);
      expect(cell.kind).toBe('free');
      expect(cell.priceTetri).toBe(5000);
    });

    it('returns a booking cell when a booking occupies the slot', () => {
      const b = booking({ court: 'court-1', start: '09:00', type: 'booking' });
      const index = indexBookings([b]);
      const cell = cellFor('court-1', slot, index, avail);
      expect(cell.kind).toBe('booking');
      expect(cell.booking).toBe(b);
    });

    it('returns a block cell for a block document', () => {
      const b = booking({ court: 'court-1', start: '09:00', type: 'block', note: 'maintenance' });
      const index = indexBookings([b]);
      const cell = cellFor('court-1', slot, index, avail);
      expect(cell.kind).toBe('block');
      expect(cell.booking?.note).toBe('maintenance');
    });

    it('renders a completed booking as a booking cell (not free/clickable)', () => {
      const b = booking({ court: 'court-1', start: '09:00', type: 'booking', status: 'completed' });
      const index = indexBookings([b]);
      const cell = cellFor('court-1', slot, index, avail);
      expect(cell.kind).toBe('booking');
      expect(cell.booking?.status).toBe('completed');
    });

    it('returns a closed cell for a band not offered on this court (no avail, no booking)', () => {
      // court-2 has no availability entry for 09:00 and no booking → closed, non-clickable.
      const cell = cellFor('court-2', slot, new Map(), avail);
      expect(cell.kind).toBe('closed');
      expect(cell.priceTetri).toBeUndefined();
    });
  });

  describe('buildDayGrid', () => {
    it('builds a column-aligned slots × courts matrix', () => {
      const avail: AvailabilityByCourt = {
        'court-1': [
          { start: '09:00', end: '10:30', priceTetri: 5000 },
          { start: '10:30', end: '12:00', priceTetri: 5000 },
        ],
        'court-2': [{ start: '10:30', end: '12:00', priceTetri: 6000 }],
      };
      // court-2 09:00 is taken by a booking.
      const bookings = [
        booking({ _id: 'taken', court: 'court-2', start: '09:00', customerName: 'გიო' }),
      ];

      const grid = buildDayGrid(COURTS, avail, bookings);

      expect(grid.courts).toEqual(COURTS);
      expect(grid.rows.map((r) => r.start)).toEqual(['09:00', '10:30']);

      const row0 = grid.rows[0];
      expect(row0.cells.length).toBe(2); // one per court
      expect(row0.cells[0].kind).toBe('free'); // court-1 09:00 free
      expect(row0.cells[1].kind).toBe('booking'); // court-2 09:00 booked
      expect(row0.cells[1].booking?.customerName).toBe('გიო');

      const row1 = grid.rows[1];
      expect(row1.cells[0].kind).toBe('free');
      expect(row1.cells[1].kind).toBe('free');
    });

    it('returns an empty grid for a closed day with no slots and no bookings', () => {
      const grid = buildDayGrid(COURTS, {}, []);
      expect(grid.rows).toEqual([]);
    });
  });

  describe('buildWeekGrid', () => {
    it('builds one court × N days with per-day cell semantics', () => {
      const days: WeekDayData[] = [
        {
          date: '2026-06-08',
          availability: { 'court-1': [{ start: '09:00', end: '10:30', priceTetri: 5000 }] },
          bookings: [],
        },
        {
          date: '2026-06-09',
          availability: {},
          bookings: [booking({ court: 'court-1', start: '09:00', customerName: 'ნინო' })],
        },
      ];
      const grid = buildWeekGrid('court-1', days);

      expect(grid.days).toEqual(['2026-06-08', '2026-06-09']);
      expect(grid.rows.length).toBe(1);

      const row = grid.rows[0];
      expect(row.start).toBe('09:00');
      expect(row.cells[0].kind).toBe('free'); // day 1 free
      expect(row.cells[0].date).toBe('2026-06-08');
      expect(row.cells[1].kind).toBe('booking'); // day 2 booked
      expect(row.cells[1].booking?.customerName).toBe('ნინო');
    });

    it('returns an empty grid when the week has no slots', () => {
      const grid = buildWeekGrid('court-1', [
        { date: '2026-06-08', availability: {}, bookings: [] },
      ]);
      expect(grid.rows).toEqual([]);
    });

    it('marks phantom slots outside a day\'s hours as closed (irregular hours)', () => {
      // Mon opens 09:00; Sat opens 10:00. The 09:00 row exists in the week union
      // (from Mon) but Sat offers no 09:00 slot → Sat 09:00 must be `closed`, not `free`.
      const days: WeekDayData[] = [
        {
          date: '2026-06-08', // Monday: 09:00 open
          availability: { 'court-1': [{ start: '09:00', end: '10:30', priceTetri: 5000 }] },
          bookings: [],
        },
        {
          date: '2026-06-13', // Saturday: 10:00 open (no 09:00)
          availability: { 'court-1': [{ start: '10:00', end: '11:30', priceTetri: 5000 }] },
          bookings: [],
        },
      ];
      const grid = buildWeekGrid('court-1', days);

      const row0900 = grid.rows.find((r) => r.start === '09:00');
      const satCell = row0900?.cells.find((c) => c.date === '2026-06-13');
      expect(satCell?.kind).toBe('closed');

      const monCell = row0900?.cells.find((c) => c.date === '2026-06-08');
      expect(monCell?.kind).toBe('free');
    });
  });
});
