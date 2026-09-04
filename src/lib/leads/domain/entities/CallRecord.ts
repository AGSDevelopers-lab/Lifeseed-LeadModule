/** Domain view of CallDisposition (persistence table retained). */
export interface CallRecord {
  id: string;
  leadId: string;
  activityId: string | null;
  telecallerUserId: string;
  startedAt: Date;
  endedAt: Date | null;
  durationSec: number | null;
  dispositionType: string;
  notes: string | null;
  followUpId: string | null;
  createdAt: Date;
}
