import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';

interface PaymentEvent {
  status: string;
  detail: string;
  date: string;
}

@Component({
  selector: 'app-payments-overview',
  templateUrl: './payments-overview.component.html',
  styleUrls: ['./payments-overview.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PaymentsOverviewComponent {
  readonly revenueData: ChartData<'line'> = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'Revenue',
        data: [420, 560, 610, 540, 680, 720, 610],
        fill: false,
        borderColor: '#6366F1',
        tension: 0.4
      }
    ]
  };

  readonly revenueOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        }
      },
      y: {
        ticks: {
          callback: (value: string | number) => `$${value}`
        }
      }
    }
  };

  readonly paymentTimeline: PaymentEvent[] = [
    { status: 'Completed', detail: 'Monthly membership - Alex Hunter', date: '08:30' },
    { status: 'Pending', detail: 'Court rental - Sofia Alvarez', date: '09:45' },
    { status: 'Refunded', detail: 'Event cancellation - Liam Chen', date: '11:10' }
  ];
}
