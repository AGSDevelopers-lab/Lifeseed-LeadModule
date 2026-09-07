import type {
  ConversionPort,
  ConversionResult,
  ConvertDonorInput,
  ConvertRecipientInput,
  EligibilityResult,
} from "../../domain/ports/ConversionPort";

export class FakeConversionPort implements ConversionPort {
  donorCalls: ConvertDonorInput[] = [];
  recipientCalls: ConvertRecipientInput[] = [];
  createdDonorIds: string[] = [];
  createdRecipientIds: string[] = [];
  throwOnConvert = false;
  donorEligibility: EligibilityResult = { eligible: true, reasons: [] };
  recipientEligibility: EligibilityResult = { eligible: true, reasons: [] };

  async convertToDonor(input: ConvertDonorInput): Promise<ConversionResult> {
    this.donorCalls.push(input);
    if (this.throwOnConvert) throw new Error("downstream conversion failed");
    const donorId = `donor-${input.leadId}`;
    this.createdDonorIds.push(donorId);
    return { ok: true, targetEntityId: donorId, donorId, donorCode: "D-WB-00001" };
  }

  async convertToRecipient(input: ConvertRecipientInput): Promise<ConversionResult> {
    this.recipientCalls.push(input);
    if (this.throwOnConvert) throw new Error("downstream conversion failed");
    const recipientId = `recipient-${input.leadId}`;
    this.createdRecipientIds.push(recipientId);
    return {
      ok: true,
      targetEntityId: recipientId,
      recipientId,
      recipientCode: "R-20260907-0001",
    };
  }

  async isEligibleForDonor(): Promise<EligibilityResult> {
    return this.donorEligibility;
  }

  async isEligibleForRecipient(): Promise<EligibilityResult> {
    return this.recipientEligibility;
  }
}
