import { readFile, realpath, stat } from "node:fs/promises";
import { join, sep } from "node:path";
import { renderStarRailCard, type StarRailCardOptions } from "./render-card.ts";
import { loadImage, type CanvasRenderingContext2D, type Image } from "skia-canvas";
import { registerGachaThemeFont } from "../../packages/skia/gacha-theme-fonts.ts";
import { readTheme } from "./panel-card.ts";
import { object, text } from "./panel-model.ts";

export interface RelicRankRow {
  readonly uid: string;
  readonly characterId: string;
  readonly score: number;
  readonly grade: string;
}
export interface RelicRankCoverage {
  readonly registered: number;
  readonly scored: number;
  readonly notListed: number;
  readonly failed: number;
}

export function relicRankCoverageText({ registered, scored, notListed, failed }: RelicRankCoverage) {
  const parts = [`本轮公开展板 ${scored}/${registered} 已计分`];
  if (notListed) parts.push(`未展示或词条不全 ${notListed}`);
  if (failed) parts.push(`读取失败 ${failed}`);
  return parts.join(" · ");
}

type Character = { readonly id: number; readonly name: string };
const elementArt: Readonly<Record<string, string>> = { 物理: "sr", 火: "pyro", 冰: "cryo", 风: "anemo", 雷: "electro", 量子: "quantum", 虚数: "geo" };
const gradeColors: Readonly<Record<string, string>> = { MAX: "#ff5722", ACE: "#ff5722", SSS: "#531ba9cf", SS: "#531ba9cf", S: "#3955b7", A: "#3955b7" };
const families = '"Noto Sans CJK SC", sans-serif';

async function asset(root: string, parts: readonly string[]) {
  if (!parts.every((part) => part && part !== "." && part !== ".." && !/[\/\\\p{Cc}]/u.test(part))) return;
  try {
    const file = await realpath(join(root, ...parts));
    if (!file.startsWith(root + sep)) return;
    const info = await stat(file);
    if (info.isFile() && info.size <= 8 * 1024 * 1024) return file;
  } catch {}
}

async function picture(root: string, ...parts: string[]) {
  const path = await asset(root, parts);
  if (path) return await readFile(path).then((bytes) => loadImage(bytes)).catch(() => undefined);
}

async function cardFonts(root: string) {
  const spec = [["RankNumber", "tttgbnumber.ttf"], ["RankHan", "HYWH-65W.ttf"], ["RankTitle", "NZBZ.ttf"]] as const;
  const [number, han, title] = await Promise.all(spec.map(async ([scope, file]) => {
    const path = await asset(root, ["common", "font", file]);
    try { if (path) return registerGachaThemeFont(scope, path); } catch {}
  }));
  return { body: [number, han, families].filter(Boolean).join(", "), heading: [number, title, han, families].filter(Boolean).join(", ") };
}

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();
}

function label(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign = "left") {
  ctx.textAlign = align;
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.fillText(value, x, y);
}

function drawBadge(ctx: CanvasRenderingContext2D, rank: number, y: number, image: Image | undefined, first: Image | undefined, font: string) {
  const art = rank === 1 ? first : image;
  if (art) {
    const frameWidth = art.height * (rank === 1 ? 2 : 1);
    const width = rank === 1 ? 48 : 24;
    ctx.drawImage(art, art.width - frameWidth, 0, frameWidth, art.height, 55 - width / 2, y + 18, width, 24);
    if (rank === 1) return;
  }
  label(ctx, String(rank), 55, y + 34, `12px ${font}`, "#fff", "center");
}

/** Draws the old element backdrop, score badges, portraits and rank rows with the native renderer. */
export async function renderStarRailRelicRank(
  character: Character, rows: readonly RelicRankRow[], mode: StarRailCardOptions["mode"] = "auto", inlineImageByteLimit?: number,
  coverage?: RelicRankCoverage,
) {
  if (!rows.length || rows.length > 15) throw new RangeError("星铁遗器榜须为 1 至 15 行。");
  const theme = await readTheme();
  const root = await realpath(theme.root).catch(() => undefined);
  const metadata = object(theme.characters[String(character.id)]);
  const element = elementArt[text(metadata?.elem)] || "sr";
  const faceNames = rows.map((row) => text(object(theme.characters[row.characterId])?.name) || character.name);
  const faces = new Map<string, Image>();
  const art = root ? await Promise.all([
    picture(root, "common", "bg", `bg-${element}.webp`), picture(root, "common", "cont", "card-bg.png"),
    picture(root, "character", "imgs", "mark-icon.png"), picture(root, "character", "imgs", "mark-icon2.png"),
    cardFonts(root),
    Promise.all([...new Set(faceNames)].map(async (name) => {
      const face = await picture(root, "meta-sr", "character", name, "imgs", "face.webp");
      if (face) faces.set(name, face);
    })),
  ] as const) : undefined;
  const [background, texture, badge, firstBadge, fonts] = art ?? [];
  const { body: font, heading } = fonts ?? { body: families, heading: families };
  const width = 600, height = 159 + rows.length * 65;
  return renderStarRailCard(width, height, (ctx) => {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = "#242e45";
    ctx.fillRect(0, 0, width, height);
    if (background) {
      const zoom = Math.max(width / background.width, height / background.height);
      ctx.drawImage(background, 0, 0, background.width * zoom, background.height * zoom);
    }
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 2;
    ctx.shadowOffsetY = 1;
    label(ctx, `${character.name}遗器评分排行`, 35, 71, `700 32px ${heading}`, "#fff");
    label(ctx, coverage ? relicRankCoverageText(coverage) : "本群成员主动展示的评分", 35, 98, `16px ${font}`, "#fff");
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    const cardTexture = texture ? ctx.createPattern(texture, "repeat-x") : null;
    for (const [index, row] of rows.entries()) {
      const y = 117 + index * 65;
      rounded(ctx, 25, y, 550, 60, 11, "#17212db0");
      if (texture && cardTexture) {
        ctx.save();
        ctx.clip();
        const zoom = 60 / texture.height;
        ctx.translate(25, y);
        ctx.scale(zoom, zoom);
        ctx.fillStyle = cardTexture;
        ctx.fillRect(0, 0, 550 / zoom, texture.height);
        ctx.restore();
      }
      drawBadge(ctx, index + 1, y, badge, firstBadge, font);
      const face = faces.get(faceNames[index]!);
      ctx.save();
      ctx.beginPath();
      ctx.arc(110, y + 30, 25, 0, 2 * Math.PI);
      ctx.fillStyle = "#28364b";
      ctx.fill();
      if (face) {
        ctx.clip();
        ctx.drawImage(face, 85, y + 5, 50, 50);
      }
      ctx.restore();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.stroke();
      label(ctx, `UID ${row.uid}`, 139, y + 36, `18px ${font}`, "#d3bc8e");
      rounded(ctx, 478, y + 21, 28, 18, 3, gradeColors[row.grade] || "#aaa");
      label(ctx, row.grade, 492, y + 35, `14px ${font}`, "#fff", "center");
      label(ctx, row.score.toFixed(1), 550, y + 36, `700 18px ${font}`, "#fff", "right");
    }
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 1;
    ctx.shadowOffsetY = 1;
    label(ctx, "Lotus-Yunzai · StarRail", 305, height - 25, `14px ${font}`, "#fff", "center");
  }, { mode, inlineImageByteLimit });
}
