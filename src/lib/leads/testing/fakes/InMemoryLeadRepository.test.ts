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

  it("list scopes TELECALLER to assigned leads only", async () => {
    const repo = new InMemoryLeadRepository();
    await repo.create(aLead({ id: "a", assignedTelecallerId: "tele-a" }));
    await repo.create(aLead({ id: "b", code: "LED-KOL-20260904-0002", assignedTelecallerId: "tele-b" }));
    const page = await repo.list({ userId: "tele-a", roles: ["TELECALLER"] });
    expect(page.items.map((l) => l.id)).toEqual(["a"]);
  });
});
