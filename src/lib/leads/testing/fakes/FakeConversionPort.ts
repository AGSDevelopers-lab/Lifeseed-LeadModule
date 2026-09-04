import type {
  ConversionPort,
  ConversionResult,
  ConvertDonorInput,
  ConvertRecipientInput,
} from "../../domain/ports/ConversionPort";

export class FakeConversionPort implements ConversionPort {
  donorCalls: ConvertDonorInput[] = [];
  recipientCalls: ConvertRecipientInput[] = [];

  async convertToDonor(input: ConvertDonorInput): Promise<ConversionResult> {
    this.donorCalls.push(input);
    return { ok: true, targetEntityId: `donor-${input.leadId}` };
  }

  async convertToRecipient(input: ConvertRecipientInput): Promise<ConversionResult> {
    this.recipientCalls.push(input);
    return { ok: true, targetEntityId: `recipient-${input.leadId}` };
  }
}
