import { createTranslator as createTextTranslator } from "../../packages/i18n/index.ts";
import messageCatalog from "./i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import { layoutTrialDamageTitles, trialDamageTitleLineHeight } from "../../lib/panel-trial-display.ts";
// Native drawing of the Star Rail profile-detail layout. Geometry and artwork follow
// the fixed MIT Miao reference in panel-theme/character/profile-detail.{html,css}.
import { Canvas, type CanvasRenderingContext2D as Context } from "skia-canvas";
import { fill, image, picture, relicPortrait, rounded, soulColors, styles, themeArt, typography } from "./panel-skia-theme.ts";
import type { makePanelDetailCard } from "./panel-card.ts";
import { formatStarRailDamageChange } from "./panel-damage.ts";
import { renderStarRailCard } from "./render-card.ts";

type Model = Awaited<ReturnType<typeof makePanelDetailCard>>;
const width = 600;
const white = "#fff", gold = "#ffe699", tan = "#d3bc8e";
const dark = "rgba(0,0,0,.4)", darkOdd = "rgba(50,50,50,.4)";
const elementNames: Readonly<Record<string, string>> = { 风: "anemo", 雷: "electro", 冰: "cryo", 火: "pyro", 虚数: "geo", 量子: "quantum", 物理: "sr" };
const attributeLabels = [
  ["hp", $t("panel-detail-skia.text_1a256e6376"), 1], ["atk", $t("panel-detail-skia.text_b84ee11f4f"), 2], ["def", $t("panel-detail-skia.text_1cb579e6ba"), 3], ["speed", $t("panel-detail-skia.text_0e14d148b4"), 10],
  ["cpct", $t("panel-detail-skia.text_d4b0baf955"), 5], ["cdmg", $t("panel-detail-skia.text_15bccc3951"), 6], ["dmg", $t("panel-detail-skia.text_4da2b666c4"), 8], ["stance", $t("panel-detail-skia.text_13d58c9c3a"), 4],
  ["effPct", $t("panel-detail-skia.text_84c7536950"), 11], ["effDef", $t("panel-detail-skia.text_c9a7dcf1f7"), 12], ["heal", $t("panel-detail-skia.text_6f2eca7102"), 9], ["joy", $t("panel-detail-skia.text_cbfad500aa"), 13],
] as const;
// Calculation snapshots retain full precision; the original panel displays short decimal values.
function panelStat(value: string | undefined) {
  if (!value || !/^[+-]?[\d,]+\.\d{3,}%?$/u.test(value)) return value;
  const number = Number(value.replaceAll(",", "").replace(/%$/u, ""));
  if (!Number.isFinite(number)) return value;
  return number.toLocaleString("en-US", { useGrouping: value.includes(","), maximumFractionDigits: 1 }) + (value.endsWith("%") ? "%" : "");
}
const skillNames = { a: $t("panel-detail-skia.text_8b79df27ba"), e: $t("panel-detail-skia.text_6d8c868f52"), t: $t("panel-detail-skia.text_866e2e6d67"), q: $t("panel-detail-skia.text_2f2c7421e9"), me: $t("panel-detail-skia.text_79bd79472f"), mt: $t("panel-detail-skia.text_2df39f9d63"), xe: $t("panel-detail-skia.text_a9613395e7") } as const;
const rankColors: Readonly<Record<string, string>> = { ACE: "#e85656", MAX: "#e85656", SSS: gold, SS: gold, S: "#d699ff", A: "#d699ff" };
const relicShortTitles: Readonly<Record<string, string>> = {
  hp: $t("panel-detail-skia.text_45bc77bc1c"), hpPlus: $t("panel-detail-skia.text_45bc77bc1c"), atk: $t("panel-detail-skia.text_8226ca02ff"), atkPlus: $t("panel-detail-skia.text_8226ca02ff"), def: $t("panel-detail-skia.text_75ba7a5727"), defPlus: $t("panel-detail-skia.text_75ba7a5727"),
  cpct: $t("panel-detail-skia.text_59d499d937"), cdmg: $t("panel-detail-skia.text_c750f692ee"), recharge: $t("panel-detail-skia.text_c0c253c271"), effPct: $t("panel-detail-skia.text_393df9bb13"), effDef: $t("panel-detail-skia.text_0d40173188"), stance: $t("panel-detail-skia.text_092a6b7674"),
};

