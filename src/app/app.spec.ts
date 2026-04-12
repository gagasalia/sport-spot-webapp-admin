import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { WA_WINDOW, WA_LOCAL_STORAGE } from '@ng-web-apis/common';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        provideAnimations(),
        { provide: WA_WINDOW, useValue: window },
        { provide: WA_LOCAL_STORAGE, useValue: localStorage },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(App, { set: { imports: [], schemas: [NO_ERRORS_SCHEMA] } })
      .compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});
