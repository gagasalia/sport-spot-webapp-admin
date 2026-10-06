import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { of } from 'rxjs';

import { TournamentsComponent } from './tournaments.component';
import { TPipe } from '../../shared/i18n/t.pipe';
import { TournamentService } from '../../services/http-services/tournament.service';
import { FacilityNamesService } from '../../shared/i18n/facility-names.service';
import { AuthService } from '../../shared/services/auth.service';
import { SsDialogService } from '../../shared/ui/dialog.service';
import { SsToastService } from '../../shared/ui/toast.service';
import { Tournament } from '../../shared/models/tournament.model';

const internal: Tournament = {
  _id: 't-1',
  academy: 'aca-1',
  facility: 'f-1',
  facilityName: 'ვაკის პადელი',
  name: 'Vake Cup',
  sportType: 'padel',
  type: 'doubles',
  format: 'knockout',
  level: 'any',
  category: 'mixed',
  startDate: '2026-10-18',
  startTime: '10:00',
  entryFeeTetri: 5000,
  currency: 'GEL',
  maxParticipants: 16,
  registeredCount: 4,
  status: 'published',
};

const external: Tournament = {
  ...internal,
  _id: 't-ext',
  academy: undefined,
  facility: undefined,
  facilityName: undefined,
  name: 'Batumi Autumn Open',
  registeredCount: 0,
  external: {
    registrationUrl: 'https://padelbatumi.ge/open',
    organizerName: 'Padel Club Batumi',
    venueName: 'ბათუმის ბულვარი',
  },
};

