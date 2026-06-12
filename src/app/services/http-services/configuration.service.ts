import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, delay } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Facility } from '../../shared/models/facility.model';
import { Court } from '../../shared/models/court.model';
import { v4 as uuidv4 } from 'uuid';

@Injectable({
  providedIn: 'root',
})
export class ConfigurationService {
  private apiUrl = `${environment.apiUrl}/configuration`;
  private readonly FACILITIES_STORAGE_KEY = 'sportify_facilities';
  private readonly COURTS_STORAGE_KEY = 'sportify_courts';

  constructor(private http: HttpClient) {}

  private getFacilitiesFromStorage(): Facility[] {
    const stored = localStorage.getItem(this.FACILITIES_STORAGE_KEY);
    if (!stored) return [];

    const facilities: Facility[] = JSON.parse(stored);

    // Retrieve photos separately for each facility
    return facilities.map((facility) => {
      const photoKey = `${this.FACILITIES_STORAGE_KEY}_photos_${facility.id}`;
      const storedPhotos = localStorage.getItem(photoKey);
      return {
        ...facility,
        photos: storedPhotos ? JSON.parse(storedPhotos) : [],
      };
    });
  }

  private saveFacilitiesToStorage(facilities: Facility[]): void {
    try {
      // Create a copy without photos to save storage space
      const facilitiesWithoutPhotos = facilities.map((f) => ({
        ...f,
        photos: f.photos?.length ? ['placeholder'] : [], // Keep track that photos exist but don't store them
      }));
      localStorage.setItem(this.FACILITIES_STORAGE_KEY, JSON.stringify(facilitiesWithoutPhotos));

      // Store photos separately with a size limit
      facilities.forEach((facility) => {
        if (facility.photos?.length) {
          const photoKey = `${this.FACILITIES_STORAGE_KEY}_photos_${facility.id}`;
          try {
            localStorage.setItem(photoKey, JSON.stringify(facility.photos));
          } catch (e) {
            console.warn(
              `Could not store photos for facility ${facility.id}. Photos will not persist.`,
            );
            // Remove the photo key if it exists
            localStorage.removeItem(photoKey);
          }
        }
      });
    } catch (error) {
      console.error('Failed to save facilities to localStorage:', error);
      // Clear old data and try again with just the new facility
      this.clearOldFacilities();
      try {
        const facilitiesWithoutPhotos = facilities.map((f) => ({
          ...f,
          photos: [],
        }));
        localStorage.setItem(this.FACILITIES_STORAGE_KEY, JSON.stringify(facilitiesWithoutPhotos));
      } catch (e) {
        console.error('Still failed after clearing. LocalStorage quota exceeded.');
        alert('გაფრთხილება: ლოკალური მეხსიერება გადაივსო. სურათები ვერ შეინახება.');
      }
    }
  }

  private clearOldFacilities(): void {
    // Remove all photo storage
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.startsWith(`${this.FACILITIES_STORAGE_KEY}_photos_`)) {
        localStorage.removeItem(key);
      }
    });
  }

  getFacilities(): Observable<Facility[]> {
    // Use localStorage instead of API for now
    const facilities = this.getFacilitiesFromStorage();
    return of(facilities).pipe(delay(500)); // Simulate API delay
  }

  getFacilityById(id: string): Observable<Facility> {
    const facilities = this.getFacilitiesFromStorage();
    const facility = facilities.find((f) => f.id === id);
    if (!facility) {
      throw new Error(`Facility with id ${id} not found`);
    }
    return of(facility).pipe(delay(300));
  }

  createFacility(facilityData: Omit<Facility, 'id'>): Observable<Facility> {
    const facilities = this.getFacilitiesFromStorage();
    const newFacility: Facility = {
      ...facilityData,
      id: uuidv4(),
    };
    facilities.push(newFacility);
    this.saveFacilitiesToStorage(facilities);
    return of(newFacility).pipe(delay(500));
  }

  updateFacility(id: string, facilityData: Partial<Facility>): Observable<Facility> {
    const facilities = this.getFacilitiesFromStorage();
    const index = facilities.findIndex((f) => f.id === id);
    if (index === -1) {
      throw new Error(`Facility with id ${id} not found`);
    }
    const updatedFacility = { ...facilities[index], ...facilityData };
    facilities[index] = updatedFacility;
    this.saveFacilitiesToStorage(facilities);
    return of(updatedFacility).pipe(delay(500));
  }

  deleteFacility(id: string): Observable<void> {
    const facilities = this.getFacilitiesFromStorage();
    const filteredFacilities = facilities.filter((f) => f.id !== id);
    this.saveFacilitiesToStorage(filteredFacilities);
    return of(void 0).pipe(delay(300));
  }

  // Court methods
  private getCourtsFromStorage(): Court[] {
    const stored = localStorage.getItem(this.COURTS_STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  }

  private saveCourtsToStorage(courts: Court[]): void {
    try {
      localStorage.setItem(this.COURTS_STORAGE_KEY, JSON.stringify(courts));
    } catch (error) {
      console.error('Failed to save courts to localStorage:', error);
    }
  }

  getCourts(facilityId?: string): Observable<Court[]> {
    const courts = this.getCourtsFromStorage();
    const filteredCourts = facilityId ? courts.filter((c) => c.facilityId === facilityId) : courts;
    return of(filteredCourts).pipe(delay(500));
  }

  getCourtById(id: string): Observable<Court> {
    const courts = this.getCourtsFromStorage();
    const court = courts.find((c) => c.id === id);
    if (!court) {
      throw new Error(`Court with id ${id} not found`);
    }
    return of(court).pipe(delay(300));
  }

  createCourt(courtData: Omit<Court, 'id'>): Observable<Court> {
    const courts = this.getCourtsFromStorage();
    const newCourt: Court = {
      ...courtData,
      id: uuidv4(),
    };
    courts.push(newCourt);
    this.saveCourtsToStorage(courts);
    return of(newCourt).pipe(delay(500));
  }

  updateCourt(id: string, courtData: Partial<Court>): Observable<Court> {
    const courts = this.getCourtsFromStorage();
    const index = courts.findIndex((c) => c.id === id);
    if (index === -1) {
      throw new Error(`Court with id ${id} not found`);
    }
    const updatedCourt = { ...courts[index], ...courtData };
    courts[index] = updatedCourt;
    this.saveCourtsToStorage(courts);
    return of(updatedCourt).pipe(delay(500));
  }

  deleteCourt(id: string): Observable<void> {
    const courts = this.getCourtsFromStorage();
    const filteredCourts = courts.filter((c) => c.id !== id);
    this.saveCourtsToStorage(filteredCourts);
    return of(void 0).pipe(delay(300));
  }
}
