import { Canvas, type CanvasRenderingContext2D as Context, type Image } from "skia-canvas";
import { renderPng } from "@lotus-yunzai/skia";
import { fill, image, picture, relicPortrait, rounded, soulColors, styles, themeArt, typography } from "./panel-skia-theme.ts";
import type { makePanelRelicCard, makePanelRelicListCard } from "./panel-card.ts";

type ListModel = Awaited<ReturnType<typeof makePanelRelicListCard>>;
type MarkModel = NonNullable<Awaited<ReturnType<typeof makePanelRelicCard>>>;
type Renderer = "auto" | "gpu";
type Part = ListModel["artis"][number];
type MarkPart = Pick<Part, "mark" | "markClass" | "main" | "attrs" | "name" | "img" | "ignoreMain" | "pMax" | "mainFactor"> & {
  readonly level: string | number;
};
type Style = ReturnType<typeof styles>;
const density = 4;
const pale = "#d3bc8e", gold = "#ffe699", white = "#fff";
const alternate = ["#0006", "#32323266"] as const;
const elementNames: Readonly<Record<string, string>> = { 风: "anemo", 雷: "electro", 冰: "cryo", 火: "pyro", 虚数: "geo", 量子: "quantum", 物理: "sr" };
const markColors: Readonly<Record<string, string>> = { MAX: "#e85656", ACE: "#e85656", SSS: gold, SS: gold, S: "#d699ff", A: "#d699ff" };
const points = 46.6 / 6 / 100;
const fmtMark = (value: number) => value > 0 ? (46.6 * value / 100).toFixed(1) : "—";

async function themeAssets(theme: string, element: string) {
  const name = Object.hasOwn(elementNames, element) ? elementNames[element] : "sr";
  const [bg, texture, ...rolls] = await Promise.all([
    themeArt(theme, `common/bg/bg-${name}.webp`), themeArt(theme, "common/cont/card-bg.png"),
    ...[0, 1, 2].map(i => themeArt(theme, `character/imgs/up-num-icon${i}.png`)),
  ]);
  return { bg, texture, rolls };
}

function box(ctx: Context, texture: Image | undefined, x: number, y: number, w: number, h: number) {
  ctx.save();
  rounded(ctx, x, y, w, h, 10);
  ctx.clip();
  if (texture) {
    const imageW = h * texture.width / texture.height;
    for (let left = x; left < x + w; left += imageW) ctx.drawImage(texture, left, y, imageW, h);
  } else fill(ctx, "#283e50", x, y, w, h);
}

function closeBox(ctx: Context, x: number, y: number, w: number, h: number) {
  ctx.restore();
  rounded(ctx, x, y, w, h, 10);
  ctx.strokeStyle = "#fff5";
  ctx.stroke();
}

