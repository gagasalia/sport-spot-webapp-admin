import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, of, tap } from 'rxjs';
import { AcademyService } from '../../services/http-services/academy.service';
import { Academy } from '../models/academy.model';
import { AuthService } from './auth.service';

/**
 * Holds the tenant (academy) context for the logged-in operator.
 *
 * Replaces the hard-coded `environment.academyId`: after login an operator
 * resolves their academy through `GET /academy/:id` using their own user id —
 * the backend `$or:[{_id},{admins}]` lookup returns the academy they administer.
 * Superadmins have no single tenant (they use the super-admin pages) and skip
 * resolution.
 */
@Injectable({
  providedIn: 'root',
})
export class TenantService {
  private readonly auth = inject(AuthService);
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
   * Resolves and caches the operator's academy. Superadmins resolve to `null`
   * (no single tenant). Subsequent calls return the cached result, including a
   * cached `null`.
   */
  resolveAcademy(): Observable<Academy | null> {
    if (this._resolved()) {
      return of(this._academy());
    }

    if (this.auth.isSuperAdmin()) {
      this.setAcademy(null);
      return of(null);
    }

    const userId = this.auth.currentUser()?.sub;
    if (!userId) {
      this.setAcademy(null);
      return of(null);
    }

    return this.academyService.getAcademyById(userId).pipe(
      tap((academy) => this.setAcademy(academy)),
    );
  }

  /** Clears the cached tenant context (call on logout). */
  clear(): void {
    this._academyId.set(null);
    this._academy.set(null);
    this._resolved.set(false);
  }

  private setAcademy(academy: Academy | null): void {
    this._academy.set(academy);
    this._academyId.set(academy?._id ?? null);
    this._resolved.set(true);
  }
}
