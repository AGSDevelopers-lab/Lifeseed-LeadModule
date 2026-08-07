-- Make FKs cascade on update so we can rename User.id safely
BEGIN;

ALTER TABLE public."UserRoleAssignment" 
  DROP CONSTRAINT "UserRoleAssignment_userId_fkey";
ALTER TABLE public."UserRoleAssignment" 
  ADD CONSTRAINT "UserRoleAssignment_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES public."User"(id) 
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public."AuditLog" 
  DROP CONSTRAINT "AuditLog_actorUserId_fkey";
ALTER TABLE public."AuditLog" 
  ADD CONSTRAINT "AuditLog_actorUserId_fkey" 
  FOREIGN KEY ("actorUserId") REFERENCES public."User"(id) 
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Now the single update cascades to all children
UPDATE public."User" 
SET id = 'ec935be2-e631-432d-b529-7bcaea27d4c2' 
WHERE email = 'superadmin@lifeseed.local';

COMMIT;