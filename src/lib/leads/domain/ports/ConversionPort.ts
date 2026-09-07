import type { ActorContext } from "./shared";

export type EligibilityResult = {
  eligible: boolean;
  reasons: string[];
};

export type ConversionResult =
  | { ok: true; targetEntityId: string; donorId?: string; donorCode?: string; recipientId?: string; recipientCode?: string }
  | { ok: false; error: string };

export type ConvertDonorInput = {
  leadId: string;
  actorUserId: string;
  extras: Record<string, unknown>;
  /** Adapter-only unit of work (Prisma tx). Domain stays framework-free. */
  unitOfWork?: unknown;
};

export type ConvertRecipientInput = {
  leadId: string;
  actorUserId: string;
  extras: Record<string, unknown>;
  unitOfWork?: unknown;
};

export interface ConversionPort {
  convertToDonor(input: ConvertDonorInput, ctx?: ActorContext): Promise<ConversionResult>;
  convertToRecipient(input: ConvertRecipientInput, ctx?: ActorContext): Promise<ConversionResult>;
  isEligibleForDonor(leadId: string, ctx?: ActorContext): Promise<EligibilityResult>;
  isEligibleForRecipient(leadId: string, ctx?: ActorContext): Promise<EligibilityResult>;
}
