import { miaoTemplateFont } from "../../lib/game-template-fonts.ts";
import { constants } from "node:fs";
import { open, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { renderStarRailCard } from "./render-card.ts";
import { Canvas, loadImage, type CanvasRenderingContext2D as Context, type Image } from "skia-canvas";

export interface TeamMember {
  readonly name: string;
  readonly level: number;
  readonly rank: number;
  readonly weapon: string;
  readonly weaponLevel: number;
  readonly weaponRank: number;
  readonly source: string;
  readonly stats: readonly string[];
  readonly face: string;
}

export interface TeamDamageReport {
  readonly uid: string;
  readonly profileId: number;
  readonly summary: readonly { readonly label: string; readonly value: string }[];
  readonly team: readonly TeamMember[];
  readonly contribution: readonly { readonly name: string; readonly value: string; readonly share: string }[];
  readonly timeline: string;
  readonly turns: readonly { readonly title: string; readonly actionPoint: number; readonly lines: readonly string[] }[];
  readonly statNames: readonly string[];
  readonly engine: string;
  readonly warnings: readonly string[];
}

const width = 720, inset = 14, innerWidth = width - inset * 2, scale = 4;
const font = miaoTemplateFont();
const gold = "#f4ddb2", white = "#fff", header = "#15101cde", body = "#15101cba";
const maxAsset = 16 * 1024 * 1024;
type Paint = (ctx: Context) => void;
type Text = { readonly value: string; readonly color?: string; readonly size?: number };
type Cell = string | readonly Text[];
type Row = readonly Cell[];

async function image(root: string, path: string | URL) {
  try {
    const file = await realpath(path);
    const inside = relative(root, file);
    if (!inside || isAbsolute(inside) || inside === ".." || inside.startsWith(".." + sep)) return;
    const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const info = await handle.stat();
      if (!info.isFile() || info.size < 1 || info.size > maxAsset) return;
      const bytes = Buffer.alloc(info.size + 1);
      const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
      if (bytesRead === info.size) return await loadImage(bytes.subarray(0, bytesRead));
    } finally {
      await handle.close();
    }
  } catch {
    // The card still presents the same data when an original image is unavailable.
  }
}

