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
    path: '',
    redirectTo: 'configuration/facilities',
    pathMatch: 'full',
  },
];