describe('TournamentsComponent', () => {
  let fixture: ComponentFixture<TournamentsComponent>;

  beforeEach(async () => {
    const tournamentSpy = jasmine.createSpyObj<TournamentService>('TournamentService', [
      'getMyTournaments',
    ]);
    tournamentSpy.getMyTournaments.and.returnValue(
      of({ data: [internal, external], page: { page: 1, size: 20, total: 2 } }),
    );
    const names = {
      ensure: jasmine.createSpy('ensure'),
      label: (_id: string | undefined, fallback: string | undefined) => fallback ?? '',
    };

    await TestBed.configureTestingModule({
      imports: [TournamentsComponent],
      providers: [
        { provide: TournamentService, useValue: tournamentSpy },
        { provide: AuthService, useValue: { isOrganizer: () => false } },
        { provide: FacilityNamesService, useValue: names },
        { provide: SsDialogService, useValue: { open: () => of(undefined) } },
        { provide: SsToastService, useValue: { open: () => of(undefined) } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(TournamentsComponent, {
        // set:{imports} REPLACES the array — TPipe must ride along (NG0302).
        set: { imports: [CommonModule, TPipe], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(TournamentsComponent);
    (fixture.componentInstance as unknown as { isMobile: { set(v: boolean): void } }).isMobile.set(
      false,
    );
    fixture.detectChanges();
  });

  const rows = (): HTMLElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('[data-testid="tournament-row"]'));

  it('marks external tournaments with the «გარე» badge and links off-site registration', () => {
    const [first, second] = rows();
    expect(first.querySelector('[data-testid="external-badge"]')).toBeNull();
    expect(first.querySelector('[data-testid="external-link"]')).toBeNull();
    expect(first.textContent).toContain('4/16');

    const badge = second.querySelector('[data-testid="external-badge"]') as HTMLElement;
    expect(badge.textContent!.trim()).toBe('გარე');
    expect(badge.className).toContain('ss-badge');
    const link = second.querySelector('[data-testid="external-link"]') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('https://padelbatumi.ge/open');
    // the place line names the free-text venue and the organizer
    expect(second.textContent).toContain('ბათუმის ბულვარი · Padel Club Batumi');
    // registration happens off-site — our counter is not shown
    expect(second.textContent).not.toContain('0/16');
  });

  it('opens the console for internal tournaments only («მართვა»)', () => {
    const [first, second] = rows();
    const manage = first.querySelector('[data-testid="tournament-manage"]') as HTMLElement;
    expect(manage).not.toBeNull();
    expect(manage.textContent).toContain('მართვა');
    expect(second.querySelector('[data-testid="tournament-manage"]')).toBeNull();
  });
});

// docs/33 §2.5 / §5: events render as one block; lifecycle asks for the scope.
describe('TournamentsComponent — events and the engine', () => {
  let fixture: ComponentFixture<TournamentsComponent>;
  let tournamentSpy: jasmine.SpyObj<TournamentService>;
  let dialogOpen: jasmine.Spy;

  const men: Tournament = {
    ...internal,
    _id: 't-men',
    name: 'Autumn Open',
    category: 'men',
    status: 'draft',
    event: { id: 'ev-1', label: 'კაცები A', order: 0 },
  };
  const women: Tournament = {
    ...internal,
    _id: 't-women',
    name: 'Autumn Open',
    category: 'women',
    level: 'beginner',
    status: 'draft',
    event: { id: 'ev-1', order: 1 },
  };
  const drawn: Tournament = { ...internal, _id: 't-drawn', draw: { status: 'published' } };

  beforeEach(async () => {
    tournamentSpy = jasmine.createSpyObj<TournamentService>('TournamentService', [
      'getMyTournaments',
      'setStatus',
    ]);
    tournamentSpy.getMyTournaments.and.returnValue(
      of({ data: [women, men, drawn], page: { page: 1, size: 20, total: 3 } }),
    );
    tournamentSpy.setStatus.and.callFake((id: string) => of({ ...men, _id: id, status: 'published' }));
    dialogOpen = jasmine.createSpy('open').and.returnValue(of('all'));

    await TestBed.configureTestingModule({
      imports: [TournamentsComponent],
      providers: [
        { provide: TournamentService, useValue: tournamentSpy },
        { provide: AuthService, useValue: { isOrganizer: () => false } },
        {
          provide: FacilityNamesService,
          useValue: { ensure: () => undefined, label: (_id: string, fallback: string) => fallback ?? '' },
        },
        { provide: SsDialogService, useValue: { open: dialogOpen } },
        { provide: SsToastService, useValue: { open: () => of(undefined) } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(TournamentsComponent, {
        set: { imports: [CommonModule, TPipe], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(TournamentsComponent);
    (fixture.componentInstance as unknown as { isMobile: { set(v: boolean): void } }).isMobile.set(
      false,
    );
    fixture.detectChanges();
  });

  it('renders the event name once, then one row per category in event order', () => {
    const events = fixture.nativeElement.querySelectorAll('[data-testid="event-row"]');
    expect(events.length).toBe(1);
    expect(events[0].textContent).toContain('Autumn Open');
    const names = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="category-name"]')).map(
      (n) => (n as HTMLElement).textContent!.trim(),
    );
    // the label, else category · level
    expect(names).toEqual(['კაცები A', 'ქალები · დამწყები']);
  });

  it('hides the legacy results dialog once the engine has a draw', () => {
    const rowsAll = Array.from(
      fixture.nativeElement.querySelectorAll('[data-testid="tournament-row"]'),
    ) as HTMLElement[];
    const drawnRow = rowsAll[rowsAll.length - 1];
    expect(drawnRow.querySelector('[data-testid="tournament-results"]')).toBeNull();
    expect(drawnRow.querySelector('[data-testid="tournament-manage"]')).not.toBeNull();
  });

  it('a lifecycle action on a category offers «ყველა კატეგორია» and sends wholeEvent', () => {
    (fixture.componentInstance as unknown as { publish(t: Tournament): void }).publish(men);
    expect(dialogOpen).toHaveBeenCalled();
    expect(tournamentSpy.setStatus).toHaveBeenCalledWith('t-men', 'published', true);
    // every sibling may have moved: the list is read again
    expect(tournamentSpy.getMyTournaments).toHaveBeenCalledTimes(2);
  });

  it('«მხოლოდ ეს» moves this category only', () => {
    dialogOpen.and.returnValue(of('one'));
    (fixture.componentInstance as unknown as { publish(t: Tournament): void }).publish(women);
    expect(tournamentSpy.setStatus).toHaveBeenCalledWith('t-women', 'published', false);
    expect(tournamentSpy.getMyTournaments).toHaveBeenCalledTimes(1);
  });
});
