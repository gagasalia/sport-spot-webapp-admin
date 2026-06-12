import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';
import { provideAnimations } from '@angular/platform-browser/animations';

import { TuiAlertService } from '@taiga-ui/core';

import { AcademyComponent } from './academy.component';
import { AcademyService } from '../../../services/http-services/academy.service';
import { Academy, AcademyStatus } from '../../../shared/models/academy.model';

// ─── Test data ────────────────────────────────────────────────────────────────

const mockAcademy: Academy = {
  _id: 'academy-id-1',
  name: 'Sports Academy',
  admins: [],
  status: AcademyStatus.PUBLISHED,
  color: '#3A86FF',
  descriptionGeorgian: 'სპორტული აკადემია',
  descriptionEnglish: 'Sports Academy',
  phone: '555-1234',
  email: 'academy@example.com',
  instagram: 'https://instagram.com/academy',
  facebook: 'https://facebook.com/academy',
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('AcademyComponent', () => {
  let component: AcademyComponent;
  let fixture: ComponentFixture<AcademyComponent>;
  let academyServiceSpy: jasmine.SpyObj<AcademyService>;
  let alertServiceSpy: jasmine.SpyObj<TuiAlertService>;
  let routerSpy: jasmine.SpyObj<Router>;

  async function createComponent(academyData?: Academy) {
    academyServiceSpy = jasmine.createSpyObj('AcademyService', [
      'getAcademyById',
      'updateAcademy',
    ]);
    alertServiceSpy = jasmine.createSpyObj('TuiAlertService', ['open']);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    academyServiceSpy.getAcademyById.and.returnValue(
      of(academyData ?? mockAcademy),
    );
    alertServiceSpy.open.and.returnValue(of(undefined) as any);

    await TestBed.configureTestingModule({
      imports: [AcademyComponent],
      providers: [
        provideAnimations(),
        { provide: AcademyService, useValue: academyServiceSpy },
        { provide: TuiAlertService, useValue: alertServiceSpy },
        { provide: Router, useValue: routerSpy },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(AcademyComponent, {
        set: { imports: [ReactiveFormsModule], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(AcademyComponent);
    component = fixture.componentInstance;
  }

  // ─── Component creation ──────────────────────────────────────────────────

  describe('component creation', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize the academyForm on creation', () => {
      // The form is built in ngOnInit, which only runs after the first detectChanges.
      fixture.detectChanges();
      expect(component.academyForm).toBeDefined();
    });
  });

  // ─── Form structure: flat field layout ───────────────────────────────────

  describe('form structure — flat field layout (no contactInfo nesting)', () => {
    beforeEach(async () => {
      await createComponent();
      fixture.detectChanges();
    });

    it('should initialize the form with a name control', () => {
      expect(component.academyForm.contains('name')).toBeTrue();
    });

    it('should initialize the form with a color control (renamed from designPalette)', () => {
      expect(component.academyForm.contains('color')).toBeTrue();
    });

    it('should initialize the form with a descriptionGeorgian control', () => {
      expect(component.academyForm.contains('descriptionGeorgian')).toBeTrue();
    });

    it('should initialize the form with a descriptionEnglish control', () => {
      expect(component.academyForm.contains('descriptionEnglish')).toBeTrue();
    });

    it('should initialize the form with a top-level phone control', () => {
      expect(component.academyForm.contains('phone')).toBeTrue();
    });

    it('should initialize the form with a top-level email control', () => {
      expect(component.academyForm.contains('email')).toBeTrue();
    });

    it('should initialize the form with a top-level instagram control', () => {
      expect(component.academyForm.contains('instagram')).toBeTrue();
    });

    it('should initialize the form with a top-level facebook control', () => {
      expect(component.academyForm.contains('facebook')).toBeTrue();
    });

    it('should NOT have a contactInfo nested form group (contact fields are now top-level)', () => {
      expect(component.academyForm.contains('contactInfo')).toBeFalse();
    });

    it('should NOT have a website control (removed)', () => {
      expect(component.academyForm.contains('website')).toBeFalse();
    });

    it('should NOT have a twitter control (removed)', () => {
      expect(component.academyForm.contains('twitter')).toBeFalse();
    });

    it('should NOT have a linkedIn control (removed)', () => {
      expect(component.academyForm.contains('linkedIn')).toBeFalse();
    });

    it('should NOT have an address control (removed)', () => {
      expect(component.academyForm.contains('address')).toBeFalse();
    });

    it('should NOT have a designPalette control (renamed to color)', () => {
      expect(component.academyForm.contains('designPalette')).toBeFalse();
    });

    it('should NOT have a description control (replaced by descriptionGeorgian and descriptionEnglish)', () => {
      expect(component.academyForm.contains('description')).toBeFalse();
    });
  });

  // ─── colorControl getter ──────────────────────────────────────────────────

  describe('colorControl getter', () => {
    beforeEach(async () => {
      await createComponent();
      fixture.detectChanges();
    });

    it('should return the color FormControl instance', () => {
      const ctrl = component.colorControl;
      expect(ctrl).toBeDefined();
      expect(ctrl).toBe(component.academyForm.get('color') as any);
    });

    it('should reflect updates made directly to the form color control', () => {
      component.academyForm.get('color')!.setValue('#FF0000');
      expect(component.colorControl.value).toBe('#FF0000');
    });

    it('should return a FormControl whose value is a string', () => {
      component.academyForm.get('color')!.setValue('#AABBCC');
      expect(typeof component.colorControl.value).toBe('string');
    });
  });

  // ─── Form initial state ───────────────────────────────────────────────────

  describe('form initial state (before academy loads)', () => {
    beforeEach(async () => {
      await createComponent();
      // Defer the academy load so the form keeps its initial (un-patched) values:
      // detectChanges runs ngOnInit (which builds academyForm) but the Subject never
      // emits, so loadAcademy's patchValue does not run.
      academyServiceSpy.getAcademyById.and.returnValue(new Subject<Academy>());
      fixture.detectChanges();
    });

    it('should start with name as an empty string', () => {
      expect(component.academyForm.get('name')!.value).toBe('');
    });

    it('should start with color as an empty string', () => {
      expect(component.academyForm.get('color')!.value).toBe('');
    });

    it('should start with descriptionGeorgian as an empty string', () => {
      expect(component.academyForm.get('descriptionGeorgian')!.value).toBe('');
    });

    it('should start with descriptionEnglish as an empty string', () => {
      expect(component.academyForm.get('descriptionEnglish')!.value).toBe('');
    });

    it('should start with phone as an empty string', () => {
      expect(component.academyForm.get('phone')!.value).toBe('');
    });

    it('should start with email as an empty string', () => {
      expect(component.academyForm.get('email')!.value).toBe('');
    });

    it('should start with instagram as an empty string', () => {
      expect(component.academyForm.get('instagram')!.value).toBe('');
    });

    it('should start with facebook as an empty string', () => {
      expect(component.academyForm.get('facebook')!.value).toBe('');
    });
  });

  // ─── Form population after academy loads ─────────────────────────────────

  describe('form population after academy loads', () => {
    beforeEach(async () => {
      await createComponent(mockAcademy);
      fixture.detectChanges();
    });

    it('should patch the name field from the loaded academy', fakeAsync(() => {
      tick();
      expect(component.academyForm.get('name')!.value).toBe('Sports Academy');
    }));

    it('should patch the color field from the loaded academy', fakeAsync(() => {
      tick();
      expect(component.academyForm.get('color')!.value).toBe('#3A86FF');
    }));

    it('should patch descriptionGeorgian from the loaded academy', fakeAsync(() => {
      tick();
      expect(component.academyForm.get('descriptionGeorgian')!.value).toBe('სპორტული აკადემია');
    }));

    it('should patch descriptionEnglish from the loaded academy', fakeAsync(() => {
      tick();
      expect(component.academyForm.get('descriptionEnglish')!.value).toBe('Sports Academy');
    }));

    it('should patch the top-level phone field from the loaded academy', fakeAsync(() => {
      tick();
      expect(component.academyForm.get('phone')!.value).toBe('555-1234');
    }));

    it('should patch the top-level email field from the loaded academy', fakeAsync(() => {
      tick();
      expect(component.academyForm.get('email')!.value).toBe('academy@example.com');
    }));

    it('should patch the top-level instagram field from the loaded academy', fakeAsync(() => {
      tick();
      expect(component.academyForm.get('instagram')!.value).toBe('https://instagram.com/academy');
    }));

    it('should patch the top-level facebook field from the loaded academy', fakeAsync(() => {
      tick();
      expect(component.academyForm.get('facebook')!.value).toBe('https://facebook.com/academy');
    }));
  });

  // ─── name: required validation ────────────────────────────────────────────

  describe('name field validation', () => {
    beforeEach(async () => {
      await createComponent();
      fixture.detectChanges();
    });

    it('should mark name as invalid when it is empty', () => {
      const nameControl = component.academyForm.get('name')!;
      nameControl.setValue('');
      nameControl.markAsTouched();

      expect(nameControl.invalid).toBeTrue();
      expect(nameControl.errors?.['required']).toBeTruthy();
    });

    it('should mark name as valid when it has a non-empty value', () => {
      component.academyForm.get('name')!.setValue('My Academy');
      expect(component.academyForm.get('name')!.valid).toBeTrue();
    });
  });

  // ─── onSave: valid form ───────────────────────────────────────────────────

  describe('onSave — valid form', () => {
    beforeEach(async () => {
      await createComponent(mockAcademy);
      fixture.detectChanges();
    });

    it('should call academyService.updateAcademy when the form is valid', fakeAsync(() => {
      tick(); // let loadAcademy complete and patch the form
      academyServiceSpy.updateAcademy.and.returnValue(of(mockAcademy));

      component.onSave();
      tick();

      expect(academyServiceSpy.updateAcademy).toHaveBeenCalled();
    }));

    it('should call updateAcademy with the flat form value including color', fakeAsync(() => {
      tick();
      academyServiceSpy.updateAcademy.and.returnValue(of(mockAcademy));
      component.academyForm.patchValue({ color: '#FFFFFF' });

      component.onSave();
      tick();

      const callArgs = academyServiceSpy.updateAcademy.calls.mostRecent().args[1];
      expect(callArgs.color).toBe('#FFFFFF');
    }));

    it('should call updateAcademy with both description fields', fakeAsync(() => {
      tick();
      academyServiceSpy.updateAcademy.and.returnValue(of(mockAcademy));
      component.academyForm.patchValue({
        descriptionGeorgian: 'განახლებული',
        descriptionEnglish: 'Updated',
      });

      component.onSave();
      tick();

      const callArgs = academyServiceSpy.updateAcademy.calls.mostRecent().args[1];
      expect(callArgs.descriptionGeorgian).toBe('განახლებული');
      expect(callArgs.descriptionEnglish).toBe('Updated');
    }));

    it('should call updateAcademy with flat contact fields at the top level', fakeAsync(() => {
      tick();
      academyServiceSpy.updateAcademy.and.returnValue(of(mockAcademy));
      component.academyForm.patchValue({
        phone: '555-0000',
        email: 'new@academy.ge',
        instagram: 'https://instagram.com/new',
        facebook: 'https://facebook.com/new',
      });

      component.onSave();
      tick();

      const callArgs = academyServiceSpy.updateAcademy.calls.mostRecent().args[1];
      expect(callArgs.phone).toBe('555-0000');
      expect(callArgs.email).toBe('new@academy.ge');
      expect(callArgs.instagram).toBe('https://instagram.com/new');
      expect(callArgs.facebook).toBe('https://facebook.com/new');
      // Confirms no contactInfo nesting
      expect((callArgs as any).contactInfo).toBeUndefined();
    }));

    it('should show success alert on successful save', fakeAsync(() => {
      tick();
      academyServiceSpy.updateAcademy.and.returnValue(of(mockAcademy));

      component.onSave();
      tick();

      expect(alertServiceSpy.open).toHaveBeenCalledWith(
        'აკადემია წარმატებით შეინახა!',
        { appearance: 'success' },
      );
    }));

    it('should set isSaved to true after a successful save', fakeAsync(() => {
      tick();
      academyServiceSpy.updateAcademy.and.returnValue(of(mockAcademy));

      component.onSave();
      tick();

      expect(component.isSaved()).toBeTrue();
    }));

    it('should set isSaving to false after a successful save', fakeAsync(() => {
      tick();
      academyServiceSpy.updateAcademy.and.returnValue(of(mockAcademy));

      component.onSave();
      tick();

      expect(component.isSaving()).toBeFalse();
    }));
  });

  // ─── onSave: invalid form ─────────────────────────────────────────────────

  describe('onSave — invalid form', () => {
    beforeEach(async () => {
      await createComponent();
      fixture.detectChanges();
    });

    it('should not call updateAcademy when the form is invalid (name empty)', fakeAsync(() => {
      tick();
      component.academyForm.get('name')!.setValue('');

      component.onSave();

      expect(academyServiceSpy.updateAcademy).not.toHaveBeenCalled();
    }));

    it('should show an error alert when the form is invalid', fakeAsync(() => {
      tick();
      component.academyForm.get('name')!.setValue('');

      component.onSave();
      tick();

      expect(alertServiceSpy.open).toHaveBeenCalledWith(
        'გთხოვთ შეავსოთ ყველა სავალდებულო ველი',
        { appearance: 'error' },
      );
    }));
  });

  // ─── onSave: error path ───────────────────────────────────────────────────

  describe('onSave — service error', () => {
    beforeEach(async () => {
      await createComponent(mockAcademy);
      fixture.detectChanges();
    });

    it('should show an error alert when updateAcademy fails', fakeAsync(() => {
      tick();
      academyServiceSpy.updateAcademy.and.returnValue(throwError(() => new Error('server error')));

      component.onSave();
      tick();

      expect(alertServiceSpy.open).toHaveBeenCalledWith(
        'შეცდომა აკადემიის შენახვისას',
        { appearance: 'error' },
      );
    }));

    it('should set isSaving to false after an update error', fakeAsync(() => {
      tick();
      academyServiceSpy.updateAcademy.and.returnValue(throwError(() => new Error('error')));

      component.onSave();
      tick();

      expect(component.isSaving()).toBeFalse();
    }));
  });

  // ─── Academy load ─────────────────────────────────────────────────────────

  describe('academy loading on init', () => {
    it('should call getAcademyById on init', fakeAsync(async () => {
      await createComponent();
      fixture.detectChanges();
      tick();

      expect(academyServiceSpy.getAcademyById).toHaveBeenCalled();
    }));

    it('should set isLoading to false after a successful load', fakeAsync(async () => {
      await createComponent(mockAcademy);
      fixture.detectChanges();
      tick();

      expect(component.isLoading()).toBeFalse();
    }));

    it('should set isLoading to false even when loading fails', fakeAsync(async () => {
      academyServiceSpy = jasmine.createSpyObj('AcademyService', [
        'getAcademyById',
        'updateAcademy',
      ]);
      alertServiceSpy = jasmine.createSpyObj('TuiAlertService', ['open']);
      routerSpy = jasmine.createSpyObj('Router', ['navigate']);
      academyServiceSpy.getAcademyById.and.returnValue(throwError(() => new Error('load error')));
      alertServiceSpy.open.and.returnValue(of(undefined) as any);

      await TestBed.configureTestingModule({
        imports: [AcademyComponent],
        providers: [
          provideAnimations(),
          { provide: AcademyService, useValue: academyServiceSpy },
          { provide: TuiAlertService, useValue: alertServiceSpy },
          { provide: Router, useValue: routerSpy },
        ],
        schemas: [NO_ERRORS_SCHEMA],
      })
        .overrideComponent(AcademyComponent, {
          set: { imports: [ReactiveFormsModule], schemas: [NO_ERRORS_SCHEMA] },
        })
        .compileComponents();

      fixture = TestBed.createComponent(AcademyComponent);
      component = fixture.componentInstance;

      fixture.detectChanges();
      tick();

      expect(component.isLoading()).toBeFalse();
    }));

    it('should show an error alert when loading fails', fakeAsync(async () => {
      academyServiceSpy = jasmine.createSpyObj('AcademyService', [
        'getAcademyById',
        'updateAcademy',
      ]);
      alertServiceSpy = jasmine.createSpyObj('TuiAlertService', ['open']);
      routerSpy = jasmine.createSpyObj('Router', ['navigate']);
      academyServiceSpy.getAcademyById.and.returnValue(throwError(() => new Error('load error')));
      alertServiceSpy.open.and.returnValue(of(undefined) as any);

      await TestBed.configureTestingModule({
        imports: [AcademyComponent],
        providers: [
          provideAnimations(),
          { provide: AcademyService, useValue: academyServiceSpy },
          { provide: TuiAlertService, useValue: alertServiceSpy },
          { provide: Router, useValue: routerSpy },
        ],
        schemas: [NO_ERRORS_SCHEMA],
      })
        .overrideComponent(AcademyComponent, {
          set: { imports: [ReactiveFormsModule], schemas: [NO_ERRORS_SCHEMA] },
        })
        .compileComponents();

      fixture = TestBed.createComponent(AcademyComponent);
      component = fixture.componentInstance;

      fixture.detectChanges();
      tick();

      expect(alertServiceSpy.open).toHaveBeenCalledWith(
        'შეცდომა აკადემიის ჩატვირთვისას',
        { appearance: 'error' },
      );
    }));
  });

  // ─── navigateToFacilities ────────────────────────────────────────────────

  describe('navigateToFacilities', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should navigate to /configuration/facilities', () => {
      component.navigateToFacilities();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/configuration/facilities']);
    });
  });

  // ─── logoUrl getter ───────────────────────────────────────────────────────

  describe('logoUrl getter', () => {
    beforeEach(async () => {
      await createComponent();
      fixture.detectChanges();
    });

    it('should return an empty string when logo url is not set', () => {
      expect(component.logoUrl).toBe('');
    });

    it('should return the logo url when it is set', () => {
      component.academyForm.patchValue({ logo: { url: 'data:image/png;base64,abc', type: '', size: 0, metadata: null } });
      expect(component.logoUrl).toBe('data:image/png;base64,abc');
    });
  });

  // ─── removeLogo ───────────────────────────────────────────────────────────

  describe('removeLogo', () => {
    beforeEach(async () => {
      await createComponent(mockAcademy);
      fixture.detectChanges();
    });

    it('should clear the logo url when removeLogo is called', fakeAsync(() => {
      tick();
      component.academyForm.patchValue({ logo: { url: 'data:image/png;base64,abc', type: 'image/png', size: 100, metadata: null } });

      component.removeLogo();

      expect(component.academyForm.get('logo.url')!.value).toBe('');
    }));

    it('should mark the form as dirty when removeLogo is called', fakeAsync(() => {
      tick();
      component.removeLogo();
      expect(component.academyForm.dirty).toBeTrue();
    }));
  });

  // ─── isSaved resets on form change ───────────────────────────────────────

  describe('isSaved resets when form changes', () => {
    beforeEach(async () => {
      await createComponent(mockAcademy);
      fixture.detectChanges();
    });

    it('should set isSaved to false when the form is dirtied after a successful save', fakeAsync(() => {
      tick();
      academyServiceSpy.updateAcademy.and.returnValue(of(mockAcademy));

      // Save first to set isSaved = true
      component.onSave();
      tick();
      expect(component.isSaved()).toBeTrue();

      // Now dirty the form
      component.academyForm.get('name')!.setValue('Changed Name');
      component.academyForm.markAsDirty();
      component.academyForm.updateValueAndValidity();
      tick();

      expect(component.isSaved()).toBeFalse();
    }));
  });
});
