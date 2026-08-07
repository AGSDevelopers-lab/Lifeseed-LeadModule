import { UserRole } from "@prisma/client";

import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";

const WITNESS_ROLES: UserRole[] = [
  UserRole.BANK_WITNESS,
  UserRole.BANK_SR_ANDROLOGIST,
  UserRole.BANK_LAB_HEAD,
  UserRole.BANK_CRYOBANK_TECH,
  UserRole.BANK_ANDROLOGY_TECH,
  UserRole.BANK_QC_OFFICER,
  UserRole.BANK_SUPER_ADMIN,
];

export async function verifyWitnesses(
  primaryUserId: string,
  witnessUserId: string,
  _action: string,
): Promise<void> {
  if (!primaryUserId || !witnessUserId) {
    throw new Error("Primary operator and witness are required");
  }
  if (primaryUserId === witnessUserId) {
    throw new Error("Two distinct user IDs are required for attestation");
  }

  const users = await prisma.user.findMany({
    where: { id: { in: [primaryUserId, witnessUserId] }, isActive: true },
    include: { roles: true },
  });
  if (users.length !== 2) {
    throw new Error("Both primary and witness must be active users");
  }

  for (const u of users) {
    const roles = u.roles.map((r) => r.role);
    const ok = roles.some((r) => WITNESS_ROLES.includes(r));
    if (!ok) {
      throw new Error(
        `User ${u.email} lacks a qualifying witness / lab role for attestation`,
      );
    }
  }
}

export async function logAttestation(input: {
  action: string;
  sampleId: string;
  primaryUserId: string;
  witnessUserId: string;
}): Promise<void> {
  await verifyWitnesses(
    input.primaryUserId,
    input.witnessUserId,
    input.action,
  );

  await audit.log({
    actorUserId: input.primaryUserId,
    action: "WITNESS_ATTEST",
    entityType: "Sample",
    entityId: input.sampleId,
    sampleRelId: input.sampleId,
    afterJson: {
      action: input.action,
      primaryUserId: input.primaryUserId,
      witnessUserId: input.witnessUserId,
    },
  });
}
