import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { nativeImageRasterScale } from "@lotus-yunzai/skia";
import { Canvas, loadImage, type CanvasRenderingContext2D as Context, type Image } from "skia-canvas";
import { registerGachaThemeFont } from "../../packages/skia/gacha-theme-fonts.ts";

const white = "#fff";
const bundledTheme = fileURLToPath(new URL("./panel-theme/", import.meta.url));
export const soulColors = ["#666", "#5cbac2", "#339d61", "#3e95b9", "#3955b7", "#531ba9cf", "#ff5722"] as const;

export function rounded(ctx: Context, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function fill(ctx: Context, color: string, x: number, y: number, w: number, h: number, radius = 0) {
  ctx.fillStyle = color;
  if (!radius) ctx.fillRect(x, y, w, h);
  else {
    rounded(ctx, x, y, w, h, radius);
    ctx.fill();
  }
}

export function picture(ctx: Context, image: Image | undefined, x: number, y: number, w: number, h: number,
  fit: "contain" | "cover" = "contain", alignX = .5, alignY = .5) {
  if (!image) return;
  const scale = (fit === "contain" ? Math.min : Math.max)(w / image.width, h / image.height);
  const iw = image.width * scale, ih = image.height * scale;
  ctx.drawImage(image, x + (w - iw) * alignX, y + (h - ih) * alignY, iw, ih);
}

export async function image(source: string | undefined) {
  if (!source) return;
  try {
    if (source.startsWith("file:")) return await loadImage(fileURLToPath(source));
    if (source.startsWith("data:image/")) return await loadImage(source);
    if (source.startsWith("/")) return await loadImage(source);
  } catch {}
}

function themeFont(theme: string, scope: string, name: string) {
  try {
    return registerGachaThemeFont(scope, join(theme, "common/font", name));
  } catch {
    return "";
  }
}

export function typography(theme: string) {
  const number = themeFont(theme, "StarRailPanelNumbers", "tttgbnumber.ttf");
  const body = themeFont(theme, "StarRailPanelBody", "HYWH-65W.ttf");
  const title = themeFont(theme, "StarRailPanelTitle", "NZBZ.ttf");
  const fallback = '"Noto Sans CJK SC", sans-serif';
  return {
    body: [number, body, fallback].filter(Boolean).join(", "),
    title: [number, title, body, fallback].filter(Boolean).join(", "),
  };
}

export function styles(ctx: Context, font: ReturnType<typeof typography>) {
  function write(value: string | number | undefined, x: number, y: number, size: number, color = white,
    align: CanvasTextAlign = "left", bold = false, header = false, maxWidth?: number) {
    if (value === undefined || value === "") return;
    ctx.font = `${bold ? "bold " : ""}${size}px ${header ? font.title : font.body}`;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    if (maxWidth) ctx.fillText(String(value), x, y, maxWidth);
    else ctx.fillText(String(value), x, y);
  }
  return write;
}

export async function themeArt(theme: string, relative: string) {
  return await image(join(theme, relative)) ?? image(join(bundledTheme, relative));
}
export function relicPortrait(ctx: Context, icon: Image | undefined, x: number, y: number, size: number, density: number) {
  if (!icon) return;
  const pixelScale = nativeImageRasterScale() === 1 ? ctx.getTransform().a : density;
  const mask = new Canvas(size * pixelScale, size * pixelScale);
  const layer = mask.getContext("2d");
  layer.scale(pixelScale, pixelScale);
  picture(layer, icon, 0, 0, size, size);
  layer.globalCompositeOperation = "destination-in";
  const fade = layer.createLinearGradient(0, size, size, 0);
  fade.addColorStop(0, "#0000");
  fade.addColorStop(.3, "#0005");
  fade.addColorStop(.5, "#000");
  layer.fillStyle = fade;
  layer.fillRect(0, 0, size, size);
  ctx.drawCanvas(mask, x, y, size, size);
}
