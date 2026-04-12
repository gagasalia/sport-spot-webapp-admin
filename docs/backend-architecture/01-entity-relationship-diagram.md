# Entity-Relationship Diagram — Academy Management System

## Overview

The system is divided into two core domains — **Facilities** and **Classes** — connected through a shared `Room` entity. All entities use UUIDs, soft deletes (`deletedAt`), and audit timestamps (`createdAt`, `updatedAt`).

---

## 1. Existing Entities (Already in Production)

These entities already exist on the backend and frontend. The new architecture extends them.

### Academy

| Column         | Type      | Constraints          |
|----------------|-----------|----------------------|
| id             | UUID (PK) | auto-generated       |
| owner          | UUID (FK) | → User.id            |
| name           | VARCHAR   | NOT NULL             |
| designPalette  | VARCHAR   |                      |
| description    | TEXT      |                      |
| logo           | JSONB     | `{ url, type, size, metadata }` |
| contactInfo    | JSONB     | `{ email, phone, address, website, socials }` |
| createdAt      | TIMESTAMP | auto                 |
| updatedAt      | TIMESTAMP | auto                 |
| deletedAt      | TIMESTAMP | nullable (soft delete) |

### User

| Column      | Type        | Constraints          |
|-------------|-------------|----------------------|
| id          | UUID (PK)   | auto-generated       |
| email       | VARCHAR     | UNIQUE, NOT NULL     |
| password    | VARCHAR     | hashed, NOT NULL     |
| userType    | VARCHAR[]   | `[admin, user, superadmin]` |
| firstName   | VARCHAR     |                      |
| lastName    | VARCHAR     |                      |
| pid         | VARCHAR     | personal ID          |
| phone       | VARCHAR     |                      |
| dateOfBirth | DATE        |                      |
| academies   | UUID[]      | → Academy.id[]       |
| createdAt   | TIMESTAMP   |                      |
| updatedAt   | TIMESTAMP   |                      |
| deletedAt   | TIMESTAMP   |                      |

---

## 2. Facilities Domain Entities

### Facility

| Column      | Type      | Constraints          |
|-------------|-----------|----------------------|
| id          | UUID (PK) | auto-generated       |
| academyId   | UUID (FK) | → Academy.id, NOT NULL |
| name        | VARCHAR   | NOT NULL             |
| description | TEXT      |                      |
| country     | VARCHAR   | NOT NULL             |
| city        | VARCHAR   | NOT NULL             |
| amenities   | VARCHAR[] | enum values          |
| media       | JSONB[]   | `[{ url, type, size, metadata }]` |
| contactInfo | JSONB     | `{ email, phone, address, website, socials }` |
| activeState | BOOLEAN   | DEFAULT true         |
| timezone    | VARCHAR   | DEFAULT 'Asia/Tbilisi' |
| createdAt   | TIMESTAMP |                      |
| updatedAt   | TIMESTAMP |                      |
| deletedAt   | TIMESTAMP |                      |

**Relations:**
- `Academy (1) → (N) Facility`
- `Facility (1) → (N) Room`
- `Facility (1) → (N) Equipment`
- `Facility (1) → (N) MaintenanceSchedule`
- `Facility (1) → (1) FacilitySchedule`

---

### Room

Replaces the current `Court` concept and generalizes it to support both sports courts and class/lecture rooms.

| Column          | Type      | Constraints            |
|-----------------|-----------|------------------------|
| id              | UUID (PK) | auto-generated         |
| facilityId      | UUID (FK) | → Facility.id, NOT NULL |
| name            | VARCHAR   | NOT NULL               |
| roomNumber      | INTEGER   |                        |
| type            | ENUM      | `court`, `classroom`, `lab`, `lecture_hall`, `gym`, `studio`, `meeting_room` |
| locationType    | ENUM      | `indoor`, `outdoor`, `covered` |
| capacity        | INTEGER   | NOT NULL, DEFAULT 0    |
| availabilityStatus | ENUM   | `available`, `occupied`, `maintenance`, `closed` |
| sportType       | ENUM      | nullable (`padel`, etc.) — only for court type |
| surface         | JSONB     | nullable `{ material, color }` — only for court type |
| amenities       | VARCHAR[] |                        |
| media           | JSONB[]   |                        |
| activeState     | BOOLEAN   | DEFAULT true           |
| createdAt       | TIMESTAMP |                        |
| updatedAt       | TIMESTAMP |                        |
| deletedAt       | TIMESTAMP |                        |

