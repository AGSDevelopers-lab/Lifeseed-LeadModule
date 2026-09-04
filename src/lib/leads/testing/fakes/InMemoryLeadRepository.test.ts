import { describe, expect, it } from "vitest";

import { LeadStatus } from "../../domain/enums";
import { aLead } from "../fixtures/aLead";
import { InMemoryLeadRepository } from "./InMemoryLeadRepository";

describe("InMemoryLeadRepository", () => {
  it("creates and reads a lead (CRUD roundtrip)", async () => {
    const repo = new InMemoryLeadRepository();
    const created = await repo.create(aLead({ id: "lead_rt" }));
    const found = await repo.byId("lead_rt");
    expect(found?.id).toBe(created.id);
    expect(found?.code.toString()).toBe("LED-KOL-20260904-0001");

    const updated = await repo.update(created.applyStatusTransition(LeadStatus.ASSIGNED));
    expect((await repo.byId("lead_rt"))?.status).toBe(LeadStatus.ASSIGNED);
    expect(updated.version).toBe(2);
  });
});