async function loadArt(model: Model, theme: string) {
  const urls = [
    ...Object.values(model.data.imgs),
    ...model.data.treeData.flatMap(row => Array.isArray(row) ? row.map(node => node.img) : row?.img || []),
    ...model.artisDetail.artis.map(part => part.img), model.data.weapon?.splash,
  ].filter((url): url is string => Boolean(url));
  const files = new Map(await Promise.all([...new Set(urls)].map(async url => [url, await image(url)] as const)));
  const asset = (relative: string) => themeArt(theme, relative);
  const element = Object.hasOwn(elementNames, model.element) ? elementNames[model.element] : "sr";
  const [back, ring, texture, icons, unusedRolls, rolls, activeRolls, hp, atk, def] = await Promise.all([
    asset(`common/bg/bg-${element}.webp`), asset(`common/bg/talent-${element}.webp`), asset("common/cont/card-bg.png"),
    asset("character/imgs/icon-sr.png"), ...[0, 1, 2].map(i => asset(`character/imgs/up-num-icon${i}.png`)), ...["hp", "atk", "def"].map(key => asset(`meta-sr/public/icons/attr-${key}.webp`)),
  ]);
  return { back, ring, texture, icons, rolls: [unusedRolls, rolls, activeRolls], coneIcons: { hp, atk, def }, get: (url: string | undefined) => url ? files.get(url) : undefined };
}

function wrapDescription(ctx: Context, description: NonNullable<Model["data"]["weapon"]>["descriptionParts"]) {
  const lines: { value: string; highlight?: boolean; width: number }[][] = [[]];
  let used = 0;
  function nextLine() { lines.push([]); used = 0; }
  for (const part of description) {
    if (part.line) { nextLine(); continue; }
    const words = part.highlight ? [part.value ?? ""] : [...(part.value ?? "")];
    for (const value of words) {
      const size = ctx.measureText(value).width + (part.highlight ? 10 : 0);
      if (used > 0 && used + size > 365) nextLine();
      lines.at(-1)!.push({ value, highlight: part.highlight, width: size });
      used += size;
    }
  }
  return lines;
}

