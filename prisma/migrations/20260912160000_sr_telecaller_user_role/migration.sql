-- LADR-26: add SR_TELECALLER to UserRole.
-- Additive enum value only. No ROLE_PERMISSIONS grants in this migration.

ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SR_TELECALLER';
