import type { IdentityPort } from "../../domain/ports/IdentityPort";
import type { ActorContext } from "../../domain/ports/shared";

export class FakeIdentityPort implements IdentityPort {
  constructor(private session: ActorContext | null = null) {}

  setSession(session: ActorContext | null): void {
    this.session = session;
  }

  async current(): Promise<ActorContext | null> {
    return this.session;
  }

  hasPermission(ctx: ActorContext, permission: string): boolean {
    return ctx.roles.includes("BANK_SUPER_ADMIN") || ctx.roles.includes(permission);
  }
}
