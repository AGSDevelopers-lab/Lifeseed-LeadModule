import { describe, expect, it } from "vitest";

import { LeadActivityType } from "../domain/enums";
import { parseActivityType, permissionForActivityType } from "./activity";

describe("generic LeadActivity", () => {
  it("accepts every LeadActivityType", () => {
    for (const t of Object.values(LeadActivityType)) {
      expect(parseActivityType(t)).toBe(t);
    }
  });

  it("maps CALL / NOTE / FOLLOW_UP to spec permissions", () => {
    expect(permissionForActivityType(LeadActivityType.CALL)).toBe("lead.disposition");
    expect(permissionForActivityType(LeadActivityType.NOTE)).toBe("lead.note.add");
    expect(permissionForActivityType(LeadActivityType.FOLLOW_UP)).toBe("follow_up.create");
  });
});
