import { type CanvasRenderingContext2D as Context, type Image } from "skia-canvas";
import { renderPng } from "@lotus-yunzai/skia";
import { fill, image, picture, rounded, soulColors, styles, themeArt, typography } from "./panel-skia-theme.ts";
import type { StarRailRosterModel } from "./personal-roster-model.ts";

const density = 4;
const white = "#fff", gold = "#d3bc8e", ink = "#333";
const sourceTint = ["#0000", "#c8c8c859", "#a8ff8559", "#89a8ff59", "#c386ff59", "#ffd48459"];
const skillTint = ["#0000", "#3c3f414c", "#17b83a80", "#1b80d480", "#925aff8c", "#ff241a8c"];
const raisedInk = ["#006cc7", "#333", "#005800", "#333", "#720465", "#b70000"];
const levels = [[0, 1, 1, 2, 3, 4, 5], [0, 1, 1, 1, 2, 2, 3, 3, 3, 4, 5]];

function clip(ctx: Context, x: number, y: number, w: number, h: number, radius: number) {
  ctx.save();
  rounded(ctx, x, y, w, h, radius);
  ctx.clip();
}

function edge(ctx: Context, x: number, y: number, w: number, h: number, radius: number) {
  rounded(ctx, x, y, w, h, radius);
  ctx.strokeStyle = "#ffffff42";
  ctx.stroke();
}

type RowArt = { face?: Image; cone?: Image; sets: (Image | undefined)[] };

async function rowArt(rows: StarRailRosterModel["rows"]) {
  return Promise.all(rows.map(async row => {
    const [face, cone, sets] = await Promise.all([image(row.face), image(row.cone?.image), Promise.all(row.sets.map(image))]);
    return { face, cone, sets };
  }));
}

