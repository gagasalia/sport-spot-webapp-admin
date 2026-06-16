import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideEventPlugins } from '@taiga-ui/event-plugins';
import { TuiButton, TuiDataList, TuiDropdown, TuiOption, TuiRoot } from '@taiga-ui/core';

/**
 * Acceptance for SHOULD-FIX 3 (Taiga dropdown portal wiring).
 *
 * A `[tuiDropdown]` opened over a real `TuiRoot` exercises the exact path that
 * threw before the fix: `TuiDropdownService.add()` → portal host
 * `addComponentChild()` → `vcr.createComponent(...)`. The Phase-2 shell split
 * re-provided `TuiDropdownService` + `tuiAsPortal` and extended `TuiPortals`
 * without a `#viewContainer`, so `vcr` was undefined and every dropdown open
 * logged "Cannot read properties of undefined (reading 'createComponent')".
 *
 * With the portal wiring removed from `ShellComponent`, `TuiRoot` (which renders
 * `<tui-dropdowns>`) owns the portal host. This host renders the dropdown inside
 * a real `TuiRoot` WITHOUT a rogue `TuiDropdownService` provider (mirroring the
 * fixed shell), so it would reproduce the original error if the regression
 * returned, and passes cleanly with the fix — no "createComponent" console error.
 */
@Component({
  standalone: true,
  imports: [TuiRoot, TuiButton, TuiDropdown, TuiDataList, TuiOption],
  template: `
    <tui-root>
      <button
        tuiButton
        type="button"
        [tuiDropdown]="content"
        [tuiDropdownManual]="open()"
      >
        Open
      </button>
      <ng-template #content>
        <tui-data-list role="menu">
          <button tuiOption type="button">Item</button>
        </tui-data-list>
      </ng-template>
    </tui-root>
  `,
})
class DropdownHostComponent {
  readonly open = signal(false);
}

describe('Taiga dropdown portal wiring (SHOULD-FIX 3)', () => {
  let fixture: ComponentFixture<DropdownHostComponent>;
  let errorSpy: jasmine.Spy;

  beforeEach(async () => {
    errorSpy = spyOn(console, 'error').and.callThrough();

    await TestBed.configureTestingModule({
      imports: [DropdownHostComponent],
      providers: [provideAnimations(), provideEventPlugins()],
    }).compileComponents();

    fixture = TestBed.createComponent(DropdownHostComponent);
    fixture.detectChanges();
  });

  /** Console errors mentioning the portal failure signature. */
  function portalErrors(): unknown[][] {
    return errorSpy.calls
      .allArgs()
      .filter((args) =>
        args.some(
          (a) =>
            (typeof a === 'string' && a.includes('createComponent')) ||
            (a instanceof Error && a.message.includes('createComponent')),
        ),
      );
  }

  it('opens a dropdown over TuiRoot with NO "createComponent" portal error', fakeAsync(() => {
    // Open the dropdown — this is the call that previously threw because the
    // shell-provided portal host had no view container.
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    // The dropdown content is rendered into the TuiRoot-owned portal host…
    const rendered = document.body.textContent ?? '';
    expect(rendered).toContain('Item');
    // …and crucially, no portal "createComponent" error was logged.
    expect(portalErrors()).toEqual([]);
  }));

  it('closing the dropdown also produces no portal error', fakeAsync(() => {
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    tick();
    fixture.componentInstance.open.set(false);
    fixture.detectChanges();
    tick();

    expect(portalErrors()).toEqual([]);
  }));
});