**Relations:**
- `Facility (1) → (N) Room`
- `Room (1) → (N) Equipment`
- `Room (1) → (N) ClassSection` (cross-domain link)
- `Room (1) → (N) Session` (cross-domain link)

> **Migration Note:** Existing `Court` records migrate into `Room` with `type = 'court'`. The `courtNumber` maps to `roomNumber`, and `sportType`/`surface` remain in their respective fields.

---

### Equipment

| Column       | Type      | Constraints          |
|--------------|-----------|----------------------|
| id           | UUID (PK) | auto-generated       |
| facilityId   | UUID (FK) | → Facility.id, NOT NULL |
| roomId       | UUID (FK) | → Room.id, nullable (facility-level equipment) |
| name         | VARCHAR   | NOT NULL             |
| description  | TEXT      |                      |
| category     | ENUM      | `electronics`, `sports`, `furniture`, `safety`, `other` |
| quantity     | INTEGER   | DEFAULT 1            |
| condition    | ENUM      | `new`, `good`, `fair`, `poor`, `broken` |
| serialNumber | VARCHAR   |                      |
| purchaseDate | DATE      |                      |
| warrantyExpiry | DATE    |                      |
| activeState  | BOOLEAN   | DEFAULT true         |
| createdAt    | TIMESTAMP |                      |
| updatedAt    | TIMESTAMP |                      |
| deletedAt    | TIMESTAMP |                      |

**Relations:**
- `Facility (1) → (N) Equipment`
- `Room (1) → (N) Equipment`

---

### MaintenanceSchedule

| Column       | Type      | Constraints          |
|--------------|-----------|----------------------|
| id           | UUID (PK) | auto-generated       |
| facilityId   | UUID (FK) | → Facility.id, NOT NULL |
| roomId       | UUID (FK) | → Room.id, nullable  |
| equipmentId  | UUID (FK) | → Equipment.id, nullable |
| title        | VARCHAR   | NOT NULL             |
| description  | TEXT      |                      |
| type         | ENUM      | `preventive`, `corrective`, `inspection` |
| status       | ENUM      | `scheduled`, `in_progress`, `completed`, `cancelled` |
| priority     | ENUM      | `low`, `medium`, `high`, `urgent` |
| scheduledAt  | TIMESTAMP | NOT NULL             |
| completedAt  | TIMESTAMP |                      |
| assignedTo   | UUID (FK) | → User.id, nullable  |
| notes        | TEXT      |                      |
| createdAt    | TIMESTAMP |                      |
| updatedAt    | TIMESTAMP |                      |
| deletedAt    | TIMESTAMP |                      |

**Relations:**
- `Facility (1) → (N) MaintenanceSchedule`
- `Room (1) → (N) MaintenanceSchedule`
- `Equipment (1) → (N) MaintenanceSchedule`

---

### FacilitySchedule

Extends the existing schedule model already used in the frontend.

| Column       | Type      | Constraints          |
|--------------|-----------|----------------------|
| id           | UUID (PK) | auto-generated       |
| facilityId   | UUID (FK) | → Facility.id, UNIQUE, NOT NULL |
| timezone     | VARCHAR   | DEFAULT 'Asia/Tbilisi' |
| weeklyHours  | JSONB     | `{ 0: [{ start, end }], 1: [...], ... }` |
| holidays     | JSONB[]   | `[{ date, reason, isClosed, timeRanges, isRecurring }]` |
| createdAt    | TIMESTAMP |                      |
| updatedAt    | TIMESTAMP |                      |

---

## 3. Classes Domain Entities

### Course

| Column        | Type      | Constraints          |
|---------------|-----------|----------------------|
| id            | UUID (PK) | auto-generated       |
| academyId     | UUID (FK) | → Academy.id, NOT NULL |
| title         | VARCHAR   | NOT NULL             |
| description   | TEXT      |                      |
| category      | VARCHAR   | NOT NULL             |
| level         | ENUM      | `beginner`, `intermediate`, `advanced`, `all_levels` |
| durationWeeks | INTEGER   | total duration in weeks |
| maxStudents   | INTEGER   |                      |
| media         | JSONB[]   |                      |
| activeState   | BOOLEAN   | DEFAULT true         |
| createdAt     | TIMESTAMP |                      |
| updatedAt     | TIMESTAMP |                      |
| deletedAt     | TIMESTAMP |                      |

