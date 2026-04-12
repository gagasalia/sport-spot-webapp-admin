# NestJS Module Map — Academy Management System

## Overview

The backend follows a modular monolith architecture using NestJS. Each domain is a self-contained module with its own controllers, services, DTOs, and entities. Cross-domain communication happens through imported services — never direct entity access.

---

## 1. Module Hierarchy

```
AppModule
 │
 ├── CoreModule (global)
 │    ├── DatabaseModule (TypeORM / PostgreSQL connection)
 │    ├── ConfigModule (@nestjs/config — env variables)
 │    ├── AuthModule (guards, JWT strategy, decorators)
 │    └── CommonModule (base entity, pagination, filters, audit)
 │
 ├── AcademyModule
 │    ├── AcademyController
 │    ├── AcademyService
 │    ├── Entities: Academy
 │    └── DTOs: CreateAcademyDto, UpdateAcademyDto, AcademyResponseDto
 │
 ├── UserModule
 │    ├── UserController
 │    ├── UserService
 │    ├── Entities: User
 │    └── DTOs: CreateUserDto, UpdateUserDto, UserResponseDto
 │
 ├── FacilitiesModule ◄── CORE DOMAIN
 │    ├── FacilityController
 │    ├── FacilityService
 │    ├── RoomController
 │    ├── RoomService
 │    ├── EquipmentController
 │    ├── EquipmentService
 │    ├── MaintenanceController
 │    ├── MaintenanceService
 │    ├── FacilityScheduleController
 │    ├── FacilityScheduleService
 │    ├── Entities: Facility, Room, Equipment, MaintenanceSchedule, FacilitySchedule
 │    └── DTOs: (see DTO summary document)
 │
 └── ClassesModule ◄── CORE DOMAIN
      ├── CourseController
      ├── CourseService
      ├── ClassSectionController
      ├── ClassSectionService
      ├── SessionController
      ├── SessionService
      ├── ScheduleController (class timetable)
      ├── ScheduleService
      ├── EnrollmentController
      ├── EnrollmentService
      ├── InstructorController
      ├── InstructorService
      ├── StudentController
      ├── StudentService
      ├── AttendanceController
      ├── AttendanceService
      ├── Entities: Course, CoursePrerequisite, ClassSection, Schedule,
      │             Session, Enrollment, Instructor, Student, Attendance
      └── DTOs: (see DTO summary document)
```

---

## 2. Module Dependencies (Imports/Exports)

### CoreModule

```
@Global()
@Module({
  imports: [
    TypeOrmModule.forRoot(dbConfig),
    ConfigModule.forRoot({ isGlobal: true }),
  ],
  providers: [PaginationService, AuditService],
  exports:   [PaginationService, AuditService],
})
```

Provides globally: database connection, config, pagination helper, audit trail.

---

### AuthModule

```
@Module({
  imports:    [UserModule, JwtModule],
  providers:  [AuthService, JwtStrategy, JwtAuthGuard, RolesGuard],
  exports:    [JwtAuthGuard, RolesGuard],
})
```

**Not implemented in this architecture** — assumed to exist. Referenced by:
- `@UseGuards(JwtAuthGuard)` on all controllers
- `@UseGuards(RolesGuard)` + `@Roles('admin')` on write endpoints
- `@CurrentUser()` decorator to extract user from JWT

---

### AcademyModule

```
@Module({
  imports:     [TypeOrmModule.forFeature([Academy])],
  controllers: [AcademyController],
  providers:   [AcademyService],
  exports:     [AcademyService],   // needed by Facilities, Classes
})
```

---

### UserModule

```
@Module({
  imports:     [TypeOrmModule.forFeature([User])],
  controllers: [UserController],
  providers:   [UserService],
  exports:     [UserService],   // needed by Auth, Instructor, Student
})
```

---

### FacilitiesModule

```
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Facility, Room, Equipment, MaintenanceSchedule, FacilitySchedule
    ]),
    AcademyModule,   // validates academyId on facility creation
  ],
  controllers: [
    FacilityController,
    RoomController,
    EquipmentController,
    MaintenanceController,
    FacilityScheduleController,
  ],
  providers: [
    FacilityService,
    RoomService,
    EquipmentService,
    MaintenanceService,
    FacilityScheduleService,
  ],
  exports: [
    RoomService,           // ◄ exported for ClassesModule (room booking, availability)
    FacilityService,       // ◄ exported for ClassesModule (capacity validation)
    FacilityScheduleService, // ◄ exported for ClassesModule (schedule conflict checks)
  ],
})
```

