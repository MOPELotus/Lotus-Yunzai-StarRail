import assert from "node:assert/strict";
import { expect, test } from "bun:test";
import { nativeImageRasterScale, setImageRenderPreset } from "@lotus-yunzai/skia";
import { renderStarRailCard } from "../render-card.ts";
import { renderStarRailRogue } from "../rogue-card.ts";

const mode = Bun.env.LOTUS_TEST_GPU === "1" ? "gpu" : "auto";
const width = (png: Buffer) => png.readUInt32BE(16);

test("低配星铁图卡只应用一次缩放，超过会话上限时不会再减半", async () => {
  const previous = nativeImageRasterScale() === 1 ? "low" : "standard";
  setImageRenderPreset("low");
  try {
    const signal = new AbortController().signal;
    const rogue = { name: "模拟宇宙战绩", identity: "样本档案", intro: [], stats: [], records: [] };
    expect(width((await renderStarRailRogue(rogue, signal, { mode })).png)).toBe(760);
    await assert.rejects(() => renderStarRailRogue(rogue, signal, { mode, inlineImageByteLimit: 32 }), /大小限制/u);
    let draws = 0;
    const draw: Parameters<typeof renderStarRailCard>[2] = (ctx) => {
      draws++;
      ctx.fillStyle = "#435a83";
      ctx.fillRect(0, 0, 101, 73);
    };
    expect(width((await renderStarRailCard(101, 73, draw, { mode })).png)).toBe(101);
    await assert.rejects(() => renderStarRailCard(101, 73, draw, { mode, inlineImageByteLimit: 32 }), /大小限制/u);
    expect(draws).toBe(2);
  } finally {
    setImageRenderPreset(previous);
  }
});
