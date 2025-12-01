import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { Academy } from '../../shared/models/academy.model';

@Injectable({
  providedIn: 'root',
})
export class AcademyService {
  private readonly STORAGE_KEY = 'sportify_academy';

  constructor() {}

  getAcademy(): Observable<Academy | null> {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    const academy = stored ? JSON.parse(stored) : null;
    return of(academy).pipe(delay(300));
  }

  saveAcademy(academy: Academy): Observable<Academy> {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(academy));
    return of(academy).pipe(delay(300));
  }

  updateAcademy(academy: Academy): Observable<Academy> {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(academy));
    return of(academy).pipe(delay(300));
  }
}
