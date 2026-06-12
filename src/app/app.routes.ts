import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'configuration/facilities',
    loadComponent: () =>
      import('./pages/configuration/facilities/facilities.component').then(
        (m) => m.FacilitiesComponent,
      ),
  },
  {
    path: 'configuration/courts',
    loadComponent: () =>
      import('./pages/configuration/courts/courts.component').then((m) => m.CourtsComponent),
  },
  {
    path: 'configuration/working-hours',
    loadComponent: () =>
      import('./pages/configuration/working-hours-and-prices/working-hours-and-prices.component').then(
        (m) => m.WorkingHoursAndPricesComponent,
      ),
  },
  {
    path: 'configuration/academy',
    loadComponent: () =>
      import('./pages/configuration/academy/academy.component').then((m) => m.AcademyComponent),
  },
  {
    path: 'super-admin/academies-management',
    loadComponent: () =>
      import('./pages/super-admin/academies-management/academies-management.component').then(
        (m) => m.AcademiesManagementComponent,
      ),
  },
  {
    path: 'super-admin/user-management',
    loadComponent: () =>
      import('./pages/super-admin/user-management/user-management.component').then(
        (m) => m.UserManagementComponent,
      ),
  },
  {
    path: '',
    redirectTo: 'configuration/academy',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: 'configuration/academy',
  },
];
