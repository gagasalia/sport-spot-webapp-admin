import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { ReservationsOverviewComponent } from './pages/reservations-overview/reservations-overview.component';

const routes: Routes = [
  {
    path: '',
    component: ReservationsOverviewComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ReservationsRoutingModule {}
