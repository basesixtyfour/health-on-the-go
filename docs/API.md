# API Documentation

**Base URL:** `/api/v1`  
**Version:** 1.0.0

## Table of Contents

- [Authentication](#authentication)
- [Error Handling](#error-handling)
- [Endpoints](#endpoints)
  - [Consultations](#consultations)
  - [Video Calls](#video-calls)
  - [Payments](#payments)
  - [Doctors](#doctors)
  - [Users](#users)
- [Enums & Constants](#enums--constants)

---

## Authentication

All endpoints require authentication via session cookie (Google OAuth) unless otherwise specified.

### Session Management

Authentication is handled through NextAuth.js with Google OAuth provider. Upon successful authentication, a session cookie is set automatically.

**Unauthenticated Response:**
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

---

## Error Handling

All errors follow a consistent format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description",
    "details": { }
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid input data |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict (e.g., duplicate) |
| `INVALID_STATUS_TRANSITION` | 400 | Invalid status state transition |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Endpoints

### Consultations

#### Create Consultation
`POST /api/v1/consultations`

Creates a new consultation request.

**Authorization:** Any authenticated user

**Request Body:**
```json
{
  "specialty": "CARDIOLOGY",
  "scheduledStartAt": "2024-01-15T10:00:00Z",
  "patientTimezone": "America/New_York"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `specialty` | string | Yes | Medical specialty (see [Specialties](#specialties)) |
| `scheduledStartAt` | string (ISO 8601) | Yes | Desired appointment time |
| `patientTimezone` | string | No | Patient's timezone (IANA format) |

**Response:** `201 Created`
```json
{
  "id": "consultation_id",
  "specialty": "CARDIOLOGY",
  "status": "CREATED",
  "patientId": "user_id",
  "doctorId": null,
  "scheduledStartAt": "2024-01-15T10:00:00.000Z",
  "createdAt": "2024-01-10T08:00:00.000Z",
  "updatedAt": "2024-01-10T08:00:00.000Z"
}
```

---

#### List Consultations
`GET /api/v1/consultations`

Returns consultations filtered by user role.

**Authorization:** Any authenticated user (role-filtered)
- **Patients:** See only their own consultations
- **Doctors:** See consultations assigned to them
- **Admins:** See all consultations

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status |
| `specialty` | string | Filter by specialty |
| `limit` | number | Results per page (default: 20, max: 100) |
| `offset` | number | Pagination offset (default: 0) |

**Response:** `200 OK`
```json
{
  "data": [...],
  "pagination": {
    "total": 50,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

---

#### Get Consultation
`GET /api/v1/consultations/:id`

Retrieves a single consultation with full details.

**Authorization:** Owner (patient), Assigned Doctor, or Admin

**Response:** `200 OK`
```json
{
  "id": "consultation_id",
  "specialty": "CARDIOLOGY",
  "status": "PAID",
  "patientId": "patient_id",
  "doctorId": "doctor_id",
  "scheduledStartAt": "2024-01-15T10:00:00.000Z",
  "startedAt": null,
  "endedAt": null,
  "patientIntake": {
    "id": "intake_id",
    "nameOrAlias": "John",
    "ageRange": "26_40",
    "chiefComplaint": "Chest pain",
    "consentAcceptedAt": "2024-01-10T09:00:00.000Z"
  },
  "payments": [...],
  "patient": {
    "id": "patient_id",
    "name": "John Doe",
    "email": "john@example.com"
  },
  "doctor": {
    "id": "doctor_id",
    "name": "Dr. Smith",
    "email": "dr.smith@example.com"
  }
}
```

---

#### Update Consultation
`PATCH /api/v1/consultations/:id`

Updates consultation status, doctor assignment, or schedule.

**Authorization:** 
- **Status updates:** Doctors and Admins only
- **Doctor assignment:** Admins only
- **Schedule updates:** Doctors and Admins only

**Request Body:**
```json
{
  "status": "IN_CALL",
  "doctorId": "doctor_id",
  "scheduledStartAt": "2024-01-15T11:00:00Z",
  "updatedAt": "2024-01-10T08:00:00.000Z"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | string | No | New status (see [Status Transitions](#consultation-status-transitions)) |
| `doctorId` | string | No | Doctor to assign (Admin only) |
| `scheduledStartAt` | string (ISO 8601) | No | Updated schedule time |
| `updatedAt` | string (ISO 8601) | No | Optimistic locking timestamp |

**Response:** `200 OK`

---

#### Submit Patient Intake
`POST /api/v1/consultations/:id/intake`

Submits the patient intake form for a consultation.

**Authorization:** Patient (consultation owner) only

**Request Body:**
```json
{
  "nameOrAlias": "John",
  "ageRange": "26_40",
  "chiefComplaint": "Experiencing occasional chest pain for the past week",
  "consentAccepted": true
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `nameOrAlias` | string | Yes | Patient's name or alias |
| `ageRange` | string | No | Age range (see [Age Ranges](#age-ranges)) |
| `chiefComplaint` | string | No | Primary reason for consultation |
| `consentAccepted` | boolean | Yes | Must be `true` |

**Allowed Status:** `CREATED`, `PAYMENT_PENDING`

**Response:** `201 Created`
```json
{
  "id": "intake_id",
  "consultationId": "consultation_id",
  "nameOrAlias": "John",
  "ageRange": "26_40",
  "chiefComplaint": "Experiencing occasional chest pain",
  "consentAcceptedAt": "2024-01-10T09:00:00.000Z"
}
```

---

#### Update Patient Intake
`PUT /api/v1/consultations/:id/intake`

Updates or creates patient intake form (upsert behavior).

**Authorization:** Patient (consultation owner) only

**Request Body:** Same as POST

**Allowed Status:** `CREATED`, `PAYMENT_PENDING`

**Response:** `200 OK`

---

### Video Calls

#### Join Consultation Video Call
`POST /api/v1/consultations/:id/join`

Generates a video call join URL for a consultation. Creates the Daily room on first join (lazy creation).

**Authorization:** Patient (owner), Assigned Doctor, or Admin

**Time Window:**
- **Early join:** 5 minutes before scheduled time
- **Late join:** Up to 30 minutes after scheduled time

**Allowed Status:** `PAID`, `IN_CALL`

**Request Body:** None required

**Response:** `200 OK`
```json
{
  "joinUrl": "https://health-on-the-go.daily.co/consult_xxx?t=token",
  "roomUrl": "https://health-on-the-go.daily.co/consult_xxx",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": "2024-01-15T11:00:00.000Z"
}
```

**Side Effects:**
- Creates video session in database on first join
- Transitions consultation status to `IN_CALL` on first join
- Sets `startedAt` timestamp
- Creates `JOIN_TOKEN_MINTED` audit event

**Error Responses:**

| Scenario | Code | Message |
|----------|------|---------|
| Too early | `VALIDATION_ERROR` | "Too early to join. You can join 5 minutes before..." |
| Too late | `VALIDATION_ERROR` | "Too late to join. The join window closed..." |
| Wrong status | `VALIDATION_ERROR` | "Cannot join consultation with status: {status}" |
| Not authorized | `FORBIDDEN` | "You are not authorized to join this consultation" |

---

### Payments

#### Create Checkout Session
`POST /api/v1/payments`

Creates a Square checkout session for consultation payment.

**Authorization:** Patient (consultation owner) only

**Request Body:**
```json
{
  "consultationId": "consultation_id"
}
```

**Allowed Consultation Status:** `CREATED`, `PAYMENT_FAILED`

**Response:** `201 Created`
```json
{
  "url": "https://checkout.squareup.com/...",
  "paymentId": "payment_id"
}
```

**Error Responses:**

| Scenario | Code | Message |
|----------|------|---------|
| Already paid | `CONFLICT` | "A payment is already in progress or completed" |
| Wrong status | `VALIDATION_ERROR` | "Payment cannot be initiated for consultation in {status} status" |

---

#### Get Payment Status
`GET /api/v1/payments/:id`

Retrieves the status of a specific payment.

**Authorization:** Patient (consultation owner) or Admin

**Response:** `200 OK`
```json
{
  "id": "payment_id",
  "status": "PAID",
  "amount": 5000,
  "currency": "USD",
  "consultationId": "consultation_id",
  "providerCheckoutId": "square_checkout_id",
  "createdAt": "2024-01-10T09:00:00.000Z",
  "updatedAt": "2024-01-10T09:05:00.000Z"
}
```

---

#### Payment Webhook (Internal)
`POST /api/v1/payments/webhook`

Handles payment status updates from Square. **Not for direct API consumption.**

**Authentication:** Verified via `x-square-hmacsha256-signature` header

**Events Handled:**
- `payment.updated` → Updates payment and consultation status

---

### Doctors

#### List Doctors
`GET /api/v1/doctors`

Returns a paginated list of all doctors.

**Authorization:** Any authenticated user

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `specialty` | string | Filter by specialty |
| `search` | string | Search by name (case-insensitive) |
| `limit` | number | Results per page (default: 20, max: 100) |
| `offset` | number | Pagination offset (default: 0) |

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "doctor_id",
      "name": "Dr. Jane Smith",
      "email": "jane.smith@example.com",
      "image": "https://...",
      "role": "DOCTOR",
      "doctorProfile": {
        "id": "profile_id",
        "specialties": ["CARDIOLOGY", "GENERAL"],
        "timezone": "America/New_York"
      }
    }
  ],
  "pagination": {
    "total": 15,
    "limit": 20,
    "offset": 0,
    "hasMore": false
  }
}
```

---

#### Get Doctor Details
`GET /api/v1/doctors/:id`

Retrieves details for a specific doctor.

**Authorization:** Any authenticated user

**Response:** `200 OK`
```json
{
  "id": "doctor_id",
  "name": "Dr. Jane Smith",
  "email": "jane.smith@example.com",
  "image": "https://...",
  "role": "DOCTOR",
  "doctorProfile": {
    "id": "profile_id",
    "specialties": ["CARDIOLOGY", "GENERAL"],
    "timezone": "America/New_York"
  },
  "_count": {
    "consultationsAsDoctor": 42
  }
}
```

> **Note:** `_count` is only included for Admin users.

---

#### Get Available Slots
`GET /api/v1/doctors/availability`

Returns available appointment slots based on specialty and date.

**Authorization:** Any authenticated user

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `specialty` | string | Yes | Medical specialty |
| `date` | string (ISO 8601) | Yes | Date to check availability |
| `patientTimezone` | string | No | Patient's timezone (IANA format) |
| `doctorId` | string | No | Filter to specific doctor |

**Example Request:**
```
GET /api/v1/doctors/availability?specialty=CARDIOLOGY&date=2024-01-15&patientTimezone=America/New_York
```

**Response:** `200 OK`
```json
{
  "date": "2024-01-15",
  "specialty": "CARDIOLOGY",
  "slots": [
    {
      "doctorId": "doctor_id",
      "doctorName": "Dr. Jane Smith",
      "startTime": "2024-01-15T14:00:00.000Z",
      "endTime": "2024-01-15T14:30:00.000Z",
      "available": true
    }
  ]
}
```

**Availability Rules:**
- Working hours: 9:00 AM - 5:00 PM (doctor's local time)
- Slot duration: 30 minutes
- Maximum booking window: 30 days ahead

---

### Users

#### Get Current User
`GET /api/v1/users/me`

Retrieves the current authenticated user's profile.

**Authorization:** Authenticated user

**Response:** `200 OK`
```json
{
  "id": "user_id",
  "name": "John Doe",
  "email": "john@example.com",
  "image": "https://...",
  "role": "PATIENT",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-05T12:00:00.000Z"
}
```

> **Note:** For doctors, includes `doctorProfile` object.

---

#### Update Current User
`PATCH /api/v1/users/me`

Updates the current user's profile.

**Authorization:** Authenticated user (owner)

**Request Body:**
```json
{
  "name": "John Smith",
  "image": "https://example.com/avatar.jpg"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Display name |
| `image` | string \| null | Profile image URL (must be valid HTTP/HTTPS URL) |

**Restricted Fields:** `email`, `role` (cannot be updated via this endpoint)

**Doctor Profile Updates (Doctors only):**
```json
{
  "doctorProfile": {
    "specialties": ["CARDIOLOGY", "GENERAL"],
    "timezone": "America/New_York"
  }
}
```

**Response:** `200 OK`

---

#### Get Current User's Consultations
`GET /api/v1/users/me/consultations`

Returns consultations for the current user.

**Authorization:** Authenticated user

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status |
| `from` | string (ISO 8601) | Filter by creation date (start) |
| `to` | string (ISO 8601) | Filter by creation date (end) |
| `limit` | number | Results per page (default: 20, max: 100) |
| `offset` | number | Pagination offset (default: 0) |

**Behavior by Role:**
- **Patients:** Returns consultations where user is patient
- **Doctors:** Returns consultations where user is assigned doctor
- **Admins:** Returns consultations where user is patient OR doctor

**Response:** `200 OK`
```json
{
  "data": [...],
  "pagination": {
    "total": 10,
    "limit": 20,
    "offset": 0,
    "hasMore": false
  }
}
```

---

## Enums & Constants

### Specialties

| Value | Description |
|-------|-------------|
| `GENERAL` | General Practice |
| `CARDIOLOGY` | Heart & Cardiovascular |
| `DERMATOLOGY` | Skin Conditions |
| `PEDIATRICS` | Children's Health |
| `PSYCHIATRY` | Mental Health |
| `ORTHOPEDICS` | Bones & Joints |

### Consultation Status

| Status | Description |
|--------|-------------|
| `CREATED` | Initial state after creation |
| `PAYMENT_PENDING` | Awaiting payment |
| `PAYMENT_FAILED` | Payment attempt failed |
| `PAID` | Payment successful, awaiting call |
| `IN_CALL` | Video consultation in progress |
| `COMPLETED` | Consultation finished |

#### Consultation Status Transitions

```
CREATED → PAYMENT_PENDING → PAID → IN_CALL → COMPLETED
                         ↓
                   PAYMENT_FAILED → PAID
```

### Payment Status

| Status | Description |
|--------|-------------|
| `PENDING` | Checkout created, awaiting completion |
| `PAID` | Payment successful |
| `FAILED` | Payment failed |
| `REFUNDED` | Payment refunded |

### User Roles

| Role | Description |
|------|-------------|
| `PATIENT` | Healthcare consumer |
| `DOCTOR` | Healthcare provider |
| `ADMIN` | System administrator |

### Age Ranges

| Value | Description |
|-------|-------------|
| `0_12` | 0-12 years |
| `13_17` | 13-17 years |
| `18_25` | 18-25 years |
| `26_40` | 26-40 years |
| `41_64` | 41-64 years |
| `65_PLUS` | 65+ years |

---

## Rate Limiting

Currently, no rate limiting is implemented. API consumers should implement reasonable backoff strategies.

---

## Changelog

### v1.0.0 (December 2024)
- Initial API release
- Consultations CRUD with status management
- Video call integration via Daily.co
- Square payment integration
- Doctor availability scheduling
- User profile management