---

### ClassesModule

```
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Course, CoursePrerequisite, ClassSection, Schedule,
      Session, Enrollment, Instructor, Student, Attendance
    ]),
    AcademyModule,      // validates academyId
    FacilitiesModule,   // ◄ room availability, capacity checks, schedule conflicts
    UserModule,         // ◄ links instructors/students to users
  ],
  controllers: [
    CourseController,
    ClassSectionController,
    SessionController,
    ScheduleController,
    EnrollmentController,
    InstructorController,
    StudentController,
    AttendanceController,
  ],
  providers: [
    CourseService,
    ClassSectionService,
    SessionService,
    ScheduleService,
    EnrollmentService,
    InstructorService,
    StudentService,
    AttendanceService,
  ],
  exports: [
    ClassSectionService,  // for potential future modules (billing, reports)
    EnrollmentService,
  ],
})
```

---

## 3. Shared Infrastructure

### Base Entity (all entities inherit from this)

```
@Entity()
abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;   // soft delete
}
```

### Pagination

All list endpoints accept:
```
GET /api/v1/resource?page=1&limit=20&sortBy=createdAt&sortOrder=DESC
```

Standard paginated response:
```json
{
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 20,
    "totalItems": 150,
    "totalPages": 8
  }
}
```

### Global API Response Wrapper

All responses follow the existing frontend convention:
```json
{
  "result": {
    "data": <T | T[]>,
    "meta": { ... }   // only on paginated responses
  }
}
```

### Guards & Decorators (assumed, not implemented)

| Guard/Decorator    | Purpose                                  |
|--------------------|------------------------------------------|
| `@UseGuards(JwtAuthGuard)` | All endpoints — JWT validation  |
| `@UseGuards(RolesGuard)`   | Admin-only endpoints            |
| `@Roles('admin', 'superadmin')` | Role-based access           |
| `@CurrentUser()`           | Extract user from JWT           |
| `@AcademyScope()`         | Multi-academy tenant scoping    |

### Multi-Academy Scoping

Since the system serves multiple academies, **every query is scoped to an academyId**:

1. The JWT contains the user's `academies[]` array
2. A middleware/interceptor extracts the active `academyId` from the request header `X-Academy-Id`
3. All services receive this `academyId` and scope their queries accordingly
4. SuperAdmin bypasses scoping and can access all academies

---

## 4. Directory Structure

