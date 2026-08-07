import { createHash } from "crypto";

/** Server-side hash helper (consent text, etc. — never for raw Aadhaar ingress). */
export function sha256HexNode(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
