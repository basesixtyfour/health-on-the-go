export const SPECIALTIES = [
  { id: 'GENERAL', label: 'General Practice', price: 50 },
  { id: 'CARDIOLOGY', label: 'Cardiology', price: 150 },
  { id: 'DERMATOLOGY', label: 'Dermatology', price: 85 },
  { id: 'PEDIATRICS', label: 'Pediatrics', price: 65 },
  { id: 'PSYCHIATRY', label: 'Psychiatry', price: 120 },
  { id: 'ORTHOPEDICS', label: 'Orthopedics', price: 110 },
];

// Default consultation fee if specialty not found
export const DEFAULT_CONSULTATION_FEE = 50;

// Helper to get price for a specialty
export function getSpecialtyPrice(specialtyId: string): number {
  const specialty = SPECIALTIES.find(s => s.id === specialtyId);
  return specialty?.price ?? DEFAULT_CONSULTATION_FEE;
}

export const AGE_RANGES = [
  "0-17",
  "18-39",
  "40-64",
  "65+"
];