function drawPart(ctx: Context, text: Style, assets: Awaited<ReturnType<typeof themeAssets>>, part: Part | MarkPart,
  art: Image | undefined, side: Image | undefined, titles: Record<string, string>, weights: Record<string, number>,
  x: number, y: number, w: number, h: number, slot?: number, configuredMax?: number) {
  box(ctx, assets.texture, x, y, w, h);
  const heading = ctx.createLinearGradient(x, y, x + w, y);
  heading.addColorStop(0, "#000b");
  heading.addColorStop(.25, "#000b");
  heading.addColorStop(.5, "#1919194d");
  heading.addColorStop(.75, "#19191900");
  ctx.fillStyle = heading;
  ctx.fillRect(x, y, w, 60);
  const detailed = slot !== undefined && "level" in part;
  const iconWidth = detailed ? 90 : 75;
  ctx.restore();
  relicPortrait(ctx, art, x + w - iconWidth - (detailed ? 0 : 10), y - 12, iconWidth, density);
  ctx.save();
  rounded(ctx, x, y, w, h, 10);
  ctx.clip();
  if (side) {
    ctx.save();
    rounded(ctx, x + w - 38, y + 24, 38, 38, 19);
    ctx.clip();
    picture(ctx, side, x + w - 38, y + 24, 38, 38, "cover");
    ctx.restore();
  }
  text(part.name, x + 15, y + 25, 15, white, "left", true, false, w - 23);
  text(`${part.mark}分 - ${part.markClass}`, x + 15, y + 45, 14, markColors[part.markClass] ?? white, "left", true);
  if (detailed && part.level !== "") {
    fill(ctx, "#000c", x + w - 34, y + 38, 27, 18, 4);
    text("+" + part.level, x + w - 20.5, y + 47, 12, white, "center");
  }
  const entries = [part.main, ...part.attrs];
  entries.forEach((stat, i) => {
    const top = y + 60 + i * 26;
    const value = stat.value.startsWith("+") ? stat.value : "+" + stat.value;
    const weight = weights[stat.key] ?? 0;
    const color = i === 0 ? white : weight >= 80 ? gold : weight ? white : "#888";
    fill(ctx, i ? alternate[i % 2]! : "#19191980", x, top, w, 26);
    if (i && stat.eff && stat.eff !== "-") {
      fill(ctx, "#0008", x + 3, top + 4, 23, 18, 4);
      text(stat.eff, x + 14.5, top + 13, 12, color, "center");
    }
    text(titles[stat.key] || stat.key, x + (i ? 30 : 9), top + 13, 14, color, "left", !i, false, detailed ? 71 : 86);
    const roll = assets.rolls[weight <= 0 ? 0 : weight >= 80 ? 2 : 1];
    if (!detailed && i && roll && stat.upNum && stat.upNum >= 2 && stat.upNum <= 6) {
      const band = roll.height / 5;
      ctx.drawImage(roll, 0, (6 - stat.upNum) * band, roll.width, band, x + 91, top + 9, roll.width / band * 8, 8);
    }
    text(value, x + w - (detailed ? 55 : 10), top + 13, 14, weight || !i ? white : "#888", "right", !i);
    if (detailed) {
      fill(ctx, "#0006", x + w - 48, top, 48, 26);
      const score = i ? (points * stat._mark).toFixed(1) + "分" :
        part.ignoreMain || slot <= 2 ? "不计分" : fmtMark(stat.mark / 6) + "分";
      text(score, x + w - 6, top + 13, 12, white, "right");
    }
  });
  if (detailed) {
    const top = y + h - 84;
    const max = part.pMax || configuredMax;
    fill(ctx, "#0005", x, top, w, 54);
    [
      ["总分对齐", max ? `×${(66 / (points * max) * 100).toFixed(1)}%` : "—"],
      ["最优主词缀", part.ignoreMain || slot <= 2 ? "—" : `×${(part.mainFactor * 100).toFixed(0)}%`],
      ["最终得分", `${part.mark}分`],
    ].forEach(([label, val], i) => {
      if (i === 2) fill(ctx, "#000a", x, top + 54, w, 30);
      text(label, x + 30, top + 14 + i * 27, 14);
      text(val, x + w - 7, top + 14 + i * 27, i === 2 ? 18 : 14, white, "right");
    });
  }
  closeBox(ctx, x, y, w, h);
}

export async function renderStarRailRelicList(model: ListModel, theme: string, mode: Renderer = "auto") {
  const font = typography(theme);
  const [assets, pictures] = await Promise.all([
    themeAssets(theme, "物理"),
    Promise.all(model.artis.map(async part => ({ relic: await image(part.img), side: await image(part.side) }))),
  ]);
  const width = 790, height = 103 + 200 * Math.ceil(model.artis.length / 4);
  return renderPng(width * density, height * density, ctx => {
    ctx.scale(density, density);
    const text = styles(ctx, font);
    fill(ctx, "#242e45", 0, 0, width, height);
    picture(ctx, assets.bg, 0, 0, width, height, "cover", 0, 0);
    text(`UID ${model.uid}`, 780, 31, 18, white, "right");
    model.artis.forEach((part, i) => drawPart(ctx, text, assets, part, pictures[i]?.relic, pictures[i]?.side, model.artisKeyTitle, part.charWeight,
      10 + i % 4 * 195, 56 + Math.floor(i / 4) * 200, 185, 190));
    text(model.cardBrand, width / 2, height - 18, 14, white, "center");
  }, mode, { allowHalfScale: true });
}

