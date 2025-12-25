/**
 * Doctor Availability API Routes
 * GET /api/v1/doctors/availability - Get available time slots for doctors
 *
 * Changes made:
 * - Properly interpret the patient's input date according to the patient's timezone or the date's offset.
 * - Convert the patient-intended day to the doctor's timezone and use that doctor's calendar day for:
 *     - validation (past / max-ahead checks)
 *     - querying existing consultations (using UTC bounds derived from the doctor's day)
 *     - generating working-hour slots in the doctor's timezone
 * - For multi-doctor queries we compute per-doctor UTC bounds (and use a single combined DB query window covering all doctors),
 *   then filter each doctor's bookings into that doctor's bounds.
 *
 * Assumptions:
 * - Patient's timezone can be provided via the optional `patientTimezone` query param.
 * - If the incoming dateStr includes an offset / zone (e.g. 2024-07-10T14:00:00+05:30), that offset is honored.
 * - If dateStr is date-only (YYYY-MM-DD) and patientTimezone is provided, the date is interpreted as midnight in patientTimezone.
 * - If neither an offset nor patientTimezone is present, the date is interpreted in UTC (safer than server-local).
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  errorResponse,
  successResponse,
  requireAuth,
  ErrorCodes,
  VALID_SPECIALTIES,
  type Specialty,
} from "@/lib/api-utils";
import { UserRole, ConsultationStatus } from "@/app/generated/prisma/client";
import { DateTime } from "luxon";

const WORKING_HOURS_START = 9;
const WORKING_HOURS_END = 17;
const SLOT_DURATION_MINUTES = 30;
const MAX_BOOKING_DAYS_AHEAD = 30;

/** Helpers ------------------------------------------------------------- */

/**
 * Parse the incoming patient-supplied date string into a Luxon DateTime that reflects the patient's intent.
 *
 * Behavior:
 * - If the ISO string includes an explicit offset/zone, we use that (DateTime.fromISO handles it).
 * - If it's date-only (YYYY-MM-DD) and patientTimezone is provided, we interpret it at midnight in patientTimezone.
 * - If it's date-only and no patientTimezone is provided, default to UTC midnight.
 *
 * Returns: { dateTime, error }
 */
function parsePatientInputDate(
  dateStr: string,
  patientTimezone?: string
): { dateTime?: DateTime; error?: string } {
  if (!dateStr) {
    return { error: "date string required" };
  }

  // Try parsing. If string contains 'T' and an offset, fromISO will include it.
  const dtFromISO = DateTime.fromISO(dateStr, { setZone: true });

  if (
    dtFromISO.isValid &&
    dtFromISO.offset !== 0 &&
    dateStr.match(/([+-]\d{2}:\d{2}|Z)$/)
  ) {
    // If the string had an explicit offset, dtFromISO.setZone has already used it.
    return { dateTime: dtFromISO };
  }

  // If it's a full timestamp without offset (e.g. 2024-07-10T14:00:00), DateTime.fromISO will set zone to local by default.
  // We prefer to treat ambiguous timestamps according to a provided patientTimezone or fallback to UTC.
  if (dateStr.includes("T") && !dateStr.match(/([Zz]|[+-]\d{2}:\d{2})$/)) {
    // ISO datetime without offset
    const zoneToUse = patientTimezone ?? "UTC";
    const dt = DateTime.fromISO(dateStr, { zone: zoneToUse });
    if (!dt.isValid) return { error: "Invalid date-time format" };
    return { dateTime: dt };
  }

  // Date-only string like YYYY-MM-DD
  if (!dateStr.includes("T")) {
    const zoneToUse = patientTimezone ?? "UTC";
    const dt = DateTime.fromISO(dateStr, { zone: zoneToUse });
    if (!dt.isValid) return { error: "Invalid date format" };
    return { dateTime: dt };
  }

  // Fallback: if parsed ok, return it
  if (dtFromISO.isValid) return { dateTime: dtFromISO };

  return { error: "Invalid date format" };
}

