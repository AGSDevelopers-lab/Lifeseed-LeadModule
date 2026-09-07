import { describe, expect, it } from "vitest";

import { DncChannel, NotificationChannel } from "../domain/enums";
import {
  dncChannelForNotification,
  lookupChannel,
  lookupChannels,
  normaliseEmail,
  normalisePhone,
  normaliseValue,
} from "./dnc";

describe("dnc normalisation", () => {
  it("normalises 10-digit Indian phones to E.164", () => {
    expect(normalisePhone("9876543210")).toBe("+919876543210");
    expect(normalisePhone("+91 98765 43210")).toBe("+919876543210");
    expect(normalisePhone("919876543210")).toBe("+919876543210");
  });

  it("lowercases email", () => {
    expect(normaliseEmail("  Ada@LifeSeed.IN ")).toBe("ada@lifeseed.in");
    expect(normaliseValue(DncChannel.EMAIL, "Ada@LifeSeed.IN")).toBe("ada@lifeseed.in");
  });

  it("lookupChannels includes ALL wildcard", () => {
    expect(lookupChannels(DncChannel.PHONE)).toEqual(
      expect.arrayContaining([DncChannel.PHONE, DncChannel.ALL]),
    );
    expect(lookupChannel(DncChannel.EMAIL)).toEqual(
      expect.arrayContaining([DncChannel.EMAIL, DncChannel.ALL]),
    );
  });

  it("maps notification channels onto DNC channels", () => {
    expect(dncChannelForNotification(NotificationChannel.EMAIL)).toBe(DncChannel.EMAIL);
    expect(dncChannelForNotification(NotificationChannel.IN_APP)).toBe(DncChannel.ALL);
  });
});
