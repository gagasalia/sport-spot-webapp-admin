import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'courts',
    loadComponent: () =>
      import('./pages/configuration/courts/courts.component').then((m) => m.CourtsComponent),
  },
  {
    path: 'configuration/facilities',
    loadComponent: () =>
      import('./pages/configuration/facilities/facilities.component').then(
        (m) => m.FacilitiesComponent
      ),
  },
  {
    path: 'facilities',
    redirectTo: 'configuration/facilities',
    pathMatch: 'full',
  },
  {
    path: '',
    redirectTo: 'configuration/facilities',
    pathMatch: 'full',
  },
];
