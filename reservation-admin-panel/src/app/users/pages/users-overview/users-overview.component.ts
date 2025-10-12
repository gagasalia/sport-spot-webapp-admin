import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

interface UserItem {
  name: string;
  email: string;
  role: string;
}

@Component({
  selector: 'app-users-overview',
  templateUrl: './users-overview.component.html',
  styleUrls: ['./users-overview.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UsersOverviewComponent {
  readonly form: FormGroup;

  readonly users: UserItem[] = [
    { name: 'Alex Hunter', email: 'alex@sportify.com', role: 'Manager' },
    { name: 'Sofia Alvarez', email: 'sofia@sportify.com', role: 'Coach' },
    { name: 'Liam Chen', email: 'liam@sportify.com', role: 'Staff' }
  ];

  constructor(private readonly fb: FormBuilder) {
    this.form = this.fb.nonNullable.group({
      name: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      role: ['', [Validators.required]]
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    // eslint-disable-next-line no-console
    console.log('New user', this.form.getRawValue());
    this.form.reset();
  }
}
