# API Endpoint List — Academy Management System

## Conventions

- Base path: `/api/v1`
- All endpoints require `Authorization: Bearer <JWT>` (JwtAuthGuard)
- Write endpoints (POST, PUT, PATCH, DELETE) require `admin` or `superadmin` role unless noted
- Multi-academy scoping via `X-Academy-Id` header
- All list endpoints support pagination: `?page=1&limit=20&sortBy=createdAt&sortOrder=DESC`
- UUID validation on all `:id` path params

---

## 1. Academy Endpoints (Existing — Extended)

| Method | Path                        | Description                    | Auth         |
|--------|-----------------------------|--------------------------------|--------------|
| GET    | `/api/v1/academies`         | List all academies (paginated) | superadmin   |
| GET    | `/api/v1/academies/:id`     | Get academy by ID              | authenticated |
| POST   | `/api/v1/academies`         | Create new academy             | superadmin   |
| PUT    | `/api/v1/academies/:id`     | Update academy                 | admin        |
| DELETE | `/api/v1/academies/:id`     | Soft-delete academy            | superadmin   |

> **Note:** Existing endpoints use `/academy` (singular). New architecture standardizes to `/academies` (plural, kebab-case). A redirect or alias should be maintained during migration.

---

## 2. User Endpoints (Existing — Extended)

| Method | Path                        | Description                    | Auth         |
|--------|-----------------------------|--------------------------------|--------------|
| GET    | `/api/v1/users`             | List users (paginated, filterable by userType) | admin |
| GET    | `/api/v1/users/:id`         | Get user by ID                 | authenticated |
| POST   | `/api/v1/users`             | Create user                    | admin        |
| PATCH  | `/api/v1/users/:id`         | Update user                    | admin        |
| DELETE | `/api/v1/users/:id`         | Soft-delete user               | admin        |

---

## 3. Facilities Domain

### 3.1 Facilities

| Method | Path                                        | Description                          | Auth         |
|--------|---------------------------------------------|--------------------------------------|--------------|
| GET    | `/api/v1/facilities`                        | List facilities for current academy  | authenticated |
| GET    | `/api/v1/facilities/:id`                    | Get facility by ID                   | authenticated |
| POST   | `/api/v1/facilities`                        | Create facility                      | admin        |
| PUT    | `/api/v1/facilities/:id`                    | Update facility                      | admin        |
| PATCH  | `/api/v1/facilities/:id/status`             | Toggle active/inactive               | admin        |
| DELETE | `/api/v1/facilities/:id`                    | Soft-delete facility                 | admin        |

**Query filters:** `?city=&country=&activeState=true`

---

### 3.2 Rooms

| Method | Path                                                    | Description                          | Auth         |
|--------|---------------------------------------------------------|--------------------------------------|--------------|
| GET    | `/api/v1/facilities/:facilityId/rooms`                  | List rooms in a facility             | authenticated |
| GET    | `/api/v1/facilities/:facilityId/rooms/:id`              | Get room by ID                       | authenticated |
| POST   | `/api/v1/facilities/:facilityId/rooms`                  | Create room                          | admin        |
| PUT    | `/api/v1/facilities/:facilityId/rooms/:id`              | Update room                          | admin        |
| PATCH  | `/api/v1/facilities/:facilityId/rooms/:id/status`       | Update availability status           | admin        |
| DELETE | `/api/v1/facilities/:facilityId/rooms/:id`              | Soft-delete room                     | admin        |
| GET    | `/api/v1/facilities/:facilityId/rooms/:id/availability` | Check room availability for date range | authenticated |
| GET    | `/api/v1/rooms/available`                               | Find available rooms across facilities | authenticated |

**Query filters for list:** `?type=classroom&locationType=indoor&minCapacity=20&availabilityStatus=available`

**Query params for availability:** `?startDate=2026-03-20&endDate=2026-03-20&startTime=09:00&endTime=11:00`

**Query params for available rooms search:** `?facilityId=&type=&minCapacity=&date=&startTime=&endTime=`

---

### 3.3 Equipment

| Method | Path                                                      | Description                          | Auth         |
|--------|------------------------------------------------------------|--------------------------------------|--------------|
| GET    | `/api/v1/facilities/:facilityId/equipment`                 | List equipment in a facility         | authenticated |
| GET    | `/api/v1/facilities/:facilityId/equipment/:id`             | Get equipment by ID                  | authenticated |
| POST   | `/api/v1/facilities/:facilityId/equipment`                 | Create equipment record              | admin        |
| PUT    | `/api/v1/facilities/:facilityId/equipment/:id`             | Update equipment                     | admin        |
| DELETE | `/api/v1/facilities/:facilityId/equipment/:id`             | Soft-delete equipment                | admin        |
| GET    | `/api/v1/facilities/:facilityId/rooms/:roomId/equipment`   | List equipment in a specific room    | authenticated |
| POST   | `/api/v1/facilities/:facilityId/rooms/:roomId/equipment`   | Assign equipment to room             | admin        |

