import { Routes } from '@angular/router';
import { authGuard } from './shared/guards/auth.guard';
import { superAdminGuard } from './shared/guards/super-admin.guard';

export const routes: Routes = [
  {
    // Public route: rendered bare (no shell chrome) and behind no guard.
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    // Authenticated app shell. The parent-level guard protects every child —
    // including the empty-path and wildcard redirects — so no guarded surface
    // can be reached without authentication.
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./shell/shell.component').then((m) => m.ShellComponent),
    children: [
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
        path: 'reservations',
        loadComponent: () =>
          import('./pages/reservations/reservations.component').then(
            (m) => m.ReservationsComponent,
          ),
      },
      {
        path: 'super-admin/academies-management',
        canActivate: [superAdminGuard],
        loadComponent: () =>
          import(
            './pages/super-admin/academies-management/academies-management.component'
          ).then((m) => m.AcademiesManagementComponent),
      },
      {
        path: 'super-admin/user-management',
        canActivate: [superAdminGuard],
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
    ],
  },
];
