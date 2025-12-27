/*
  This migration is intentionally a NO-OP.

  Background:
  - Migration `20251224094948_init` already creates the lowercase Better-Auth tables:
      "user", "account", "session", "verification"
  - The Prisma schema maps models via @@map("user") / @@map("account") etc.

  The original version of this migration attempted to drop PascalCase tables
  ("User", "Account", "Session", "Verification") and recreate the lowercase ones,
  but that breaks fresh DB deploys because those PascalCase tables do not exist
  and the lowercase ones already do.
*/

SELECT 1;
