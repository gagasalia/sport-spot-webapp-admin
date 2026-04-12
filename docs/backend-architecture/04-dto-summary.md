# DTO Summary — Academy Management System

## Conventions

- All DTOs use `class-validator` decorators for validation
- Request DTOs: `Create*Dto`, `Update*Dto` (Update extends Partial<Create> with PartialType)
- Response DTOs: `*ResponseDto` — what the API returns (excludes internal fields like `deletedAt`)
- Shared sub-DTOs: reusable across modules (e.g., `MediaDto`, `ContactInfoDto`, `AddressDto`)

---

## 1. Shared / Common DTOs

### PaginationQueryDto (all list endpoints)
```typescript
{
  page?: number;          // default: 1, min: 1
  limit?: number;         // default: 20, min: 1, max: 100
  sortBy?: string;        // default: 'createdAt'
  sortOrder?: 'ASC' | 'DESC'; // default: 'DESC'
}
```

### PaginatedResponseDto<T>
```typescript
{
  data: T[];
  meta: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  }
}
```

### MediaDto
```typescript
{
  url: string;            // @IsUrl()
  type: string;           // e.g. 'image/jpeg'
  size: number;           // bytes
  metadata?: Record<string, any>;
}
```

### ContactInfoDto
```typescript
{
  email?: string;         // @IsEmail()
  phone?: string;         // @IsPhoneNumber()
  address?: AddressDto;
  website?: string;       // @IsUrl()
  facebook?: string;
  twitter?: string;
  instagram?: string;
  linkedIn?: string;
}
```

### AddressDto
```typescript
{
  street?: string;
  city?: string;
  lng?: string;
  lat?: string;
}
```

---

## 2. Academy DTOs

### CreateAcademyDto
```typescript
{
  owner: string;            // @IsUUID() — user who owns this academy
  name: string;             // @IsString(), @MinLength(2)
  designPalette: string;    // @IsString()
  description: string;      // @IsString()
  logo?: MediaDto;          // @ValidateNested()
  contactInfo?: ContactInfoDto;
}
```

### UpdateAcademyDto
```typescript
{
  name?: string;
  designPalette?: string;
  description?: string;
  logo?: MediaDto;
  contactInfo?: ContactInfoDto;
}
```

