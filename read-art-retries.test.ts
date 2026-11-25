import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readStarRailPanelPhoto } from "./panel-card.ts";

const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
const photo = { url: "https://act-webstatic.mihoyo.com/synthetic.png", sha256: createHash("sha256").update(bytes).digest("hex") };
const active = () => new AbortController().signal;
const mockFetch = (read: (url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => Promise<Response>): typeof fetch =>
  Object.assign(read, { preconnect: () => undefined });

test("官方面板图片GET在暂时连接错误后恢复，预算至多三次", async () => {
  const original = globalThis.fetch; let calls = 0;
  try {
    globalThis.fetch = mockFetch(async (_url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      expect(init?.redirect).toBe("error"); expect(init?.credentials).toBe("omit");
      if (++calls < 3) throw Object.assign(new Error("reset"), { code: "ECONNRESET" });
      return new Response(bytes);
    });
    expect(await readStarRailPanelPhoto(photo, active())).toEqual(bytes); expect(calls).toBe(3);
    calls = 0;
    globalThis.fetch = mockFetch(async () => { calls++; return new Response("", { status: 503 }); });
    expect(await readStarRailPanelPhoto(photo, active())).toBeUndefined(); expect(calls).toBe(3);
  } finally { globalThis.fetch = original; }
});

test("官方图限流/Retry-After/取消及未授权域不重放", async () => {
  const original = globalThis.fetch;
  try {
    for (const [status, headers] of [[429, {}], [503, { "Retry-After": "10" }]] as const) {
      let calls = 0;
      globalThis.fetch = mockFetch(async () => { calls++; return new Response("", { status, headers }); });
      expect(await readStarRailPanelPhoto(photo, active())).toBeUndefined(); expect(calls).toBe(1);
    }
    let calls = 0; const stop = new AbortController();
    globalThis.fetch = mockFetch(async () => { calls++; stop.abort(); throw Object.assign(new Error("reset"), { code: "ECONNRESET" }); });
    expect(await readStarRailPanelPhoto(photo, stop.signal)).toBeUndefined(); expect(calls).toBe(1);
    calls = 0;
    expect(await readStarRailPanelPhoto({ ...photo, url: "https://example.invalid/synthetic.png" }, active())).toBeUndefined(); expect(calls).toBe(0);
  } finally { globalThis.fetch = original; }
});
