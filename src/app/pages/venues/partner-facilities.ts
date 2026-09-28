import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { AcademyService } from '../../services/http-services/academy.service';
import { FacilityService } from '../../services/http-services/facility.service';
import { Facility } from '../../shared/models/facility.model';

/** A bookable facility a directory venue can be linked to, with its academy. */
export interface PartnerFacilityOption {
  id: string;
  facility: Facility;
  academyName: string;
}

/**
 * Every facility on the platform, for the venue ↔ partner link. There is no
 * global facilities endpoint, so this fans out one
 * `GET /facilities/academy/:id` per academy. An academy whose facilities fail
 * to load contributes nothing instead of failing the whole list — the picker
 * still offers the rest, and a venue's existing link keeps its id either way.
 */
export function loadPartnerFacilities(
  academies: AcademyService,
  facilities: FacilityService,
): Observable<PartnerFacilityOption[]> {
  return academies.getAllAcademies().pipe(
    switchMap((list) => {
      const withId = (list ?? []).filter((a) => !!a._id);
      if (!withId.length) {
        return of([] as PartnerFacilityOption[][]);
      }
      return forkJoin(
        withId.map((academy) =>
          facilities.getFacilitiesByAcademy(academy._id as string).pipe(
            map((rows) =>
              (rows ?? []).flatMap((facility) => {
                const id = facility._id ?? facility.id;
                return id ? [{ id, facility, academyName: academy.name }] : [];
              }),
            ),
            catchError(() => of([] as PartnerFacilityOption[])),
          ),
        ),
      );
    }),
    map((groups) => groups.flat()),
    catchError(() => of([] as PartnerFacilityOption[])),
  );
}
