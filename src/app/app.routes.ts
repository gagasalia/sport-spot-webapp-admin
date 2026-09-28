import { Routes } from '@angular/router';

import { environment } from '../environments/environment';
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
        // Venues directory (docs/26 §WP-1b) — superadmin-only, like /super-admin/*.
        // `new` precedes `:id` so it is never read as a venue id.
        path: 'venues',
        canActivate: [superAdminGuard],
        loadComponent: () =>
          import('./pages/venues/venues.component').then((m) => m.VenuesComponent),
      },
      {
        path: 'venues/new',
        canActivate: [superAdminGuard],
        loadComponent: () =>
          import('./pages/venues/venue-edit/venue-edit.component').then(
            (m) => m.VenueEditComponent,
          ),
      },
      {
        path: 'venues/:id',
        canActivate: [superAdminGuard],
        loadComponent: () =>
          import('./pages/venues/venue-edit/venue-edit.component').then(
            (m) => m.VenueEditComponent,
          ),
      },
      {
        // Articles / blog (docs/26 §WP-3) — superadmin-only, like the venues
        // directory. `new` precedes `:id` so it is never read as an article id.
        path: 'articles',
        canActivate: [superAdminGuard],
        loadComponent: () =>
          import('./pages/articles/articles.component').then((m) => m.ArticlesComponent),
      },
      {
        path: 'articles/new',
        canActivate: [superAdminGuard],
        loadComponent: () =>
          import('./pages/articles/article-edit/article-edit.component').then(
            (m) => m.ArticleEditComponent,
          ),
      },
      {
        path: 'articles/:id',
        canActivate: [superAdminGuard],
        loadComponent: () =>
          import('./pages/articles/article-edit/article-edit.component').then(
            (m) => m.ArticleEditComponent,
          ),
      },
      // Coaches directory (docs/26 §WP-1d) — ADMIN and SUPERADMIN alike (the
      // parent authGuard admits exactly those roles); the API scopes an
      // operator to their own academy's coaches. `new` precedes `:id`.
      // Registered only while environment.coachesEnabled (off until real
      // coaches exist — owner decision 2026-09-29).
      ...(environment.coachesEnabled
        ? ([
            {
              path: 'coaches',
              loadComponent: () =>
                import('./pages/coaches/coaches.component').then((m) => m.CoachesComponent),
            },
            {
              path: 'coaches/new',
              loadComponent: () =>
                import('./pages/coaches/coach-edit/coach-edit.component').then(
                  (m) => m.CoachEditComponent,
                ),
            },
            {
              path: 'coaches/:id',
              loadComponent: () =>
                import('./pages/coaches/coach-edit/coach-edit.component').then(
                  (m) => m.CoachEditComponent,
                ),
            },
          ] as Routes)
        : []),
      {
        path: 'reservations',
        loadComponent: () =>
          import('./pages/reservations/reservations.component').then(
            (m) => m.ReservationsComponent,
          ),
      },
      {
        path: 'vouchers',
        loadComponent: () =>
          import('./pages/vouchers/vouchers.component').then((m) => m.VouchersComponent),
      },
      {
        path: 'promocodes',
        loadComponent: () =>
          import('./pages/promocodes/promocodes.component').then((m) => m.PromocodesComponent),
      },
      {
        path: 'campaigns',
        loadComponent: () =>
          import('./pages/campaigns/campaigns.component').then((m) => m.CampaignsComponent),
      },
      {
        path: 'tournaments',
        loadComponent: () =>
          import('./pages/tournaments/tournaments.component').then(
            (m) => m.TournamentsComponent,
          ),
      },
      {
        path: 'matches',
        loadComponent: () =>
          import('./pages/matches/matches.component').then((m) => m.MatchesComponent),
      },
      {
        path: 'statistics',
        loadComponent: () =>
          import('./pages/statistics/statistics.component').then(
            (m) => m.StatisticsComponent,
          ),
      },
      {
        path: 'customers',
        loadComponent: () =>
          import('./pages/customers/customers.component').then(
            (m) => m.CustomersComponent,
          ),
      },
      {
        path: 'customers/:id',
        loadComponent: () =>
          import('./pages/customers/customer-detail/customer-detail.component').then(
            (m) => m.CustomerDetailComponent,
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
        redirectTo: 'reservations',
        pathMatch: 'full',
      },
      {
        path: '**',
        redirectTo: 'reservations',
      },
    ],
  },
];
