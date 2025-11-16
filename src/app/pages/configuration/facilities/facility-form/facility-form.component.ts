import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SHARED_TAIGA_IMPORTS } from '../../../../shared/shared.module';

@Component({
  selector: 'app-facility-form',
  standalone: true,
  imports: [...SHARED_TAIGA_IMPORTS],
  templateUrl: './facility-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FacilityFormComponent {}
