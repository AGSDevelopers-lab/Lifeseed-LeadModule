import { describe, expect, it } from "vitest";

import { DeliveryStatus, NotificationChannel } from "../../domain/enums";
import { DncGatedNotificationPort } from "./notification-port";
import type { NotificationChannelAdapter } from "./types";

const CHANNELS = [
  NotificationChannel.EMAIL,
  NotificationChannel.SMS,
  NotificationChannel.WHATSAPP,
  NotificationChannel.IN_APP,
] as const;

function memoryDnc() {
  const blocked = new Set<string>();
  return {
    add: (recipient: string) => blocked.add(recipient.toLowerCase()),
    isBlocked: async (recipient: string) => blocked.has(recipient.toLowerCase()),
  };
}

describe("DncGatedNotificationPort", () => {
  it("blocks DNC'd recipient on all 4 channels and never calls adapters", async () => {
    const dnc = memoryDnc();
    dnc.add("blocked@example.com");
    const adapterCalls: string[] = [];
    const logs: Array<{ deliveryStatus: string; dncPassed: boolean }> = [];
    const stub: NotificationChannelAdapter = {
      send: async (input) => {
        adapterCalls.push(input.channel);
        return { providerMessageId: "should-not-run" };
      },
    };
    const port = new DncGatedNotificationPort({
      isBlocked: async (input) => dnc.isBlocked(input.recipient),
      writeLog: async (row) => {
        logs.push({ deliveryStatus: row.deliveryStatus, dncPassed: row.dncPassed });
        return { id: `log-${logs.length}` };
      },
      adapters: {
        EMAIL: stub,
        SMS: stub,
        WHATSAPP: stub,
        IN_APP: stub,
      },
      getMode: () => "on",
    });

    for (const channel of CHANNELS) {
      const result = await port.send({
        channel,
        templateKey: "t",
        recipient: "blocked@example.com",
        data: {},
      });
      expect(result).toEqual({ blocked: true, reason: "DNC", deliveryId: expect.any(String) });
    }
    expect(adapterCalls).toEqual([]);
    expect(logs.every((l) => l.deliveryStatus === DeliveryStatus.BLOCKED_DNC && l.dncPassed === false)).toBe(
      true,
    );
  });

  it("writes BLOCKED_DNC log when send is blocked", async () => {
    const logs: string[] = [];
    const port = new DncGatedNotificationPort({
      isBlocked: async () => true,
      writeLog: async (row) => {
        logs.push(row.deliveryStatus);
        return { id: "blocked-1" };
      },
      adapters: {},
      getMode: () => "on",
    });
    await port.send({
      channel: NotificationChannel.SMS,
      templateKey: "t",
      recipient: "+919999999999",
      data: {},
    });
    expect(logs).toEqual([DeliveryStatus.BLOCKED_DNC]);
  });

  it("successful send writes dncPassed=true and provider stub id", async () => {
    const logs: Array<{ dncPassed: boolean; providerMessageId: string | null }> = [];
    const port = new DncGatedNotificationPort({
      isBlocked: async () => false,
      writeLog: async (row) => {
        logs.push({ dncPassed: row.dncPassed, providerMessageId: row.providerMessageId });
        return { id: "ok-1" };
      },
      adapters: {
        EMAIL: { send: async () => ({ providerMessageId: "stub-resend-t" }) },
      },
      getMode: () => "on",
    });
    const result = await port.send({
      channel: NotificationChannel.EMAIL,
      templateKey: "t",
      recipient: "ok@example.com",
      data: { a: 1 },
    });
    expect(result).toEqual({ blocked: false, deliveryId: "ok-1" });
    expect(logs[0]).toEqual({ dncPassed: true, providerMessageId: "stub-resend-t" });
  });

  it("adding a DNC entry immediately blocks the next send (no stale cache)", async () => {
    const dnc = memoryDnc();
    const port = new DncGatedNotificationPort({
      isBlocked: async (input) => dnc.isBlocked(input.recipient),
      writeLog: async () => ({ id: "x" }),
      adapters: {
        SMS: { send: async () => ({ providerMessageId: "stub" }) },
      },
      getMode: () => "on",
    });
    const first = await port.send({
      channel: NotificationChannel.SMS,
      templateKey: "t",
      recipient: "+919876543210",
      data: {},
    });
    expect(first.blocked).toBe(false);
    dnc.add("+919876543210");
    const second = await port.send({
      channel: NotificationChannel.SMS,
      templateKey: "t",
      recipient: "+919876543210",
      data: {},
    });
    expect(second).toMatchObject({ blocked: true, reason: "DNC" });
  });
});
