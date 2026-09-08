import { describe, expect, it } from "vitest";
import {
  computeInterval,
  isWithinQuietHours,
  DEFAULT_INTERVAL_SEC,
  QUIET_INTERVAL_SEC,
} from "@/server/monitor/schedule";

const now = new Date("2026-09-09T03:00:00.000Z"); // 日本時間 12:00

function base(overrides: Partial<Parameters<typeof computeInterval>[0]> = {}) {
  return computeInterval({
    now,
    saleStartsAt: null,
    consecutiveErrors: 0,
    quiet: false,
    minIntervalSec: 30,
    ...overrides,
  });
}

describe("computeInterval", () => {
  it("通常時は30分", () => {
    expect(base().intervalSec).toBe(DEFAULT_INTERVAL_SEC);
  });

  it("販売開始が近づくほど短くなる", () => {
    const in20h = base({ saleStartsAt: new Date(now.getTime() + 20 * 3600_000) }).intervalSec;
    const in30m = base({ saleStartsAt: new Date(now.getTime() + 30 * 60_000) }).intervalSec;
    const in5m = base({ saleStartsAt: new Date(now.getTime() + 5 * 60_000) }).intervalSec;
    const atStart = base({ saleStartsAt: new Date(now.getTime() + 30_000) }).intervalSec;
    expect(in20h).toBe(600);
    expect(in30m).toBe(300);
    expect(in5m).toBe(60);
    expect(atStart).toBe(30);
    expect(in20h > in30m && in30m > in5m && in5m > atStart).toBe(true);
  });

  it("サイトごとの最短間隔より短くはしない", () => {
    const result = base({
      saleStartsAt: new Date(now.getTime() + 30_000),
      minIntervalSec: 900,
    });
    expect(result.intervalSec).toBe(900);
  });

  it("お休み時間帯は間隔を広げる", () => {
    expect(base({ quiet: true }).intervalSec).toBe(QUIET_INTERVAL_SEC);
  });

  it("お休み時間でも販売開始が近ければ予定を優先する", () => {
    const result = base({ quiet: true, saleStartsAt: new Date(now.getTime() + 5 * 60_000) });
    expect(result.intervalSec).toBe(60);
  });

  it("エラーが続くと間隔をあける（上限6時間）", () => {
    expect(base({ consecutiveErrors: 1 }).intervalSec).toBe(3600);
    expect(base({ consecutiveErrors: 10 }).intervalSec).toBe(21600);
  });
});

describe("isWithinQuietHours", () => {
  const tz = "Asia/Tokyo";
  it("日をまたぐ指定に対応する", () => {
    expect(isWithinQuietHours(new Date("2026-09-08T14:30:00Z"), tz, "22:00", "06:00")).toBe(true); // JST 23:30
    expect(isWithinQuietHours(new Date("2026-09-08T20:00:00Z"), tz, "22:00", "06:00")).toBe(true); // JST 05:00
    expect(isWithinQuietHours(new Date("2026-09-09T03:00:00Z"), tz, "22:00", "06:00")).toBe(false); // JST 12:00
  });

  it("同じ日の中の指定にも対応する", () => {
    expect(isWithinQuietHours(new Date("2026-09-09T02:00:00Z"), tz, "09:00", "16:00")).toBe(true); // JST 11:00
    expect(isWithinQuietHours(new Date("2026-09-09T09:00:00Z"), tz, "09:00", "16:00")).toBe(false); // JST 18:00
  });

  it("開始と終了が同じなら休まない", () => {
    expect(isWithinQuietHours(new Date(), tz, "10:00", "10:00")).toBe(false);
  });
});
