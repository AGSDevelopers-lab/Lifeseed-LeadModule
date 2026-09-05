import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const PATTERN =
  String.raw`status:\s*['"](NEW|ASSIGNED|CONTACTED_QUALIFIED|CONTACTED_NOT_INTERESTED|CONTACTED_CALLBACK_REQUESTED|NOT_REACHABLE|WRONG_NUMBER|DO_NOT_CALL|COUNSELLING_BOOKED|COUNSELLING_ATTENDED|COUNSELLING_NO_SHOW|CONVERTED|LOST|EXPIRED_AUTO_PURGED)['"]`;

const ALLOW = [
  "src/lib/leads/domain/state-machine/",
  "src/lib/leads/adapters/prisma-lead-repository.ts",
  "src/lib/leads/adapters/prisma-transition-store.ts",
];

describe("I-01 Lead.status write guard", () => {
  it("has no quoted Lead.status writes outside authorised files", () => {
    const raw = execFileSync(
      "git",
      ["grep", "-n", "-E", PATTERN, "--", "*.ts", "*.tsx"],
      { encoding: "utf8" },
    );
    const hits = raw
      .split("\n")
      .filter(Boolean)
      .filter((line) => !ALLOW.some((a) => line.includes(a)))
      .filter((line) => !line.includes(".test.ts"))
      .filter((line) => !line.includes("LifeSeed_App_Specs"));
    expect(hits).toEqual([]);
  });
});