### AcademyResponseDto
```typescript
{
  id: string;
  owner: string;
  name: string;
  designPalette: string;
  description: string;
  logo: MediaDto | null;
  contactInfo: ContactInfoDto | null;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 3. Facilities Domain DTOs

### 3.1 Facility

#### CreateFacilityDto
```typescript
{
  name: string;               // @IsString(), @MinLength(2)
  description: string;        // @IsString()
  country: string;            // @IsString()
  city: string;               // @IsString()
  amenities: string[];        // @IsArray(), @IsEnum(Amenity, { each: true })
  media?: MediaDto[];         // @ValidateNested({ each: true })
  contactInfo?: ContactInfoDto;
  timezone?: string;          // default: 'Asia/Tbilisi'
}
```

#### UpdateFacilityDto
```typescript
PartialType(CreateFacilityDto)
```

#### FacilityResponseDto
```typescript
{
  id: string;
  academyId: string;
  name: string;
  description: string;
  country: string;
  city: string;
  amenities: string[];
  media: MediaDto[];
  contactInfo: ContactInfoDto | null;
  activeState: boolean;
  timezone: string;
  roomCount: number;          // computed — number of rooms
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 3.2 Room

#### CreateRoomDto
```typescript
{
  name: string;                     // @IsString()
  roomNumber?: number;              // @IsInt(), @IsPositive()
  type: RoomType;                   // @IsEnum(RoomType)
  locationType: LocationType;       // @IsEnum(LocationType)
  capacity: number;                 // @IsInt(), @Min(1)
  sportType?: SportType;            // @IsEnum(SportType), only when type = 'court'
  surface?: {                       // only when type = 'court'
    material: SurfaceMaterial;
    color: SurfaceColor;
  };
  amenities?: string[];
  media?: MediaDto[];
}
```

#### UpdateRoomDto
```typescript
PartialType(CreateRoomDto)
```

#### UpdateRoomStatusDto
```typescript
{
  availabilityStatus: AvailabilityStatus;  // @IsEnum()
}
```

#### RoomAvailabilityQueryDto
```typescript
{
  startDate: string;          // @IsDateString(), 'YYYY-MM-DD'
  endDate: string;            // @IsDateString()
  startTime: string;          // @Matches(/^\d{2}:\d{2}$/)
  endTime: string;            // @Matches(/^\d{2}:\d{2}$/)
}
```

#### RoomResponseDto
```typescript
{
  id: string;
  facilityId: string;
  facilityName: string;       // included for convenience
  name: string;
  roomNumber: number | null;
  type: RoomType;
  locationType: LocationType;
  capacity: number;
  availabilityStatus: AvailabilityStatus;
  sportType: SportType | null;
  surface: { material: string; color: string } | null;
  amenities: string[];
  media: MediaDto[];
  activeState: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

#### AvailableRoomsQueryDto
```typescript
{
  facilityId?: string;        // @IsUUID(), optional — filter by facility
  type?: RoomType;            // @IsEnum(RoomType)
  minCapacity?: number;       // @IsInt()
  date: string;               // @IsDateString()
  startTime: string;          // @Matches(/^\d{2}:\d{2}$/)
  endTime: string;            // @Matches(/^\d{2}:\d{2}$/)
}
```

---

### 3.3 Equipment

#### CreateEquipmentDto
```typescript
{
  name: string;                   // @IsString()
  description?: string;
  category: EquipmentCategory;    // @IsEnum()
  roomId?: string;                // @IsUUID(), nullable — facility-level if omitted
  quantity?: number;              // @IsInt(), @Min(1), default: 1
  condition: EquipmentCondition;  // @IsEnum()
  serialNumber?: string;
  purchaseDate?: string;          // @IsDateString()
  warrantyExpiry?: string;        // @IsDateString()
}
```

#### UpdateEquipmentDto
```typescript
PartialType(CreateEquipmentDto)
```

#### EquipmentResponseDto
```typescript
{
  id: string;
  facilityId: string;
  roomId: string | null;
  roomName: string | null;
  name: string;
  description: string | null;
  category: EquipmentCategory;
  quantity: number;
  condition: EquipmentCondition;
  serialNumber: string | null;
  purchaseDate: Date | null;
  warrantyExpiry: Date | null;
  activeState: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 3.4 Maintenance

#### CreateMaintenanceDto
```typescript
{
  roomId?: string;                  // @IsUUID()
  equipmentId?: string;            // @IsUUID()
  title: string;                   // @IsString()
  description?: string;
  type: MaintenanceType;           // @IsEnum()
  priority: MaintenancePriority;   // @IsEnum()
  scheduledAt: string;             // @IsDateString()
  assignedTo?: string;             // @IsUUID() — user ID
}
```

#### UpdateMaintenanceDto
```typescript
PartialType(CreateMaintenanceDto) + {
  notes?: string;
}
```

#### UpdateMaintenanceStatusDto
```typescript
{
  status: MaintenanceStatus;       // @IsEnum()
  completedAt?: string;            // @IsDateString(), required when status = 'completed'
  notes?: string;
}
```

#### MaintenanceResponseDto
```typescript
{
  id: string;
  facilityId: string;
  roomId: string | null;
  roomName: string | null;
  equipmentId: string | null;
  equipmentName: string | null;
  title: string;
  description: string | null;
  type: MaintenanceType;
  status: MaintenanceStatus;
  priority: MaintenancePriority;
  scheduledAt: Date;
  completedAt: Date | null;
  assignedTo: string | null;
  assignedToName: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 3.5 Facility Schedule

#### UpdateFacilityScheduleDto
```typescript
{
  timezone?: string;              // @IsString()
  weeklyHours?: WeeklyHoursDto;  // @ValidateNested()
  holidays?: HolidayDto[];       // @ValidateNested({ each: true })
}
```

#### WeeklyHoursDto
```typescript
{
  [day: number]: TimeRangeDto[];  // day 0-6
}
```

#### TimeRangeDto
```typescript
{
  start: string;    // @Matches(/^\d{2}:\d{2}$/)
  end: string;      // @Matches(/^\d{2}:\d{2}$/)
}
```

#### HolidayDto
```typescript
{
  date: string;               // @IsDateString()
  reason?: string;
  isClosed: boolean;          // @IsBoolean()
  timeRanges?: TimeRangeDto[];
  isRecurring?: boolean;
}
```

#### FacilityScheduleResponseDto
```typescript
{
  id: string;
  facilityId: string;
  timezone: string;
  weeklyHours: WeeklyHoursDto;
  holidays: HolidayDto[];
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 4. Classes Domain DTOs

### 4.1 Course

#### CreateCourseDto
```typescript
{
  title: string;                // @IsString(), @MinLength(2)
  description?: string;
  category: string;             // @IsString()
  level: CourseLevel;           // @IsEnum() — beginner, intermediate, advanced, all_levels
  durationWeeks?: number;       // @IsInt(), @IsPositive()
  maxStudents?: number;         // @IsInt(), @IsPositive()
  media?: MediaDto[];
  prerequisiteIds?: string[];   // @IsUUID(undefined, { each: true })
}
```

#### UpdateCourseDto
```typescript
PartialType(CreateCourseDto)
```

#### CourseResponseDto
```typescript
{
  id: string;
  academyId: string;
  title: string;
  description: string | null;
  category: string;
  level: CourseLevel;
  durationWeeks: number | null;
  maxStudents: number | null;
  media: MediaDto[];
  activeState: boolean;
  prerequisites: { id: string; title: string }[];  // populated
  activeSectionCount: number;  // computed
  createdAt: Date;
  updatedAt: Date;
}
```

#### AddPrerequisiteDto
```typescript
{
  prerequisiteCourseId: string;  // @IsUUID()
}
```

---

### 4.2 Class Section

#### CreateClassSectionDto
```typescript
{
  courseId: string;              // @IsUUID()
  instructorId: string;         // @IsUUID()
  roomId: string;               // @IsUUID() — cross-domain reference
  name?: string;                // e.g. "Section A"
  startDate: string;            // @IsDateString()
  endDate: string;              // @IsDateString()
  maxEnrollment: number;        // @IsInt(), @Min(1)
}
```

#### UpdateClassSectionDto
```typescript
{
  instructorId?: string;
  roomId?: string;
  name?: string;
  startDate?: string;
  endDate?: string;
  maxEnrollment?: number;
}
```

#### UpdateClassSectionStatusDto
```typescript
{
  status: ClassSectionStatus;   // @IsEnum() — upcoming, active, completed, cancelled
}
```

#### ClassSectionResponseDto
```typescript
{
  id: string;
  courseId: string;
  courseName: string;           // populated
  instructorId: string;
  instructorName: string;       // populated
  roomId: string;
  roomName: string;             // populated (cross-domain)
  facilityName: string;         // populated (cross-domain)
  name: string | null;
  startDate: Date;
  endDate: Date;
  maxEnrollment: number;
  currentEnrollment: number;
  status: ClassSectionStatus;
  schedules: ScheduleResponseDto[];  // nested
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 4.3 Class Schedule (Timetable)

#### CreateScheduleDto
```typescript
{
  dayOfWeek: number;            // @IsInt(), @Min(0), @Max(6)
  startTime: string;            // @Matches(/^\d{2}:\d{2}$/)
  endTime: string;              // @Matches(/^\d{2}:\d{2}$/)
  recurrence: Recurrence;       // @IsEnum() — weekly, biweekly, once
}
```

#### UpdateScheduleDto
```typescript
PartialType(CreateScheduleDto)
```

#### ScheduleResponseDto
```typescript
{
  id: string;
  classSectionId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  recurrence: Recurrence;
  createdAt: Date;
  updatedAt: Date;
}
```

#### GenerateSessionsDto
```typescript
{
  fromDate?: string;            // @IsDateString(), defaults to section startDate
  toDate?: string;              // @IsDateString(), defaults to section endDate
}
```

---

### 4.4 Session

#### CreateSessionDto
```typescript
{
  classSectionId: string;       // @IsUUID()
  roomId?: string;              // @IsUUID(), defaults to section's room
  date: string;                 // @IsDateString()
  startTime: string;            // @Matches(/^\d{2}:\d{2}$/)
  endTime: string;              // @Matches(/^\d{2}:\d{2}$/)
  notes?: string;
}
```

#### UpdateSessionDto
```typescript
{
  roomId?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  notes?: string;
}
```

#### UpdateSessionStatusDto
```typescript
{
  status: SessionStatus;        // @IsEnum() — scheduled, in_progress, completed, cancelled
}
```

#### SessionResponseDto
```typescript
{
  id: string;
  classSectionId: string;
  courseName: string;           // populated
  sectionName: string;          // populated
  instructorName: string;       // populated
  roomId: string;
  roomName: string;             // populated (cross-domain)
  facilityName: string;         // populated (cross-domain)
  date: Date;
  startTime: string;
  endTime: string;
  status: SessionStatus;
  notes: string | null;
  attendanceRecorded: boolean;  // computed
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 4.5 Enrollment

#### CreateEnrollmentDto
```typescript
{
  studentId: string;            // @IsUUID()
  classSectionId: string;       // @IsUUID()
  notes?: string;
}
```

#### UpdateEnrollmentStatusDto
```typescript
{
  status: EnrollmentStatus;     // @IsEnum() — active, dropped, completed, waitlisted
  grade?: string;               // only when status = 'completed'
  notes?: string;
}
```

#### EnrollmentResponseDto
```typescript
{
  id: string;
  studentId: string;
  studentName: string;          // populated
  classSectionId: string;
  courseName: string;           // populated
  sectionName: string;          // populated
  status: EnrollmentStatus;
  enrolledAt: Date;
  droppedAt: Date | null;
  completedAt: Date | null;
  grade: string | null;
  notes: string | null;
  attendanceRate: number;       // computed — percentage 0-100
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 4.6 Instructor

#### CreateInstructorDto
```typescript
{
  userId: string;               // @IsUUID() — must reference existing user
  specializations?: string[];   // @IsString({ each: true })
  bio?: string;
  certifications?: CertificationDto[];
  availability?: WeeklyHoursDto;
  hireDate?: string;            // @IsDateString()
}
```

#### CertificationDto
```typescript
{
  name: string;
  issuer: string;
  date: string;                 // @IsDateString()
  expiry?: string;              // @IsDateString()
}
```

#### UpdateInstructorDto
```typescript
{
  specializations?: string[];
  bio?: string;
  certifications?: CertificationDto[];
  hireDate?: string;
}
```

#### UpdateInstructorAvailabilityDto
```typescript
{
  availability: WeeklyHoursDto;  // same format as facility weekly hours
}
```

#### InstructorResponseDto
```typescript
{
  id: string;
  userId: string;
  academyId: string;
  firstName: string;            // from User
  lastName: string;             // from User
  email: string;                // from User
  phone: string;                // from User
  specializations: string[];
  bio: string | null;
  certifications: CertificationDto[];
  availability: WeeklyHoursDto | null;
  hireDate: Date | null;
  activeState: boolean;
  activeSectionCount: number;   // computed
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 4.7 Student

#### CreateStudentDto
```typescript
{
  userId: string;               // @IsUUID() — must reference existing user
  enrollmentDate?: string;      // @IsDateString(), defaults to now
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  medicalNotes?: string;
}
```

#### UpdateStudentDto
```typescript
{
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  medicalNotes?: string;
}
```

#### StudentResponseDto
```typescript
{
  id: string;
  userId: string;
  academyId: string;
  firstName: string;            // from User
  lastName: string;             // from User
  email: string;                // from User
  phone: string;                // from User
  enrollmentDate: Date;
  emergencyContact: { name: string; phone: string; relationship: string } | null;
  activeState: boolean;
  activeEnrollmentCount: number;  // computed
  completedCourseCount: number;   // computed
  createdAt: Date;
  updatedAt: Date;
}
```

> **Note:** `medicalNotes` is intentionally excluded from the response DTO. It is only accessible via a dedicated secure endpoint for authorized medical staff (future scope).

---

### 4.8 Attendance

#### CreateAttendanceDto (single)
```typescript
{
  sessionId: string;            // @IsUUID()
  enrollmentId: string;         // @IsUUID()
  status: AttendanceStatus;     // @IsEnum() — present, absent, late, excused
  checkInTime?: string;         // @IsDateString()
  notes?: string;
}
```

#### BulkAttendanceDto
```typescript
{
  sessionId: string;            // @IsUUID()
  records: {
    enrollmentId: string;       // @IsUUID()
    status: AttendanceStatus;   // @IsEnum()
    notes?: string;
  }[];
}
```

#### UpdateAttendanceDto
```typescript
{
  status?: AttendanceStatus;
  checkInTime?: string;
  notes?: string;
}
```

#### AttendanceResponseDto
```typescript
{
  id: string;
  sessionId: string;
  enrollmentId: string;
  studentName: string;          // populated
  status: AttendanceStatus;
  checkInTime: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 5. Enum Reference

```typescript
// --- Facilities ---
enum RoomType { COURT = 'court', CLASSROOM = 'classroom', LAB = 'lab', LECTURE_HALL = 'lecture_hall', GYM = 'gym', STUDIO = 'studio', MEETING_ROOM = 'meeting_room' }
enum LocationType { INDOOR = 'indoor', OUTDOOR = 'outdoor', COVERED = 'covered' }
enum AvailabilityStatus { AVAILABLE = 'available', OCCUPIED = 'occupied', MAINTENANCE = 'maintenance', CLOSED = 'closed' }
enum SportType { PADEL = 'padel' }  // extensible
enum SurfaceMaterial { CLAY = 'clay', GRASS = 'grass', CONCRETE = 'concrete', SYNTHETIC = 'synthetic', HARDCOURT = 'hardcourt' }
enum SurfaceColor { BLUE = 'blue', GREEN = 'green', RED = 'red', ORANGE = 'orange', GRAY = 'gray', BROWN = 'brown' }
enum Amenity { RESTROOMS = 'restrooms', SHOWERS = 'showers', CHANGING_ROOMS = 'changing_rooms', LOCKERS = 'lockers', FREE_PARKING = 'free_parking', PAID_PARKING = 'paid_parking', HAIR_DRYERS = 'hair_dryers', VENDING_MACHINES = 'vending_machines' }
enum EquipmentCategory { ELECTRONICS = 'electronics', SPORTS = 'sports', FURNITURE = 'furniture', SAFETY = 'safety', OTHER = 'other' }
enum EquipmentCondition { NEW = 'new', GOOD = 'good', FAIR = 'fair', POOR = 'poor', BROKEN = 'broken' }
enum MaintenanceType { PREVENTIVE = 'preventive', CORRECTIVE = 'corrective', INSPECTION = 'inspection' }
enum MaintenanceStatus { SCHEDULED = 'scheduled', IN_PROGRESS = 'in_progress', COMPLETED = 'completed', CANCELLED = 'cancelled' }
enum MaintenancePriority { LOW = 'low', MEDIUM = 'medium', HIGH = 'high', URGENT = 'urgent' }

// --- Classes ---
enum CourseLevel { BEGINNER = 'beginner', INTERMEDIATE = 'intermediate', ADVANCED = 'advanced', ALL_LEVELS = 'all_levels' }
enum ClassSectionStatus { UPCOMING = 'upcoming', ACTIVE = 'active', COMPLETED = 'completed', CANCELLED = 'cancelled' }
enum SessionStatus { SCHEDULED = 'scheduled', IN_PROGRESS = 'in_progress', COMPLETED = 'completed', CANCELLED = 'cancelled' }
enum EnrollmentStatus { ACTIVE = 'active', DROPPED = 'dropped', COMPLETED = 'completed', WAITLISTED = 'waitlisted' }
enum AttendanceStatus { PRESENT = 'present', ABSENT = 'absent', LATE = 'late', EXCUSED = 'excused' }
enum Recurrence { WEEKLY = 'weekly', BIWEEKLY = 'biweekly', ONCE = 'once' }
```
