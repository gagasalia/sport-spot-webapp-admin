import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { TuiAlertService } from '@taiga-ui/core';
import { TuiDialogService } from '@taiga-ui/experimental';

import { ReservationsComponent } from './reservations.component';
import { BookingService } from '../../services/http-services/booking.service';
import { CourtService } from '../../services/http-services/court.service';
import { FacilityService } from '../../services/http-services/facility.service';
import { TenantService } from '../../shared/services/tenant.service';
import { Facility } from '../../shared/models/facility.model';
import { Court } from '../../shared/models/court.model';
import { Booking } from '../../shared/models/booking.model';
import {
  SportType,
  CourtLocationType,
  SurfaceMaterial,
  SurfaceColor,
} from '../../shared/enums/court-type.enum';
import { GridCell } from './calendar-grid';
import { tuiDayToIso, todayIso } from './calendar-date.util';

const facility: Facility = {
  _id: 'fac-1',
  name: 'Padel House',
  country: 'Georgia',
  city: 'Tbilisi',
  description: 'desc',
  amenities: [],
};

const court: Court = {
  _id: 'court-1',
  facility: 'fac-1',
  courtNumber: 1,
  sportType: SportType.Padel,
  locationType: CourtLocationType.Indoor,
  surface: { material: SurfaceMaterial.Synthetic, color: SurfaceColor.Blue },
  activeState: true,
};

