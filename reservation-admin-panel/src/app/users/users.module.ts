import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { CardModule } from 'primeng/card';
import { ListboxModule } from 'primeng/listbox';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';

import { SharedModule } from '../shared/shared.module';
import { UsersRoutingModule } from './users-routing.module';
import { UsersOverviewComponent } from './pages/users-overview/users-overview.component';

@NgModule({
  declarations: [UsersOverviewComponent],
  imports: [CommonModule, SharedModule, UsersRoutingModule, CardModule, ListboxModule, InputTextModule, ButtonModule]
})
export class UsersModule {}
