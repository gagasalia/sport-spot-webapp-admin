import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { PaymentsOverviewComponent } from './pages/payments-overview/payments-overview.component';

const routes: Routes = [
  {
    path: '',
    component: PaymentsOverviewComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PaymentsRoutingModule {}
