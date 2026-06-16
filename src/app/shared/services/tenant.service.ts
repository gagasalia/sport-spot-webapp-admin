import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, of, shareReplay, tap } from 'rxjs';
import { AcademyService } from '../../services/http-services/academy.service';
import { Academy } from '../models/academy.model';

/**
 * Holds the tenant (academy) context for the logged-in operator.
 *
 * Replaces the hard-coded `environment.academyId`: an operator resolves their
 * academy through `GET /academy/my`. The backend derives the academy from the
 * caller's admin membership (returning `null` data for a superadmin or an
 * operator with no academy), so a single call works for every operator —
 * unlike `GET /academy/:id`, which the API 403s for non-superadmins.
 */
@Injectable({
  providedIn: 'root',
})
export class TenantService {
  private readonly academyService = inject(AcademyService);

  private readonly _academyId = signal<string | null>(null);
  /** The resolved academy `_id` for the current operator, or `null`. */
  readonly academyId = this._academyId.asReadonly();

  private readonly _academy = signal<Academy | null>(null);
  /** The resolved academy document, or `null` until loaded. */
  readonly academy = this._academy.asReadonly();

  /**
   * Whether resolution has completed at least once. Tracked explicitly so a
   * legitimately-`null` result (superadmin, or an operator with no academy) is
   * cached and not re-fetched on every call — a `null` academy is falsy and
   * cannot itself signal "already resolved".
   */
  private readonly _resolved = signal<boolean>(false);

  readonly hasTenant = computed(() => this._academyId() !== null);

  /**
   * In-flight / completed resolution stream. `shareReplay(1)` replays the
   * resolved academy to late subscribers (e.g. a page that initializes after
   * the login flow already resolved), and de-duplicates concurrent first calls
   * into a single `GET /academy/my`.
   */
  private resolve$: Observable<Academy | null> | null = null;

  /**
   * Resolves and caches the operator's academy via `GET /academy/my`.
   * Subsequent calls return the cached result, including a cached `null`.
   */
  resolveAcademy(): Observable<Academy | null> {
    if (this._resolved()) {
      return of(this._academy());
    }
    return this.ensure();
  }

  /**
   * Resolves the tenant once and replays the cached result to every later
   * subscriber. Tenant-consuming pages drive their initial load through this so
   * a hard refresh / deep link (where the login flow never ran) still resolves
   * the academy before reading `academyId()` — instead of synchronously reading
   * a still-`null` signal and rendering an empty state forever.
   */
  ensure(): Observable<Academy | null> {
    if (this._resolved()) {
      return of(this._academy());
    }
    if (!this.resolve$) {
      this.resolve$ = this.academyService.getMyAcademy().pipe(
        tap((academy) => this.setAcademy(academy)),
        shareReplay(1),
      );
    }
    return this.resolve$;
  }

  /** Clears the cached tenant context (call on logout). */
  clear(): void {
    this._academyId.set(null);
    this._academy.set(null);
    this._resolved.set(false);
    this.resolve$ = null;
  }

  private setAcademy(academy: Academy | null): void {
    this._academy.set(academy);
    this._academyId.set(academy?._id ?? null);
    this._resolved.set(true);
  }
}