**Query filters:** `?category=electronics&condition=good&roomId=`

---

### 3.4 Maintenance

| Method | Path                                                    | Description                          | Auth         |
|--------|---------------------------------------------------------|--------------------------------------|--------------|
| GET    | `/api/v1/facilities/:facilityId/maintenance`            | List maintenance records             | authenticated |
| GET    | `/api/v1/facilities/:facilityId/maintenance/:id`        | Get maintenance record               | authenticated |
| POST   | `/api/v1/facilities/:facilityId/maintenance`            | Create maintenance record            | admin        |
| PUT    | `/api/v1/facilities/:facilityId/maintenance/:id`        | Update maintenance record            | admin        |
| PATCH  | `/api/v1/facilities/:facilityId/maintenance/:id/status` | Update maintenance status            | admin        |
| DELETE | `/api/v1/facilities/:facilityId/maintenance/:id`        | Soft-delete maintenance record       | admin        |

**Query filters:** `?status=scheduled&priority=high&roomId=&equipmentId=&type=preventive&from=2026-03-01&to=2026-03-31`

---

### 3.5 Facility Schedules

| Method | Path                                                          | Description                        | Auth         |
|--------|---------------------------------------------------------------|-------------------------------------|--------------|
| GET    | `/api/v1/facilities/:facilityId/schedule`                     | Get facility schedule               | authenticated |
| PUT    | `/api/v1/facilities/:facilityId/schedule`                     | Create or update facility schedule  | admin        |
| PATCH  | `/api/v1/facilities/:facilityId/schedule/weekly-hours`        | Update weekly hours only            | admin        |
| POST   | `/api/v1/facilities/:facilityId/schedule/holidays`            | Add holiday                         | admin        |
| PUT    | `/api/v1/facilities/:facilityId/schedule/holidays/:holidayIndex` | Update holiday                  | admin        |
| DELETE | `/api/v1/facilities/:facilityId/schedule/holidays/:holidayIndex` | Remove holiday                  | admin        |

---

## 4. Classes Domain

### 4.1 Courses

| Method | Path                                           | Description                          | Auth         |
|--------|-------------------------------------------------|--------------------------------------|--------------|
| GET    | `/api/v1/courses`                               | List courses for current academy     | authenticated |
| GET    | `/api/v1/courses/:id`                           | Get course by ID                     | authenticated |
| POST   | `/api/v1/courses`                               | Create course                        | admin        |
| PUT    | `/api/v1/courses/:id`                           | Update course                        | admin        |
| DELETE | `/api/v1/courses/:id`                           | Soft-delete course                   | admin        |
| GET    | `/api/v1/courses/:id/prerequisites`             | List prerequisites for a course      | authenticated |
| POST   | `/api/v1/courses/:id/prerequisites`             | Add prerequisite to course           | admin        |
| DELETE | `/api/v1/courses/:id/prerequisites/:prereqId`   | Remove prerequisite from course      | admin        |
| GET    | `/api/v1/courses/:id/sections`                  | List all sections of a course        | authenticated |

**Query filters:** `?category=&level=beginner&activeState=true&search=`

---

### 4.2 Class Sections

| Method | Path                                           | Description                          | Auth         |
|--------|-------------------------------------------------|--------------------------------------|--------------|
| GET    | `/api/v1/class-sections`                        | List class sections                  | authenticated |
| GET    | `/api/v1/class-sections/:id`                    | Get class section by ID              | authenticated |
| POST   | `/api/v1/class-sections`                        | Create class section                 | admin        |
| PUT    | `/api/v1/class-sections/:id`                    | Update class section                 | admin        |
| PATCH  | `/api/v1/class-sections/:id/status`             | Update section status                | admin        |
| DELETE | `/api/v1/class-sections/:id`                    | Soft-delete class section            | admin        |
| GET    | `/api/v1/class-sections/:id/enrollments`        | List enrollments for section         | admin        |
| GET    | `/api/v1/class-sections/:id/sessions`           | List sessions for section            | authenticated |

**Query filters:** `?courseId=&instructorId=&roomId=&status=active&startDate=&endDate=`

---

### 4.3 Class Schedules (Timetable)

| Method | Path                                                     | Description                          | Auth         |
|--------|----------------------------------------------------------|--------------------------------------|--------------|
| GET    | `/api/v1/class-sections/:sectionId/schedules`            | List schedules for a section         | authenticated |
| POST   | `/api/v1/class-sections/:sectionId/schedules`            | Add schedule entry                   | admin        |
| PUT    | `/api/v1/class-sections/:sectionId/schedules/:id`        | Update schedule entry                | admin        |
| DELETE | `/api/v1/class-sections/:sectionId/schedules/:id`        | Remove schedule entry                | admin        |
| POST   | `/api/v1/class-sections/:sectionId/schedules/generate-sessions` | Generate sessions from schedule | admin |

