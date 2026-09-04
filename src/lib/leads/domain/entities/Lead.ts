import {
  CONVERTIBLE_STATUSES,
  LeadOutcome,
  LeadPersonType,
  LeadStatus,
  type LeadDonorSubType,
  type LeadSource,
} from "../enums";
import { LeadStateTransitionNotAllowedError } from "../errors";
import type { ArchiveMeta } from "../value-objects/ArchiveMeta";
import type { ContactInfo } from "../value-objects/ContactInfo";
import type { Consent } from "../value-objects/Consent";
import type { LeadCode } from "../value-objects/LeadCode";
import type { TierScore } from "../value-objects/TierScore";

export type LeadId = string;

export interface LeadProps {
  id: LeadId;
  code: LeadCode;
  personType: LeadPersonType;
  donorSubtype: LeadDonorSubType | null;
  contact: ContactInfo;
  consent: Consent;
  status: LeadStatus;
  outcome: LeadOutcome | null;
  isArchived: boolean;
  archive: ArchiveMeta | null;
  source: LeadSource;
  latestScore: TierScore | null;
  latestScoreId: string | null;
  ownership: {
    siteId: string | null;
    assignedTelecallerId: string | null;
    activeAssignmentId: string | null;
  };
  retention: {
    capturedAt: Date;
    retentionExpiresAt: Date | null;
  };
  merge: { mergedIntoLeadId: string | null };
  conversion: {
    convertedDonorId: string | null;
    convertedRecipientId: string | null;
    convertedAt: Date | null;
  };
  duplicate: { duplicateOfLeadId: string | null };
  version: number;
}

export class Lead {
  constructor(readonly props: LeadProps) {}

  get id(): LeadId {
    return this.props.id;
  }

  get code(): LeadCode {
    return this.props.code;
  }

  get status(): LeadStatus {
    return this.props.status;
  }

  get version(): number {
    return this.props.version;
  }

  canConvertToDonor(): boolean {
    return (
      this.props.personType === LeadPersonType.DONOR &&
      CONVERTIBLE_STATUSES.includes(this.props.status) &&
      !this.props.isArchived &&
      this.props.outcome !== LeadOutcome.MERGED &&
      this.props.conversion.convertedDonorId == null
    );
  }

  canConvertToRecipient(): boolean {
    return (
      this.props.personType === LeadPersonType.RECIPIENT &&
      CONVERTIBLE_STATUSES.includes(this.props.status) &&
      !this.props.isArchived &&
      this.props.outcome !== LeadOutcome.MERGED &&
      this.props.conversion.convertedRecipientId == null
    );
  }

  isEligibleForReactivation(now: Date, windowDays: number): boolean {
    if (this.props.status !== LeadStatus.LOST) return false;
    if (this.props.outcome === LeadOutcome.MERGED) return false;
    const lostAt =
      this.props.retention.capturedAt; /* lostAt not denormalised yet; B04 */
    const windowMs = windowDays * 24 * 60 * 60 * 1000;
    return now.getTime() - lostAt.getTime() <= windowMs;
  }

  applyStatusTransition(to: LeadStatus): Lead {
    if (this.props.status === to) {
      throw new LeadStateTransitionNotAllowedError("Status unchanged", {
        leadId: this.id,
        status: to,
      });
    }
    return new Lead({ ...this.props, status: to, version: this.props.version + 1 });
  }
}
