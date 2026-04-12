# Cross-Domain Interactions — Facilities ↔ Classes

## Overview

The **Facilities** and **Classes** domains are independent modules that interact through well-defined service interfaces. The `ClassesModule` imports `FacilitiesModule` to access room availability, capacity validation, and schedule conflict checking. There is **no direct entity import** — all cross-domain communication flows through exported services.

---

## 1. Interaction Points

### 1.1 Room Assignment (ClassSection → Room)

**When:** Creating or updating a `ClassSection`

**Flow:**
```
ClassSectionService.create(dto)
  │
  ├── 1. CourseService.findOne(dto.courseId)         → validate course exists
  ├── 2. InstructorService.findOne(dto.instructorId) → validate instructor exists
  ├── 3. RoomService.findOne(dto.roomId)             → validate room exists  ◄── CROSS-DOMAIN
  ├── 4. RoomService.getCapacity(dto.roomId)         → validate maxEnrollment ≤ room capacity  ◄── CROSS-DOMAIN
  ├── 5. RoomService.checkAvailability(dto.roomId, dto.startDate, dto.endDate, schedules)  ◄── CROSS-DOMAIN
  │      → ensure no scheduling conflicts with other class sections in this room
  └── 6. Save ClassSection with roomId FK
```

**Validation rules:**
- Room must exist and be `activeState = true`
- Room `availabilityStatus` must not be `maintenance` or `closed`
- `maxEnrollment` must not exceed `room.capacity`
- Room must not have conflicting sessions at the same day/time

---

### 1.2 Session Room Booking (Session → Room)

**When:** Creating a `Session` (either generated from schedule or ad-hoc)

**Flow:**
```
SessionService.create(dto)
  │
  ├── 1. Resolve roomId (dto.roomId ?? classSection.roomId)
  ├── 2. RoomService.checkTimeSlotAvailability(roomId, date, startTime, endTime)  ◄── CROSS-DOMAIN
  │      → ensure no other session uses this room at this exact time
  ├── 3. FacilityScheduleService.isOpenAt(facilityId, date, startTime, endTime)  ◄── CROSS-DOMAIN
  │      → ensure the facility is open during session time (not a holiday, within weekly hours)
  └── 4. Save Session with roomId FK
```

**Validation rules:**
- Room must be available at the specified date/time
- Facility must be open (not on holiday, within operating hours)
- Session time must not overlap with maintenance windows on that room

---

### 1.3 Schedule Generation (Schedule → Room availability)

**When:** Admin triggers `POST /api/v1/class-sections/:id/schedules/generate-sessions`

**Flow:**
```
ScheduleService.generateSessions(sectionId, fromDate, toDate)
  │
  ├── 1. Load ClassSection (with room, schedules)
  ├── 2. For each schedule entry (e.g., "Monday 09:00–11:00 weekly"):
  │      ├── Generate all dates between fromDate and toDate matching the day/recurrence
  │      └── For each generated date:
  │           ├── FacilityScheduleService.isOpenAt(facilityId, date, start, end)  ◄── CROSS-DOMAIN
  │           │    → skip if facility is closed (holiday)
  │           ├── RoomService.checkTimeSlotAvailability(roomId, date, start, end)  ◄── CROSS-DOMAIN
  │           │    → skip if room already booked (log warning)
  │           └── Create Session record
  └── 3. Return created sessions + skipped dates with reasons
```

---

### 1.4 Room Availability Search (Available Rooms endpoint)

**When:** Admin is assigning a room to a new class section and needs to find available rooms

**Endpoint:** `GET /api/v1/rooms/available?date=&startTime=&endTime=&type=&minCapacity=`

**Flow:**
```
RoomService.findAvailableRooms(query)
  │
  ├── 1. Filter rooms by type, minCapacity, activeState, availabilityStatus
  ├── 2. For each candidate room:
  │      ├── Check no Sessions overlap the requested time slot
  │      ├── Check no MaintenanceSchedule overlaps the requested time slot
  │      └── FacilityScheduleService.isOpenAt(facilityId, date, start, end)
  └── 3. Return filtered list of available rooms with facility info
```

