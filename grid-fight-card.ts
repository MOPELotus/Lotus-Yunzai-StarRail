import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { loadOfficialArtwork } from "@lotus-yunzai/account";
import { renderPng } from "@lotus-yunzai/skia";
import { loadImage, type Image, type CanvasRenderingContext2D as Context } from "skia-canvas";
import { registerGachaThemeFont } from "../../packages/skia/gacha-theme-fonts.ts";
import { fill, image, picture, rounded, styles } from "./panel-skia-theme.ts";
import { gridFightStats, type GridFightCard, type GridMember } from "./grid-fight-model.ts";

const width = 834;
const contentWidth = 764;
const gold = "#ecd381";
const muted = "#a8a4a0";
const purple = "#7c8ef3";
const origin = "https://webstatic.mihoyo.com/app/community-game-records/rpg/images/";
const staticArt = {
  heading: ["entry-bg-top.253f0fd5.webp", origin + "entry-bg-top.253f0fd5.png"],
  banner: ["record-header-bg--home.c09dc5c8.png", origin + "record-header-bg--home.c09dc5c8.png"],
  environment: ["gridFight/environment.png", undefined],
  strategy: ["gridFight/strategy-icon-bg-3.b1898bcc.webp", origin + "strategy-icon-bg-3.b1898bcc.png"],
  heart: ["gridFight/heart.webp", undefined],
  coin: ["gridFight/money.png", undefined],
  front: ["gridFight/front.webp", undefined],
  star: ["gridFight/star.png", undefined],
  bronze: ["gridFight/bond_bronze.png", undefined],
  silver: ["gridFight/bond_silver.png", undefined],
  gold: ["gridFight/bond_gold.png", undefined],
  rainbow: ["gridFight/bond_rainbow.png", undefined],
  unique: ["gridFight/bond_unique.png", undefined],
  strategySilver: ["gridFight/strategy_silver.png", undefined],
  strategyGold: ["gridFight/strategy_gold.png", undefined],
} as const;
type StaticArt = keyof typeof staticArt;

const defaultTheme = fileURLToPath(new URL("../../data/starrail/grid-fight-theme/", import.meta.url));
type ArtTransport = NonNullable<Parameters<typeof loadOfficialArtwork>[1]>["transport"];

async function readArtwork(model: GridFightCard, directory: string, signal: AbortSignal, transport?: ArtTransport) {
  const urls = [model.division.background, model.division.icon, model.battle?.division.icon];
  const row = model.battle;
  if (row) {
    const { front, back, traits, portals, augments, damage } = row;
    urls.push(...[...front, ...back].map(item => item.icon));
    if (model.index !== undefined) {
      urls.push(...[...traits, ...portals, ...augments, ...damage.map(hit => hit.entity)].map(item => item.icon),
        ...[...front, ...back].flatMap(role => role.equipment.map(item => item.icon)));
    }
  }
  const local = new Map<StaticArt, Image>();
  for (const name of Object.keys(staticArt) as StaticArt[]) {
    const [path, remote] = staticArt[name];
    const value = await image(join(directory, path));
    if (value) local.set(name, value);
    else if (remote) urls.unshift(remote);
  }
  const byUrl = new Map<string, Image>();
  const sources = [...new Set(urls.filter((url): url is string => Boolean(url)))];
  for (let start = 0; start < sources.length; start += 24) {
    const bytes = await loadOfficialArtwork(sources.slice(start, start + 24), { signal, transport });
    await Promise.all([...bytes].map(async ([url, data]) => {
      const decoded = await loadImage(Buffer.from(data)).catch(() => undefined);
      if (decoded) byUrl.set(url, decoded);
    }));
  }
  return {
    fixed: (name: StaticArt) => local.get(name) ?? byUrl.get(staticArt[name][1] ?? ""),
    get: (url?: string) => url ? byUrl.get(url) : undefined,
  };
}

