import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { BookingService } from './booking.service';
import { Booking, CreateBlockDto, CreateBookingDto } from '../../shared/models/booking.model';
import { SKIP_ERROR_TOAST } from '../../shared/interceptors/error.interceptor';
import { environment } from '../../../environments/environment';

function wrap<T>(data: T, page?: unknown) {
  return { result: page ? { data, page } : { data }, errors: [] };
}

const FACILITY_ID = 'fac-1';

const mockBooking: Booking = {
  _id: 'b-1',
  facility: FACILITY_ID,
  court: 'court-1',
  type: 'booking',
  date: '2026-06-13',
  start: '09:00',
  end: '10:30',
  status: 'confirmed',
  customerName: 'გიო',
  priceTetri: 5000,
  paymentStatus: 'pay_at_venue',
};

describe('BookingService', () => {
  let service: BookingService;
  let httpMock: HttpTestingController;

  const facilityBase = `${environment.apiUrl}/facilities/${FACILITY_ID}`;
  const bookingsBase = `${environment.apiUrl}/bookings`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [BookingService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(BookingService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getAvailability GETs availability?date= and flattens the courts[] into a per-court map', () => {
    let emitted: unknown;
    service.getAvailability(FACILITY_ID, '2026-06-13').subscribe((a) => (emitted = a));

    const req = httpMock.expectOne(`${facilityBase}/availability?date=2026-06-13`);
    expect(req.request.method).toBe('GET');
    // Wire shape: { date, timezone, slotDurationMinutes, courts: [{ courtId, courtNumber, slots }] }.
    req.flush(
      wrap({
        date: '2026-06-13',
        timezone: 'Asia/Tbilisi',
        slotDurationMinutes: 90,
        courts: [
          {
            courtId: 'court-1',
            courtNumber: 1,
            slots: [{ start: '09:00', end: '10:30', priceTetri: 5000 }],
          },
          {
            courtId: 'court-2',
            courtNumber: 2,
            slots: [{ start: '10:30', end: '12:00', priceTetri: 6000 }],
          },
        ],
      }),
    );

    expect(emitted).toEqual({
      'court-1': [{ start: '09:00', end: '10:30', priceTetri: 5000 }],
      'court-2': [{ start: '10:30', end: '12:00', priceTetri: 6000 }],
    });
  });

  it('getAvailability defaults to an empty map when data is null', () => {
    let emitted: unknown;
    service.getAvailability(FACILITY_ID, '2026-06-13').subscribe((a) => (emitted = a));
    const req = httpMock.expectOne(`${facilityBase}/availability?date=2026-06-13`);
    req.flush(wrap(null));
    expect(emitted).toEqual({});
  });

  it('getAvailability tolerates a missing courts[] array', () => {
    let emitted: unknown;
    service.getAvailability(FACILITY_ID, '2026-06-13').subscribe((a) => (emitted = a));
    const req = httpMock.expectOne(`${facilityBase}/availability?date=2026-06-13`);
    req.flush(wrap({ date: '2026-06-13', timezone: 'Asia/Tbilisi', slotDurationMinutes: 90 }));
    expect(emitted).toEqual({});
  });

  it('getBookings builds query params from the query object', () => {
    service
      .getBookings(FACILITY_ID, { date: '2026-06-13', status: 'confirmed', courtId: 'court-1' })
      .subscribe();

    const req = httpMock.expectOne(
      (r) => r.url === `${facilityBase}/bookings`,
    );
    expect(req.request.params.get('date')).toBe('2026-06-13');
    expect(req.request.params.get('status')).toBe('confirmed');
    expect(req.request.params.get('courtId')).toBe('court-1');
    req.flush(wrap([mockBooking]));
  });

  it('getBookings unwraps data + page metadata', () => {
    let emitted: { data: Booking[]; page?: unknown } | undefined;
    service.getBookings(FACILITY_ID, { date: '2026-06-13' }).subscribe((r) => (emitted = r));

    const req = httpMock.expectOne((r) => r.url === `${facilityBase}/bookings`);
    req.flush(wrap([mockBooking], { page: 0, size: 20, total: 1 }));

    expect(emitted?.data).toEqual([mockBooking]);
    expect(emitted?.page).toEqual({ page: 0, size: 20, total: 1 } as never);
  });

  it('getBookings omits empty/undefined query params', () => {
    service.getBookings(FACILITY_ID, { date: '2026-06-13', courtId: undefined, status: null as never }).subscribe();
    const req = httpMock.expectOne((r) => r.url === `${facilityBase}/bookings`);
    expect(req.request.params.has('courtId')).toBeFalse();
    expect(req.request.params.has('status')).toBeFalse();
    req.flush(wrap([]));
  });

  it('createBooking POSTs the dto and sets SKIP_ERROR_TOAST so callers own 409 messaging', () => {
    const dto: CreateBookingDto = {
      court: 'court-1',
      date: '2026-06-13',
      start: '09:00',
      customerName: 'გიო',
    };
    let created: Booking | undefined;
    service.createBooking(FACILITY_ID, dto).subscribe((b) => (created = b));

    const req = httpMock.expectOne(`${facilityBase}/bookings`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dto);
    expect(req.request.context.get(SKIP_ERROR_TOAST)).toBeTrue();
    req.flush(wrap(mockBooking));

    expect(created).toEqual(mockBooking);
  });

  it('createBooking propagates a 409 error to the caller', () => {
    const dto: CreateBookingDto = {
      court: 'court-1',
      date: '2026-06-13',
      start: '09:00',
      customerName: 'გიო',
    };
    let status: number | undefined;
    service.createBooking(FACILITY_ID, dto).subscribe({
      error: (err) => (status = err.status),
    });

    const req = httpMock.expectOne(`${facilityBase}/bookings`);
    req.flush({ errors: [{ statusCode: 409, message: 'slot already taken' }] }, {
      status: 409,
      statusText: 'Conflict',
    });

    expect(status).toBe(409);
  });

  it('createBlock POSTs a block dto with type: block', () => {
    const dto: CreateBlockDto = {
      type: 'block',
      court: 'court-1',
      date: '2026-06-13',
      start: '09:00',
      note: 'maintenance',
    };
    service.createBlock(FACILITY_ID, dto).subscribe();

    const req = httpMock.expectOne(`${facilityBase}/bookings`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dto);
    req.flush(wrap({ ...mockBooking, type: 'block' }));
  });

  it('cancelBooking PATCHes /bookings/:id/cancel', () => {
    let emitted: Booking | undefined;
    service.cancelBooking('b-1').subscribe((b) => (emitted = b));

    const req = httpMock.expectOne(`${bookingsBase}/b-1/cancel`);
    expect(req.request.method).toBe('PATCH');
    req.flush(wrap({ ...mockBooking, status: 'cancelled' }));

    expect(emitted?.status).toBe('cancelled');
  });

  it('markPaid PATCHes /bookings/:id/payment with { paymentStatus: paid }', () => {
    let emitted: Booking | undefined;
    service.markPaid('b-1').subscribe((b) => (emitted = b));

    const req = httpMock.expectOne(`${bookingsBase}/b-1/payment`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ paymentStatus: 'paid' });
    req.flush(wrap({ ...mockBooking, paymentStatus: 'paid' }));

    expect(emitted?.paymentStatus).toBe('paid');
  });
});
