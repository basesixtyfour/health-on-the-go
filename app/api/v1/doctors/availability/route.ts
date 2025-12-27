/**
 * Doctor Availability API Routes
 * GET /api/v1/doctors/availability - Get available time slots for doctors
 *
 * Changes made:
 * - Properly interpret the patient's input date according to the patient's timezone or the date's offset.
 * - Treat the patient-selected day as a patient-local calendar day and convert that day bounds into UTC instants.
 * - Generate working-hour slots in the doctor's timezone (to respect DST), convert to UTC instants, then filter to the
 *   patient-day UTC window.
 * - Query existing consultations using the patient-day UTC window (canonical), then mark slots as available/unavailable.
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
 * Returns: { dateTime, error, hadExplicitOffset }
 */
function parsePatientInputDate(
  dateStr: string,
  patientTimezone?: string
): { dateTime?: DateTime; error?: string; hadExplicitOffset?: boolean } {
  if (!dateStr) {
    return { error: "date string required" };
  }

  // Try parsing. If string contains 'T' and an offset, fromISO will include it.
  const dtFromISO = DateTime.fromISO(dateStr, { setZone: true });

  if (dtFromISO.isValid && dateStr.match(/([+-]\d{2}:\d{2}|Z)$/)) {
    // If the string had an explicit offset or Z, dtFromISO.setZone has already honored it.
    // IMPORTANT: Callers must NOT re-zone this DateTime into patientTimezone, as that would
    // convert the instant and violate the "explicit offsets should be honored" rule.
    return { dateTime: dtFromISO, hadExplicitOffset: true };
  }

  // If it's a full timestamp without offset (e.g. 2024-07-10T14:00:00), DateTime.fromISO will set zone to local by default.
  // We prefer to treat ambiguous timestamps according to a provided patientTimezone or fallback to UTC.
  if (dateStr.includes("T") && !dateStr.match(/([Zz]|[+-]\d{2}:\d{2})$/)) {
    // ISO datetime without offset
    const zoneToUse = patientTimezone ?? "UTC";
    const dt = DateTime.fromISO(dateStr, { zone: zoneToUse });
    if (!dt.isValid) return { error: "Invalid date-time format" };
    return { dateTime: dt, hadExplicitOffset: false };
  }

  // Date-only string like YYYY-MM-DD
  if (!dateStr.includes("T")) {
    const zoneToUse = patientTimezone ?? "UTC";
    const dt = DateTime.fromISO(dateStr, { zone: zoneToUse });
    if (!dt.isValid) return { error: "Invalid date format" };
    return { dateTime: dt, hadExplicitOffset: false };
  }

  // Fallback: if parsed ok, return it
  if (dtFromISO.isValid)
    return { dateTime: dtFromISO, hadExplicitOffset: false };

  return { error: "Invalid date format" };
}

/**
 * Compute the patient-local day bounds (start/end of that calendar day in patientTimezone) and return UTC instants.
 *
 * This is the canonical day window used for:
 * - booking-window validation
 * - DB queries (scheduledStartAt bounds)
 * - filtering generated slots
 */
