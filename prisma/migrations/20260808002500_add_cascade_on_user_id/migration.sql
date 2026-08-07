ALTER TABLE public."UserRoleAssignment" DROP CONSTRAINT "UserRoleAssignment_userId_fkey";
ALTER TABLE public."UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE public."AuditLog" DROP CONSTRAINT "AuditLog_actorUserId_fkey";
ALTER TABLE public."AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES public."User"(id) ON DELETE SET NULL ON UPDATE CASCADE;