function fill(ctx: Context, color: string, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function type(ctx: Context, text: string, x: number, y: number, size: number, color: string, bold = false, align: CanvasTextAlign = "center") {
  ctx.font = `${bold ? "700 " : ""}${size}px ${bold ? miaoTemplateFont(true) : font}`;
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
}

function wrap(value: string, limit: number, measure: (value: string) => number) {
  const words = value.replace(/\s+/gu, " ").match(/[A-Za-z\d][A-Za-z\d.,%+–-]*|./gu) ?? [];
  const lines: string[] = [];
  let line = "";
  for (const token of words.flatMap(word => measure(word) <= limit ? [word] : Array.from(word))) {
    if (line && measure(line + token) > limit) {
      lines.push(line.trimEnd());
      line = "";
    }
    if (line || token.trim()) line += token;
  }
  lines.push(line);
  return lines;
}

function face(ctx: Context, image: Image, x: number, y: number) {
  const size = 31;
  const crop = Math.min(image.width, image.height);
  ctx.save();
  ctx.beginPath(); ctx.arc(x + size / 2, y + size / 2, size / 2, 0, 2 * Math.PI); ctx.clip();
  ctx.drawImage(image, (image.width - crop) / 2, (image.height - crop) / 2, crop, crop, x, y, size, size);
  ctx.restore();
}

function renderLayout(report: TeamDamageReport, faces: readonly (Image | undefined)[]) {
  const details = report.turns.length > 0;
  const measure = new Canvas(1, 1).getContext("2d");
  const paints: Paint[] = [];
  const lineHeight = (size: number) => Math.round(size * 1.45);
  function lines(value: string, max: number, size: number, bold = false) {
    measure.font = `${bold ? "700 " : ""}${size}px ${bold ? miaoTemplateFont(true) : font}`;
    return wrap(value, max, text => measure.measureText(text).width);
  }

  paints.push(ctx => {
    ctx.save();
    ctx.shadowColor = "#130d1b"; ctx.shadowBlur = 3 * scale; ctx.shadowOffsetY = scale;
    type(ctx, "星铁队伍伤害" + (details ? " · 行动过程" : ""), width / 2, 65, 32, gold, true);
    type(ctx, `UID ${report.uid} · 档案 ${report.profileId}`, width / 2, 104, 17, white);
    ctx.restore();
  });
  let cursor = 135;
  function table(title: readonly string[], rows: readonly Row[], { widths = title.map(() => innerWidth / title.length),
    size = 17, portraits = [], rowHeaders = false }: { widths?: readonly number[]; size?: number;
      portraits?: readonly (Image | undefined)[]; rowHeaders?: boolean } = {}) {
    const top = cursor;
    const entries = [title, ...rows].map((row, index) => {
      const picture = index > 0 ? portraits[index - 1] : undefined;
      const cells = row.map((cell, column) => {
        const bold = !index || (rowHeaders && !column);
        const art = column === 1 ? picture : undefined;
        const max = widths[column]! - 7 - (art ? 35 : 0);
        const phrases = (typeof cell === "string" ? [{ value: cell }] : cell).flatMap(
          ({ value, color = index ? white : gold, size: textSize = size }) =>
            lines(value, max, textSize, bold).map(value => ({ value, color, size: textSize, height: lineHeight(size) })),
        );
        const contentHeight = phrases.reduce((sum, phrase) => sum + phrase.height, 0);
        return { bold, phrases, art, contentHeight };
      });
      return { cells, height: 15 + Math.max(...cells.map(cell => Math.max(cell.contentHeight, cell.art ? 31 : 0))) };
    });
    cursor += entries.reduce((sum, row) => sum + row.height, 0) + 13;
    paints.push(ctx => {
      let y = top;
      for (const [index, { cells, height }] of entries.entries()) {
        fill(ctx, index ? body : header, inset, y, innerWidth, height);
        let x = inset;
        for (const [column, { bold, phrases, art, contentHeight }] of cells.entries()) {
          const w = widths[column]!;
          let center = x + w / 2;
          if (art) {
            measure.font = `${size}px ${font}`;
            const labelWidth = Math.max(0, ...phrases.map(({ value }) => measure.measureText(value).width));
            const start = x + (w - labelWidth - 35) / 2;
            face(ctx, art, start, y + (height - 31) / 2);
            center += 17.5;
          }
          let line = y + (height - contentHeight) / 2;
          for (const entry of phrases) {
            type(ctx, entry.value, center, line + entry.height / 2, entry.size, entry.color, bold);
            line += entry.height;
          }
          ctx.strokeStyle = "#fff3";
          ctx.strokeRect(x + 0.5, y + 0.5, w, height);
          x += w;
        }
        y += height;
      }
    });
  }
  function note(title: string, values: readonly string[], size: number, separate: boolean) {
    const left = inset + (separate ? 10 : 12), top = cursor;
    const content = separate ? values.map(value => lines(value, width - left * 2, size)) :
      [lines(`${title}  ${values[0]}`, width - left * 2, size)];
    const height = 16 + (separate ? lineHeight(size) : 0) +
      content.reduce((sum, value) => sum + value.length * lineHeight(size) + (separate ? 6 : 0), 0);
    cursor += height + (separate ? 9 : 12);
    paints.push(ctx => {
      fill(ctx, header, inset, top, innerWidth, height);
      let y = top + 8 + lineHeight(size) / 2;
      if (separate) {
        type(ctx, title, left, y, size, gold, true, "left");
        y += lineHeight(size) + 6;
      }
      for (const [i, parts] of content.entries()) {
        for (const [j, text] of parts.entries()) {
          if (!separate && i === 0 && j === 0 && text.startsWith(title)) {
            const tail = text.slice(title.length);
            measure.font = `700 ${size}px ${font}`;
            type(ctx, title, left, y, size, gold, true, "left");
            type(ctx, tail, left + measure.measureText(title).width, y, size, white, false, "left");
          } else {
            type(ctx, text, left, y, size, white, false, "left");
          }
          y += lineHeight(size);
        }
        y += separate ? 6 : 0;
      }
    });
  }

  table(report.summary.map(row => row.label), [report.summary.map(row => row.value)]);
  table(["#", "角色", "等级 / 星魂", "光锥"], report.team.map((member, index) => [
    String(index + 1), member.name, `Lv.${member.level} · ${member.rank} 魂`,
    member.weaponRank ? [{ value: member.weapon }, { value: `Lv.${member.weaponLevel} · ${member.weaponRank} 叠影` }] : member.weapon,
  ]), { widths: [42, 220, 130, innerWidth - 392], portraits: faces });
  table(["面板属性", ...report.team.map(member => member.name)], report.statNames.map((label, index) =>
    [label, ...report.team.map(member => member.stats[index] ?? "")]), { size: 14, rowHeaders: true });
  table(["角色", "面板来源"], report.team.map(member => [member.name, member.source]));
  if (report.contribution.length) {
    table(["伤害贡献", "伤害", "占比"], report.contribution.map(row => [row.name, row.value, row.share]));
  }
  if (report.timeline) note("起手顺序", [report.timeline], 17, false);
  if (details) {
    table(["顺序", "关键行动（前 8 项）", "行动值"], report.turns.map((turn, index) => [
      String(index + 1), [{ value: turn.title }, { value: turn.lines[0] ?? "" },
        ...(turn.lines[1] ? [{ value: turn.lines[1], size: 14, color: gold }] : [])], String(turn.actionPoint),
    ]), { widths: [67, innerWidth - 160, 93] });
  }
  if (report.warnings.length) note("模拟说明", report.warnings, 14, true);

  const footer = cursor;
  paints.push(ctx => {
    ctx.save();
    ctx.shadowColor = "#130d1b"; ctx.shadowBlur = 3 * scale; ctx.shadowOffsetY = scale;
    type(ctx, `计算引擎 · ${report.engine}`, width / 2, footer + 10, 14, gold);
    type(ctx, "固定假人与自动行动策略，数值仅供参考", width / 2, footer + 30, 14, gold);
    type(ctx, "Lotus-Yunzai · StarRail", width / 2, footer + 50, 14, gold);
    ctx.restore();
  });
  return { height: footer + 72, paints };
}

export async function renderStarRailTeamDamage(report: TeamDamageReport, directory: string, signal: AbortSignal,
  verify: () => Promise<void>, inlineImageByteLimit?: number) {
  const root = await realpath(directory).catch(() => undefined);
  const assets = root ? await Promise.all([
    image(root, join(root, "character/imgs/bg-02.jpg")),
    image(root, join(root, "character/imgs/main-02.png")),
    ...report.team.map(member => member.face ? image(root, fileURLToPath(member.face)) : Promise.resolve(undefined)),
  ]) : [];
  const [background, artwork, ...faces] = assets;
  const { height, paints } = renderLayout(report, faces);
  const tileHeight = background ? width * background.height / background.width : 0;
  const center = tileHeight ? (height - tileHeight) / 2 : 0;
  signal.throwIfAborted();
  const { png, engine } = await renderStarRailCard(width, height, ctx => {
    fill(ctx, "#26142a", 0, 0, width, height);
    if (background && tileHeight > 0) {
      for (let y = center - Math.ceil(center / tileHeight) * tileHeight; y < height; y += tileHeight) {
        ctx.drawImage(background, 0, y, width, tileHeight);
      }
    }
    if (artwork) ctx.drawImage(artwork, 0, -25, width, width * artwork.height / artwork.width);
    paints.forEach(paint => paint(ctx));
  }, { inlineImageByteLimit });
  await verify();
  console.log(`[渲染] 星铁队伍伤害 ${engine.renderer} ${engine.api} ${engine.device}`);
  return png;
}
