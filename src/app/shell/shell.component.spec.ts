import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { WA_WINDOW, WA_LOCAL_STORAGE } from '@ng-web-apis/common';

import { ShellComponent } from './shell.component';
import { AuthService } from '../shared/services/auth.service';

describe('ShellComponent', () => {
  // `isSuperAdmin` is a Signal; a plain stub exposing a callable signal models it
  // without dragging the real AuthService (and its HttpClient) into the test.
  const authStub = { isSuperAdmin: signal(false) };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShellComponent],
      providers: [
        provideRouter([]),
        provideAnimations(),
        { provide: AuthService, useValue: authStub },
        { provide: WA_WINDOW, useValue: window },
        { provide: WA_LOCAL_STORAGE, useValue: localStorage },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(ShellComponent, { set: { imports: [], schemas: [NO_ERRORS_SCHEMA] } })
      .compileComponents();
  });

  it('should create the shell', () => {
    const fixture = TestBed.createComponent(ShellComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
