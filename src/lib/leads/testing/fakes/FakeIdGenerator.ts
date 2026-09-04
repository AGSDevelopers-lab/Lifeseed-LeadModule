import type { IdGenerator } from "../../domain/ports/IdGenerator";

export class FakeIdGenerator implements IdGenerator {
  private n = 0;

  next(): string {
    this.n += 1;
    return `fake-id-${this.n}`;
  }
}
