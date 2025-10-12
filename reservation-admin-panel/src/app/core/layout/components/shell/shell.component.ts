import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MenuItem } from 'primeng/api';

@Component({
  selector: 'app-shell',
  templateUrl: './shell.component.html',
  styleUrls: ['./shell.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShellComponent {
  readonly menuItems: MenuItem[] = [
    {
      label: 'Dashboard',
      icon: 'pi pi-home',
      routerLink: ['/reservations']
    },
    {
      label: 'Reservations',
      icon: 'pi pi-calendar-clock',
      routerLink: ['/reservations']
    },
    {
      label: 'Users',
      icon: 'pi pi-users',
      routerLink: ['/users']
    },
    {
      label: 'Payments',
      icon: 'pi pi-wallet',
      routerLink: ['/payments']
    }
  ];

  sidebarVisible = false;

  toggleSidebar(): void {
    this.sidebarVisible = !this.sidebarVisible;
  }

  onSidebarVisibilityChange(visible: boolean): void {
    this.sidebarVisible = visible;
  }
}
