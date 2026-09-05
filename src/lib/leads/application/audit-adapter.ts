import { audit } from "@/lib/audit";
import type { ActorContext } from "../domain/ports/shared";
import type { AuditPort } from "../domain/ports/AuditPort";

export const auditPort: AuditPort = {
  async append(input) {
      await audit.log({
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      beforeJson: (input.before ?? undefined) as never,
      afterJson: (input.after ?? undefined) as never,
    });
  },
};

export type { ActorContext };
