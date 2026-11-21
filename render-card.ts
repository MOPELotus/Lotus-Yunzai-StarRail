import { renderPng } from "@lotus-yunzai/skia";
import type { CanvasRenderingContext2D as Context } from "skia-canvas";

export interface StarRailCardOptions {
  readonly inlineImageByteLimit?: number;
  readonly mode?: Parameters<typeof renderPng>[3];
}

export async function renderStarRailCard(width: number, height: number, draw: (ctx: Context) => void,
  { mode = "auto", inlineImageByteLimit }: StarRailCardOptions) {
  const render = (scale: 2 | 4) => renderPng(width * scale, height * scale, ctx => {
    ctx.scale(scale, scale);
    draw(ctx);
  }, mode, { allowHalfScale: scale === 4 });
  const full = await render(4);
  if (inlineImageByteLimit === undefined || full.png.byteLength <= inlineImageByteLimit) return full;
  if (!full.reducedScaleReason) {
    const smaller = await render(2);
    if (smaller.png.byteLength <= inlineImageByteLimit) return smaller;
  }
  throw new Error("星铁图卡超出当前会话的图片大小限制。");
}