export async function renderStarRailPanelDetail(model: Model, theme: string, mode: "auto" | "gpu" = "auto", inlineImageByteLimit?: number) {
  const art = await loadArt(model, theme);
  const font = typography(theme);
  const measure = new Canvas(1, 1).getContext("2d");
  measure.font = `12px ${font.body}`;
  const { data, artisDetail, attr, damageRows } = model;
  const { weapon } = data;
  const weaponText = weapon ? wrapDescription(measure, weapon.descriptionParts) : [];
  const weaponHeight = weapon ? Math.max(100, 68 + weaponText.length * 15 + weaponText.filter(line => line.some(part => part.highlight)).length) : 0;
  const relicRows = Math.ceil(artisDetail.artis.length / 3);
  const summaryY = 617 + (weapon ? weaponHeight + 10 : 0);
  const relicY = summaryY + (artisDetail.mark === undefined ? 0 : 113);
  const damageY = relicY + relicRows * 200 + (relicRows ? 10 : 0);
  const damageComparison = damageRows.some(row => row.change !== undefined);
  const damageRowHeight = damageComparison ? 54 : 40;
  const rows = [{ title: $t("panel-detail-skia.text_9b65f38ca8"), critical: $t("panel-detail-skia.text_15bccc3951"), average: $t("panel-detail-skia.text_d5f4617e07"), change: undefined }, ...damageRows];
  measure.font = `15px ${font.body}`;
  const titles = layoutTrialDamageTitles(rows, damageRowHeight, model.trialTitleMode, line => measure.measureText(line).width <= 201);
  const damageHeight = damageRows.length ? 75 + titles.height : 0;
  const height = Math.ceil(damageY + damageHeight + 37);

  return renderStarRailCard(width, height, ctx => {
    const text = styles(ctx, font);
    function box(x: number, y: number, w: number, h: number, tall = false) {
      ctx.save();
      rounded(ctx, x, y, w, h, 10);
      ctx.clip();
      if (art.texture) {
        const imageHeight = h * (tall ? 1.5 : 1);
        const imageWidth = imageHeight * art.texture.width / art.texture.height;
        for (let left = x; left < x + w; left += imageWidth) ctx.drawImage(art.texture, left, y, imageWidth, imageHeight);
      } else fill(ctx, "#233348", x, y, w, h);
    }
    function closeBox(x: number, y: number, w: number, h: number) {
      ctx.restore();
      rounded(ctx, x, y, w, h, 10);
      ctx.strokeStyle = "#ffffff38";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    function icon(url: string | undefined, x: number, y: number, w: number, h = w, active = true) {
      ctx.save();
      if (!active) {
        ctx.globalAlpha = .4;
        ctx.filter = "grayscale(1)";
      }
      picture(ctx, art.ring, x, y, w, h);
      picture(ctx, art.get(url), x + .27 * w, y + .28 * h, .46 * w, .46 * h);
      ctx.restore();
    }
    function relicStat(stat: { key: string; value: string; eff?: string; upNum?: number }, x: number, y: number, w: number,
      main = false, short = false) {
      const weight = artisDetail.charWeight[stat.key] ?? 0;
      const muted = !main && weight <= 0;
      const value = stat.value.startsWith("+") ? stat.value : "+" + stat.value;
      const title = (short && relicShortTitles[stat.key]) || model.artisKeyTitle[stat.key] || stat.key;
      const eff = "eff" in stat && stat.eff && stat.eff !== "-" ? stat.eff : "";
      if (eff) {
        fill(ctx, "#0008", x + 3, y + 4, 23, 18, 4);
        text(eff, x + 14.5, y + 13, 12, muted ? "#999" : weight >= 80 ? gold : white, "center");
      }
      const titleX = x + (short ? 36 : main ? 9 : 30);
      text(title, titleX, y + 13, 14, muted ? "#888" : !main && weight >= 80 ? gold : white, "left", main, false, short ? 55 : 94);
      const rolls = art.rolls[muted ? 0 : weight >= 80 ? 2 : 1];
      if (!short && rolls && stat.upNum && stat.upNum > 1 && stat.upNum <= 6) {
        const row = rolls.height / 5;
        ctx.drawImage(rolls, 0, (6 - stat.upNum) * row, rolls.width, row, x + 91, y + 9, rolls.width / row * 8, 8);
      }
      text(value, x + w - (short ? 5 : 10), y + 13, short ? 13 : 14, muted ? "#888" : white, "right", main);
    }

    fill(ctx, "#242e45", 0, 0, width, height);
    picture(ctx, art.back, 0, 0, width, height, "cover", 0, 0);
    rounded(ctx, 8, 115, 584, 405, 5);
    ctx.strokeStyle = "#ffffff40";
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, 520);
    ctx.clip();
    picture(ctx, art.get(data.imgs.splash), -545, 0, 1400, 520);
    ctx.restore();

    ctx.save();
    ctx.shadowColor = "#000b";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    text(data.name, 580, 51, 50, white, "right", false, true, 545);
    measure.font = `18px ${font.body}`;
    const soul = $t("panel-detail-skia.text_70593aa83c", { "cons": data.cons }), soulWidth = Math.ceil(measure.measureText(soul).width) + 12;
    fill(ctx, soulColors[Number(data.cons)] ?? soulColors[0]!, 580 - soulWidth, 79, soulWidth, 21, 4);
    text(soul, 580 - soulWidth / 2, 90, 18, white, "center");
    text(`UID ${model.uid} - Lv.${data.level}`, 574 - soulWidth, 90, 18, white, "right");
    ctx.restore();

    ctx.save();
    rounded(ctx, 280, 125, 300, 384, 8);
    ctx.clip();
    if (art.get(data.imgs.splash)) {
      ctx.filter = "blur(2px)";
      picture(ctx, art.back, 0, 0, width, height, "cover", 0, 0);
      picture(ctx, art.get(data.imgs.splash), -545, 0, 1400, 520);
      ctx.filter = "none";
    }
    fill(ctx, "#0003", 280, 125, 300, 384);
    attributeLabels.forEach(([key, title, ticker], index) => {
      const y = 125 + index * 32;
      fill(ctx, index % 2 ? dark : darkOdd, 280, y, 300, 32);
      if (art.icons) {
        const tile = art.icons.height;
        ctx.drawImage(art.icons, ticker * tile, 0, tile, tile, 288, y + 8, 16, 16);
      }
      text(title, 309, y + 16, 17);
      const weight = artisDetail.charWeight[key];
      if (weight) {
        fill(ctx, "#0008", 383.5, y + 7, 30, 18, 5);
        text(weight, 398.5, y + 16, 12, weight >= 80 ? gold : white, "center");
      }
      text(panelStat(attr[key]), 502, y + 16, 17, white, "right");
      fill(ctx, "#0003", 512.3, y, 67.7, 32);
      text(panelStat(attr[key + "Base"]), 570, y + 11, 12, attr[key + "Base"] === "0.0%" ? "#bbb9" : "#eee", "right");
      text(panelStat(attr[key + "Plus"]), 570, y + 24, 12, "#90e800", "right");
    });
    ctx.restore();
    const extra = Boolean(data.imgs.consEx);
    for (let i = 1; i <= 6; i++) icon(data.imgs[`cons${i}`], 15 + (i - 1) * 40, extra ? 420 : 465, 50, 50, i <= Number(data.cons));
    if (extra) icon(data.imgs.consEx, 15, 468, 50, 50, data.exCons > 0);
    text([$t("panel-detail-skia.text_f9124d8645", { "dataSource": data.dataSource }), data.updateTime].filter(Boolean).join("  "), 585, 520, 12, "#fffd", "right", false, false, 560);

    const extras = model.hsr_paths === "记忆" ? ["me", "mt"] as const : model.charWeapon === "欢愉" ? ["xe"] as const : [];
    const skills = ["a", "e", "t", "q", ...extras] as const;
    const skillSize = extras.length ? 55 : 60, shift = extras.length === 2 ? 49 : extras.length === 1 ? 59 : 65;
    box(10, 535, 575, 72, true);
    for (const [i, key] of skills.entries()) {
      const x = 17 + i * shift;
      icon(data.imgs[key], x, 543, skillSize);
      text(skillNames[key], x + skillSize / 2, 548, 12, white, "center");
      const level = data.talent[key];
      const center = x + skillSize / 2, pillWidth = extras.length ? 18 : 22, pillHeight = extras.length ? 16 : 20;
      const raised = level?.original !== undefined && level.level > level.original;
      fill(ctx, raised ? "#2e353e" : white, center - pillWidth / 2, extras.length ? 580 : 581, pillWidth, pillHeight, 4);
      text(level?.level, center, extras.length ? 588 : 591, extras.length ? 10 : 13, raised ? "#ffdfa0" : "#111", "center", true);
    }
    let treeX = extras.length === 2 ? 319 : extras.length === 1 ? 313 : 285;
    const treeWide = extras.length === 2 ? 49.67 : extras.length === 1 ? 48 : 59.33;
    for (const node of data.treeData) {
      if (Array.isArray(node)) {
        node.forEach((entry, i) => icon(entry.img, treeX, node.length === 1 ? 556 : 543 + i * 28, 30, node.length === 1 ? 30 : 28, entry.value));
        treeX += 20;
      } else {
        if (node) icon(node.img, treeX + 2, 543, skillSize, skillSize, node.value);
        treeX += treeWide;
      }
    }
    closeBox(10, 535, 575, 72);

    if (weapon) {
      box(10, 617, 575, weaponHeight, true);
      ctx.save();
      ctx.beginPath();
      ctx.rect(10, 617, 185, weaponHeight);
      ctx.clip();
      const cone = art.get(weapon.splash);
      if (cone) {
        const imageHeight = 185 * cone.height / cone.width;
        ctx.drawImage(cone, 10, 617 + (weaponHeight - imageHeight) * .05, 185, imageHeight);
      }
      ctx.restore();
      measure.font = `18px ${font.body}`;
      const labelWidth = Math.min(237, measure.measureText(weapon.name).width);
      text(weapon.name, 210, 638, 18, tan, "left", false, false, 237);
      text($t("panel-detail-skia.text_7853fdc62a", { "level": weapon.level, "affix": weapon.affix }), 216 + labelWidth, 640, 14, white, "left", false, false, 354 - labelWidth);
      let x = 210;
      for (const key of ["hp", "atk", "def"] as const) {
        measure.font = `12px ${font.body}`;
        const value = weapon.attrs[key];
        const w = measure.measureText(value ?? "").width + 29;
        fill(ctx, "#0008", x, 648, w, 22, 4);
        picture(ctx, art.coneIcons[key], x, 648, 22, 22);
        text(value, x + 22, 659, 12, gold);
        x += w + 10;
      }
      weaponText.forEach((line, index) => {
        let x = 210;
        for (const part of line) {
          if (part.highlight) fill(ctx, "#0008", x + 2, 681 + 15 * index, part.width - 4, 16, 4);
          text(part.value, x + (part.highlight ? 5 : 0), 689 + 15 * index, 12, part.highlight ? gold : white);
          x += part.width;
        }
      });
      closeBox(10, 617, 575, weaponHeight);
    }

    if (artisDetail.mark !== undefined) {
      box(10, summaryY, 575, 103);
      fill(ctx, dark, 10, summaryY, 185, 103);
      text($t("panel-detail-skia.text_562b5ec995"), 70, summaryY + 22, 12, "#ddd", "center");
      text($t("panel-detail-skia.text_f8a1198a68"), 153, summaryY + 22, 12, "#ddd", "center");
      text(artisDetail.mark, 70, summaryY + 49, 30, white, "center", true);
      text(artisDetail.markClass, 153, summaryY + 49, 30, rankColors[artisDetail.markClass ?? ""] ?? white, "center", true);
      artisDetail.allAttr.forEach((stat, index) => {
        const y = summaryY + index % 3 * 26, x = 195 + Math.floor(index / 3) * 130;
        fill(ctx, index % 2 ? dark : darkOdd, x, y, 130, 26);
        if (stat) relicStat(stat, x, y, 130, false, true);
      });
      fill(ctx, "#000b", 10, summaryY + 78, 575, 25);
      text($t("panel-detail-skia.text_8f5dcadbfa", { "value1": artisDetail.classTitle ?? "" }), 102.5, summaryY + 91, 11, white, "center");
      text($t("panel-detail-skia.text_ee4b18328a", { "abbr": data.abbr }), 390, summaryY + 91, 10, "#ddd", "center");
      closeBox(10, summaryY, 575, 103);
    }
    artisDetail.artis.forEach((part, index) => {
      const x = 10 + index % 3 * 195, y = relicY + Math.floor(index / 3) * 200 + 5;
      box(x, y, 185, 190);
      const heading = ctx.createLinearGradient(x, y, x + 185, y);
      heading.addColorStop(0, "#000b");
      heading.addColorStop(.25, "#000b");
      heading.addColorStop(.5, "#1919194d");
      heading.addColorStop(.75, "#19191900");
      ctx.fillStyle = heading;
      ctx.fillRect(x, y, 185, 60);
      ctx.restore();
      relicPortrait(ctx, art.get(part.img), x + 95, y - 12, 90, ctx.getTransform().a);
      ctx.save();
      rounded(ctx, x, y, 185, 190, 10);
      ctx.clip();
      text(part.abbr || part.name, x + 15, y + 25, 15, white, "left", true, false, 161);
      if (part.markClass) text($t("panel-detail-skia.text_37b08c3e12", { "mark": part.mark, "markClass": part.markClass }), x + 15, y + 45, 14, rankColors[part.markClass] ?? white, "left", true);
      fill(ctx, "#000c", x + 151, y + 38, 27, 18, 4);
      if (part.level !== "") text("+" + part.level, x + 164.5, y + 47, 12, white, "center");
      [part.main, ...part.attrs].forEach((stat, i) => {
        const top = y + 60 + i * 26;
        if (i >= 5) return;
        fill(ctx, i === 0 ? "#19191980" : i % 2 ? dark : darkOdd, x, top, 185, 26);
        if (stat) relicStat(stat, x, top, 185, i === 0);
      });
      closeBox(x, y, 185, 190);
    });

    if (damageHeight) {
      box(10, damageY, 575, damageHeight);
      fill(ctx, dark, 10, damageY, 575, 40);
      text($t("panel-detail-skia.text_393374d45e"), 30, damageY + 20, 16, tan);
      text(damageComparison ? $t("panel-detail-skia.text_287d1f01f4") : $t("panel-detail-skia.text_103a85f2c7", { "abbr": data.abbr }), 109, damageY + 20, 12, "#bbb");
      rows.forEach((row, index) => {
        const { lines, top, height: rowHeight } = titles.rows[index]!;
        const y = damageY + 40 + top;
        fill(ctx, index % 2 ? dark : darkOdd, 10, y, 575, rowHeight);
        ctx.strokeStyle = "#ffffff28";
        ctx.strokeRect(10, y, 230, rowHeight);
        ctx.strokeRect(240, y, 184, rowHeight);
        ctx.strokeRect(424, y, 161, rowHeight);
        lines.forEach((title, line) => text(title, 220, y + 20 + line * trialDamageTitleLineHeight,
          15, tan, "right", false, false, 201));
        if (row.critical) text(row.critical, 332, y + 20, index ? 18 : 15, index ? white : tan, "center");
        text(row.average, row.critical ? 504 : 412, y + 20, index ? 18 : 15, index ? white : tan, "center", false, false, row.critical ? 151 : 330);
        for (const [delta, x] of [[row.change?.critical, 332], [row.change?.average, row.critical ? 504 : 412]] as const) {
          if (delta !== undefined) {
            text(formatStarRailDamageChange(delta), x, y + 39, 12,
              delta > 0 ? "#a9dfb4" : delta < 0 ? "#f5a8ac" : "#e1d9e8", "center");
          }
        }
      });
      fill(ctx, "#0008", 10, damageY + damageHeight - 35, 575, 35);
      text($t("panel-detail-skia.text_f399cbc997"), 25, damageY + damageHeight - 17, 12, "#bbb");
      if (model.damageAuthor) text($t("panel-detail-skia.text_b1cf75c193", { "damageAuthor": model.damageAuthor }), 573, damageY + damageHeight - 17, 12, tan, "right");
      closeBox(10, damageY, 575, damageHeight);
    }
    text(model.cardBrand, width / 2, height - 18, 14, white, "center");
  }, { mode, inlineImageByteLimit });
}
