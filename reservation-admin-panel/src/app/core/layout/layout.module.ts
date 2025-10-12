import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { ButtonModule } from 'primeng/button';
import { MenubarModule } from 'primeng/menubar';
import { SidebarModule } from 'primeng/sidebar';
import { AvatarModule } from 'primeng/avatar';

import { SharedModule } from '../../shared/shared.module';
import { ShellComponent } from './components/shell/shell.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { TopbarComponent } from './components/topbar/topbar.component';

@NgModule({
  declarations: [ShellComponent, SidebarComponent, TopbarComponent],
  imports: [CommonModule, RouterModule, SidebarModule, MenubarModule, ButtonModule, AvatarModule, SharedModule],
  exports: [ShellComponent]
})
export class LayoutModule {}
