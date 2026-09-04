export interface ConfigPort {
  getActive<T = Record<string, unknown>>(key: string, at?: Date): Promise<T | null>;
}
