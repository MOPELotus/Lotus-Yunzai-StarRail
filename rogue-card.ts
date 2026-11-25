import { createTranslator as createTextTranslator } from "../../packages/i18n/index.ts";
import messageCatalog from "./i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import { fileURLToPath } from "node:url";
import { loadOfficialArtwork } from "@lotus-yunzai/account";
import { nativeImageRasterScale, renderPng } from "@lotus-yunzai/skia";
import { FontLibrary, loadImage, type CanvasRenderingContext2D as Context, type Image } from "skia-canvas";
import { fill, picture, styles } from "./panel-skia-theme.ts";
import type { RogueCard, RogueTile } from "./rogue-model.ts";

const width = 760;
const dark = "#0b0c11b0";
const gold = "#ecd381";
const silver = "#d4cfe0";
const paper = "#ffffff17";
const original = new URL("./rogue-theme/", import.meta.url);
const theme = {
  universe: { background: "rogue-background.png", heading: "rogue-header.png", hue: true, icon: "universe-icon.png" },
  locust: { background: "locust-background.jpg", heading: "rogue-header.png", hue: false, icon: "locust-icon.png" },
  tourn: { background: "rogue-background.png", heading: "tourn-header.webp", hue: true, icon: undefined },
};
const paths = [
  [$t("rogue-card.text_18db236249"), 0, -112], [$t("rogue-card.text_89ae343575"), 93, -74], [$t("rogue-card.text_85a5719200"), 132, 2], [$t("rogue-card.text_17f4b35418"), 92, 71],
  [$t("rogue-card.text_d55d4d5989"), -90, 71], [$t("rogue-card.text_7a6335b379"), -128, 2], [$t("rogue-card.text_135fd7b0a1"), -91, -74],
] as const;

async function readImage(name: string) {
  return loadImage(fileURLToPath(new URL(name, original)));
}

function splitLines(value: string, limit: number) {
  const lines: string[] = [];
  let line = "", length = 0;
  for (const char of value) {
    const weight = /^[\x20-\x7e]$/u.test(char) ? 1 : 2;
    if (length + weight > limit) {
      lines.push(line);
      line = "";
      length = 0;
    }
    line += char;
    length += weight;
  }
  if (line) lines.push(line);
  return lines;
}

type Draw = (ctx: Context, write: ReturnType<typeof styles>) => void;

export const rogueLogicalHeightLimit = 5_000;