const ruleNotes = [
  "每个角色有不同的词条评分权重（已隐藏权重为0的词条），后续会逐步扩充不同流派的规则",
  "以权重值100的单词条理论最高分46.6分为基准，根据权重值及当前词条成长计算每点得分",
  "词条得分：词条数值 × 当前词条每点得分。小攻击、小防御、小生命折算为对应百分比词条进行计分",
  "原始总分（对齐前）：计算所有副词条的评分之和，躯干、脚部、位面球和连结绳附加25%的主词条评分",
];
const positionNotes = [
  "总分对齐比例：根据角色不同遗器位置可选词条及评分，计算理论最高原始词条总分。为使不同角色不同位置最终总分对齐，规定遗器满分为66分。理论总分对齐比例 = 66 / 理论最高原始分 × 100%",
  "最优主词缀比例：对主词条词缀非最优的遗器进行评分惩罚。若装备的遗器主词条不是当前位置的最高权重主词条或元素属性不符，则依据权重差值比例进行分数扣减，最多扣减50%。主词缀为充能时不进行扣减",
  "最终得分：遗器最终得分 = 原始总分 × 总分对齐比例 × 最优主词缀比例",
  "得分级别：MAX(>56分) / ACE(>49分) / SSS(>42分) / SS(>35分) / S(>28分) / A / B / C / D",
];
const guidance = [
  "遗器评分的目标是对角色遗器词条进行一个快速的评估，一般来说评分更高的遗器可能会更匹配角色",
  "但实际情况下遗器各词条的提升并非线性，且需考虑各词条平衡，故评分仅供参考，请勿过分追求高评分",
  "各角色有各自的词条权重，反映对不同属性的需求。",
  "分数适合在同一角色内对比装备。",
];

