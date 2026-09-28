import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { of } from 'rxjs';

import { TournamentsComponent } from './tournaments.component';
import { TPipe } from '../../shared/i18n/t.pipe';
import { TournamentService } from '../../services/http-services/tournament.service';
import { FacilityNamesService } from '../../shared/i18n/facility-names.service';
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
});
