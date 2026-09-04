/** Domain view of LeadDoNotCallList (table rename is B08). */
export interface LeadDoNotCall {
  id: string;
  phone: string;
  email: string | null;
  reason: string;
  addedByUserId: string | null;
  addedAt: Date;
  expiresAt: Date | null;
  source: string;
}