---

### 4.4 Sessions

| Method | Path                                           | Description                          | Auth         |
|--------|-------------------------------------------------|--------------------------------------|--------------|
| GET    | `/api/v1/sessions`                              | List sessions (filterable)           | authenticated |
| GET    | `/api/v1/sessions/:id`                          | Get session by ID                    | authenticated |
| POST   | `/api/v1/sessions`                              | Create ad-hoc session                | admin        |
| PUT    | `/api/v1/sessions/:id`                          | Update session                       | admin        |
| PATCH  | `/api/v1/sessions/:id/status`                   | Update session status                | admin        |
| DELETE | `/api/v1/sessions/:id`                          | Soft-delete (cancel) session         | admin        |
| GET    | `/api/v1/sessions/:id/attendance`               | Get attendance for session           | admin        |
| POST   | `/api/v1/sessions/:id/attendance`               | Record attendance (bulk)             | admin        |

**Query filters:** `?classSectionId=&roomId=&date=&status=&from=&to=&instructorId=`

---

### 4.5 Enrollments

| Method | Path                                           | Description                          | Auth         |
|--------|-------------------------------------------------|--------------------------------------|--------------|
| GET    | `/api/v1/enrollments`                           | List enrollments                     | admin        |
| GET    | `/api/v1/enrollments/:id`                       | Get enrollment by ID                 | authenticated |
| POST   | `/api/v1/enrollments`                           | Enroll student in section            | admin        |
| PATCH  | `/api/v1/enrollments/:id/status`                | Update enrollment status (drop, complete) | admin  |
| DELETE | `/api/v1/enrollments/:id`                       | Soft-delete enrollment               | admin        |
| GET    | `/api/v1/enrollments/:id/attendance`            | Get attendance history for enrollment | authenticated |

**Query filters:** `?studentId=&classSectionId=&status=active`

---

### 4.6 Instructors

| Method | Path                                           | Description                          | Auth         |
|--------|-------------------------------------------------|--------------------------------------|--------------|
| GET    | `/api/v1/instructors`                           | List instructors for academy         | authenticated |
| GET    | `/api/v1/instructors/:id`                       | Get instructor profile               | authenticated |
| POST   | `/api/v1/instructors`                           | Create instructor (links to user)    | admin        |
| PUT    | `/api/v1/instructors/:id`                       | Update instructor profile            | admin        |
| DELETE | `/api/v1/instructors/:id`                       | Soft-delete instructor               | admin        |
| GET    | `/api/v1/instructors/:id/sections`              | List sections assigned to instructor | authenticated |
| GET    | `/api/v1/instructors/:id/availability`          | Get instructor availability          | authenticated |
| PUT    | `/api/v1/instructors/:id/availability`          | Update instructor availability       | admin        |

**Query filters:** `?specialization=&activeState=true&search=`

---

### 4.7 Students

| Method | Path                                           | Description                          | Auth         |
|--------|-------------------------------------------------|--------------------------------------|--------------|
| GET    | `/api/v1/students`                              | List students for academy            | admin        |
| GET    | `/api/v1/students/:id`                          | Get student profile                  | authenticated |
| POST   | `/api/v1/students`                              | Create student (links to user)       | admin        |
| PUT    | `/api/v1/students/:id`                          | Update student profile               | admin        |
| DELETE | `/api/v1/students/:id`                          | Soft-delete student                  | admin        |
| GET    | `/api/v1/students/:id/enrollments`              | List student enrollments             | authenticated |
| GET    | `/api/v1/students/:id/attendance-summary`       | Get attendance summary across classes | authenticated |

**Query filters:** `?activeState=true&search=&enrolledInCourse=`

---

### 4.8 Attendance

| Method | Path                                           | Description                          | Auth         |
|--------|-------------------------------------------------|--------------------------------------|--------------|
| GET    | `/api/v1/attendance`                            | List attendance records              | admin        |
| POST   | `/api/v1/attendance/bulk`                       | Bulk create/update attendance        | admin        |
| PUT    | `/api/v1/attendance/:id`                        | Update single attendance record      | admin        |

**Query filters:** `?sessionId=&enrollmentId=&status=present&from=&to=`

---

## 5. Endpoint Count Summary

| Domain      | Sub-resource       | Endpoints |
|-------------|-------------------|-----------|
| Academy     | —                 | 5         |
| User        | —                 | 5         |
| Facilities  | Facility          | 6         |
|             | Room              | 8         |
|             | Equipment         | 7         |
|             | Maintenance       | 6         |
|             | FacilitySchedule  | 6         |
| Classes     | Course            | 9         |
|             | ClassSection      | 8         |
|             | ClassSchedule     | 5         |
|             | Session           | 8         |
|             | Enrollment        | 6         |
|             | Instructor        | 8         |
|             | Student           | 7         |
|             | Attendance        | 3         |
| **Total**   |                   | **97**    |
