export interface LeadConfig {
  id: string;
  key: string;
  version: number;
  payload: Record<string, unknown>;
  payloadSchemaRef: string;
  ownerRole: string;
  createdByUserId: string;
  createdAt: Date;
  approvedByUserId: string | null;
  approvedAt: Date | null;
  effectiveFrom: Date | null;
  effectiveUntil: Date | null;
  isActive: boolean;
  notes: string | null;
}