---

### 1.5 Capacity Enforcement

**When:** Enrolling a student in a class section

**Flow:**
```
EnrollmentService.create(dto)
  │
  ├── 1. ClassSectionService.findOne(dto.classSectionId)
  │      → check status is 'upcoming' or 'active'
  ├── 2. Check currentEnrollment < maxEnrollment
  │      → if full, either reject or set status = 'waitlisted'
  ├── 3. maxEnrollment was already validated against room.capacity at section creation
  │      → no additional cross-domain call needed here
  ├── 4. Check student hasn't completed prerequisites (CourseService)
  └── 5. Save Enrollment, increment ClassSection.currentEnrollment
```

---

### 1.6 Maintenance Impact on Classes

**When:** A maintenance record is created or updated for a room

**Flow:**
```
MaintenanceService.create(dto)
  │
  ├── 1. Save maintenance record
  ├── 2. If room has sessions during maintenance window:
  │      └── ClassSectionService.getSessionsForRoom(roomId, scheduledAt, estimatedEnd)  ◄── CROSS-DOMAIN (optional)
  │           → Return list of affected sessions
  │           → Admin is notified (does NOT auto-cancel — manual decision)
  └── 3. If maintenance sets room to 'maintenance' status:
       └── RoomService.updateStatus(roomId, 'maintenance')
            → Future session/section creation will be blocked for this room
```

**Note:** Maintenance does not auto-cancel sessions. It returns a list of conflicts for the admin to resolve manually.

---

## 2. Service Interface Contracts

### RoomService (exported from FacilitiesModule)

```typescript
interface IRoomService {
  // Basic CRUD (used internally and by ClassesModule)
  findOne(roomId: string): Promise<Room>;
  getCapacity(roomId: string): Promise<number>;

  // Availability (primary cross-domain interface)
  checkTimeSlotAvailability(
    roomId: string,
    date: string,          // 'YYYY-MM-DD'
    startTime: string,     // 'HH:mm'
    endTime: string        // 'HH:mm'
  ): Promise<{ available: boolean; conflictReason?: string }>;

  findAvailableRooms(query: {
    facilityId?: string;
    type?: RoomType;
    minCapacity?: number;
    date: string;
    startTime: string;
    endTime: string;
  }): Promise<Room[]>;
}
```

### FacilityScheduleService (exported from FacilitiesModule)

```typescript
interface IFacilityScheduleService {
  isOpenAt(
    facilityId: string,
    date: string,          // 'YYYY-MM-DD'
    startTime: string,     // 'HH:mm'
    endTime: string        // 'HH:mm'
  ): Promise<{ open: boolean; reason?: string }>;

  getSchedule(facilityId: string): Promise<FacilitySchedule>;
}
```

### FacilityService (exported from FacilitiesModule)

```typescript
interface IFacilityService {
  findOne(facilityId: string): Promise<Facility>;
  validateFacilityBelongsToAcademy(facilityId: string, academyId: string): Promise<boolean>;
}
```

---

## 3. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                     CLASSES MODULE                        │
│                                                           │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐ │
│  │ ClassSection  │   │   Session    │   │  Enrollment  │ │
│  │   Service     │   │   Service    │   │   Service    │ │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘ │
│         │                  │                    │         │
│         │ roomId           │ roomId             │         │
│         │ validation       │ booking            │         │
└─────────┼──────────────────┼────────────────────┼─────────┘
          │                  │                    │
          ▼                  ▼                    │