async function renderRosterPage(model: StarRailRosterModel, rows: StarRailRosterModel["rows"], theme: string,
  mode: "auto" | "gpu") {
  const [background, banner, portrait, relicIcon, stars, avatars] = await Promise.all([
    themeArt(theme, "common/bg/bg-sr.webp"), image(model.banner), image(model.face),
    themeArt(theme, "common/item/artifact-icon.webp"),
    Promise.all([1, 2, 3, 4, 5].map(star => themeArt(theme, `common/item/bg${star}.png`))), rowArt(rows),
  ]);
  const font = typography(theme);
  const width = 740, contentW = 710, left = 15;
  const columns = 6, gridPitch = 115, rowPitch = 197.5, cardW = 105, cardH = 187.5;
  const gridY = 161, footerY = gridY + Math.ceil(rows.length / columns) * rowPitch + 16;
  const height = Math.ceil(footerY + 82);
  return renderPng(width * density, height * density, ctx => {
    ctx.scale(density, density);
    const text = styles(ctx, font);
    fill(ctx, "#242e45", 0, 0, width, height);
    picture(ctx, background, 0, 0, width, height, "cover", 0, 0);
    clip(ctx, left, 25, contentW, 90, 45);
    fill(ctx, "#f0ece4", left, 25, contentW, 90);
    if (banner) ctx.drawImage(banner, left + contentW - banner.width * 90 / banner.height, 25, banner.width * 90 / banner.height, 90);
    clip(ctx, 26, 36, 70, 70, 35);
    fill(ctx, white, 26, 36, 70, 70);
    clip(ctx, 29, 39, 64, 64, 32);
    picture(ctx, stars[4], 29, 39, 64, 64, "cover");
    picture(ctx, portrait, 29, 39, 64, 64);
    ctx.restore();
    ctx.restore();
    const stats = model.stats.filter(([, value]) => Boolean(value));
    const badges = stats.length ? 70 * stats.length + (stats.length > 1 ? 20 : 10) : 0;
    const badgeX = left + contentW - badges - 16;
    const maxName = Math.max(95, badgeX - 118);
    text(model.nickname, 111, 60, 24, "#414e64", "left", true, false, maxName - 52);
    if (model.level && model.level > 1) {
      ctx.font = `bold 24px ${font.body}`;
      const gap = Math.min(maxName - 52, ctx.measureText(model.nickname).width) + 8;
      text("Lv." + model.level, 111 + gap, 61, 17, "#414e64");
    }
    text([`#${model.uid}`, model.active].filter(Boolean).join("  "), 111, 86, 16, "#414e64", "left", false, false, maxName);
    if (stats.length) {
      clip(ctx, badgeX, 41, badges, 58, 29);
      let x = badgeX;
      stats.forEach(([label, value], i) => {
        const size = stats.length === 1 || i === 0 || i === stats.length - 1 ? 80 : 70;
        fill(ctx, i % 2 ? "#dcdcdc80" : "#ffffffa6", x, 41, size, 58);
        text(value, x + size / 2, 61, 22, "#222", "center", true);
        text(label, x + size / 2, 84, 14, "#414e64", "center");
        x += size;
      });
      ctx.restore();
    }
    ctx.restore();

    clip(ctx, left, 125, contentW, footerY + 35 - 125, 10);
    fill(ctx, "#0008", left, 125, contentW, footerY + 35 - 125);
    fill(ctx, "#0005", left, 125, contentW, 36);
    text("角色列表", left + 15, 144, 16, gold);
    rows.forEach((row, i) => {
      const art: RowArt = avatars[i]!;
      const x = left + 13 + i % columns * gridPitch, y = gridY + 13 + Math.floor(i / columns) * rowPitch;
      clip(ctx, x, y, cardW, cardH, 10.5);
      fill(ctx, "#e7e5d9", x, y, cardW, cardH);
      picture(ctx, stars[(row.rarity === 4 ? 4 : 5) - 1], x, y, cardW, 105, "cover");
      picture(ctx, art.face, x, y, cardW, 105, "contain", .5, 1);
      if (row.rank) {
        fill(ctx, soulColors[row.rank] ?? soulColors[0], x + 81, y, 24, 24, 4);
        text(row.rank, x + 93, y + 12, 16, white, "center");
      }
      fill(ctx, "#0009", x, y + 77, cardW, 28);
      text("Lv", x + 5, y + 94, 12);
      text(row.level, x + 17, y + 93, 16);
      text(row.label, x + 43, y + 93, Math.max(12, Math.min(16, 48 / row.label.length)), white, "left", false, false, 59);
      if (row.skills[0]?.level) {
        row.skills.slice(0, 3).forEach((skill, i) => {
          if (!skill.level) return;
          const crown = skill.original === 10;
          const raised = skill.original !== undefined && skill.level > skill.original;
          fill(ctx, crown ? gold : "#ffffff95", x + 10 + 29 * i, y + 110, 25, 24, 4);
          text(skill.level, x + 22.5 + 29 * i, y + 122, 16, crown ? "#3a2702" : raised ? "#0284b9" : ink,
            "center", raised);
        });
      } else text("暂无天赋数据", x + 52.5, y + 120, 13, "#7778", "center");
      const gearY = y + 136.5;
      if (row.cone) {
        clip(ctx, x + 4.5, gearY, 46.5, 46.5, 4.5);
        picture(ctx, stars[(row.cone.rarity ?? 1) - 1], x + 4.5, gearY, 46.5, 46.5, "cover");
        picture(ctx, art.cone, x + 4.5, gearY, 46.5, 46.5);
        if (row.cone.rank) {
          fill(ctx, soulColors[row.cone.rank > 4 ? 6 : row.cone.rank] ?? soulColors[0], x + 33, gearY + 28, 18, 19, 4);
          text(row.cone.rank, x + 42, gearY + 37, 13, white, "center");
        }
        ctx.restore();
      } else fill(ctx, "#6f777849", x + 4.5, gearY, 46.5, 46.5, 4.5);
      fill(ctx, "#0005", x + 54, gearY, 46.5, 46.5, 4.5);
      if (!art.sets.length) picture(ctx, relicIcon, x + 59, gearY + 5, 36.5, 36.5);
      art.sets.forEach((icon, i) => {
        const size = art.sets.length > 2 ? 22 : art.sets.length === 2 ? 33 : 46.5;
        const step = art.sets.length > 2 ? 22 : 13;
        picture(ctx, icon, x + 54 + (i % 2) * step, gearY + (art.sets.length > 2 ? Math.floor(i / 2) * step : i * step), size, size);
      });
      ctx.restore();
    });
    text(`数据更新时间  米游社：${model.time}`, left + contentW - 15, footerY + 18, 12, gold, "right");
    ctx.restore();
    edge(ctx, left, 125, contentW, footerY + 35 - 125, 10);
    text("Lotus-Yunzai · StarRail", width / 2, height - 18, 14, white, "center");
  }, mode, { allowHalfScale: true });
}

