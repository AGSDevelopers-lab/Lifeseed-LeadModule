export type AuditAppendInput = {
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
};

export interface AuditPort {
  append(input: AuditAppendInput): Promise<void>;
}
