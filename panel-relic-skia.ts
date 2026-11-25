import { createTranslator as createTextTranslator } from "../../packages/i18n/index.ts";
import messageCatalog from "./i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
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
  text($t("panel-relic-skia.text_37b08c3e12", { "mark": part.mark, "markClass": part.markClass }), x + 15, y + 45, 14, markColors[part.markClass] ?? white, "left", true);
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
      const score = i ? (points * stat._mark).toFixed(1) + $t("panel-relic-skia.text_b6a993c256") :
        part.ignoreMain || slot <= 2 ? $t("panel-relic-skia.text_32b2119768") : fmtMark(stat.mark / 6) + $t("panel-relic-skia.text_b6a993c256");
      text(score, x + w - 6, top + 13, 12, white, "right");
    }
  });
  if (detailed) {
    const top = y + h - 84;
    const max = part.pMax || configuredMax;
    fill(ctx, "#0005", x, top, w, 54);
    [
      [$t("panel-relic-skia.text_d12a6fe4b3"), max ? `×${(66 / (points * max) * 100).toFixed(1)}%` : "—"],
      [$t("panel-relic-skia.text_effce16500"), part.ignoreMain || slot <= 2 ? "—" : `×${(part.mainFactor * 100).toFixed(0)}%`],
      [$t("panel-relic-skia.text_ef9c2aa30c"), $t("panel-relic-skia.text_b0e0ce719c", { "mark": part.mark })],
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
    themeAssets(theme, $t("panel-relic-skia.text_a454f17872")),
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
  $t("panel-relic-skia.text_31edde20d1"),
  $t("panel-relic-skia.text_f5cd572570"),
  $t("panel-relic-skia.text_9f8f4beab3"),
  $t("panel-relic-skia.text_c88fc37867"),
];
const positionNotes = [
  $t("panel-relic-skia.text_b61f46f317"),
  $t("panel-relic-skia.text_8c474c64b4"),
  $t("panel-relic-skia.text_e583d7279c"),
  $t("panel-relic-skia.text_9c26ea5163"),
];
const guidance = [
  $t("panel-relic-skia.text_37039b41d9"),
  $t("panel-relic-skia.text_515f34b527"),
  $t("panel-relic-skia.text_ef4dc9155c"),
  $t("panel-relic-skia.text_5fc9fcf985"),
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
    section($t("panel-relic-skia.text_acf83a0706", { "name": data.name, "classTitle": charCfg.classTitle }), [$t("panel-relic-skia.text_86de52d178"), $t("panel-relic-skia.text_57526346b5"), $t("panel-relic-skia.text_c516c07c73"), $t("panel-relic-skia.text_139bdd3b8d"), $t("panel-relic-skia.text_0b4c47ddbc"), $t("panel-relic-skia.text_15d8868a40")], weightRows, ruleNotes),
    section($t("panel-relic-skia.text_de922572d4"), [$t("panel-relic-skia.text_1fb4d574da"), $t("panel-relic-skia.text_f045b9ca8f"), $t("panel-relic-skia.text_d3db5e5606"), $t("panel-relic-skia.text_3a28422f1f"), $t("panel-relic-skia.text_ee5d390496"), $t("panel-relic-skia.text_12a2aadcf0"), $t("panel-relic-skia.text_231e8863ee")], [
      [$t("panel-relic-skia.text_ed894aabbe"), ...slots.map(slot => fmtMark((charCfg.posMaxMark[slot] ?? 0) / 6))],
      [$t("panel-relic-skia.text_07808af625"), ...slots.map(slot => charCfg.posMaxMark[slot] ? `${(66 / (points * charCfg.posMaxMark[slot]!) * 100).toFixed(1)}%` : "—")],
      [$t("panel-relic-skia.text_78a586e49d"), ...slots.map((slot,i) => i < 2 ? "—" : String(charCfg.posMaxMark["m" + slot] ?? "—"))],
    ], positionNotes),
    section($t("panel-relic-skia.text_3f908191f9"), [], [], guidance),
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
    text($t("panel-relic-skia.text_70593aa83c", { "cons": data.cons }), 620, 90, 18, white, "center");
    text(`UID ${model.uid} - Lv.${data.level}`, 594, 90, 18, white, "right");
    const summaryHeight = ranking.incomplete ? 128 : 103;
    box(ctx, assets.texture, 389, 125, 251, summaryHeight);
    fill(ctx, "#0007", 389, 125, 251, summaryHeight);
    text($t("panel-relic-skia.text_db409bb319", { "classTitle": charCfg.classTitle }), 514, 137, 12, white, "center");
    if (ranking.incomplete) text($t("panel-relic-skia.text_aed20330e7", { "incomplete": ranking.incomplete }), 514, 162, 12, white, "center");
    const scoreTop = 125 + summaryHeight;
    text(ranking.markClass, 452, scoreTop - 49, 30, markColors[ranking.markClass] ?? white, "center", true);
    text(ranking.mark, 577, scoreTop - 49, 30, white, "center", true);
    text($t("panel-relic-skia.text_f8a1198a68"), 452, scoreTop - 19, 12, white, "center");
    text($t("panel-relic-skia.text_562b5ec995"), 577, scoreTop - 19, 12, white, "center");
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