async function renderTalentPage(model: StarRailRosterModel, rows: StarRailRosterModel["rows"], start: number, theme: string,
  mode: "auto" | "gpu") {
  const [background, foreground, crown, avatars] = await Promise.all([
    themeArt(theme, "character/imgs/bg-02.jpg"), themeArt(theme, "character/imgs/main-02.png"),
    themeArt(theme, "common/item/crown-sr-o.png"), rowArt(rows),
  ]);
  const font = typography(theme);
  const width = 600, tableX = 10, tableY = 107, tableW = 575, rowH = 36;
  const fontSizes = [14, 14, 14, 14, 14, 14, 14, 14, 13, 13];
  const headers = ["#", "角色", "Lv", "星魂", "A", "E", "Q", "T", "周本", "天赋书"];
  const cols = [30, 100, 35, 40, 35, 35, 35, 35, 61, 169];
  const begins = cols.map((_, i) => tableX + cols.slice(0, i).reduce((a, b) => a + b, 0));
  const footerY = tableY + rowH * (rows.length + 1), footerH = 60, height = footerY + footerH + 47;
  return renderPng(width * density, height * density, ctx => {
    ctx.scale(density, density);
    const text = styles(ctx, font);
    fill(ctx, "#323047", 0, 0, width, height);
    if (background) {
      const backgroundH = width * background.height / background.width;
      const y0 = (height % backgroundH - backgroundH) / 2;
      for (let y = y0; y < height; y += backgroundH) ctx.drawImage(background, 0, y, width, backgroundH);
    }
    if (foreground) ctx.drawImage(foreground, 0, -25, width, width * foreground.height / foreground.width);
    ctx.save();
    ctx.shadowColor = "#000d";
    ctx.shadowBlur = 3;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    text("*面板练度统计", 35, 51, 36, white, "left", false, true);
    text(`UID:${model.uid} 共${model.rows.length}名角色`, 35, 82, 16);
    ctx.restore();

    clip(ctx, tableX, tableY, tableW, footerY - tableY + footerH, 10);
    fill(ctx, "#0008", tableX, tableY, tableW, rowH);
    headers.forEach((label, i) => {
      const x = begins[i]!, w = cols[i]!;
      ctx.strokeStyle = "#fff3";
      ctx.strokeRect(x, tableY, w, rowH);
      text(label, x + w / 2, tableY + 18, fontSizes[i]!, gold, "center", true);
    });
    rows.forEach((row, index) => {
      const y = tableY + rowH * (index + 1);
      fill(ctx, index % 2 ? white : "#f0f0f0", tableX, y, tableW, rowH);
      fill(ctx, sourceTint[row.rarity ?? 0] ?? "#0000", tableX, y, cols[0]! + cols[1]!, rowH);
      text(start + index + 1, 25, y + 18, 14, ink, "center");
      picture(ctx, avatars[index]?.face, 43, y + 3, 30, 30);
      text(row.label, 79, y + 18, 14, row.rarity === 5 ? "#6f4b00" : row.rarity === 4 ? "#720465" : ink, "left", false, false, 55);
      text(row.level, begins[2]! + cols[2]! / 2, y + 18, 14, ink, "center");
      const soul = begins[3]! + cols[3]! / 2;
      if (row.rank !== undefined) {
        fill(ctx, soulColors[row.rank] ?? soulColors[0], soul - 8, y + 7, 16, 22, 4);
        text(row.rank, soul, y + 18, 13, white, "center");
      }
      row.skills.forEach((skill, i) => {
        const x = begins[i + 4]!, w = cols[i + 4]!, levelClass = levels[i ? 1 : 0]?.[skill.original ?? 1] ?? 0;
        const raised = skill.level !== undefined && skill.original !== undefined && skill.level > skill.original;
        fill(ctx, skillTint[levelClass] ?? "#0000", x, y, w, rowH);
        if (levelClass === 5) picture(ctx, crown, x, y, w, rowH);
        text(skill.level ?? "—", x + w / 2, y + 18, raised ? 15 : 14, raised ? raisedInk[levelClass] : ink, "center", raised);
      });
      if (model.materialWeek === 7) fill(ctx, "#ffe4b480", begins[8]!, y, cols[8]! + cols[9]!, rowH);
      text("- (周-)", begins[9]! + cols[9]! / 2, y + 18, 13, model.materialWeek === 7 ? "#765100" : "#666", "center");
      ctx.strokeStyle = "#6663";
      cols.forEach((w, i) => ctx.strokeRect(begins[i]!, y, w, rowH));
    });
    fill(ctx, "#000b", tableX, footerY, tableW, footerH);
    text(`数据更新时间  米游社：${model.time}`, width / 2, footerY + 17, 13, gold, "center");
    text("查询已登录角色的当前技能。可用 *刷新行迹 更新本人面板。", width / 2, footerY + 38, 12, white, "center");
    ctx.restore();
    edge(ctx, tableX, tableY, tableW, footerY - tableY + footerH, 10);
    text("Lotus-Yunzai · StarRail", width / 2, height - 18, 14, white, "center");
  }, mode, { allowHalfScale: true });
}

export async function renderStarRailPersonalRoster(model: StarRailRosterModel, theme: string, mode: "auto" | "gpu" = "auto", signal?: AbortSignal) {
  const pages = [];
  const limit = model.mode === "roster" ? 24 : 30;
  for (let start = 0; start < model.rows.length; start += limit) {
    signal?.throwIfAborted();
    const rows = model.rows.slice(start, start + limit);
    pages.push(await (model.mode === "roster" ? renderRosterPage(model, rows, theme, mode)
      : renderTalentPage(model, rows, start, theme, mode)));
  }
  return pages;
}