/**
 * Given a DateTime that represents the patient-intended instant,
 * compute the doctor's calendar day start/end in UTC and return:
 * { doctorDayStartInDoctorTZ, startOfDayUTC: Date, endOfDayUTC: Date, doctorDayLabel }
 *
 * doctorTimezone must be a valid IANA zone string.
 */
function computeDoctorDayBoundsFromPatientDateTime(
  patientDateTime: DateTime,
  doctorTimezone: string
): {
  doctorDayStartInDoctorTZ: DateTime;
  startOfDayUTC: Date;
  endOfDayUTC: Date;
  doctorDayLabel: string;
} {
  // Convert patient's instant into doctor's timezone (this decides which doctor calendar day the patient-intended instant maps to)
  const inDoctorTZ = patientDateTime.setZone(doctorTimezone);

  // Determine the doctor's calendar day (start and end in doctor's zone)
  const doctorDayStart = inDoctorTZ.startOf("day"); // midnight in doctor's zone
  const doctorDayEnd = doctorDayStart.endOf("day"); // 23:59:59.999 in doctor's zone

  // Convert those bounds to UTC Date for DB queries
  const startOfDayUTC = doctorDayStart.toUTC().toJSDate();
  const endOfDayUTC = doctorDayEnd.toUTC().toJSDate();

  const doctorDayLabel = doctorDayStart.toISODate(); // YYYY-MM-DD in doctor's zone

  return {
    doctorDayStartInDoctorTZ: doctorDayStart,
    startOfDayUTC,
    endOfDayUTC,
    doctorDayLabel: doctorDayLabel ?? "",
  };
}

/**
 * Generate working-hour time slots for a given doctor's day.
 * - Accepts doctorDayStartInDoctorTZ (Luxon DateTime at the doctor's midnight)
 * - Returns slots as UTC Date objects (startTime, endTime)
 */
function generateTimeSlotsForDoctorDay(
  doctorDayStartInDoctorTZ: DateTime
): { startTime: Date; endTime: Date }[] {
  const slots: { startTime: Date; endTime: Date }[] = [];

  const workStart = doctorDayStartInDoctorTZ.plus({
    hours: WORKING_HOURS_START,
  });
  const workEnd = doctorDayStartInDoctorTZ.plus({ hours: WORKING_HOURS_END });

  let currentSlot = workStart;

  while (currentSlot < workEnd) {
    const endSlot = currentSlot.plus({ minutes: SLOT_DURATION_MINUTES });

    slots.push({
      startTime: currentSlot.toUTC().toJSDate(),
      endTime: endSlot.toUTC().toJSDate(),
    });

    currentSlot = endSlot;
  }

  return slots;
}

/** Validates that the doctor's calendar day is within allowed booking window relative to the doctor's local "today" */
function validateDoctorDayWithinBookingWindow(
  doctorDayStartInDoctorTZ: DateTime
): { valid: boolean; error?: string } {
  const todayDoctor = DateTime.now()
    .setZone(doctorDayStartInDoctorTZ.zoneName ?? "UTC")
    .startOf("day");

  if (doctorDayStartInDoctorTZ < todayDoctor) {
    return {
      valid: false,
      error: "Cannot book appointments in the past for the doctor's timezone",
    };
  }

  const maxDate = todayDoctor.plus({ days: MAX_BOOKING_DAYS_AHEAD });
  if (doctorDayStartInDoctorTZ > maxDate) {
    return {
      valid: false,
      error: `Cannot book more than ${MAX_BOOKING_DAYS_AHEAD} days in advance for the doctor's timezone`,
    };
  }

  return { valid: true };
}

/** ------------------------------------------------------------------- */