export async function renderStarRailRelicMark(model: MarkModel, theme: string, mode: Renderer = "auto") {
  const { charCfg, artisDetail: ranking, data } = model;
  const parts = Object.entries(ranking.artis) as [string, MarkPart][];
  const font = typography(theme);
  const [assets, hero, relics] = await Promise.all([
    themeAssets(theme, model.element), image(model.splash), Promise.all(parts.map(([,part]) => image(part.img))),
  ]);
  const measure = new Canvas(1, 1).getContext("2d");
  measure.font = `12px ${font.body}`;
  function wrap(note: string) {
    const lines: string[] = [];
    let current = "";
    for (const glyph of note) {
      if (current && measure.measureText(current + glyph).width > 585) { lines.push(current); current = ""; }
      current += glyph;
    }
    if (current) lines.push(current);
    return lines;
  }
  function section(title: string, header: string[], rows: string[][], notes: string[]) {
    const paragraphs = notes.map(wrap);
    return { title, header, rows, paragraphs,
      height: 40 + (header.length ? 35 : 0) + rows.length * 27 + 15 + paragraphs.flat().length * 17 + paragraphs.length * 3 };
  }
  const weightRows = Object.entries(model.attrMap).flatMap(([key, attr]) => {
    const config = charCfg.attrs[key];
    if (attr.type === "plus" || !config?.weight) return [];
    return [[attr.title, String(config.weight), attr.text, config.mark > 0 ? (points * config.mark).toFixed(2) : "—",
      attr.title === "治疗加成" ? "—" : fmtMark(config.weight), fmtMark(config.weight / 3)]];
  });
  const slots = ["1", "2", "3", "4", "5", "6"];
  const sections = [
    section(`${data.name}评分规则: ${charCfg.classTitle}`, ["属性", "评分权重", "词条成长", "每点得分", "副词条最高分", "主词条最高分"], weightRows, ruleNotes),
    section("遗器评分计算", ["位置", "帽子", "手套", "衣服", "靴子", "球", "绳"], [
      ["最高分(对齐前)", ...slots.map(slot => fmtMark((charCfg.posMaxMark[slot] ?? 0) / 6))],
      ["总分对齐比例", ...slots.map(slot => charCfg.posMaxMark[slot] ? `${(66 / (points * charCfg.posMaxMark[slot]!) * 100).toFixed(1)}%` : "—")],
      ["最优主词缀权重", ...slots.map((slot,i) => i < 2 ? "—" : String(charCfg.posMaxMark["m" + slot] ?? "—"))],
    ], positionNotes),
    section("遗器评分补充说明", [], [], guidance),
  ];
  const width = 660;
  const firstSection = 255 + Math.max(280, Math.ceil(parts.length / 3) * 284 + 10) + 5;
  const height = firstSection + sections.reduce((sum, current) => sum + current.height + 5, 0) + 32;
  return renderPng(width * density, height * density, ctx => {
    ctx.scale(density, density);
    const text = styles(ctx, font);
    fill(ctx, "#242e45", 0, 0, width, height);
    picture(ctx, assets.bg, 0, 0, width, height, "cover", 0, 0);
    picture(ctx, hero, -545, 0, 1400, 520);
    text(data.name, 640, 51, 50, white, "right", false, true, 600);
    fill(ctx, soulColors[Number(data.cons)] ?? soulColors[0], 600, 79, 40, 21, 4);
    text(`${data.cons}魂`, 620, 90, 18, white, "center");
    text(`UID ${model.uid} - Lv.${data.level}`, 594, 90, 18, white, "right");
    const summaryHeight = ranking.incomplete ? 128 : 103;
    box(ctx, assets.texture, 389, 125, 251, summaryHeight);
    fill(ctx, "#0007", 389, 125, 251, summaryHeight);
    text(`评分规则：${charCfg.classTitle}`, 514, 137, 12, white, "center");
    if (ranking.incomplete) text(`${ranking.incomplete} 件遗器的词条资料不全，未计分`, 514, 162, 12, white, "center");
    const scoreTop = 125 + summaryHeight;
    text(ranking.markClass, 452, scoreTop - 49, 30, markColors[ranking.markClass] ?? white, "center", true);
    text(ranking.mark, 577, scoreTop - 49, 30, white, "center", true);
    text("遗器评级", 452, scoreTop - 19, 12, white, "center");
    text("遗器总分", 577, scoreTop - 19, 12, white, "center");
    closeBox(ctx, 389, 125, 251, summaryHeight);
    parts.forEach(([key, part], i) => drawPart(ctx, text, assets, part, relics[i], undefined, model.artisKeyTitle, ranking.charWeight,
      10 + i % 3 * 215, 260 + Math.floor(i / 3) * 284, 205, 279, Number(key), charCfg.posMaxMark[key]));

    let y = firstSection;
    for (const table of sections) {
      const x = 10, w = 635;
      box(ctx, assets.texture, x, y, w, table.height);
      fill(ctx, "#0007", x, y, w, 40);
      text(table.title, x + 20, y + 20, 16, pale);
      let rowY = y + 40;
      function tableRow(cells: string[], h: number, head: boolean, index = 0) {
        const first = table.header.length === 6 ? 127 : 145;
        const remaining = (w - first) / (cells.length - 1);
        fill(ctx, head ? "#0008" : alternate[index % 2]!, x, rowY, w, h);
        cells.forEach((cell, i) => {
          const cellX = x + (i ? first + (i - 1) * remaining : 0), cellWidth = i ? remaining : first;
          ctx.strokeStyle = "#fff3";
          ctx.strokeRect(cellX, rowY, cellWidth, h);
          text(cell, cellX + cellWidth / 2, rowY + h / 2, 14, head || !i ? pale : white, "center", false, false, cellWidth - 4);
        });
        rowY += h;
      }
      if (table.header.length) tableRow(table.header, 35, true);
      table.rows.forEach((row, i) => tableRow(row, 27, false, i));
      fill(ctx, "#0008", x, rowY, w, y + table.height - rowY);
      let lineY = rowY + 16;
      table.paragraphs.forEach(lines => {
        lines.forEach((line, index) => {
          text(index ? line : "• " + line, x + 20, lineY, 12, "#eee");
          lineY += 17;
        });
        lineY += 3;
      });
      closeBox(ctx, x, y, w, table.height);
      y += table.height + 5;
    }
    text(model.cardBrand, width / 2, height - 18, 14, white, "center");
  }, mode, { allowHalfScale: true });
}
