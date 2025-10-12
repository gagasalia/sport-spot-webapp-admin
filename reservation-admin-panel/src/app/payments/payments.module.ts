import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { TimelineModule } from 'primeng/timeline';

import { SharedModule } from '../shared/shared.module';
import { PaymentsRoutingModule } from './payments-routing.module';
import { PaymentsOverviewComponent } from './pages/payments-overview/payments-overview.component';

@NgModule({
  declarations: [PaymentsOverviewComponent],
  imports: [CommonModule, SharedModule, PaymentsRoutingModule, CardModule, ChartModule, TimelineModule]
})
export class PaymentsModule {}
