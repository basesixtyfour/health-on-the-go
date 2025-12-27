/**
 * Consultation utility functions for on-read filtering
 * 
 * These utilities help determine the "effective" status of a consultation,
 * treating past PAID/IN_CALL appointments as expired in the UI without
 * requiring database changes.
 */

// Join window constants (in milliseconds)
export const EARLY_JOIN_WINDOW = 5 * 60 * 1000; // 5 minutes before scheduled time
export const LATE_JOIN_WINDOW = 30 * 60 * 1000; // 30 minutes after scheduled time

/**
 * Consultation-like object with minimum required fields for status calculation
 */
export interface ConsultationForStatus {
    status: string;
    scheduledStartAt: Date | string | null;
}

/**
 * Checks if a consultation has passed the late join window
 * and should be treated as expired in the UI.
 * 
 * A consultation is considered expired if:
 * 1. Status is PAID or IN_CALL (active but not completed)
 * 2. Has a scheduled time
 * 3. Current time is past the late join window (30 min after scheduled)
 * 
 * @param consultation - The consultation to check
 * @param now - Current time (optional, defaults to Date.now())
 * @returns true if the consultation should be treated as expired
 */
export function isConsultationExpired(
    consultation: ConsultationForStatus,
    now: number = Date.now()
): boolean {
    // Only PAID or IN_CALL can be expired (other statuses have their own terminal states)
    if (!['PAID', 'IN_CALL'].includes(consultation.status)) {
        return false;
    }

    // If no scheduled time, can't determine expiration
    if (!consultation.scheduledStartAt) {
        return false;
    }

    const scheduledTime = consultation.scheduledStartAt instanceof Date
        ? consultation.scheduledStartAt.getTime()
        : new Date(consultation.scheduledStartAt).getTime();

    const lateBoundary = scheduledTime + LATE_JOIN_WINDOW;

    return now > lateBoundary;
}

/**
 * Gets the effective status of a consultation for UI display.
 * 
 * This applies on-read filtering to treat past PAID/IN_CALL consultations
 * as EXPIRED without modifying the database.
 * 
 * @param consultation - The consultation to get effective status for
 * @param now - Current time (optional, defaults to Date.now())
 * @returns The effective status string
 */
export function getEffectiveStatus(
    consultation: ConsultationForStatus,
    now: number = Date.now()
): string {
    if (isConsultationExpired(consultation, now)) {
        return 'EXPIRED';
    }
    return consultation.status;
}

/**
 * Checks if a consultation is within the joinable time window.
 * 
 * A consultation is joinable if:
 * 1. Status is PAID or IN_CALL
 * 2. Either has no scheduled time, OR current time is within the join window
 *    (5 min early to 30 min late)
 * 
 * @param consultation - The consultation to check
 * @param now - Current time (optional, defaults to Date.now())
 * @returns true if the consultation can be joined now
 */
export function isConsultationJoinable(
    consultation: ConsultationForStatus,
    now: number = Date.now()
): boolean {
    if (!['PAID', 'IN_CALL'].includes(consultation.status)) {
        return false;
    }

    if (!consultation.scheduledStartAt) {
        return true; // No scheduled time = always joinable
    }

    const scheduledTime = consultation.scheduledStartAt instanceof Date
        ? consultation.scheduledStartAt.getTime()
        : new Date(consultation.scheduledStartAt).getTime();

    const earlyBoundary = scheduledTime - EARLY_JOIN_WINDOW;
    const lateBoundary = scheduledTime + LATE_JOIN_WINDOW;

    return now >= earlyBoundary && now <= lateBoundary;
}

/**
 * Checks if a consultation is upcoming (scheduled but not yet in join window).
 * 
 * @param consultation - The consultation to check
 * @param now - Current time (optional, defaults to Date.now())
 * @returns true if the consultation is upcoming
 */
export function isConsultationUpcoming(
    consultation: ConsultationForStatus,
    now: number = Date.now()
): boolean {
    if (!['PAID', 'IN_CALL'].includes(consultation.status)) {
        return false;
    }

    if (!consultation.scheduledStartAt) {
        return false;
    }

    const scheduledTime = consultation.scheduledStartAt instanceof Date
        ? consultation.scheduledStartAt.getTime()
        : new Date(consultation.scheduledStartAt).getTime();

    const earlyBoundary = scheduledTime - EARLY_JOIN_WINDOW;

    return now < earlyBoundary;
}