export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.errorResponse) {
    return authResult.errorResponse;
  }

  const { searchParams } = new URL(request.url);
  const specialty = searchParams.get("specialty");
  const dateStr = searchParams.get("date") ?? ""; // patient-supplied date string (required if you want day-specific availability)
  const doctorId = searchParams.get("doctorId");
  const patientTimezone = searchParams.get("patientTimezone") ?? undefined; // optional - recommended to pass

  if (doctorId !== null && doctorId.trim() === "") {
    return errorResponse(
      ErrorCodes.VALIDATION_ERROR,
      "Invalid doctorId format",
      400,
      { field: "doctorId" }
    );
  }

  if (!specialty) {
    return errorResponse(
      ErrorCodes.VALIDATION_ERROR,
      "Specialty is required",
      400,
      { field: "specialty" }
    );
  }

  if (!VALID_SPECIALTIES.includes(specialty as Specialty)) {
    return errorResponse(
      ErrorCodes.VALIDATION_ERROR,
      `Invalid specialty. Valid options: ${VALID_SPECIALTIES.join(", ")}`,
      400,
      { field: "specialty", validOptions: VALID_SPECIALTIES }
    );
  }

  try {
    // If doctorId is present, we treat it as "availability for a single doctor for the patient-intended day".
    if (doctorId) {
      const doctor = await prisma.user.findUnique({
        where: { id: doctorId },
        include: { doctorProfile: true },
      });

      if (!doctor || doctor.role !== UserRole.DOCTOR) {
        return errorResponse(ErrorCodes.NOT_FOUND, "Doctor not found", 404);
      }

      // We require a dateStr for day-based availability. If not provided, default to tomorrow in patient's timezone (or UTC).
      const effectiveDateStr =
        dateStr || DateTime.utc().plus({ days: 1 }).toISODate();

      // Parse patient input date correctly
      const parsed = parsePatientInputDate(effectiveDateStr, patientTimezone);
      if (parsed.error) {
        return errorResponse(ErrorCodes.VALIDATION_ERROR, parsed.error, 400, {
          field: "date",
        });
      }
      const patientDateTime = parsed.dateTime!; // an instant representing what patient meant

      // Compute which doctor's day that instant maps to (doctor timezone)
      const doctorTimezone = doctor.doctorProfile?.timezone ?? "UTC";
      const {
        doctorDayStartInDoctorTZ,
        startOfDayUTC,
        endOfDayUTC,
        doctorDayLabel,
      } = computeDoctorDayBoundsFromPatientDateTime(
        patientDateTime,
        doctorTimezone
      );

      // Validate booking window in doctor's timezone
      const validation = validateDoctorDayWithinBookingWindow(
        doctorDayStartInDoctorTZ
      );
      if (!validation.valid) {
        return errorResponse(
          ErrorCodes.VALIDATION_ERROR,
          validation.error!,
          400,
          { field: "date" }
        );
      }

      // Query existing consultations for the doctor within the doctor's UTC day bounds
      const existingConsultations = await prisma.consultation.findMany({
        where: {
          doctorId: doctor.id,
          scheduledStartAt: {
            gte: startOfDayUTC,
            lte: endOfDayUTC,
          },
          status: {
            notIn: [ConsultationStatus.CANCELLED, ConsultationStatus.EXPIRED],
          },
        },
        select: { scheduledStartAt: true },
      });

      const bookedTimes = new Set(
        existingConsultations
          .filter((c) => c.scheduledStartAt)
          .map((c) => c.scheduledStartAt!.getTime())
      );

      // Generate slots in doctor's timezone for that doctor's day
      const timeSlots = generateTimeSlotsForDoctorDay(doctorDayStartInDoctorTZ);

      const slots = timeSlots.map((slot) => ({
        ...slot,
        available: !bookedTimes.has(slot.startTime.getTime()),
        doctorId: doctor.id,
      }));

      return successResponse({
        doctorId: doctor.id,
        doctorName: doctor.name,
        date: doctorDayLabel,
        timezone: doctorTimezone,
        slots,
      });
    }

    // Multi-doctor flow -------------------------------------------------
    const doctors = await prisma.user.findMany({
      where: {
        role: UserRole.DOCTOR,
        doctorProfile: {
          specialties: { has: specialty },
        },
      },
      include: { doctorProfile: true },
    });

    if (doctors.length === 0) {
      return successResponse({
        date: dateStr || DateTime.utc().plus({ days: 1 }).toISODate(),
        specialty,
        doctors: [],
        slots: [],
      });
    }

    // For multi-doctor, parse patient date once (or default to tomorrow)
    const effectiveDateStr =
      dateStr || DateTime.utc().plus({ days: 1 }).toISODate();
    const parsed = parsePatientInputDate(effectiveDateStr, patientTimezone);
    if (parsed.error) {
      return errorResponse(ErrorCodes.VALIDATION_ERROR, parsed.error, 400, {
        field: "date",
      });
    }
    const patientDateTime = parsed.dateTime!;

    // For each doctor compute their day bounds and keep a mapping
    type DoctorBounds = {
      doctorId: string;
      doctorTimezone: string;
      doctorDayStartInDoctorTZ: DateTime;
      startOfDayUTC: Date;
      endOfDayUTC: Date;
      doctorDayLabel: string;
    };

    const boundsByDoctor: DoctorBounds[] = doctors.map((doctor) => {
      const tz = doctor.doctorProfile?.timezone ?? "UTC";
      const b = computeDoctorDayBoundsFromPatientDateTime(patientDateTime, tz);
      return {
        doctorId: doctor.id,
        doctorTimezone: tz,
        doctorDayStartInDoctorTZ: b.doctorDayStartInDoctorTZ,
        startOfDayUTC: b.startOfDayUTC,
        endOfDayUTC: b.endOfDayUTC,
        doctorDayLabel: b.doctorDayLabel,
      };
    });

    // Build a combined query window to fetch consultations in one DB call:
    // min startOfDayUTC .. max endOfDayUTC across all doctors
    const minStart = new Date(
      Math.min(...boundsByDoctor.map((b) => b.startOfDayUTC.getTime()))
    );
    const maxEnd = new Date(
      Math.max(...boundsByDoctor.map((b) => b.endOfDayUTC.getTime()))
    );

    const existingConsultations = await prisma.consultation.findMany({
      where: {
        doctorId: { in: doctors.map((d) => d.id) },
        scheduledStartAt: {
          gte: minStart,
          lte: maxEnd,
        },
        status: {
          notIn: [ConsultationStatus.CANCELLED, ConsultationStatus.EXPIRED],
        },
      },
      select: { doctorId: true, scheduledStartAt: true },
    });

    // Group booked times by doctor
    const bookedTimesByDoctor = new Map<string, Set<number>>();
    for (const consultation of existingConsultations) {
      if (consultation.scheduledStartAt && consultation.doctorId) {
        if (!bookedTimesByDoctor.has(consultation.doctorId)) {
          bookedTimesByDoctor.set(consultation.doctorId, new Set());
        }
        bookedTimesByDoctor
          .get(consultation.doctorId)!
          .add(consultation.scheduledStartAt.getTime());
      }
    }

    // Build availability for each doctor using their own bounds and timezone
    const doctorAvailability = doctors.map((doctor) => {
      const bounds = boundsByDoctor.find((b) => b.doctorId === doctor.id)!;
      // Validate doctor's booking window for that day; if not valid, return empty slots
      const validation = validateDoctorDayWithinBookingWindow(
        bounds.doctorDayStartInDoctorTZ
      );
      if (!validation.valid) {
        return {
          doctorId: doctor.id,
          doctorName: doctor.name,
          specialties: doctor.doctorProfile?.specialties ?? [],
          timezone: bounds.doctorTimezone,
          date: bounds.doctorDayLabel,
          slots: [], // out of booking window
          note: validation.error,
        };
      }

      const bookedTimes = bookedTimesByDoctor.get(doctor.id) ?? new Set();
      const timeSlots = generateTimeSlotsForDoctorDay(
        bounds.doctorDayStartInDoctorTZ
      );

      return {
        doctorId: doctor.id,
        doctorName: doctor.name,
        specialties: doctor.doctorProfile?.specialties ?? [],
        timezone: bounds.doctorTimezone,
        date: bounds.doctorDayLabel,
        slots: timeSlots.map((slot) => ({
          ...slot,
          available: !bookedTimes.has(slot.startTime.getTime()),
          doctorId: doctor.id,
        })),
      };
    });

    const allSlots = doctorAvailability.flatMap((da) => da.slots ?? []);

    return successResponse({
      date: effectiveDateStr,
      specialty,
      doctors: doctorAvailability,
      slots: allSlots,
    });
  } catch (error) {
    console.error("Error getting doctor availability:", error);
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      "Failed to get doctor availability",
      500
    );
  }
}
