import type { Clock } from "../../domain/ports/Clock";

export class FakeClock implements Clock {
  constructor(private current: Date = new Date("2026-09-04T12:00:00.000Z")) {}

  now(): Date {
    return this.current;
  }

  set(next: Date): void {
    this.current = next;
  }
}
