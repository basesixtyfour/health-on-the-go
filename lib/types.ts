/**
 * Valid varieties for consultations
 */
export const VALID_SPECIALTIES = [
    'GENERAL',
    'CARDIOLOGY',
    'DERMATOLOGY',
    'PEDIATRICS',
    'PSYCHIATRY',
    'ORTHOPEDICS',
] as const;

export type Specialty = typeof VALID_SPECIALTIES[number];

/**
 * Valid age ranges for patient intake
 */
export const VALID_AGE_RANGES = ['18-39', '40-64', '65+'] as const;

export type AgeRange = typeof VALID_AGE_RANGES[number];

/**
 * Valid status transitions for consultations
 */
export const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
    CREATED: ['PAYMENT_PENDING', 'CANCELLED'],
    PAYMENT_PENDING: ['PAID', 'PAYMENT_FAILED', 'CANCELLED'],
    PAID: ['IN_CALL', 'CANCELLED'],
    IN_CALL: ['COMPLETED'],
    COMPLETED: [], // Terminal state
    CANCELLED: [], // Terminal state
    EXPIRED: [], // Terminal state
    PAYMENT_FAILED: ['PAYMENT_PENDING'], // Can retry payment
};

/**
 * Check if a status transition is valid
 */
export function isValidStatusTransition(from: string, to: string): boolean {
    const validTransitions = VALID_STATUS_TRANSITIONS[from];
    return validTransitions?.includes(to) ?? false;
}
