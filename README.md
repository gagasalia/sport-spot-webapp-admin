# Sport Spot Admin

Operator/admin web app for **Sport Spot**, a court-booking platform for sports
academies in Georgia (launch market: padel in Tbilisi). Academies (tenants) own
facilities, facilities contain courts, and courts are booked in priced time slots.
This app is what academy operators and superadmins use to manage that inventory and
the booking calendar; players use a separate (planned) app. It talks to the
`sport-spot-api` NestJS backend.

For the product picture, phased plan, and pinned conventions, see [`../docs`](../docs)
(start with `01-current-state.md` and `03-admin-completion-plan.md`).

## Stack

- **Angular 20** — standalone components, signals, lazy-loaded routes, OnPush
- **Taiga UI 4.64** + **Tailwind CSS 4** for UI
- **Reactive Forms**; RxJS for API streams, signals for local/derived state
- **Karma + Jasmine** (ChromeHeadless) for unit tests
- **ESLint** (angular-eslint flat config) + Prettier

## Environments

Config lives in `src/environments/`; the build swaps the file via `fileReplacements`:

- `environment.ts` / `environment.dev.ts` — local dev, `apiUrl: http://localhost:3000`
- `environment.prod.ts` — production build (currently points at the staging API
  Gateway stage until a dedicated prod stage exists)

The only field is `apiUrl`. There is **no `academyId`** any more: post-auth, the
operator's academy is resolved at runtime by `TenantService` (it calls
`GET /academy/:id` with the logged-in user's id; the backend `$or:[{_id},{admins}]`
lookup returns the academy they administer). Superadmins have no single tenant.

## Local development

Run the backend first so `apiUrl` resolves:

```bash
# in ../sport-spot-api
npm start            # NestJS dev server on http://localhost:3000
```

Then start the admin (serves on http://localhost:4200, also builds Tailwind CSS):

```bash
npm install          # honors .npmrc legacy-peer-deps (Angular 20 vs google-maps 21 peer)
npm start
```

## Commands

```bash
npm start            # dev server + Tailwind watch
npm run build        # production build to dist/
npm test             # unit tests (interactive Karma)
npm test -- --watch=false --browsers=ChromeHeadless   # headless single run (CI mode)
npm run lint         # ESLint with --fix
npm run lint:check   # ESLint, no fixes (CI gate)
```

## CI

`.github/workflows/ci.yml` runs on push/PR to `develop` and `main`: Node 22, `npm ci`,
`lint:check`, the ChromeHeadless test suite, then `ng build`. GitHub-hosted runners
ship Chrome preinstalled, so no extra browser setup is needed.

## Project layout

```
src/app/
  pages/        feature pages (lazy-loaded): configuration/*, reservations, super-admin/*, login
  services/     http-services/* — one service per backend resource
  shared/       models, enums, guards, interceptors, services (auth, tenant, loading), utils
  shell/        authenticated app chrome
public/         favicon.ico, logos/, images/  (copied to build output as assets)
```
