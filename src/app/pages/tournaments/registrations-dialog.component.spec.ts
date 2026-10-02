import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';

import { RegistrationsDialogComponent } from './registrations-dialog.component';
import { TPipe } from '../../shared/i18n/t.pipe';
import { TournamentService } from '../../services/http-services/tournament.service';
import { SS_DIALOG_CONTEXT } from '../../shared/ui/dialog.service';
import { SsToastService } from '../../shared/ui/toast.service';
import { SsAvatarComponent } from '../../shared/ui/ss-avatar.component';
import { Tournament, TournamentRegistration } from '../../shared/models/tournament.model';

const tournament = { _id: 't1', type: 'doubles' } as Tournament;

const regs: TournamentRegistration[] = [
  {
    _id: 'r1',
    tournament: 't1',
    user: 'u1',
    status: 'registered',
    playerName: 'Nino',
    partnerName: 'Luka',
    partnerPhone: '+995555000002',
    paymentStatus: 'paid',
  },
  {
    _id: 'r2',
    tournament: 't1',
    user: 'u2',
    status: 'registered',
    playerName: 'Giorgi',
    partnerName: 'Dato',
    paymentStatus: 'pay_at_venue',
  },
];

describe('RegistrationsDialogComponent', () => {
  let fixture: ComponentFixture<RegistrationsDialogComponent>;
  let component: RegistrationsDialogComponent;
  let tournamentSpy: jasmine.SpyObj<TournamentService>;

  async function setup(t: Tournament = tournament) {
    tournamentSpy = jasmine.createSpyObj<TournamentService>('TournamentService', [
      'getRegistrations',
      'updateRegistration',
    ]);
    tournamentSpy.getRegistrations.and.returnValue(of(regs));
    await TestBed.configureTestingModule({
      imports: [RegistrationsDialogComponent],
      providers: [
        { provide: SS_DIALOG_CONTEXT, useValue: { data: { tournament: t } } },
        { provide: TournamentService, useValue: tournamentSpy },
        { provide: SsToastService, useValue: { open: () => of(undefined) } },
      ],
    })
      .overrideComponent(RegistrationsDialogComponent, {
        // set:{imports} REPLACES the array — TPipe must ride along (NG0302),
        // FormsModule drives the inline partner edit.
        set: { imports: [CommonModule, DatePipe, FormsModule, SsAvatarComponent, TPipe] },
      })
      .compileComponents();
    fixture = TestBed.createComponent(RegistrationsDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const all = (testId: string) => Array.from(el().querySelectorAll(`[data-testid="${testId}"]`));
  const c = () => component as unknown as Record<string, any>;

  it('doubles rows show the partner phone, or that it is missing', async () => {
    await setup();
    const lines = all('reg-partner').map((l) => l.textContent?.replace(/\s+/g, ' ').trim());
    expect(lines[0]).toContain('+995555000002');
    expect(lines[1]).toContain('ტელეფონი აკლია');
  });

  it('singles tournaments show no partner line', async () => {
    await setup({ ...tournament, type: 'singles' });
    expect(all('reg-partner').length).toBe(0);
  });

  describe('inline partner edit', () => {
    beforeEach(async () => setup());

    it('edit → PATCH → the row shows the saved phone and the editor closes', () => {
      tournamentSpy.updateRegistration.and.returnValue(
        of({ ...regs[1], partnerPhone: '+995555000004' }),
      );
      c()['startEdit'](regs[1]);
      fixture.detectChanges();
      expect(all('reg-partner-form').length).toBe(1);

      c()['draftPhone'].set('555 000 004');
      fixture.detectChanges();
      (el().querySelector('[data-testid="reg-partner-save"]') as HTMLButtonElement).click();
      fixture.detectChanges();

      // only the changed field travels (the name is untouched)
      expect(tournamentSpy.updateRegistration).toHaveBeenCalledOnceWith('t1', 'r2', {
        partnerPhone: '555 000 004',
      });
      expect(all('reg-partner-form').length).toBe(0);
      expect(all('reg-partner')[1].textContent).toContain('+995555000004');
    });

    it('an invalid or unchanged draft cannot be saved', () => {
      c()['startEdit'](regs[0]);
      expect(c()['editDto'](regs[0])).toBeNull(); // nothing changed
      c()['draftPhone'].set('12');
      expect(c()['draftPhoneInvalid']()).toBeTrue();
      expect(c()['editDto'](regs[0])).toBeNull();
      // the same number in another shape is not a change either
      c()['draftPhone'].set('555 000 002');
      expect(c()['editDto'](regs[0])).toBeNull();
      c()['draftName'].set('Luka Beridze');
      expect(c()['editDto'](regs[0])).toEqual({ partnerName: 'Luka Beridze' });
    });

    it('an API error stays inline and keeps the editor open', () => {
      tournamentSpy.updateRegistration.and.returnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 400,
              error: { errors: [{ statusCode: 400, message: 'Nothing to update' }] },
            }),
        ),
      );
      c()['startEdit'](regs[1]);
      c()['draftPhone'].set('555000004');
      c()['saveEdit'](regs[1]);
      fixture.detectChanges();

      expect(all('reg-partner-form').length).toBe(1);
      const error = all('reg-partner-error')[0]?.textContent ?? '';
      expect(error).toContain('შენახვა ვერ მოხერხდა, სცადეთ თავიდან');
      expect(error).toContain('Nothing to update');
    });
  });
});
