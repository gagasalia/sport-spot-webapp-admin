import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, finalize, of, switchMap, take } from 'rxjs';
import { SHARED_TAIGA_IMPORTS } from '../../shared/shared.module';
import { AuthService } from '../../shared/services/auth.service';
import { TenantService } from '../../shared/services/tenant.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [...SHARED_TAIGA_IMPORTS, ReactiveFormsModule, CommonModule],
  templateUrl: './login.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly tenant = inject(TenantService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly isSubmitting = signal(false);
  /** Set to a Georgian message on a 401; cleared on a fresh submit. */
  readonly loginError = signal<string | null>(null);

  readonly loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loginError.set(null);
    this.isSubmitting.set(true);

    const { email, password } = this.loginForm.getRawValue();

    this.auth
      .login(email, password)
      .pipe(
        // Resolve the operator's tenant before entering the app; superadmins
        // resolve to null and proceed. A tenant-resolution failure must not
        // block login, so swallow it here.
        switchMap(() => this.tenant.resolveAcademy().pipe(catchError(() => of(null)))),
        take(1),
        finalize(() => this.isSubmitting.set(false)),
      )
      .subscribe({
        next: () => {
          const returnUrl = this.sanitizeReturnUrl(
            this.route.snapshot.queryParamMap.get('returnUrl'),
          );
          this.router.navigateByUrl(returnUrl);
        },
        error: (err: HttpErrorResponse) => {
          if (err.status === 401) {
            this.loginError.set('ელ. ფოსტა ან პაროლი არასწორია');
          } else {
            this.loginError.set('მოხდა შეცდომა, გთხოვთ სცადოთ მოგვიანებით');
          }
        },
      });
  }

  /**
   * Guards against open-redirect: only same-origin, absolute-path returnUrls are
   * honoured. A value must start with a single '/' (not '//', which the browser
   * treats as a protocol-relative external URL) — anything else falls back to '/'.
   */
  private sanitizeReturnUrl(returnUrl: string | null): string {
    if (returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//')) {
      return returnUrl;
    }
    return '/';
  }
}
