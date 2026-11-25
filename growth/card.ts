import { genshinTemplateFont } from "../../../lib/game-template-fonts.ts";
import { builtinResourceDirectory } from "../../../lib/builtin-resources.ts";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadOfficialArtwork } from "@lotus-yunzai/account";
import type { StarRailGrowthSnapshot } from "@lotus-yunzai/hoyo-client";
import { loadImage, type CanvasRenderingContext2D, type Image } from "skia-canvas";
import { image as loadLocalImage, fill, picture, rounded, styles } from "../panel-skia-theme.ts";
import { registerGachaThemeFont } from "../../../packages/skia/gacha-theme-fonts.ts";
import { renderStarRailCard, type StarRailCardOptions } from "../render-card.ts";

const width = 550;
const titleColor = "#a57f72";
const resultColor = "#91837a";
const border = "#d9d3c7";
const defaultTheme = builtinResourceDirectory("games/genshin");
const skillPattern = /\.skill\s*\{[^}]*data:image\/png;base64,([A-Za-z0-9+/=]+)\)/u;
type Options = StarRailCardOptions & {
  readonly themeDirectory?: string;
  readonly transport?: NonNullable<Parameters<typeof loadOfficialArtwork>[1]>["transport"];
};
const groups = [
  ["角色消耗", "avatar_consume"], ["行迹消耗", "skill_consume"], ["光锥消耗", "equipment_consume"],
] as const;

export function growthCount(value: number) {
  return value > 10_000 ? `${(value / 10_000).toFixed(1)} 万` : String(value);
}

export function starRailGrowthText(model: StarRailGrowthSnapshot) {
  const scales = [model.avatar, model.equipment, ...model.skills].flatMap(row =>
    row ? [`${row.name}  ${row.current} → ${row.target}`] : []);
  const materials = groups.flatMap(([name, key]) => model.materials[key].length ? [name,
    ...model.materials[key].map(item => `${item.name} × ${growthCount(item.total)}`)] : []);
  return [`角色养成计算 · UID ${model.uid}`, ...(model.owned ? [] : ["未拥有该角色，按 Lv.1 计算。"]),
    ...scales, ...(materials.length ? materials : ["已达到目标，无需额外材料。"])].join("\n");
}

async function loadRowTexture(directory: string) {
  try {
    const css = Bun.file(resolve(directory, "html/calculator/calculator-sr.css"));
    if (css.size <= 0 || css.size > 128 * 1024) return;
    const encoded = skillPattern.exec(await css.text())?.[1];
    if (encoded && encoded.length < 96 * 1024) return await loadImage(Buffer.from(encoded, "base64"));
  } catch {}
}

async function readGrowthTheme(directory: string) {
  const [three, four, five, skillIcon, skillRow] = await Promise.all([
    loadLocalImage(resolve(directory, "img/other/bg3.png")),
    loadLocalImage(resolve(directory, "img/other/bg4.png")),
    loadLocalImage(resolve(directory, "img/other/bg5.png")),
    loadLocalImage(resolve(directory, "html/calculator/skillbg.png")),
    loadRowTexture(directory),
  ]);
  const fontPath = resolve(directory, "font/tttgbnumber.ttf");
  let font: string | undefined;
  if (await Bun.file(fontPath).exists()) {
    try { font = registerGachaThemeFont("StarRailGrowthNumbers", fontPath); } catch {}
  }
  return { three, four, five, skillIcon, skillRow, font };
}

function fallbackBadge(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rarity?: number) {
  const gradient = ctx.createLinearGradient(x, y, x + size, y + size);
  gradient.addColorStop(0, rarity === 5 ? "#dcbe82" : rarity === 4 ? "#c0a8cb" : "#acc3bd");
  gradient.addColorStop(1, rarity === 5 ? "#a6794a" : rarity === 4 ? "#86699e" : "#718983");
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, size, size);
}

