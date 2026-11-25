import { createTranslator as createTextTranslator } from "../../packages/i18n/index.ts";
import messageCatalog from "./i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import { fileURLToPath } from "node:url";
import { loadOfficialArtwork } from "@lotus-yunzai/account";
import { FontLibrary, loadImage, type CanvasRenderingContext2D as Context, type Image } from "skia-canvas";
import { loadStarRailChallengePortraits, type ChallengePortraitOptions } from "./challenge-portraits.ts";
import { readTheme } from "./panel-card.ts";
import { renderStarRailCard, type StarRailCardOptions } from "./render-card.ts";
import type { StarRailPersonalRecord } from "./personal-record.ts";

// Card and phone theme geometry from StarRail-plugin 308a83d resources/card.
const source = new URL("./profile-theme/", import.meta.url);
const fontPath = fileURLToPath(new URL("./rogue-theme/SR.ttf", import.meta.url));
const font = '"LotusStarRailRecord", "Noto Sans CJK SC", sans-serif';
const width = 600, headerBottom = 388, gridY = 467, rowHeight = 130;
const colors = {
  fire: "#c5523a", ice: "#4089bb", imaginary: "#f1d85e", lightning: "#a042be",
  physical: "#857f87", quantum: "#4b52a1", wind: "#349972",
} as const;
let fontsRegistered = false;

function label(ctx: Context, value: string | number | undefined, x: number, y: number, size: number,
  color: string, align: CanvasTextAlign = "left", maxWidth?: number) {
  ctx.font = `${size}px ${font}`;
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.textAlign = align;
  ctx.fillText(String(value ?? "—"), x, y, maxWidth);
}

function path(ctx: Context, x: number, y: number, w: number, h: number, radius: number | number[]) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
}

