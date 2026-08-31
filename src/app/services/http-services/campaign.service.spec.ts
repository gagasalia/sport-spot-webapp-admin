import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { CampaignService } from './campaign.service';
import {
  Campaign,
  CampaignParticipant,
  CreateCampaignDto,
  UpdateCampaignDto,
} from '../../shared/models/campaign.model';
import { environment } from '../../../environments/environment';

function wrap<T>(data: T, page?: unknown) {
  return { result: { data, page }, errors: [] };
}

const base = `${environment.apiUrl}/campaigns`;

const mockCampaign: Campaign = {
  _id: 'c-1',
  academy: 'aca-1',
  academyName: 'Padel House',
  facilities: ['f-1'],
  facilityNames: ['Padel Center'],
  goalType: 'bookings',
  goalTarget: 5,
  rewardTetri: 2000,
  maxCompletionsPerUser: 1,
  active: true,
  enrolledCount: 4,
  completedCount: 1,
};

const mockParticipant: CampaignParticipant = {
  _id: 'pr-1',
  campaign: 'c-1',
  user: { _id: 'u-1', firstName: 'Anna', lastName: 'Kapanadze', phone: '+995599000111' },
  userMemberId: 59,
  userName: 'Anna Kapanadze',
  userPhone: '+995599000111',
  cycle: 1,
  windowStartsAt: '2026-08-01T10:00:00.000Z',
  windowEndsAt: '2026-08-31T10:00:00.000Z',
  bookingsCount: 3,
  spentTetri: 13500,
  contributionsCount: 3,
  current: 3,
  target: 5,
  status: 'in_progress',
  createdAt: '2026-08-01T10:00:00.000Z',
};

describe('CampaignService', () => {
  let service: CampaignService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CampaignService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CampaignService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('lists campaigns with page/limit and unwraps the envelope', () => {
    let received: Campaign[] | undefined;
    let total: number | undefined;
    service.getCampaigns({ page: 2, limit: 20 }).subscribe((res) => {
      received = res.data;
      total = res.page?.total;
    });

    const req = httpMock.expectOne((r) => r.url === base && r.method === 'GET');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('limit')).toBe('20');
    // Undefined filters must not appear in the URL at all.
    expect(req.request.params.has('q')).toBeFalse();
    expect(req.request.params.has('academyId')).toBeFalse();
    req.flush(wrap([mockCampaign], { page: 2, size: 20, total: 41 }));

    expect(received).toEqual([mockCampaign]);
    expect(total).toBe(41);
  });

  it('passes active / academyId / facilityId when set', () => {
    service
      .getCampaigns({
        page: 1,
        limit: 20,
        active: false,
        academyId: 'aca-1',
        facilityId: 'f-1',
      })
      .subscribe();
    const req = httpMock.expectOne((r) => r.url === base);
    expect(req.request.params.get('active')).toBe('false');
    expect(req.request.params.get('academyId')).toBe('aca-1');
    expect(req.request.params.get('facilityId')).toBe('f-1');
    req.flush(wrap([]));
  });

  it('defaults an empty list when the envelope carries no data', () => {
    let received: Campaign[] | undefined;
    service.getCampaigns({ page: 1, limit: 20 }).subscribe((res) => (received = res.data));
    httpMock.expectOne((r) => r.url === base).flush({ result: {}, errors: [] });
    expect(received).toEqual([]);
  });

  it('creates a campaign with the tetri body it was given', () => {
    const dto: CreateCampaignDto = {
      goalType: 'bookings',
      goalTarget: 5,
      rewardTetri: 2000,
      endsAt: '2026-12-31',
      facilityIds: ['f-1'],
    };
    service.createCampaign(dto).subscribe();
    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dto);
    req.flush(wrap(mockCampaign));
  });

  it('patches a campaign, passing an explicit null through to clear a field', () => {
    const dto: UpdateCampaignDto = { endsAt: null, active: false };
    service.updateCampaign('c-1', dto).subscribe();
    const req = httpMock.expectOne(`${base}/c-1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(dto);
    req.flush(wrap(mockCampaign));
  });

  it('deletes a campaign', () => {
    let done = false;
    service.deleteCampaign('c-1').subscribe(() => (done = true));
    const req = httpMock.expectOne(`${base}/c-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(wrap(true));
    expect(done).toBeTrue();
  });

  it('lists participants of one campaign, paginated', () => {
    let received: CampaignParticipant[] | undefined;
    service.getParticipants('c-1', 2, 20).subscribe((res) => (received = res.data));
    const req = httpMock.expectOne((r) => r.url === `${base}/c-1/participants`);
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('limit')).toBe('20');
    req.flush(wrap([mockParticipant], { page: 2, size: 20, total: 4 }));
    expect(received).toEqual([mockParticipant]);
  });
});
