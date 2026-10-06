import { environment } from '../../environments/environment';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { ShellComponent } from './shell.component';
import { TPipe } from '../shared/i18n/t.pipe';
import { AuthService } from '../shared/services/auth.service';
import { TenantService } from '../shared/services/tenant.service';
import { SsDialogService } from '../shared/ui/dialog.service';

describe('ShellComponent', () => {
  // `isSuperAdmin` is a Signal; a plain stub exposing a callable signal models it
  // without dragging the real AuthService (and its HttpClient) into the test.
  let authStub: {
    isSuperAdmin: ReturnType<typeof signal<boolean>>;
    isOrganizer: ReturnType<typeof signal<boolean>>;
    logout: jasmine.Spy;
  };
  let tenantStub: { clear: jasmine.Spy };
  let dialogStub: { open: jasmine.Spy };

  beforeEach(async () => {
    authStub = {
      isSuperAdmin: signal(false),
      isOrganizer: signal(false),
      logout: jasmine.createSpy('logout'),
    };
    tenantStub = { clear: jasmine.createSpy('clear') };
    dialogStub = { open: jasmine.createSpy('open').and.returnValue(of(true)) };

    await TestBed.configureTestingModule({
      imports: [ShellComponent],
      providers: [
        provideRouter([]),
        provideAnimations(),
        { provide: AuthService, useValue: authStub },
        { provide: TenantService, useValue: tenantStub },
        { provide: SsDialogService, useValue: dialogStub },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      // set:{imports} REPLACES the array — TPipe must ride along or `| t` is NG0302;
      // NgTemplateOutlet stamps the nav list (desktop rail + mobile sheet share it).
      .overrideComponent(ShellComponent, {
        set: { imports: [NgTemplateOutlet, TPipe], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();
  });

  function signOut(): void {
    const fixture = TestBed.createComponent(ShellComponent);
    (fixture.componentInstance as unknown as { signOut(): void }).signOut();
  }

  it('should create the shell', () => {
    const fixture = TestBed.createComponent(ShellComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('confirmed signOut clears the session AND the cached tenant, then navigates to login', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');

    signOut();

    expect(dialogStub.open).toHaveBeenCalled();
    expect(authStub.logout).toHaveBeenCalled();
    // Regression guard: a cached tenant surviving sign-out makes the next
    // operator's modules render empty (stale `null` academy for superadmins).
    expect(tenantStub.clear).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/login']);
  });

  // The mobile bar hides most destinations behind the Menu sheet; while that
  // sheet is up the page behind it must not scroll away under the user's drag.
  it('the menu sheet locks and releases page scrolling', () => {
    const fixture = TestBed.createComponent(ShellComponent);
    const shell = fixture.componentInstance as unknown as {
      toggleMenu(): void;
      closeMenu(): void;
      menuOpen(): boolean;
    };
    fixture.detectChanges();

    shell.toggleMenu();
    fixture.detectChanges();
    expect(shell.menuOpen()).toBeTrue();
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overflow).toBe('hidden');

    shell.closeMenu();
    fixture.detectChanges();
    expect(shell.menuOpen()).toBeFalse();
    expect(document.body.style.overflow).toBe('');
    expect(document.documentElement.style.overflow).toBe('');
  });

  // The venues directory is a superadmin tool; it lives in the (always open)
  // Super Admin group right after «იუზერები» and must not leak to operators.
  it('shows the venues directory entry to superadmins only', () => {
    const fixture = TestBed.createComponent(ShellComponent);
    (fixture.componentInstance as unknown as { isMobile: { set(v: boolean): void } }).isMobile.set(
      false,
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[automation-id="venues"]')).toBeNull();

    authStub.isSuperAdmin.set(true);
    fixture.detectChanges();
    const link: HTMLElement = fixture.nativeElement.querySelector('[automation-id="venues"]');
    expect(link).not.toBeNull();
    expect(link.getAttribute('routerLink')).toBe('/venues');
    expect(link.textContent).toContain('კლუბები');
    // …and its twin for resorts with padel courts, same list pre-filtered
    const resorts: HTMLElement = fixture.nativeElement.querySelector('[automation-id="resorts"]');
    expect(resorts.getAttribute('routerLink')).toBe('/venues');
    expect(resorts.textContent).toContain('კურორტები');
    // placed in the Super Admin group, after Users — without any toggle click
    const previous = link.previousElementSibling as HTMLElement;
    expect(previous.getAttribute('routerLink')).toBe('/super-admin/user-management');
  });

  // The blog editor is a superadmin tool too; its entry follows the venues
  // directory in both hosts of the nav list (desktop rail + mobile Menu sheet).
  it('shows the articles entry to superadmins only, right after the venues directory', () => {
    const fixture = TestBed.createComponent(ShellComponent);
    const shell = fixture.componentInstance as unknown as {
      isMobile: { set(v: boolean): void };
      toggleMenu(): void;
      closeMenu(): void;
    };
    shell.isMobile.set(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[automation-id="articles"]')).toBeNull();

    authStub.isSuperAdmin.set(true);
    fixture.detectChanges();
    const link: HTMLElement = fixture.nativeElement.querySelector('[automation-id="articles"]');
    expect(link).not.toBeNull();
    expect(link.getAttribute('routerLink')).toBe('/articles');
    expect(link.textContent).toContain('სტატიები');
    const previous = link.previousElementSibling as HTMLElement;
    expect(previous.getAttribute('automation-id')).toBe('resorts');

    // Mobile: the same entry lives in the Menu sheet.
    shell.isMobile.set(true);
    shell.toggleMenu();
    fixture.detectChanges();
    const sheetLink = fixture.nativeElement.querySelector(
      '.menu-sheet [automation-id="articles"]',
    );
    expect(sheetLink).not.toBeNull();

    // Release the page-scroll lock the open sheet applied.
    shell.closeMenu();
    fixture.detectChanges();
  });

  // Ranking results moderation (docs/25 §6.5) is superadmin-only: its entry
  // lives in the Super Admin group, in both hosts of the nav list.
  it('shows the results-moderation entry to superadmins only', () => {
    const fixture = TestBed.createComponent(ShellComponent);
    const shell = fixture.componentInstance as unknown as {
      isMobile: { set(v: boolean): void };
      toggleMenu(): void;
      closeMenu(): void;
    };
    shell.isMobile.set(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[automation-id="ranking-moderation"]')).toBeNull();

    authStub.isSuperAdmin.set(true);
    fixture.detectChanges();
    const link: HTMLElement = fixture.nativeElement.querySelector(
      '[automation-id="ranking-moderation"]',
    );
    expect(link.getAttribute('routerLink')).toBe('/super-admin/ranking-moderation');
    expect(link.textContent).toContain('შედეგების მოდერაცია');

    shell.isMobile.set(true);
    shell.toggleMenu();
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('.menu-sheet [automation-id="ranking-moderation"]'),
    ).not.toBeNull();

    // Release the page-scroll lock the open sheet applied.
    shell.closeMenu();
    fixture.detectChanges();
  });

  // The coaches module is switched off (environment.coachesEnabled = false)
  // until real coaches exist: no nav entry for anyone, in either nav host.
  it('hides the coaches entry while the module is switched off', () => {
    expect(environment.coachesEnabled).toBeFalse();
    const fixture = TestBed.createComponent(ShellComponent);
    const shell = fixture.componentInstance as unknown as {
      isMobile: { set(v: boolean): void };
      toggleMenu(): void;
      closeMenu(): void;
    };
    shell.isMobile.set(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[automation-id="coaches"]')).toBeNull();

    authStub.isSuperAdmin.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[automation-id="coaches"]')).toBeNull();

    shell.isMobile.set(true);
    shell.toggleMenu();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.menu-sheet [automation-id="coaches"]')).toBeNull();

    // Release the page-scroll lock the open sheet applied.
    shell.closeMenu();
    fixture.detectChanges();
  });

  // The Super Admin group never collapses: clicking its header on the expanded
  // rail keeps every sub-item visible.
  it('keeps the super-admin group open when its header is clicked', () => {
    const fixture = TestBed.createComponent(ShellComponent);
    (fixture.componentInstance as unknown as { isMobile: { set(v: boolean): void } }).isMobile.set(
      false,
    );
    authStub.isSuperAdmin.set(true);
    fixture.detectChanges();
    const header: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[automation-id="super-admin"]',
    );
    header.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[automation-id="venues"]')).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('[routerLink="/super-admin/user-management"]'),
    ).not.toBeNull();
  });

  // docs/33 §6: a tournament maker sees ONLY «ტურნირები» — rail, sheet and tab bar.
  it('shows an organizer nothing but tournaments, on desktop and on mobile', () => {
    authStub.isOrganizer.set(true);
    const fixture = TestBed.createComponent(ShellComponent);
    const shell = fixture.componentInstance as unknown as { isMobile: { set(v: boolean): void } };
    shell.isMobile.set(false);
    fixture.detectChanges();

    const navLinks = (): string[] =>
      Array.from(fixture.nativeElement.querySelectorAll('.aside-nav [routerLink]')).map(
        (a) => (a as HTMLElement).getAttribute('routerLink') ?? '',
      );
    expect(navLinks()).toEqual(['/tournaments']);
    expect(fixture.nativeElement.querySelector('[automation-id="setting"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[automation-id="reservations"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[automation-id="customers"]')).toBeNull();

    shell.isMobile.set(true);
    fixture.detectChanges();
    const tabs = Array.from(fixture.nativeElement.querySelectorAll('.tab-bar .tab-item')) as HTMLElement[];
    expect(tabs.length).toBe(1);
    expect(tabs[0].getAttribute('automation-id')).toBe('tab-tournaments');
    expect(fixture.nativeElement.querySelector('[automation-id="tab-menu"]')).toBeNull();
  });

  it('keeps today’s navigation for an admin', () => {
    const fixture = TestBed.createComponent(ShellComponent);
    (fixture.componentInstance as unknown as { isMobile: { set(v: boolean): void } }).isMobile.set(
      false,
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[automation-id="reservations"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[automation-id="tournaments"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[automation-id="setting"]')).not.toBeNull();
  });

  it('declined signOut leaves the session untouched', () => {
    dialogStub.open.and.returnValue(of(false));
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');

    signOut();

    expect(authStub.logout).not.toHaveBeenCalled();
    expect(tenantStub.clear).not.toHaveBeenCalled();
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
