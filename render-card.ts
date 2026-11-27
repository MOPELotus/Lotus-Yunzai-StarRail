import { createTranslator as createTextTranslator } from "../../packages/i18n/index.ts";
import messageCatalog from "./i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import { nativeImageRasterScale, renderPng } from "@lotus-yunzai/skia";
import type { CanvasRenderingContext2D as Context } from "skia-canvas";

export interface StarRailCardOptions {
  readonly inlineImageByteLimit?: number;
  readonly mode?: Parameters<typeof renderPng>[3];
}

export async function renderStarRailCard(width: number, height: number, draw: (ctx: Context) => void,
  { mode = "auto", inlineImageByteLimit }: StarRailCardOptions) {
  const standard = nativeImageRasterScale() === 4;
  const render = (scale: 2 | 4) => renderPng(width * scale, height * scale, ctx => {
    ctx.scale(scale, scale);
    draw(ctx);
  }, mode, { renderScale: scale, allowHalfScale: standard && scale === 4 });
  const full = await render(4);
  if (inlineImageByteLimit === undefined || full.png.byteLength <= inlineImageByteLimit) return full;
  if (standard && !full.reducedScaleReason) {
    const smaller = await render(2);
    if (smaller.png.byteLength <= inlineImageByteLimit) return smaller;
  }
  throw new Error($t("render-card.text_a9a2049fd7"));
}
