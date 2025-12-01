import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'configuration/facilities',
    loadComponent: () =>
      import('./pages/configuration/facilities/facilities.component').then(
        (m) => m.FacilitiesComponent
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
      import(
        './pages/configuration/working-hours-and-prices/working-hours-and-prices.component'
      ).then((m) => m.WorkingHoursAndPricesComponent),
  },
  {
    path: 'configuration/academy',
    loadComponent: () =>
      import('./pages/configuration/academy/academy.component').then((m) => m.AcademyComponent),
  },
  {
    path: '',
    redirectTo: 'configuration/facilities',
    pathMatch: 'full',
  },
];