const rarityColors = [
  ["#b3b3b3", "#5c5c5c"], ["#51a55b", "#2f5e35"], ["#4480c4", "#2a4d7d"],
  ["#7f54c0", "#3d3d63"], ["#c59a65", "#894f4a"],
] as const;
const border = "#ffffff24";
const traitBackgrounds = ["bronze", "silver", "gold", "rainbow", "unique"] as const;
const traitBackground = (quality?: number) => traitBackgrounds[quality ?? 0] ?? "bronze";
const strategyBackground = (quality?: number) => quality === 3 ? "strategy" : quality === 2 ? "strategyGold" : "strategySilver";
function patch(ctx: Context, color: string, x: number, y: number, w: number, h: number, r = 8) {
  fill(ctx, color, x, y, w, h, r);
  rounded(ctx, x, y, w, h, r);
  ctx.strokeStyle = border;
  ctx.stroke();
}

const divisionLevel = (level: number | undefined) => level === undefined ? "—" : `A${level}`;

export async function renderGridFight(model: GridFightCard, fontTheme: string, signal: AbortSignal,
  { mode = "auto", directory = Bun.env.LOTUS_STAR_RAIL_GRID_THEME_DIR?.trim() || defaultTheme, transport }:
    { mode?: "auto" | "gpu"; directory?: string; transport?: ArtTransport } = {}) {
  const artworkSignal = AbortSignal.any([signal, AbortSignal.timeout(5_000)]);
  const media = await readArtwork(model, directory, artworkSignal, transport);
  signal.throwIfAborted();
  const metrics = gridFightStats(model);
  const detail = model.index !== undefined;
  const row = model.battle;
  const roleRows = (count: number) => Math.max(1, Math.ceil(count / 8));
  const roleSize = detail ? 105 : 78;
  const track = row ? (roleRows(row.front.length) + roleRows(row.back.length) - 2) * roleSize : 0;
  const contentY = detail ? 290 : 397;
  const recordHeight = row ? (detail ? 528 : 477) + track : 115;
  const groups = row && detail ? [
    { title: "羁绊信息", values: row.traits, kind: "trait", columns: 3 },
    { title: "投资环境", values: row.portals, kind: "environment", columns: 1 },
    { title: "投资策略", values: row.augments, kind: "strategy", columns: 3 },
  ] as const : [];
  const groupRows = (n: number, columns: number) => Math.max(1, Math.ceil(n / columns));
  const extras = groups.reduce((sum, group) => sum + 69 + groupRows(group.values.length, group.columns) * 80, 0);
  const hitHeight = 120;
  const hitsHeight = row && detail && row.damage.length ? 45 + row.damage.length * hitHeight : 0;
  const footer = contentY + recordHeight + extras + hitsHeight + 16;
  const height = footer + 62;
  const density = 4;
  let face = '"Noto Sans CJK SC", serif';
  for (const path of [join(directory, "../common/font/SR.ttf"), join(fontTheme, "common/font/SR.ttf")]) {
    try {
      face = registerGachaThemeFont("StarRailGridFight", path) + ", " + face;
      break;
    } catch {}
  }
  const font = { body: face, title: face };
  return renderPng(width * density, height * density, ctx => {
    ctx.scale(density, density);
    const text = styles(ctx, font);
    fill(ctx, "#0c1220", 0, 0, width, height);
    ctx.save();
    rounded(ctx, 20, 30, 784, 250, 4);
    ctx.clip();
    picture(ctx, media.fixed("heading"), 20, 30, 784, 250, "cover", .5, 0);
    ctx.restore();
    text(detail ? "货币战争·战绩回顾" : "货币战争", width / 2, 69, 28, gold, "center");
    text(`uid ${model.uid}`, width / 2, 104, 14, "#bba86a", "center");
    patch(ctx, "#0b0c1180", 50, 122, 724, 104, 10);
    metrics.header.forEach(([label, value], i) => {
      const x = 50 + (i + .5) * 241.3;
      text(value, x, 161, 24, "#fdfdfd", "center");
      text(label, x, 204, 18, "#cacaca", "center");
    });
    picture(ctx, media.get(model.division.background ?? model.division.icon), 550, 142, 40, 40);
    text(divisionLevel(model.division.level), 610, 161, 13, purple, "center");
    text(model.division.name, 630, 161, 16, "#fff", "left", false, false, 124);
    text("职级", 653, 204, 18, "#cacaca", "center");

    if (!detail) {
      patch(ctx, "#ffffff0d", 30, 300, contentWidth, 77, 10);
      metrics.progress.forEach(([label, value], i) => {
        const x = 30 + (i + .5) * contentWidth / 3;
        text(label, x, 320, 14, muted, "center");
        text(value, x, 347, 20, "#fdfdfd", "center", true);
      });
    }
    patch(ctx, "#0005", 30, contentY, contentWidth, recordHeight, 8);
    text(detail ? `挑战记录 ${model.index} / ${model.historyCount}` : "最新通关战绩",
      detail ? width / 2 : 50, contentY + 26, 20, gold, detail ? "center" : "left", true);
    function drawMember(role: GridMember, x: number, y: number, details: boolean) {
      const pair = rarityColors[Math.max(0, Math.min(4, (role.rarity ?? 1) - 1))] ?? rarityColors[0];
      const gradient = ctx.createLinearGradient(x, y, x, y + 72);
      gradient.addColorStop(0, pair[0]);
      gradient.addColorStop(1, pair[1]);
      ctx.save();
      rounded(ctx, x, y, 72, 72, 4);
      ctx.clip();
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, 72, 72);
      const avatar = media.get(role.icon);
      picture(ctx, avatar, x, y, 72, 72, "cover");
      if (!avatar) text(role.name ?? "角色", x + 36, y + 36, 12, "#fff", "center", false, false, 66);
      if (role.trial) {
        fill(ctx, "#f65d64", x, y, 28, 18);
        text("试用", x + 14, y + 9, 12, "#fff", "center");
      }
      for (let star = 0; star < (role.stars ?? 0); star++) {
        const starArt = media.fixed("star");
        const sx = x + 2 + star * 8;
        if (starArt) picture(ctx, starArt, sx, y + 61, 9, 9);
        else text("★", sx, y + 65, 9, gold);
      }
      fill(ctx, pair[0], x, y + 69, 72, 3);
      ctx.restore();
      if (details) role.equipment.forEach((equip, j) => {
        const ex = x + j * 24;
        fill(ctx, "#131522", ex, y + 74, 22, 22, 4);
        const eq = media.get(equip.icon);
        picture(ctx, eq, ex + 1, y + 75, 20, 20);
        if (!eq && equip.name) text(equip.name.slice(0, 2), ex + 11, y + 85, 9, muted, "center", false, false, 18);
      });
    }
    if (!row) {
      text("暂无通关战绩", width / 2, contentY + 80, 16, muted, "center");
    } else {
      const barY = contentY + 45;
      const bar = media.fixed("banner");
      ctx.save();
      rounded(ctx, 40, barY, 744, 60, 4);
      ctx.clip();
      if (bar) picture(ctx, bar, 40, barY, 744, 60, "cover");
      else fill(ctx, "#202943", 40, barY, 744, 60, 4);
      ctx.restore();
      text(divisionLevel(row.division.level), 61, barY + 20, 12, purple);
      picture(ctx, media.get(row.division.icon), 93, barY + 8, 26, 26);
      text(row.division.name, 128, barY + 20, 14, "#fff", "left", false, false, 230);
      text(row.mode, 367, barY + 20, 13, purple);
      text(row.time, 61, barY + 44, 12, muted);
      text(row.rank, 762, barY + 30, 32, gold, "right", true);
      const records = [["小队生命值", row.health, "heart"], ["总经济", row.coin, "coin"], ["阵容价值", row.value, "coin"]] as const;
      records.forEach(([label, value, icon], index) => {
        const x = 50 + index * 245;
        patch(ctx, "#ffffff08", x, barY + 80, 232, 52);
        picture(ctx, media.fixed(icon), x + 15, barY + 88, 32, 32);
        text(label, x + 57, barY + 93, 13, muted);
        text(value ?? "—", x + 57, barY + 112, 18, index ? gold : "#fff", "left", true);
      });
      let baseline = barY + 158;
      for (const [label, roles] of [["前台", row.front], ["后台", row.back]] as const) {
        picture(ctx, media.fixed("front"), 50, baseline + 2, 12, 22);
        text(label, 68, baseline + 14, 15, "#fff", "left", true);
        if (!roles.length) text("暂无角色", 50, baseline + 60, 14, muted);
        roles.forEach((role, i) =>
          drawMember(role, 50 + i % 8 * 80, baseline + 29 + Math.floor(i / 8) * roleSize, detail));
        baseline += roleRows(roles.length) * roleSize + 39;
      }

      let top = contentY + recordHeight + 10;
      for (const { title, values, kind, columns } of groups) {
        const h = 59 + groupRows(values.length, columns) * 80;
        patch(ctx, "#0005", 30, top, contentWidth, h);
        text(title, 50, top + 22, 18, gold, "left", true);
        if (!values.length) text("暂无记录", 49, top + 70, 14, muted);
        values.forEach((value, i) => {
          const tileW = columns === 1 ? 720 : 222;
          const x = 50 + i % columns * 245, y = top + 54 + Math.floor(i / columns) * 80;
          const background = kind === "trait" ? traitBackground(value.quality)
            : kind === "environment" ? "environment" : strategyBackground(value.quality);
          fill(ctx, "#ffffff0d", x, y, tileW, 68, 5);
          picture(ctx, media.fixed(background), x + 6, y + 10, 48, 48);
          picture(ctx, media.get(value.icon), x + 12, y + 16, 36, 36);
          text(value.name ?? "未提供名称", x + 64, y + 34, 15, "#fff", "left", false, false, tileW - 70);
          if (value.count !== undefined) {
            fill(ctx, "#121212", x + 42, y + 41, 17, 17, 7);
            text(value.count, x + 50.5, y + 50, 11, "#fff", "center");
          }
        });
        top += h + 10;
      }
      if (hitsHeight) {
        patch(ctx, "#0005", 30, top, contentWidth, hitsHeight);
        text("伤害统计", 50, top + 23, 18, gold, "left", true);
        row.damage.forEach(({ entity, kind, ratio, label }, index) => {
          const y = top + 46 + index * hitHeight;
          if ("equipment" in entity) drawMember(entity, 50, y, true);
          else {
            const quality = "quality" in entity ? entity.quality : undefined;
            const background = kind === "strategy" ? strategyBackground(quality) : kind === "trait" ? traitBackground(quality) : undefined;
            if (background) picture(ctx, media.fixed(background), 52, y, 64, 64);
            picture(ctx, media.get(entity.icon), 60, y + 8, 48, 48);
            if ("count" in entity && entity.count !== undefined) {
              fill(ctx, "#121212", 102, y + 53, 17, 17, 7);
              text(entity.count, 110.5, y + 62, 11, "#fff", "center");
            }
          }
          text(label, 145, y + 36, 16, gold);
          text(entity.name, 757, y + 36, 13, muted, "right", false, false, 160);
          const gradient = ctx.createLinearGradient(145, y + 57, 765, y + 57);
          gradient.addColorStop(0, "#ecd38166");
          gradient.addColorStop(1, gold);
          ctx.fillStyle = gradient;
          rounded(ctx, 145, y + 57, 620 * ratio, 8, 4);
          if (ratio) ctx.fill();
        });
      }
    }
    if (!detail && model.historyCount > 0) text(`可查询 ${model.historyCount} 条战绩 · *币战战报1`, width / 2, footer + 9, 14, muted, "center");
    text("Lotus-Yunzai · 米游社战绩", width / 2, footer + 37, 17, gold, "center");
  }, mode);
}
