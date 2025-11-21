import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { type TuiStringHandler } from '@taiga-ui/cdk';
import { SHARED_TAIGA_IMPORTS } from '../../../../shared/shared.module';
import { City } from '../../../../shared/enums/city.enum';
import { Country } from '../../../../shared/enums/country.enum';

interface CountryItem {
  readonly id: number;
  readonly name: string;
}

interface CityItem {
  readonly id: number;
  readonly name: string;
}

@Component({
  selector: 'app-facility-form',
  standalone: true,
  imports: [...SHARED_TAIGA_IMPORTS, ReactiveFormsModule, CommonModule],
  templateUrl: './facility-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FacilityFormComponent implements OnInit {
  facilityForm!: FormGroup;
  academyId: string = ''; // Will be set from API response

  readonly countries: readonly CountryItem[] = [{ id: Country.Georgia, name: 'საქართველო' }];

  readonly cities: readonly CityItem[] = [{ id: City.Tbilisi, name: 'თბილისი' }];

  readonly stringifyCountry: TuiStringHandler<number> = (id) =>
    this.countries.find((item) => item.id === id)?.name ?? '';

  readonly stringifyCity: TuiStringHandler<number> = (id) =>
    this.cities.find((item) => item.id === id)?.name ?? '';

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.facilityForm = this.fb.group({
      country: [{ value: Country.Georgia, disabled: true }, Validators.required],
      city: [{ value: City.Tbilisi, disabled: true }, Validators.required],
      addressPin: this.fb.group({
        lat: [null, Validators.required],
        lng: [null, Validators.required],
      }),
      addressText: ['', Validators.required],
      photos: [[]],
      description: ['', Validators.required],
      amenities: [[]],
      workingHours: [[]],
      courts: [[]],
    });
  }

  onSubmit(): void {
    if (this.facilityForm.valid) {
      const formValue = {
        ...this.facilityForm.value,
        academyId: this.academyId, // Add academyId from API response
      };
      console.log('Form value:', formValue);
      // TODO: Call service to create/update facility
    }
  }

  onCancel(): void {
    // TODO: Close dialog
  }
}