function box(ctx: Context, x: number, y: number, w: number, h: number, radius: number | number[], fill: string, border?: string) {
  path(ctx, x, y, w, h, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  if (border) {
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function maskedPicture(ctx: Context, image: Image, x: number, y: number, side: number, radius: number) {
  ctx.save();
  path(ctx, x, y, side, side, radius);
  ctx.clip();
  const scale = Math.max(side / image.width, side / image.height);
  ctx.drawImage(image, x + (side - image.width * scale) / 2, y + (side - image.height * scale) / 2,
    image.width * scale, image.height * scale);
  ctx.restore();
}

async function image(name: string) {
  return loadImage(new URL(name, source));
}

export async function renderStarRailPersonalRecord(record: StarRailPersonalRecord, signal: AbortSignal,
  { portraitOptions, ...options }: StarRailCardOptions & { readonly portraitOptions?: ChallengePortraitOptions } = {}) {
  signal.throwIfAborted();
  if (!fontsRegistered) {
    FontLibrary.use("LotusStarRailRecord", fontPath);
    fontsRegistered = true;
  }
  const root = portraitOptions?.themeDirectory ?? await readTheme().then(theme => theme.root, () => undefined);
  const elements = [...new Set(record.avatars.map(avatar => avatar.element).filter(Boolean))];
  const [defaultArt, logo, star, assets, portraits, badges] = await Promise.all([
    image("default.png"), image("logo.png"), image("star.png"),
    loadOfficialArtwork([record.avatar, record.background], { signal, transport: portraitOptions?.transport }),
    loadStarRailChallengePortraits(record.avatars, signal, { ...portraitOptions, themeDirectory: root }),
    Promise.all(elements.map(async element => [element, await image(element + ".png")] as const)),
  ]);
  signal.throwIfAborted();
  async function asset(url: string | undefined) {
    const bytes = url ? assets.get(url) : undefined;
    return bytes ? loadImage(Buffer.from(bytes)).catch(() => undefined) : undefined;
  }
  const [theme, avatar] = await Promise.all([asset(record.background), asset(record.avatar)]);
  const background = theme ?? defaultArt;
  const icons = new Map(badges);
  const rows = Math.ceil(record.avatars.length / 5);
  const gridHeight = 30 + rows * rowHeight;
  const height = gridY + gridHeight + 20;
  const rendered = await renderStarRailCard(width, height, ctx => {
    box(ctx, 0, 0, width, height, 0, "white");
    const backgroundWidth = width * 1.01;
    function backdrop(x: number, y: number, w: number, h: number, radius: number | number[], blur = 0) {
      ctx.save();
      path(ctx, x, y, w, h, radius);
      ctx.clip();
      ctx.fillStyle = "#16151e";
      ctx.fillRect(x, y, w, h);
      if (blur) ctx.filter = `blur(${blur}px)`;
      ctx.drawImage(background, (width - backgroundWidth) / 2, -2,
        backgroundWidth, backgroundWidth * background.height / background.width);
      ctx.restore();
    }
    backdrop(0, 0, width, headerBottom + 20, 0);

    box(ctx, 25, 18, 30, 30, 7, "white");
    maskedPicture(ctx, logo, 27, 20, 26, 5);
    const brand = $t("personal-record-card.text_3867834e77");
    label(ctx, brand, 63, 33, 21.6, "white");
    const arrowX = 72 + ctx.measureText(brand).width;
    ctx.beginPath();
    ctx.moveTo(arrowX, 26); ctx.lineTo(arrowX + 8, 33); ctx.lineTo(arrowX, 40); ctx.closePath();
    ctx.fillStyle = "#b8b8b8"; ctx.fill();
    backdrop(505, 28, 65, 45, 25, 8);
    box(ctx, 505, 28, 65, 45, 25, "#ffffff0d", "#a3a3a333");
    ctx.strokeStyle = "#d9c096";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const [a, b, c, d] of [[528, 43, 534, 49], [548, 43, 542, 49], [528, 60, 534, 54], [548, 60, 542, 54]]) {
      ctx.moveTo(a!, b!); ctx.lineTo(c!, d!);
    }
    ctx.stroke();
    box(ctx, 536.5, 50.5, 3, 3, 1.5, "#d9c096");

    box(ctx, 20, 78, 75, 75, 37.5, "#a5a09d");
    const headerAvatar = avatar ?? portraits.values().next().value;
    if (headerAvatar) maskedPicture(ctx, headerAvatar, 23, 81, 69, 34.5);
    label(ctx, record.nickname, 115, 100, 23.4, "white", "left", 315);
    if (record.level !== undefined) {
      const x = 125 + Math.min(315, ctx.measureText(record.nickname).width);
      const badge = `Lv.${record.level}`;
      ctx.font = `16.2px ${font}`;
      const badgeWidth = 16 + ctx.measureText(badge).width;
      box(ctx, x, 87, badgeWidth, 26, 5, "#ebb35d");
      label(ctx, badge, x + badgeWidth / 2, 100, 16.2, "white", "center");
    }
    label(ctx, record.region, 115, 135, 18, "#dedede");
    const separator = 133 + Math.min(300, ctx.measureText(record.region).width);
    box(ctx, separator, 128, 1, 15, 0, "#8f8f8f");
    label(ctx, `UID${record.uid}`, separator + 18, 135, 18, "#dedede", "left", width - separator - 35);

    backdrop(20, 173, 560, 230, [13, 13, 0, 0], 16);
    box(ctx, 20, 173, 560, 230, [13, 13, 0, 0], "#0009");
    record.stats.slice(0, 2).forEach(([name, value], i) => {
      const x = 165 + i * 270;
      label(ctx, value, x, 220, 27, "white", "center");
      label(ctx, name, x, 250, 16.2, "#6f6f6f", "center");
    });
    box(ctx, 300, 218, 1, 29, 0, "#3f3f3f");
    record.stats.slice(2).forEach(([name, value], i) => {
      const x = 30 + i * 183;
      box(ctx, x, 300, 173, 73, 10, "#222021", "#323031");
      label(ctx, value, x + 86.5, 325, 21.6, "#b3b3b3", "center", 160);
      label(ctx, name, x + 86.5, 352, 16.2, "#6f6f6f", "center");
    });

    box(ctx, 0, headerBottom, width, height - headerBottom, [18, 18, 0, 0], "white");
    ctx.drawImage(star, 20, 420, 24, 24);
    label(ctx, $t("personal-record-card.text_299e349fd3"), 54, 433, 23.76, "black");
    box(ctx, 20, gridY, 560, gridHeight, [5, 40, 5, 5], "#f4f2e5");
    path(ctx, 30, gridY + 10, 540, gridHeight - 20, [5, 35, 5, 5]);
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = "#d0ba94"; ctx.lineWidth = 2; ctx.stroke();
    ctx.setLineDash([]);
    record.avatars.forEach((character, i) => {
      const x = 43 + i % 5 * 106, y = gridY + 23 + Math.floor(i / 5) * rowHeight;
      const tint = ctx.createLinearGradient(x, y + 90, x + 90, y);
      const gradient = character.rarity === 5 ? ["#c59a65", "#894f4a"] : character.rarity === 4 ? ["#7f54c0", "#3d3d63"] : ["#cb9a6d", "#cb9a6d"];
      tint.addColorStop(0, gradient[0]!); tint.addColorStop(1, gradient[1]!);
      path(ctx, x, y, 90, 95, [0, 15, 0, 0]);
      ctx.save(); ctx.clip();
      ctx.fillStyle = tint; ctx.fillRect(x, y, 90, 95);
      path(ctx, x + 3, y + 3, 84, 89, [0, 15, 0, 0]);
      ctx.strokeStyle = "#fffdfd48"; ctx.lineWidth = 2; ctx.stroke();
      const art = portraits.get(character);
      if (art) ctx.drawImage(art, x, y, 90, 90);
      box(ctx, x, y + 76, 90, 17, 0, "black");
      label(ctx, character.level === undefined ? $t("personal-record-card.text_2369e160bc") : $t("personal-record-card.text_d6960d887e", { "level": character.level }), x + 45, y + 85, 14.4, "white", "center");
      const element = icons.get(character.element);
      if (element) {
        ctx.save();
        ctx.translate(x + 13, y + 13); ctx.rotate(Math.PI / 4);
        box(ctx, -7.5, -7.5, 15, 15, 0, "black", colors[character.element as keyof typeof colors]);
        path(ctx, -6.5, -6.5, 13, 13, 0); ctx.clip();
        ctx.rotate(-Math.PI / 4); ctx.drawImage(element, -7, -7, 14, 14);
        ctx.restore();
      }
      if (character.rank) {
        box(ctx, x + 70, y, 20, 28, [0, 0, 0, 5], "#0008");
        label(ctx, character.rank, x + 80, y + 14, 14, "#f1f1f1", "center");
      }
      ctx.restore();
      label(ctx, character.name, x + 45, y + 108, 18, "black", "center", 100);
    });
  }, options);
  signal.throwIfAborted();
  return rendered;
}
