import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';

import { SharedModule } from '../shared/shared.module';
import { ReservationsRoutingModule } from './reservations-routing.module';
import { ReservationsOverviewComponent } from './pages/reservations-overview/reservations-overview.component';

@NgModule({
  declarations: [ReservationsOverviewComponent],
  imports: [CommonModule, SharedModule, ReservationsRoutingModule, CardModule, TableModule, TagModule, ButtonModule]
})
export class ReservationsModule {}
