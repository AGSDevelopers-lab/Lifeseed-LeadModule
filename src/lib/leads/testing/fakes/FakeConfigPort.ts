import type { ConfigPort } from "../../domain/ports/ConfigPort";

export class FakeConfigPort implements ConfigPort {
  constructor(private readonly store = new Map<string, Record<string, unknown>>()) {}

  seed(key: string, payload: Record<string, unknown>): void {
    this.store.set(key, payload);
  }

  async getActive<T = Record<string, unknown>>(key: string): Promise<T | null> {
    return (this.store.get(key) as T | undefined) ?? null;
  }
}