export async function renderStarRailGrowth(model: StarRailGrowthSnapshot, signal: AbortSignal, options: Options = {}) {
  const { transport, themeDirectory, ...renderOptions } = options;
  const directory = resolve(themeDirectory || Bun.env.LOTUS_STAR_RAIL_GROWTH_THEME_DIR?.trim() || defaultTheme);
  const all = [...model.skills, model.avatar, model.equipment, ...Object.values(model.materials).flat()];
  const [{ three, four, five, skillIcon, skillRow, font }, artwork] = await Promise.all([
    readGrowthTheme(directory),
    loadOfficialArtwork(all.map(row => row?.icon), { signal, transport }),
  ]);
  signal.throwIfAborted();
  const images = new Map<string, Image>();
  await Promise.all([...artwork].map(async ([url, bytes]) => {
    const image = await loadImage(Buffer.from(bytes)).catch(() => undefined);
    if (image) images.set(url, image);
  }));
  signal.throwIfAborted();
  const entries = [] as { readonly name: string; readonly top: number; readonly rows: Array<{ x: number; y: number; width: number; name: string; total: number; icon?: string }> }[];
  let end = 212 + model.skills.length * 72;
  for (const [name, key] of groups) {
    const items = model.materials[key];
    if (!items.length) continue;
    const display: typeof entries[number]["rows"] = [];
    const top = end;
    end += 29;
    let column = 0;
    for (const item of items) {
      const wide = item.name === "信用点" && (key === "skill_consume" || (key === "avatar_consume" && items.length > 2));
      if (wide && column > 0) { end += 58; column = 0; }
      display.push({ ...item, x: column ? 277 : 28, y: end, width: wide ? 490 : 242 });
      if (wide || column) { end += 58; column = 0; }
      else column = 1;
    }
    if (column) end += 58;
    entries.push({ name, top, rows: display });
  }
  const bottom = entries.length ? end + 4 : end + 43;
  if (bottom > 7_800) throw new Error("星铁养成卡超出单张图片容量。");
  const image = (url?: string) => url ? images.get(url) : undefined;

  const face = [font, genshinTemplateFont()].filter(Boolean).join(", ");
  function paint(ctx: CanvasRenderingContext2D) {
    const write = styles(ctx, { body: face, title: face });
    const fitted = (text: string, x: number, y: number, size: number, max: number, color: string, bold = false) => {
      ctx.font = `${bold ? "bold " : ""}${size}px ${face}`;
      const measured = ctx.measureText(text).width;
      if (measured > max) size *= max / measured;
      write(text, x, y, size, color, "left", bold);
    };
    const line = (color: string, x: number, y: number, w: number, h: number, radius: number) => {
      fill(ctx, color, x, y, w, h, radius);
      rounded(ctx, x, y, w, h, radius);
      ctx.strokeStyle = border;
      ctx.stroke();
    };
    fill(ctx, "#ffffff", 0, 0, width, bottom + 35);
    fill(ctx, titleColor, 15, 25, 163, 28, 7);
    write("角色养成计算", 21, 40, 20, "#ffffff");
    fill(ctx, titleColor, 366, 25, 169, 28, 7);
    write("UID", 376, 40, 20, "#ffffff");
    write(model.uid, 527, 40, 20, "#ffffff", "right");
    line("#e9e5dc", 15, 65, 520, 133, 5);
    for (const [index, item] of [model.avatar, model.equipment].entries()) {
      if (!item) continue;
      const x = index ? 270 : 25, y = 76;
      ctx.save();
      rounded(ctx, x, y, 95, 95, 7);
      ctx.clip();
      const badge = item.rarity === 5 ? five : item.rarity === 4 ? four : three;
      if (badge) picture(ctx, badge, x, y, 95, 95, "cover");
      else fallbackBadge(ctx, x, y, 95, item.rarity);
      picture(ctx, image(item.icon), x, y, 95, 95);
      ctx.restore();
      fitted(item.name, x + 105, 102, 23, 149, resultColor, true);
      write(`Lv.${item.current}  →  Lv.${item.target}`, x + 105, 138, 17, resultColor);
    }
    if (model.rank) {
      fill(ctx, model.rank > 4 ? "#ff5722" : model.rank > 2 ? "#45b97c" : "#62a8ea", 28, 78, 35, 20, 5);
      write(`${model.rank}魂`, 45, 88, 13, "#ffffff", "center");
    }
    if (!model.owned) write("未拥有该角色，按 Lv.1 计算", 130, 165, 12, resultColor);
    for (const [i, skill] of model.skills.entries()) {
      const y = 205 + 72 * i;
      line("#f1eee5", 15, y, 520, 66, 7);
      if (skillRow) {
        ctx.save();
        rounded(ctx, 15, y, 520, 66, 7);
        ctx.clip();
        ctx.globalAlpha = .62;
        ctx.drawImage(skillRow, 15, y, 520, 66);
        ctx.restore();
      }
      if (skillIcon) picture(ctx, skillIcon, 37, y + 3, 60, 60);
      else fill(ctx, "#a68c80", 37, y + 3, 60, 60, 30);
      picture(ctx, image(skill.icon), 41, y + 7, 52, 52);
      write(skill.name, 110, y + 23, 20, resultColor, "left", true);
      write(`Lv.${skill.max}`, 110, y + 49, 15, resultColor);
      for (const [j, level] of [skill.current, skill.target].entries()) {
        const x = j ? 465 : 375;
        fill(ctx, "#f7f5f0", x, y + 18, 50, 30, 4);
        write(level, x + 25, y + 34, 18, resultColor, "center");
      }
      write("→", 445, y + 34, 18, resultColor, "center");
    }
    const top = 204 + 72 * model.skills.length;
    line("#f2eee6", 15, top, 520, bottom - top, 5);
    if (!entries.length) write("已达到目标，无需额外材料", 275, end + 17, 22, resultColor, "center", true);
    for (const group of entries) {
      write(group.name, 275, group.top + 12, 17, "#8c7770", "center", true);
      fill(ctx, "#d9d3c7", 30, group.top + 25, 490, 1);
      for (const item of group.rows) {
        picture(ctx, image(item.icon), item.x, item.y + 2, 51, 51);
        const color = item.name.includes("「") ? "#916853" : resultColor;
        fitted(item.name, item.x + 55, item.y + 18, 16, item.width - 63, color);
        write(`× ${growthCount(item.total)}`, item.x + 55, item.y + 39, 16, resultColor);
      }
    }
    write("Lotus-Yunzai · StarRail", 275, bottom + 18, 12, "#fff", "center");
  }
  return renderStarRailCard(width, bottom + 35, paint, renderOptions);
}