const booking: Booking = {
  _id: 'b-1',
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

describe('ReservationsComponent', () => {
  let component: ReservationsComponent;
  let fixture: ComponentFixture<ReservationsComponent>;
  let bookingSpy: jasmine.SpyObj<BookingService>;
  let courtSpy: jasmine.SpyObj<CourtService>;
  let facilitySpy: jasmine.SpyObj<FacilityService>;
  let tenantSpy: jasmine.SpyObj<TenantService>;
  let dialogSpy: jasmine.SpyObj<TuiDialogService>;

  async function setup() {
    bookingSpy = jasmine.createSpyObj<BookingService>('BookingService', [
      'getAvailability',
      'getBookings',
      'createBooking',
      'createBlock',
      'cancelBooking',
      'markPaid',
    ]);
    courtSpy = jasmine.createSpyObj<CourtService>('CourtService', ['getCourts']);
    facilitySpy = jasmine.createSpyObj<FacilityService>('FacilityService', [
      'getFacilitiesByAcademy',
    ]);
    tenantSpy = jasmine.createSpyObj<TenantService>('TenantService', ['academyId', 'ensure']);
    dialogSpy = jasmine.createSpyObj<TuiDialogService>('TuiDialogService', ['open']);

    tenantSpy.academyId.and.returnValue('aca-1');
    // ngOnInit drives the load through ensure(); emit so loadFacilities() runs.
    tenantSpy.ensure.and.returnValue(of(null));
    facilitySpy.getFacilitiesByAcademy.and.returnValue(of([facility]));
    courtSpy.getCourts.and.returnValue(of([court]));
    bookingSpy.getAvailability.and.returnValue(
      of({ 'court-1': [{ start: '10:30', end: '12:00', priceTetri: 5000 }] }),
    );
    bookingSpy.getBookings.and.returnValue(of({ data: [booking] }));
    bookingSpy.cancelBooking.and.returnValue(of({ ...booking, status: 'cancelled' }));
    bookingSpy.markPaid.and.returnValue(of({ ...booking, paymentStatus: 'paid' }));
    dialogSpy.open.and.returnValue(of(true));

    const routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [ReservationsComponent],
      providers: [
        { provide: BookingService, useValue: bookingSpy },
        { provide: CourtService, useValue: courtSpy },
        { provide: FacilityService, useValue: facilitySpy },
        { provide: TenantService, useValue: tenantSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: { queryParams: of({}) } },
        { provide: TuiAlertService, useValue: { open: () => of(undefined) } },
        { provide: TuiDialogService, useValue: dialogSpy },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(ReservationsComponent, {
        set: { imports: [], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ReservationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => setup());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads facilities, auto-selects the single facility and its courts', () => {
    expect(facilitySpy.getFacilitiesByAcademy).toHaveBeenCalledWith('aca-1');
    expect(component.selectedFacilityId()).toBe('fac-1');
    expect(courtSpy.getCourts).toHaveBeenCalledWith('fac-1');
    expect(component.activeCourts().length).toBe(1);
  });

  it('fetches one availability + one bookings call per facility+date and builds the day grid', () => {
    expect(bookingSpy.getAvailability).toHaveBeenCalledWith('fac-1', jasmine.any(String));
    expect(bookingSpy.getBookings).toHaveBeenCalledWith('fac-1', { date: jasmine.any(String) });

    const grid = component.dayGrid();
    // Union of the booked 09:00 slot and the free 10:30 slot → two rows.
    expect(grid.rows.map((r) => r.start)).toEqual(['09:00', '10:30']);
    expect(grid.rows[0].cells[0].kind).toBe('booking');
    expect(grid.rows[1].cells[0].kind).toBe('free');
  });

  it('does not load facilities when there is no tenant academy', fakeAsync(() => {
    tenantSpy.academyId.and.returnValue(null);
    facilitySpy.getFacilitiesByAcademy.calls.reset();
    component.ngOnInit();
    tick();
    expect(facilitySpy.getFacilitiesByAcademy).not.toHaveBeenCalled();
    expect(component.facilities()).toEqual([]);
  }));

  it('click-create: opens the dialog for a free cell and refreshes the day on save', () => {
    bookingSpy.getAvailability.calls.reset();
    bookingSpy.getBookings.calls.reset();

    const freeCell: GridCell = {
      kind: 'free',
      courtId: 'court-1',
      start: '10:30',
      end: '12:00',
      priceTetri: 5000,
    };
    component.onCellClick(freeCell);

    expect(dialogSpy.open).toHaveBeenCalled();
    // Returned `true` → day refetched.
    expect(bookingSpy.getAvailability).toHaveBeenCalled();
    expect(bookingSpy.getBookings).toHaveBeenCalled();
  });

  it('click-create 409 path: dialog completes(true) so the day refreshes with the taken slot', () => {
    // Simulate the dialog resolving truthy after a 409 (the dialog itself shows
    // the Georgian "slot already taken" alert and completes with true).
    dialogSpy.open.and.returnValue(of(true));
    bookingSpy.getBookings.calls.reset();
    bookingSpy.getBookings.and.returnValue(
      of({ data: [booking, { ...booking, _id: 'b-2', start: '10:30', end: '12:00' }] }),
    );

    const freeCell: GridCell = {
      kind: 'free',
      courtId: 'court-1',
      start: '10:30',
      end: '12:00',
      priceTetri: 5000,
    };
    component.onCellClick(freeCell);

    expect(bookingSpy.getBookings).toHaveBeenCalled();
    // The previously-free 10:30 slot is now a booking cell after refresh.
    const row = component.dayGrid().rows.find((r) => r.start === '10:30');
    expect(row?.cells[0].kind).toBe('booking');
  });

  it('week-view free cell: opens the create dialog prefilled with the CELL\'s own date', () => {
    dialogSpy.open.calls.reset();
    dialogSpy.open.and.returnValue(of(true));

    const weekFreeCell = {
      kind: 'free' as const,
      courtId: 'court-1',
      start: '10:30',
      end: '12:00',
      priceTetri: 5000,
      date: '2026-06-10', // a different day than selectedDate()
    };
    // The template calls onCellClick(cell, cell.date) for week-view free cells.
    component.onCellClick(weekFreeCell, weekFreeCell.date);

    expect(dialogSpy.open).toHaveBeenCalled();
    const opts = dialogSpy.open.calls.mostRecent().args[1] as { data: { date: string; start: string } };
    expect(opts.data.date).toBe('2026-06-10');
    expect(opts.data.start).toBe('10:30');
  });

  it('week-view block cell: routes to the cancel-confirm flow', () => {
    dialogSpy.open.calls.reset();
    dialogSpy.open.and.returnValue(of(true));
    bookingSpy.cancelBooking.calls.reset();

    const blockDoc: Booking = {
      ...booking,
      _id: 'blk-1',
      type: 'block',
      status: 'confirmed',
      note: 'სარემონტო',
    };
    const weekBlockCell = {
      kind: 'block' as const,
      courtId: 'court-1',
      start: '09:00',
      end: '10:30',
      booking: blockDoc,
      date: '2026-06-11',
    };
    component.onCellClick(weekBlockCell, weekBlockCell.date);

    // Confirm dialog opened then the block was cancelled.
    expect(dialogSpy.open).toHaveBeenCalled();
    expect(bookingSpy.cancelBooking).toHaveBeenCalledWith('blk-1');
  });

  it('cancel flow: confirm dialog → cancelBooking → refresh', () => {
    dialogSpy.open.and.returnValue(of(true));
    bookingSpy.getBookings.calls.reset();

    component.confirmCancel(booking, 'cancel?');

    expect(bookingSpy.cancelBooking).toHaveBeenCalledWith('b-1');
    expect(bookingSpy.getBookings).toHaveBeenCalled();
  });

  it('cancel flow: a declined confirm does NOT cancel', () => {
    dialogSpy.open.and.returnValue(of(false));
    bookingSpy.cancelBooking.calls.reset();

    component.confirmCancel(booking, 'cancel?');

    expect(bookingSpy.cancelBooking).not.toHaveBeenCalled();
  });

  it('mark-paid: PATCHes payment then refreshes', () => {
    bookingSpy.getBookings.calls.reset();
    component.markPaid(booking);
    expect(bookingSpy.markPaid).toHaveBeenCalledWith('b-1');
    expect(bookingSpy.getBookings).toHaveBeenCalled();
  });

  it('list filters: applyListFilters issues a from/to/court/status query', () => {
    bookingSpy.getBookings.calls.reset();
    bookingSpy.getBookings.and.returnValue(of({ data: [booking], page: { page: 0, size: 20, total: 1 } }));

    component.setTab('list');
    component.listCourt.setValue('court-1');
    component.listStatus.setValue('confirmed');
    component.applyListFilters();

    expect(bookingSpy.getBookings).toHaveBeenCalledWith(
      'fac-1',
      jasmine.objectContaining({ courtId: 'court-1', status: 'confirmed', page: 1, limit: 20 }),
    );
    expect(component.listBookings()).toEqual([booking]);
    expect(component.listTotal()).toBe(1);
  });

  it('list pagination is one-based: page starts at 1 and next/prev step within bounds', () => {
    bookingSpy.getBookings.calls.reset();
    bookingSpy.getBookings.and.returnValue(
      of({ data: [booking], page: { page: 1, size: 20, total: 45 } }),
    );

    component.setTab('list');
    expect(component.listPage()).toBe(1);

    component.nextListPage(); // 1*20=20 < 45 → page 2
    expect(component.listPage()).toBe(2);

    component.nextListPage(); // 2*20=40 < 45 → page 3
    expect(component.listPage()).toBe(3);

    component.nextListPage(); // 3*20=60 >= 45 → guarded, stays on 3
    expect(component.listPage()).toBe(3);

    component.prevListPage();
    expect(component.listPage()).toBe(2);
  });

  it('onCourtSwitch guards against re-selecting the already-active court (no redundant week reload)', () => {
    component.setTab('week');
    const current = component.selectedCourtId();
    bookingSpy.getAvailability.calls.reset();
    bookingSpy.getBookings.calls.reset();

    // Re-select the same court → guarded, no reload.
    component.onCourtSwitch(current);
    expect(bookingSpy.getAvailability).not.toHaveBeenCalled();
    expect(bookingSpy.getBookings).not.toHaveBeenCalled();
  });

  it('statusChipAppearance: completed is neutral, cancelled destructive, confirmed positive', () => {
    expect(component.statusChipAppearance('completed')).toBe('neutral');
    expect(component.statusChipAppearance('cancelled')).toBe('destructive');
    expect(component.statusChipAppearance('confirmed')).toBe('positive');
  });

  it('prev/next day shifts the selected date and refetches', () => {
    const before = component.selectedDate();
    bookingSpy.getAvailability.calls.reset();
    component.nextDay();
    expect(component.selectedDate()).not.toBe(before);
    expect(bookingSpy.getAvailability).toHaveBeenCalled();
  });

  it('surfaces an error state when the day fetch fails', () => {
    bookingSpy.getBookings.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    component.nextDay();
    expect(component.hasError()).toBeTrue();
  });

  // ── NITS: date / court control binding ───────────────────────────────────────

  it('day-view date control is initialized to today (so the field is not blank)', () => {
    const day = component.dateControl.value;
    expect(day).toBeTruthy();
    expect(tuiDayToIso(day!)).toBe(todayIso());
    expect(tuiDayToIso(day!)).toBe(component.selectedDate());
  });

  it('week/mobile court control reflects the auto-selected court (so it is not blank)', () => {
    // Single facility → single active court auto-selected; the backing control
    // must mirror it so stringifyCourt renders the court number.
    expect(component.selectedCourtId()).toBe('court-1');
    expect(component.courtControl.value).toBe('court-1');
    expect(component.stringifyCourt('court-1')).toBe('კორტი 1');
  });

  it('court control changes drive onCourtSwitch and keep the signal in sync', () => {
    component.setTab('week');
    component.courtControl.setValue('court-1'); // same value → guarded, stays
    expect(component.selectedCourtId()).toBe('court-1');
  });
});