┌─────────────────────────────────────────────────┼─────────┐
│                   FACILITIES MODULE              │         │
│                                                  │         │
│  ┌──────────────┐   ┌──────────────────────┐    │         │
│  │    Room       │   │  FacilitySchedule    │    │         │
│  │   Service     │   │     Service          │    │         │
│  │              │   │                      │    │         │
│  │ • findOne()  │   │ • isOpenAt()         │    │         │
│  │ • getCapacity│   │ • getSchedule()      │    │         │
│  │ • checkSlot()│   │                      │    │         │
│  │ • findAvail()│   │                      │    │         │
│  └──────────────┘   └──────────────────────┘    │         │
│                                                  │         │
│  ┌──────────────┐   ┌──────────────────────┐    │         │
│  │  Facility    │   │   Maintenance        │    │         │
│  │   Service    │   │     Service          │    │         │
│  └──────────────┘   └──────────────────────┘    │         │
└─────────────────────────────────────────────────┴─────────┘
```

---

## 4. Conflict Resolution Strategy

### Time Slot Conflicts

When checking room availability, the system checks for overlaps against:

1. **Existing Sessions** — other class sessions already booked in the room
2. **Maintenance Windows** — scheduled maintenance on the room
3. **Facility Hours** — the facility's weekly operating hours and holidays

Overlap detection logic:
```
Two time slots [A_start, A_end] and [B_start, B_end] on the same date overlap when:
  A_start < B_end AND B_start < A_end
```

### Priority Rules

| Scenario                                    | Resolution                                      |
|---------------------------------------------|--------------------------------------------------|
| Two sections want the same room/time        | First-come-first-served (reject second)         |
| Maintenance scheduled during existing session | Warn admin, do NOT auto-cancel session          |
| Session during facility holiday             | Block creation, return reason                    |
| Session outside facility operating hours    | Block creation, return reason                    |
| Enrollment exceeds room capacity            | Block if maxEnrollment already equals capacity   |

---

## 5. Event-Driven Notifications (Future Enhancement)

While not in the initial implementation, the architecture supports event-based cross-domain notifications:

```
// FacilitiesModule emits:
RoomStatusChanged        → ClassesModule listens → warns about affected sessions
MaintenanceCreated       → ClassesModule listens → finds conflicting sessions
FacilityScheduleUpdated  → ClassesModule listens → validates future sessions still valid

// ClassesModule emits:
SessionCreated           → FacilitiesModule listens → updates room occupancy calendar
SessionCancelled         → FacilitiesModule listens → frees room slot
EnrollmentCapacityReached → No listener needed (contained within ClassesModule)
```

This can be implemented using NestJS `@nestjs/event-emitter` module without changing the module structure.

---

## 6. Database-Level Integrity

### Foreign Key Constraints

```sql
-- ClassSection references Room (cross-domain)
ALTER TABLE class_section
  ADD CONSTRAINT fk_class_section_room
  FOREIGN KEY (room_id) REFERENCES room(id);

-- Session references Room (cross-domain)
ALTER TABLE session
  ADD CONSTRAINT fk_session_room
  FOREIGN KEY (room_id) REFERENCES room(id);
```

### Unique Constraints (prevent double-booking at DB level)

```sql
-- Prevent duplicate enrollments
ALTER TABLE enrollment
  ADD CONSTRAINT uq_enrollment_student_section
  UNIQUE (student_id, class_section_id);

-- Prevent duplicate attendance records
ALTER TABLE attendance
  ADD CONSTRAINT uq_attendance_session_enrollment
  UNIQUE (session_id, enrollment_id);
```

### Indexes (performance for cross-domain queries)

```sql
-- Fast lookup: sessions by room and date (room availability checks)
CREATE INDEX idx_session_room_date ON session(room_id, date, start_time, end_time)
  WHERE deleted_at IS NULL;

-- Fast lookup: maintenance by room and scheduled time
CREATE INDEX idx_maintenance_room_scheduled ON maintenance_schedule(room_id, scheduled_at)
  WHERE deleted_at IS NULL;

-- Fast lookup: class sections by room (what classes use this room?)
CREATE INDEX idx_class_section_room ON class_section(room_id)
  WHERE deleted_at IS NULL;

-- Fast lookup: enrollments by student (student's schedule)
CREATE INDEX idx_enrollment_student ON enrollment(student_id, status)
  WHERE deleted_at IS NULL;

-- Fast lookup: sessions by date range (timetable views)
CREATE INDEX idx_session_date_range ON session(date, start_time)
  WHERE deleted_at IS NULL;
```