**Relations:**
- `Academy (1) → (N) Course`
- `Course (1) → (N) ClassSection`
- `Course (N) ↔ (N) Course` (prerequisites — self-referencing many-to-many)

---

### CoursePrerequisite (Join Table)

| Column           | Type      | Constraints              |
|------------------|-----------|--------------------------|
| courseId          | UUID (FK) | → Course.id, PK          |
| prerequisiteCourseId | UUID (FK) | → Course.id, PK      |
| createdAt        | TIMESTAMP |                          |

---

### Instructor

Extends `User` with instructor-specific data. An instructor IS a user with additional profile fields.

| Column          | Type      | Constraints          |
|-----------------|-----------|----------------------|
| id              | UUID (PK) | auto-generated       |
| userId          | UUID (FK) | → User.id, UNIQUE, NOT NULL |
| academyId       | UUID (FK) | → Academy.id, NOT NULL |
| specializations | VARCHAR[] |                      |
| bio             | TEXT      |                      |
| certifications  | JSONB[]   | `[{ name, issuer, date, expiry }]` |
| availability    | JSONB     | same format as WeeklyHoursDTO |
| hireDate        | DATE      |                      |
| activeState     | BOOLEAN   | DEFAULT true         |
| createdAt       | TIMESTAMP |                      |
| updatedAt       | TIMESTAMP |                      |
| deletedAt       | TIMESTAMP |                      |

**Relations:**
- `User (1) → (1) Instructor`
- `Academy (1) → (N) Instructor`
- `Instructor (1) → (N) ClassSection`

---

### Student

Extends `User` with student-specific data. A student IS a user with additional profile fields.

| Column          | Type      | Constraints          |
|-----------------|-----------|----------------------|
| id              | UUID (PK) | auto-generated       |
| userId          | UUID (FK) | → User.id, UNIQUE, NOT NULL |
| academyId       | UUID (FK) | → Academy.id, NOT NULL |
| enrollmentDate  | DATE      | NOT NULL             |
| emergencyContact | JSONB    | `{ name, phone, relationship }` |
| medicalNotes    | TEXT      | encrypted at rest    |
| activeState     | BOOLEAN   | DEFAULT true         |
| createdAt       | TIMESTAMP |                      |
| updatedAt       | TIMESTAMP |                      |
| deletedAt       | TIMESTAMP |                      |

**Relations:**
- `User (1) → (1) Student`
- `Academy (1) → (N) Student`
- `Student (1) → (N) Enrollment`

---

### ClassSection

A specific offering of a course — tied to an instructor, room, and schedule.

| Column        | Type      | Constraints          |
|---------------|-----------|----------------------|
| id            | UUID (PK) | auto-generated       |
| courseId       | UUID (FK) | → Course.id, NOT NULL |
| instructorId  | UUID (FK) | → Instructor.id, NOT NULL |
| roomId        | UUID (FK) | → Room.id, NOT NULL  |
| name          | VARCHAR   | e.g. "Section A"    |
| startDate     | DATE      | NOT NULL             |
| endDate       | DATE      | NOT NULL             |
| maxEnrollment | INTEGER   | NOT NULL             |
| currentEnrollment | INTEGER | DEFAULT 0          |
| status        | ENUM      | `upcoming`, `active`, `completed`, `cancelled` |
| createdAt     | TIMESTAMP |                      |
| updatedAt     | TIMESTAMP |                      |
| deletedAt     | TIMESTAMP |                      |

**Relations:**
- `Course (1) → (N) ClassSection`
- `Instructor (1) → (N) ClassSection`
- `Room (1) → (N) ClassSection` **(cross-domain)**
- `ClassSection (1) → (N) Session`
- `ClassSection (1) → (N) Enrollment`

---

### Schedule (Class Timetable)

Recurring timetable entries for a class section.

| Column        | Type      | Constraints          |
|---------------|-----------|----------------------|
| id            | UUID (PK) | auto-generated       |
| classSectionId | UUID (FK) | → ClassSection.id, NOT NULL |
| dayOfWeek     | INTEGER   | 0–6 (Mon–Sun)       |
| startTime     | TIME      | NOT NULL             |
| endTime       | TIME      | NOT NULL             |
| recurrence    | ENUM      | `weekly`, `biweekly`, `once` |
| createdAt     | TIMESTAMP |                      |
| updatedAt     | TIMESTAMP |                      |

