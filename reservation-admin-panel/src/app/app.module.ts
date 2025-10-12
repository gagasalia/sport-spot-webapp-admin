import { APP_INITIALIZER, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule } from '@angular/common/http';
import { PrimeNGConfig } from 'primeng/api';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { CoreModule } from './core/core.module';
import { SharedModule } from './shared/shared.module';
import { initializePrimeNGStyleConfig } from './shared/PrimeNGStyleConfig';

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, BrowserAnimationsModule, HttpClientModule, AppRoutingModule, CoreModule, SharedModule],
  providers: [
    PrimeNGConfig,
    {
      provide: APP_INITIALIZER,
      useFactory: initializePrimeNGStyleConfig,
      deps: [PrimeNGConfig],
      multi: true
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}
