import { readFile, realpath, stat } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { renderPng } from "@lotus-yunzai/skia";
import { loadImage } from "skia-canvas";
import { readStarRailGachaItems, starRailGachaThemeDirectory } from "../gacha-detail-source.ts";
import type { WarpPull } from "./draw.ts";

type Picture = Awaited<ReturnType<typeof loadImage>>;
type Context = Parameters<Parameters<typeof renderPng>[2]>[0];
const palette = { 3: "#81b5dc", 4: "#c7a1f3", 5: "#ffd07b" };
const fonts = '"Noto Sans CJK SC", sans-serif';

interface WarpCard {
  readonly title: string;
  readonly pity: number;
  readonly pulls: readonly WarpPull[];
  readonly page: number;
  readonly pages: number;
  readonly themeDirectory?: string;
  readonly mode?: Parameters<typeof renderPng>[3];
}

async function portraits(pulls: readonly WarpPull[], directory: string) {
  const root = await realpath(directory).catch(() => undefined);
  if (!root) return [];
  const item = await readStarRailGachaItems(root);
  const assets = new Map<string, Promise<Picture | undefined>>();
  async function picture(path: string) {
    try {
      const file = await realpath(resolve(root!, path.replace(/^\//u, "")));
      if (!file.startsWith(`${root}${sep}`)) return;
      const info = await stat(file);
      if (!info.isFile() || info.size > 4 * 1024 * 1024) return;
      const bytes = await readFile(file);
      if (bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP") return;
      return await loadImage(bytes);
    } catch { return; }
  }
  return Promise.all(pulls.map((pull) => {
    const entry = item({ name: pull.name, item_type: pull.kind }) ??
      item({ name: pull.name.replaceAll("『", "「").replaceAll("』", "」"), item_type: pull.kind });
    const path = entry?.img;
    if (!path) return;
    const file = pull.kind === "光锥" ? path.replace(/icon\.webp$/u, "splash.webp") : path.replace(/face\.webp$/u, "preview.webp");
    if (!assets.has(file)) assets.set(file, picture(file));
    return assets.get(file);
  }));
}

function text(ctx: Context, label: string, x: number, y: number, size: number, color: string, width: number) {
  ctx.fillStyle = color;
  ctx.font = `600 ${size}px ${fonts}`;
  const measuredWidth = ctx.measureText(label).width;
  if (measuredWidth > width) ctx.font = `600 ${Math.floor(size * width / measuredWidth)}px ${fonts}`;
  ctx.fillText(label, x, y);
}

export async function renderWarpCard({ title, pity, pulls, page, pages, themeDirectory = starRailGachaThemeDirectory(), mode = "auto" }: WarpCard) {
  if (pulls.length < 1 || pulls.length > 10) throw new RangeError("每张跃迁卡需有 1–10 抽。");
  const visible = [...pulls].sort((left, right) => right.rarity - left.rarity || left.order - right.order);
  const artwork = await portraits(visible, themeDirectory).catch(() => []);
  const width = pulls.length === 1 ? 530 : 1190;
  const height = 352;
  const gap = 10;
  const itemWidth = pulls.length === 1 ? 420 : 104;
  const left = (width - visible.length * itemWidth - (visible.length - 1) * gap) / 2;
  return renderPng(width, height, (ctx) => {
    const background = ctx.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, "#172539");
    background.addColorStop(1, "#08131e");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#80acd025";
    ctx.beginPath();
    ctx.moveTo(24, 65);
    ctx.lineTo(width - 24, 65);
    ctx.moveTo(24, 312);
    ctx.lineTo(width - 24, 312);
    ctx.stroke();
    text(ctx, title, 25, 49, 26, "#f6f8fc", width - 165);
    ctx.textAlign = "right";
    text(ctx, `${page} / ${pages}`, width - 25, 48, 18, "#c7d7e7", 85);
    for (const [index, pull] of visible.entries()) {
      const accent = palette[pull.rarity];
      const x = left + index * (itemWidth + gap);
      const top = 85;
      const content = ctx.createLinearGradient(x, top, x, top + 206);
      content.addColorStop(0, "#213044");
      content.addColorStop(1, "#0d1725");
      ctx.fillStyle = content;
      ctx.fillRect(x, top, itemWidth, 206);
      ctx.fillStyle = accent;
      ctx.fillRect(x, top, itemWidth, 3);
      const art = artwork[index];
      if (art) {
        const scale = Math.min((itemWidth - 6) / art.width, 122 / art.height);
        const artWidth = art.width * scale;
        const artHeight = art.height * scale;
        ctx.drawImage(art, x + (itemWidth - artWidth) / 2, top + 15 + (122 - artHeight) / 2, artWidth, artHeight);
      } else {
        ctx.textAlign = "center";
        text(ctx, pull.kind, x + itemWidth / 2, top + 91, 22, "#c0cde0", itemWidth - 8);
      }
      ctx.textAlign = "center";
      text(ctx, "★".repeat(pull.rarity), x + itemWidth / 2, top + 154, 16, accent, itemWidth - 9);
      text(ctx, pull.name, x + itemWidth / 2, top + 177, 17, "#f6f8fc", itemWidth - 9);
      text(ctx, pull.featured ? "UP" : pull.kind, x + itemWidth / 2, top + 197, 13, "#c4d0df", itemWidth - 9);
    }
    ctx.textAlign = "left";
    text(ctx, `模拟跃迁 · 当前垫 ${pity} 抽`, 25, 335, 16, "#d1dded", width - 210);
    ctx.textAlign = "right";
    text(ctx, "Lotus-Yunzai · StarRail", width - 25, 335, 14, "#aebfd5", 205);
  }, mode);
}
