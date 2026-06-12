import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { TuiAlertService } from '@taiga-ui/core';
import { POLYMORPHEUS_CONTEXT } from '@taiga-ui/polymorpheus';

import { BookingDialogComponent, BookingDialogData } from './booking-dialog.component';
import { BookingService } from '../../../services/http-services/booking.service';
import { Booking } from '../../../shared/models/booking.model';

const data: BookingDialogData = {
  facilityId: 'fac-1',
  court: 'court-1',
  courtLabel: 'კორტი 1',
  date: '2026-06-13',
  start: '09:00',
  end: '10:30',
  priceTetri: 5000,
  laterSlots: [{ start: '10:30', end: '12:00' }],
};

const created: Booking = {
  _id: 'b-1',
  court: 'court-1',
  type: 'booking',
  date: '2026-06-13',
  start: '09:00',
  end: '10:30',
  status: 'confirmed',
  customerName: 'გიო',
};

describe('BookingDialogComponent', () => {
  let component: BookingDialogComponent;
  let fixture: ComponentFixture<BookingDialogComponent>;
  let bookingSpy: jasmine.SpyObj<BookingService>;
  let completeWith: jasmine.Spy;

  async function setup() {
    bookingSpy = jasmine.createSpyObj<BookingService>('BookingService', [
      'createBooking',
      'createBlock',
    ]);
    bookingSpy.createBooking.and.returnValue(of(created));
    bookingSpy.createBlock.and.returnValue(of(created));
    completeWith = jasmine.createSpy('completeWith');

    await TestBed.configureTestingModule({
      imports: [BookingDialogComponent],
      providers: [
        { provide: BookingService, useValue: bookingSpy },
        { provide: TuiAlertService, useValue: { open: () => of(undefined) } },
        { provide: POLYMORPHEUS_CONTEXT, useValue: { data, completeWith } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(BookingDialogComponent, {
        set: { imports: [], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(BookingDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => setup());

  it('should create and default to booking mode', () => {
    expect(component).toBeTruthy();
    expect(component.mode()).toBe('booking');
  });

  it('requires a customer name in booking mode', () => {
    component.submit();
    expect(bookingSpy.createBooking).not.toHaveBeenCalled();
  });

  it('creates a booking with the prefilled court/slot and completes with true', () => {
    component.form.get('customerName')?.setValue('გიო');
    component.submit();

    expect(bookingSpy.createBooking).toHaveBeenCalledWith('fac-1', {
      court: 'court-1',
      date: '2026-06-13',
      start: '09:00',
      customerName: 'გიო',
      customerPhone: undefined,
      note: undefined,
    });
    expect(completeWith).toHaveBeenCalledWith(true);
  });

  it('switching to block mode drops the name requirement and posts a block dto', () => {
    // The end-slot data-list value is the slot's START (10:30); the submitted
    // `end` must be that slot's EXCLUSIVE END (12:00) per the contract.
    component.setMode('block');
    component.form.get('note')?.setValue('სარემონტო');
    component.form.get('blockEnd')?.setValue('10:30');
    component.submit();

    expect(bookingSpy.createBlock).toHaveBeenCalledWith('fac-1', {
      type: 'block',
      court: 'court-1',
      date: '2026-06-13',
      start: '09:00',
      end: '12:00',
      note: 'სარემონტო',
    });
    expect(completeWith).toHaveBeenCalledWith(true);
  });

  it('block without an end slot submits an undefined end (single-slot block)', () => {
    component.setMode('block');
    component.form.get('note')?.setValue('სარემონტო');
    component.submit();

    expect(bookingSpy.createBlock).toHaveBeenCalledWith('fac-1', {
      type: 'block',
      court: 'court-1',
      date: '2026-06-13',
      start: '09:00',
      end: undefined,
      note: 'სარემონტო',
    });
  });

  it('409 path: completes with true (so the calendar refreshes the taken slot)', () => {
    bookingSpy.createBooking.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 409 })),
    );
    component.form.get('customerName')?.setValue('გიო');
    component.submit();
    expect(completeWith).toHaveBeenCalledWith(true);
  });

  it('non-409 error keeps the dialog open (does not complete)', () => {
    bookingSpy.createBooking.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );
    component.form.get('customerName')?.setValue('გიო');
    component.submit();
    expect(completeWith).not.toHaveBeenCalled();
  });

  it('cancel completes with false', () => {
    component.cancel();
    expect(completeWith).toHaveBeenCalledWith(false);
  });
});