```
src/
├── main.ts
├── app.module.ts
│
├── core/
│   ├── core.module.ts
│   ├── database/
│   │   ├── database.module.ts
│   │   └── typeorm.config.ts
│   ├── common/
│   │   ├── entities/
│   │   │   └── base.entity.ts
│   │   ├── dto/
│   │   │   ├── pagination-query.dto.ts
│   │   │   └── paginated-response.dto.ts
│   │   ├── interceptors/
│   │   │   └── response-wrapper.interceptor.ts
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts
│   │   │   ├── roles.decorator.ts
│   │   │   └── academy-scope.decorator.ts
│   │   └── pipes/
│   │       └── uuid-validation.pipe.ts
│   └── auth/
│       ├── auth.module.ts
│       ├── guards/
│       │   ├── jwt-auth.guard.ts
│       │   └── roles.guard.ts
│       └── strategies/
│           └── jwt.strategy.ts
│
├── academy/
│   ├── academy.module.ts
│   ├── academy.controller.ts
│   ├── academy.service.ts
│   ├── entities/
│   │   └── academy.entity.ts
│   └── dto/
│       ├── create-academy.dto.ts
│       ├── update-academy.dto.ts
│       └── academy-response.dto.ts
│
├── user/
│   ├── user.module.ts
│   ├── user.controller.ts
│   ├── user.service.ts
│   ├── entities/
│   │   └── user.entity.ts
│   └── dto/
│       ├── create-user.dto.ts
│       ├── update-user.dto.ts
│       └── user-response.dto.ts
│
├── facilities/
│   ├── facilities.module.ts
│   ├── facility/
│   │   ├── facility.controller.ts
│   │   ├── facility.service.ts
│   │   ├── entities/
│   │   │   └── facility.entity.ts
│   │   └── dto/
│   │       ├── create-facility.dto.ts
│   │       ├── update-facility.dto.ts
│   │       └── facility-response.dto.ts
│   ├── room/
│   │   ├── room.controller.ts
│   │   ├── room.service.ts
│   │   ├── entities/
│   │   │   └── room.entity.ts
│   │   └── dto/
│   │       ├── create-room.dto.ts
│   │       ├── update-room.dto.ts
│   │       ├── room-response.dto.ts
│   │       └── room-availability-query.dto.ts
│   ├── equipment/
│   │   ├── equipment.controller.ts
│   │   ├── equipment.service.ts
│   │   ├── entities/
│   │   │   └── equipment.entity.ts
│   │   └── dto/
│   │       ├── create-equipment.dto.ts
│   │       ├── update-equipment.dto.ts
│   │       └── equipment-response.dto.ts
│   ├── maintenance/
│   │   ├── maintenance.controller.ts
│   │   ├── maintenance.service.ts
│   │   ├── entities/
│   │   │   └── maintenance-schedule.entity.ts
│   │   └── dto/
│   │       ├── create-maintenance.dto.ts
│   │       ├── update-maintenance.dto.ts
│   │       └── maintenance-response.dto.ts
│   └── schedule/
│       ├── facility-schedule.controller.ts
│       ├── facility-schedule.service.ts
│       ├── entities/
│       │   └── facility-schedule.entity.ts
│       └── dto/
│           ├── update-facility-schedule.dto.ts
│           └── facility-schedule-response.dto.ts
│
└── classes/
    ├── classes.module.ts
    ├── course/
    │   ├── course.controller.ts
    │   ├── course.service.ts
    │   ├── entities/
    │   │   ├── course.entity.ts
    │   │   └── course-prerequisite.entity.ts
    │   └── dto/
    │       ├── create-course.dto.ts
    │       ├── update-course.dto.ts
    │       └── course-response.dto.ts
    ├── class-section/
    │   ├── class-section.controller.ts
    │   ├── class-section.service.ts
    │   ├── entities/
    │   │   └── class-section.entity.ts
    │   └── dto/
    │       ├── create-class-section.dto.ts
    │       ├── update-class-section.dto.ts
    │       └── class-section-response.dto.ts
    ├── session/
    │   ├── session.controller.ts
    │   ├── session.service.ts
    │   ├── entities/
    │   │   └── session.entity.ts
    │   └── dto/
    │       ├── create-session.dto.ts
    │       ├── update-session.dto.ts
    │       └── session-response.dto.ts
    ├── schedule/
    │   ├── class-schedule.controller.ts
    │   ├── class-schedule.service.ts
    │   ├── entities/
    │   │   └── class-schedule.entity.ts
    │   └── dto/
    │       ├── create-schedule.dto.ts
    │       ├── update-schedule.dto.ts
    │       └── schedule-response.dto.ts
    ├── enrollment/
    │   ├── enrollment.controller.ts
    │   ├── enrollment.service.ts
    │   ├── entities/
    │   │   └── enrollment.entity.ts
    │   └── dto/
    │       ├── create-enrollment.dto.ts
    │       ├── update-enrollment.dto.ts
    │       └── enrollment-response.dto.ts
    ├── instructor/
    │   ├── instructor.controller.ts
    │   ├── instructor.service.ts
    │   ├── entities/
    │   │   └── instructor.entity.ts
    │   └── dto/
    │       ├── create-instructor.dto.ts
    │       ├── update-instructor.dto.ts
    │       └── instructor-response.dto.ts
    ├── student/
    │   ├── student.controller.ts
    │   ├── student.service.ts
    │   ├── entities/
    │   │   └── student.entity.ts
    │   └── dto/
    │       ├── create-student.dto.ts
    │       ├── update-student.dto.ts
    │       └── student-response.dto.ts
    └── attendance/
        ├── attendance.controller.ts
        ├── attendance.service.ts
        ├── entities/
        │   └── attendance.entity.ts
        └── dto/
            ├── create-attendance.dto.ts
            ├── update-attendance.dto.ts
            └── attendance-response.dto.ts
```
