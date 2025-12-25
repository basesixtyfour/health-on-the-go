# API Documentation

**Base URL:** `/api/v1`

## Authentication

All endpoints require authentication via session cookie (Google OAuth).

## Endpoints

### Consultations

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/consultations` | Create consultation | Any |
| `GET` | `/consultations` | List consultations | Any (role-filtered) |
| `GET` | `/consultations/:id` | Get consultation | Owner/Doctor/Admin |
| `PATCH` | `/consultations/:id` | Update consultation | Doctor/Admin |
| `POST` | `/consultations/:id/intake` | Submit intake form | Patient only |
| `PUT` | `/consultations/:id/intake` | Update intake form | Patient only |

### Doctors

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/doctors` | List doctors | Any |
| `GET` | `/doctors/:id` | Get doctor details | Any |
| `GET` | `/doctors/availability` | Get available slots | Any |

## Request/Response Examples

### Create Consultation
```bash
POST /api/v1/consultations
```
```json
{ "specialty": "CARDIOLOGY", "scheduledStartAt": "2024-01-15T10:00:00Z" }
```

### Get Doctor Availability
```bash
GET /api/v1/doctors/availability?specialty=CARDIOLOGY&date=2024-01-15
```

## Error Format

```json
{ "error": { "code": "ERROR_CODE", "message": "Description" } }
```

| Code | Status |
|------|--------|
| `VALIDATION_ERROR` | 400 |
| `UNAUTHORIZED` | 401 |
| `FORBIDDEN` | 403 |
| `NOT_FOUND` | 404 |
| `CONFLICT` | 409 |

## Enums

**Specialties:** `GENERAL`, `CARDIOLOGY`, `DERMATOLOGY`, `PEDIATRICS`, `PSYCHIATRY`, `ORTHOPEDICS`

**Consultation Status:** `CREATED` → `PAYMENT_PENDING` → `PAID` → `IN_CALL` → `COMPLETED`

**User Roles:** `PATIENT`, `DOCTOR`, `ADMIN`
