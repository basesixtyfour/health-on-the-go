-- Prevent double-booking for confirmed consultations:
-- Only one consultation can occupy a (doctorId, scheduledStartAt) slot once it is confirmed.
--
-- We intentionally scope the uniqueness to confirmed statuses so that multiple in-progress
-- consultations (e.g., during payment) do not block each other until confirmation.
CREATE UNIQUE INDEX "Consultation_doctorId_scheduledStartAt_confirmed_unique"
ON "Consultation" ("doctorId", "scheduledStartAt")
WHERE
  "doctorId" IS NOT NULL
  AND "scheduledStartAt" IS NOT NULL
  AND "status" IN ('PAID', 'IN_CALL', 'COMPLETED');


