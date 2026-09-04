export type ConversionResult =
  | { ok: true; targetEntityId: string }
  | { ok: false; error: string };

export type ConvertDonorInput = {
  leadId: string;
  actorUserId: string;
  extras: Record<string, unknown>;
};

export type ConvertRecipientInput = {
  leadId: string;
  actorUserId: string;
  extras: Record<string, unknown>;
};

export interface ConversionPort {
  convertToDonor(input: ConvertDonorInput): Promise<ConversionResult>;
  convertToRecipient(input: ConvertRecipientInput): Promise<ConversionResult>;
}