export async function renderStarRailRogue(card: RogueCard, signal: AbortSignal, {
  inlineImageByteLimit = Infinity, mode = "auto", transport,
}: {
  readonly inlineImageByteLimit?: number;
  readonly mode?: "auto" | "gpu";
  readonly transport?: NonNullable<Parameters<typeof loadOfficialArtwork>[1]>["transport"];
} = {}) {
  const layout = card.name.startsWith("寰宇") ? theme.locust : card.name.startsWith("模拟") ? theme.universe : theme.tourn;
  const drawings: Draw[] = [];
  const artworks = new Map<string, Image>();
  const pathImages = new Map<string, Image>();
  const icons = new Set<string>();
  let recordIcon: Image | undefined, radar: Image | undefined;
  let y = 114;
  function art(url: string | undefined) {
    if (!url) return;
    icons.add(url);
    return () => artworks.get(url);
  }
  function drawTile(data: RogueTile, x: number, top: number, width: number, height: number, stat: boolean): Draw {
    const primary = art(data.icon), secondary = art(data.secondaryIcon);
    return (ctx, write) => {
      const tint = data.rarity === 5 ? "#a9784a52" : data.rarity === 4 ? "#8758b752" : paper;
      fill(ctx, tint, x, top, width, height, 8);
      const image = primary?.(), sub = secondary?.();
      if (image) picture(ctx, image, x + 7, top + 7, 42, height - 14);
      if (sub) picture(ctx, sub, x + 30, top + height - 27, 22, 20);
      const textX = x + (image ? 54 : 12);
      const maxWidth = width - (textX - x) - 10;
      write(stat ? data.detail : data.name, textX, top + 18, stat ? 20 : 16, gold, "left", stat, false, maxWidth);
      write(stat ? data.name : data.detail, textX, top + 39, 13, silver, "left", false, false, maxWidth);
    };
  }
  function tiles(list: readonly RogueTile[], columns: number, stat = false) {
    const gap = 8, itemWidth = (width - 60 - (columns - 1) * gap) / columns;
    for (const [index, data] of list.entries()) {
      drawings.push(drawTile(data, 30 + (index % columns) * (itemWidth + gap), y + Math.floor(index / columns) * 64, itemWidth, 56, stat));
    }
    y += Math.ceil(list.length / columns) * 64;
  }
  function paragraph(values: readonly string[]) {
    for (const value of values) {
      for (const line of splitLines(value, 86)) {
        const top = y;
        drawings.push((_ctx, write) => write(line, 39, top + 11, 15, silver));
        y += 22;
      }
    }
  }
  tiles(card.stats, 3, true);
  if (card.intro.length) paragraph(card.intro);
  if (card.destiny?.length) {
    const levels = new Map(card.destiny.map(path => [path.name, path.detail]));
    const top = y;
    drawings.push((ctx, write) => {
      picture(ctx, radar, width / 2 - 130, top + 5, 260, 232);
      for (const [name, offsetX, offsetY] of paths) {
        const x = width / 2 + offsetX;
        const center = top + 132 + offsetY;
        picture(ctx, pathImages.get(name), x - 16, center - 16, 32, 32);
        write(`${name} ${levels.get(name) ?? "—"}`, x, center + 24, 15, gold, "center");
      }
    });
    y += 248;
  }
  y += 8;
  for (const record of card.records) {
    const top = y;
    drawings.push((ctx, write) => {
      fill(ctx, "#817c8da0", 24, top, width - 48, 34, 7);
      picture(ctx, recordIcon, 36, top + 3, 28, 28);
      write(record.name, recordIcon ? 72 : 40, top + 18, 18, "#ffffff", "left", true);
    });
    y += 41;
    paragraph(record.summary.length ? [record.summary.join("  ·  ")] : []);
    for (const section of record.sections) {
      const heading = y;
      drawings.push((ctx, write) => {
        fill(ctx, dark, 30, heading, width - 60, 23, 5);
        write(section.name, 39, heading + 12, 16, gold);
      });
      y += 29;
      if (section.tiles?.length) tiles(section.tiles, 3);
      if (section.text?.length) paragraph(section.text);
      y += 5;
    }
    y += 9;
  }
  const height = Math.max(210, y + 39);
  if (height > rogueLogicalHeightLimit) throw new Error($t("rogue-card.text_c339909fdd"));

  const [background, heading, bytes, marker, locustRadar] = await Promise.all([
    readImage(layout.background), readImage(layout.heading), loadOfficialArtwork([...icons], { signal, transport }),
    layout.icon ? readImage(layout.icon) : undefined,
    card.destiny?.length ? readImage("locust-radar.png") : undefined,
  ]);
  recordIcon = marker;
  radar = locustRadar;
  await Promise.all([...bytes].map(async ([key, value]) => {
    const raster = await loadImage(Buffer.from(value)).catch(() => undefined);
    if (raster) artworks.set(key, raster);
  }).concat(radar ? paths.map(async ([name]) => { pathImages.set(name, await readImage(`${name}.webp`)); }) : []));
  signal.throwIfAborted();
  FontLibrary.use("LotusStarRailRogue", [fileURLToPath(new URL("SR.ttf", original))]);
  const font = { body: '"LotusStarRailRogue", "Noto Sans CJK SC", sans-serif', title: '"LotusStarRailRogue", "Noto Sans CJK SC", sans-serif' };
  const standard = nativeImageRasterScale() === 4;
  function draw(ctx: Context) {
    const write = styles(ctx, font);
    fill(ctx, "#100a0e", 0, 0, width, height);
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = .9;
    if (layout.hue) ctx.filter = "hue-rotate(280deg)";
    ctx.drawImage(background, 0, 0, width, width * background.height / background.width);
    ctx.restore();
    const headingWidth = width - 34;
    const headingHeight = headingWidth * heading.height / heading.width;
    ctx.save();
    ctx.beginPath();
    ctx.rect(17, 10, headingWidth, 220);
    ctx.clip();
    ctx.drawImage(heading, 17, 10, headingWidth, headingHeight);
    ctx.restore();
    fill(ctx, dark, 23, 19, width - 46, 81, 10);
    write(card.name, width / 2, 47, 28, gold, "center", true, true);
    write(card.identity, width / 2, 77, 15, silver, "center", false, false, width - 74);
    for (const draw of drawings) draw(ctx, write);
    write($t("rogue-card.text_cd4924c07a"), width / 2, height - 18, 13, "#fff", "center");
  }

  const pngAt = (density: number) => renderPng(width * density, height * density, ctx => {
    ctx.scale(density, density);
    draw(ctx);
  }, mode, { allowHalfScale: standard && density === 4 });
  const full = await pngAt(4);
  if (full.png.byteLength <= inlineImageByteLimit) return full;
  if (standard && !full.reducedScaleReason) {
    const half = await pngAt(2);
    if (half.png.byteLength <= inlineImageByteLimit) return half;
  }
  throw new Error($t("rogue-card.text_376f6d4f1f"));
}

export function starRailRogueText(card: RogueCard) {
  const entry = ({ name, detail }: RogueTile) => detail ? `${name} ${detail}` : name;
  return [card.name, card.identity, card.stats.map(entry).join(" · "), ...card.intro, card.destiny?.map(entry).join(" · "),
    ...card.records.flatMap(record => [record.name, record.summary.join(" · "), ...record.sections.flatMap(section =>
      [section.name, ...(section.text ?? []), section.tiles?.map(entry).join(" · ") ?? ""])]),
  ].filter(Boolean).join("\n");
}
