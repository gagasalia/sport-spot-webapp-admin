import { ChangeDetectionStrategy, Component } from '@angular/core';

interface ReservationItem {
  court: string;
  player: string;
  time: string;
  status: 'confirmed' | 'pending' | 'cancelled';
}

@Component({
  selector: 'app-reservations-overview',
  templateUrl: './reservations-overview.component.html',
  styleUrls: ['./reservations-overview.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReservationsOverviewComponent {
  readonly reservations: ReservationItem[] = [
    { court: 'Padel Court 1', player: 'Alex Hunter', time: '08:00 - 09:00', status: 'confirmed' },
    { court: 'Padel Court 2', player: 'Sofia Alvarez', time: '09:00 - 10:00', status: 'pending' },
    { court: 'Padel Court 3', player: 'Liam Chen', time: '10:00 - 11:30', status: 'confirmed' }
  ];
}
