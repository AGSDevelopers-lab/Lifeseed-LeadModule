import type { ActorContext } from "./shared";

export interface IdentityPort {
  current(): Promise<ActorContext | null>;
  hasPermission(ctx: ActorContext, permission: string): boolean;
}