**Relations:**
- `ClassSection (1) → (N) Schedule`

---

### Session

An individual meeting of a class section (generated from schedule or created ad-hoc).

| Column        | Type      | Constraints          |
|---------------|-----------|----------------------|
| id            | UUID (PK) | auto-generated       |
| classSectionId | UUID (FK) | → ClassSection.id, NOT NULL |
| roomId        | UUID (FK) | → Room.id, NOT NULL  |
| date          | DATE      | NOT NULL             |
| startTime     | TIME      | NOT NULL             |
| endTime       | TIME      | NOT NULL             |
| status        | ENUM      | `scheduled`, `in_progress`, `completed`, `cancelled` |
| notes         | TEXT      |                      |
| createdAt     | TIMESTAMP |                      |
| updatedAt     | TIMESTAMP |                      |
| deletedAt     | TIMESTAMP |                      |

**Relations:**
- `ClassSection (1) → (N) Session`
- `Room (1) → (N) Session` **(cross-domain)**
- `Session (1) → (N) Attendance`

---

### Enrollment

| Column        | Type      | Constraints          |
|---------------|-----------|----------------------|
| id            | UUID (PK) | auto-generated       |
| studentId     | UUID (FK) | → Student.id, NOT NULL |
| classSectionId | UUID (FK) | → ClassSection.id, NOT NULL |
| status        | ENUM      | `active`, `dropped`, `completed`, `waitlisted` |
| enrolledAt    | TIMESTAMP | NOT NULL             |
| droppedAt     | TIMESTAMP | nullable             |
| completedAt   | TIMESTAMP | nullable             |
| grade         | VARCHAR   | nullable             |
| notes         | TEXT      |                      |
| createdAt     | TIMESTAMP |                      |
| updatedAt     | TIMESTAMP |                      |
| deletedAt     | TIMESTAMP |                      |

**Unique Constraint:** `(studentId, classSectionId)` — a student can only enroll once per section.

**Relations:**
- `Student (1) → (N) Enrollment`
- `ClassSection (1) → (N) Enrollment`

---

### Attendance

| Column        | Type      | Constraints          |
|---------------|-----------|----------------------|
| id            | UUID (PK) | auto-generated       |
| sessionId     | UUID (FK) | → Session.id, NOT NULL |
| enrollmentId  | UUID (FK) | → Enrollment.id, NOT NULL |
| status        | ENUM      | `present`, `absent`, `late`, `excused` |
| checkInTime   | TIMESTAMP | nullable             |
| notes         | TEXT      |                      |
| createdAt     | TIMESTAMP |                      |
| updatedAt     | TIMESTAMP |                      |

**Unique Constraint:** `(sessionId, enrollmentId)`

**Relations:**
- `Session (1) → (N) Attendance`
- `Enrollment (1) → (N) Attendance`

---

## 4. Full Relationship Map (Text Diagram)

```
Academy
 ├── 1:N → Facility
 │         ├── 1:N → Room ◄──────────────────────┐
 │         │         ├── 1:N → Equipment          │ (cross-domain)
 │         │         └── 1:N → MaintenanceSchedule│
 │         ├── 1:N → Equipment                    │
 │         ├── 1:N → MaintenanceSchedule          │
 │         └── 1:1 → FacilitySchedule             │
 │                                                │
 ├── 1:N → Course                                 │
 │         ├── N:N → Course (prerequisites)       │
 │         └── 1:N → ClassSection ────────────────┘
 │                   ├── FK → Instructor
 │                   ├── FK → Room (cross-domain)
 │                   ├── 1:N → Schedule (timetable)
 │                   ├── 1:N → Session
 │                   │         ├── FK → Room (can override)
 │                   │         └── 1:N → Attendance
 │                   └── 1:N → Enrollment
 │                             ├── FK → Student
 │                             └── 1:N → Attendance
 │
 ├── 1:N → Instructor → FK → User
 └── 1:N → Student    → FK → User

User
 ├── 1:1 → Instructor (optional)
 └── 1:1 → Student (optional)
```