function computePatientDayBounds(
  dateStr: string,
  patientTimezone?: string
): {
  patientDayStartInPatientTZ: DateTime;
  patientDayEndInPatientTZ: DateTime;
  patientDayStartUTC: Date;
  patientDayEndUTC: Date;
  patientDayLabel: string;
} {
  const parsed = parsePatientInputDate(dateStr, patientTimezone);
  if (parsed.error || !parsed.dateTime) {
    // Keep caller-side error handling consistent with existing code paths
    throw new Error(parsed.error || "Invalid date");
  }

  // Interpret the calendar day:
  // - If the input included an explicit offset/zone (or Z), honor it as the source of truth.
  // - Otherwise, if patientTimezone is provided, interpret the day in patientTimezone.
  // - Otherwise, use whatever zone parsePatientInputDate produced (UTC fallback).
  const inPatientTZ =
    parsed.hadExplicitOffset === true
      ? parsed.dateTime
      : patientTimezone
      ? parsed.dateTime.setZone(patientTimezone)
      : parsed.dateTime;

  const patientDayStart = inPatientTZ.startOf("day");
  const patientDayEnd = patientDayStart.endOf("day");

  return {
    patientDayStartInPatientTZ: patientDayStart,
    patientDayEndInPatientTZ: patientDayEnd,
    patientDayStartUTC: patientDayStart.toUTC().toJSDate(),
    patientDayEndUTC: patientDayEnd.toUTC().toJSDate(),
    patientDayLabel: patientDayStart.toISODate() ?? "",
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

/**
 * Generate slots for a doctor that overlap the patient-day UTC window.
 * Slots are generated in doctor-local time (to respect DST) but returned as UTC instants.
 */
function generateDoctorSlotsForPatientDayUTCWindow(params: {
  doctorTimezone: string;
  patientDayStartUTC: Date;
  patientDayEndUTC: Date;
}): { startTime: Date; endTime: Date }[] {
  const { doctorTimezone, patientDayStartUTC, patientDayEndUTC } = params;

  const startInDoctorTZ = DateTime.fromJSDate(patientDayStartUTC, {
    zone: "UTC",
  }).setZone(doctorTimezone);
  const endInDoctorTZ = DateTime.fromJSDate(patientDayEndUTC, {
    zone: "UTC",
  }).setZone(doctorTimezone);

  let currentDoctorDayStart = startInDoctorTZ.startOf("day");
  const lastDoctorDayStart = endInDoctorTZ.startOf("day");

  const allSlots: { startTime: Date; endTime: Date }[] = [];

  while (currentDoctorDayStart <= lastDoctorDayStart) {
    allSlots.push(...generateTimeSlotsForDoctorDay(currentDoctorDayStart));
    currentDoctorDayStart = currentDoctorDayStart.plus({ days: 1 });
  }

  const startMs = patientDayStartUTC.getTime();
  const endMs = patientDayEndUTC.getTime();
  return allSlots.filter((s) => {
    const t = s.startTime.getTime();
    return t >= startMs && t <= endMs;
  });
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

      // Compute patient-local day bounds and convert to UTC instants (canonical)
      let patientDayBounds:
        | ReturnType<typeof computePatientDayBounds>
        | undefined;
      try {
        patientDayBounds = computePatientDayBounds(
          effectiveDateStr,
          patientTimezone
        );
      } catch (e) {
        return errorResponse(
          ErrorCodes.VALIDATION_ERROR,
          e instanceof Error ? e.message : "Invalid date format",
          400,
          { field: "date" }
        );
      }

      const doctorTimezone = doctor.doctorProfile?.timezone ?? "UTC";

      // Validate booking window using patient-day UTC bounds
      const nowMs = Date.now();
      if (patientDayBounds.patientDayEndUTC.getTime() < nowMs) {
        return errorResponse(
          ErrorCodes.VALIDATION_ERROR,
          "Cannot book appointments in the past",
          400,
          { field: "date" }
        );
      }
      const maxAllowedMs = DateTime.utc()
        .plus({ days: MAX_BOOKING_DAYS_AHEAD })
        .toMillis();
      if (patientDayBounds.patientDayStartUTC.getTime() > maxAllowedMs) {
        return errorResponse(
          ErrorCodes.VALIDATION_ERROR,
          `Cannot book more than ${MAX_BOOKING_DAYS_AHEAD} days in advance`,
          400,
          { field: "date" }
        );
      }

      // Query existing PAID consultations for the doctor within the patient-day UTC bounds
      // Only count slots as booked after payment is confirmed
      const existingConsultations = await prisma.consultation.findMany({
        where: {
          doctorId: doctor.id,
          scheduledStartAt: {
            gte: patientDayBounds.patientDayStartUTC,
            lte: patientDayBounds.patientDayEndUTC,
          },
          status: {
            in: [
              ConsultationStatus.PAID,
              ConsultationStatus.IN_CALL,
              ConsultationStatus.COMPLETED,
            ],
          },
        },
        select: { scheduledStartAt: true },
      });

      const bookedTimes = new Set(
        existingConsultations
          .filter((c) => c.scheduledStartAt)
          .map((c) => c.scheduledStartAt!.getTime())
      );

      // Generate slots in doctor timezone (DST-safe), converted to UTC instants, then filtered to patient-day window
      const timeSlots = generateDoctorSlotsForPatientDayUTCWindow({
        doctorTimezone,
        patientDayStartUTC: patientDayBounds.patientDayStartUTC,
        patientDayEndUTC: patientDayBounds.patientDayEndUTC,
      });

      const now = Date.now();
      const slots = timeSlots.map((slot) => ({
        ...slot,
        available:
          !bookedTimes.has(slot.startTime.getTime()) &&
          slot.startTime.getTime() > now,
        doctorId: doctor.id,
      }));

      return successResponse({
        doctorId: doctor.id,
        doctorName: doctor.name,
        date: patientDayBounds.patientDayLabel,
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
    let patientDayBounds:
      | ReturnType<typeof computePatientDayBounds>
      | undefined;
    try {
      patientDayBounds = computePatientDayBounds(
        effectiveDateStr,
        patientTimezone
      );
    } catch (e) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        e instanceof Error ? e.message : "Invalid date format",
        400,
        { field: "date" }
      );
    }

    // Validate booking window once using patient-day UTC bounds
    const nowMs = Date.now();
    if (patientDayBounds.patientDayEndUTC.getTime() < nowMs) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        "Cannot book appointments in the past",
        400,
        { field: "date" }
      );
    }
    const maxAllowedMs = DateTime.utc()
      .plus({ days: MAX_BOOKING_DAYS_AHEAD })
      .toMillis();
    if (patientDayBounds.patientDayStartUTC.getTime() > maxAllowedMs) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        `Cannot book more than ${MAX_BOOKING_DAYS_AHEAD} days in advance`,
        400,
        { field: "date" }
      );
    }

    // Query existing PAID consultations across all doctors
    // Only count slots as booked after payment is confirmed
    const existingConsultations = await prisma.consultation.findMany({
      where: {
        doctorId: { in: doctors.map((d) => d.id) },
        scheduledStartAt: {
          gte: patientDayBounds.patientDayStartUTC,
          lte: patientDayBounds.patientDayEndUTC,
        },
        status: {
          in: [
            ConsultationStatus.PAID,
            ConsultationStatus.IN_CALL,
            ConsultationStatus.COMPLETED,
          ],
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
      const doctorTimezone = doctor.doctorProfile?.timezone ?? "UTC";
      const bookedTimes = bookedTimesByDoctor.get(doctor.id) ?? new Set();
      const timeSlots = generateDoctorSlotsForPatientDayUTCWindow({
        doctorTimezone,
        patientDayStartUTC: patientDayBounds.patientDayStartUTC,
        patientDayEndUTC: patientDayBounds.patientDayEndUTC,
      });

      const now = Date.now();
      return {
        doctorId: doctor.id,
        doctorName: doctor.name,
        specialties: doctor.doctorProfile?.specialties ?? [],
        timezone: doctorTimezone,
        date: patientDayBounds.patientDayLabel,
        slots: timeSlots.map((slot) => ({
          ...slot,
          available:
            !bookedTimes.has(slot.startTime.getTime()) &&
            slot.startTime.getTime() > now,
          doctorId: doctor.id,
        })),
      };
    });

    const allSlots = doctorAvailability.flatMap((da) => da.slots ?? []);

    return successResponse({
      date: patientDayBounds.patientDayLabel,
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
