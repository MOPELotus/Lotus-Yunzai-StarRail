import { rankLabelLayout } from "../../lib/rank-label-layout.ts";
import { createTranslator as createTextTranslator } from "../../packages/i18n/index.ts";
import messageCatalog from "./i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
// Layout follows the MIT Miao rank-profile-list HTML/CSS; extra Eidolon border matches 87b09ace.
import type { CanvasRenderingContext2D as Context, Image } from "skia-canvas";
import { groupPanelNumber, maxGroupPanelRankLimit } from "../../lib/group-panel-rank-settings.ts";
import { fill, image, picture, rounded, soulColors, styles, themeArt, typography } from "./panel-skia-theme.ts";
import { renderStarRailCard, type StarRailCardOptions } from "./render-card.ts";
import { readTheme, type readPanelRankAvatar } from "./panel-card.ts";
import { object, text } from "./panel-model.ts";

export const relicRankLabels = { damage: $t("group-relic-rank-card.text_30e1196888"), mark: $t("group-relic-rank-card.text_08ddb000a9"), crit: $t("group-relic-rank-card.text_8239a4e7ae"), valid: $t("group-relic-rank-card.text_60ac93fb6d") } as const;
export type RelicRankMetric = keyof typeof relicRankLabels;

export interface RelicRankRow {
  readonly uid: string;
  readonly characterId: string;
  readonly characterName?: string;
  readonly score: number;
  readonly grade: string;
  readonly relicMark?: { readonly score: number; readonly grade: string };
  readonly presentation?: Awaited<ReturnType<typeof readPanelRankAvatar>>;
  readonly metric?: RelicRankMetric;
}
export interface RelicRankCoverage {
  readonly registered: number;
  readonly scored: number;
  readonly notListed: number;
  readonly failed: number;
}

export function relicRankCoverageText({ registered, scored, notListed, failed }: RelicRankCoverage) {
  const parts = [$t("group-relic-rank-card.text_490e18dd65", { "scored": scored, "registered": registered })];
  if (notListed) parts.push($t("group-relic-rank-card.text_d26a25f1b4", { "notListed": notListed }));
  if (failed) parts.push($t("group-relic-rank-card.text_4c3cf9a067", { "failed": failed }));
  return parts.join(" · ");
}

type Character = { readonly id: number; readonly name: string };
const elementArt: Readonly<Record<string, string>> = {
  物理: "sr", 火: "pyro", 冰: "cryo", 风: "anemo", 雷: "electro", 量子: "quantum", 虚数: "geo",
};
const gradeColors: Readonly<Record<string, string>> = {
  MAX: "#ff5722", ACE: "#ff5722", SSS: "#531ba9cf", SS: "#531ba9cf", S: "#3955b7", A: "#3955b7",
};
const gold = "#d3bc8e";
const white = "#fff";
const lines = [
  [$t("group-relic-rank-card.text_5e574e16da"), $t("group-relic-rank-card.text_d5b1019cf7")],
  [$t("group-relic-rank-card.text_a12840164b"), $t("group-relic-rank-card.text_ddbfdc4a14")],
  [$t("group-relic-rank-card.text_7527b41911"), $t("group-relic-rank-card.text_976ffc8799")],
  [$t("group-relic-rank-card.text_94c51e5cd1"), $t("group-relic-rank-card.text_2985cca526")],
  [$t("group-relic-rank-card.text_cc5a9ebd9d"), $t("group-relic-rank-card.text_7420dc5ff6")],
] as const;
const geometry = {
  normal: { width: 900, face: 40, nameX: 114, talentX: 193, coneX: 419, setX: 524, dmgX: 650, secondX: 760 },
  remembrance: { width: 970, face: 38, nameX: 112, talentX: 185, coneX: 511, setX: 608, dmgX: 735, secondX: 839 },
  elation: { width: 970, face: 42, nameX: 116, talentX: 198, coneX: 474, setX: 584, dmgX: 710, secondX: 825 },
};

function badgeArt(ctx: Context, img: Image | undefined, variant: "damage" | "mark", x: number, y: number, width: number, height: number) {
  if (!img) return;
  const half = img.width / 2;
  ctx.drawImage(img, variant === "mark" ? half : 0, 0, half, img.height, x, y, width, height);
}

function framed(ctx: Context, backdrop: Image | undefined, x: number, y: number, w: number, h: number, radius: number,
  artwork?: Image, cover = false,
) {
  ctx.save();
  rounded(ctx, x, y, w, h, radius);
  ctx.clip();
  fill(ctx, "#777", x, y, w, h);
  picture(ctx, backdrop, x, y, w, h, "cover");
  if (cover && artwork) {
    const iw = artwork.width * h / artwork.height;
    ctx.drawImage(artwork, x + (w - iw) / 2, y, iw, h);
  }
  ctx.restore();
  rounded(ctx, x, y, w, h, radius);
  ctx.strokeStyle = "#ffffffb3";
  ctx.lineWidth = 1;
  ctx.stroke();
}

function divider(ctx: Context, x: number, y: number) {
  const gradient = ctx.createLinearGradient(0, y, 0, y + 40);
  gradient.addColorStop(0, "#ffffff1a");
  gradient.addColorStop(.5, "#ffffffcc");
  gradient.addColorStop(1, "#ffffff1a");
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, 1, 40);
}

export async function renderStarRailRelicRank(
  character: Character | undefined, rows: readonly RelicRankRow[], mode: StarRailCardOptions["mode"] = "auto", inlineImageByteLimit?: number,
  coverage?: RelicRankCoverage, metric: RelicRankMetric = "mark", aggregate?: { readonly title: string; readonly summary: string },
  publicRanking?: { readonly filters: string; readonly count: number },
) {
  const maximum = publicRanking ? 50 : maxGroupPanelRankLimit;
  if (!rows.length || rows.length > maximum) throw new RangeError($t("group-relic-rank-card.text_35cabeaebc", { "maximum": maximum }));
  const theme = await readTheme();
  const meta = character && object(theme.characters[String(character.id)]);
  const path = aggregate
    ? rows.some(row => row.presentation?.path === "记忆") ? $t("group-relic-rank-card.text_7a6335b379") :
      rows.some(row => row.presentation?.path === "欢愉") ? $t("group-relic-rank-card.text_17f4b35418") : undefined
    : text(meta?.weapon) || rows[0]?.presentation?.path;
  const slotCount = path === "记忆" ? 6 : path === "欢愉" ? 5 : 4;
  const baseLayout = path === "记忆" ? geometry.remembrance : path === "欢愉" ? geometry.elation : geometry.normal;
  const setX = baseLayout.coneX + 300;
  const dmgX = setX + 150;
  const layout = { ...baseLayout, setX, dmgX, secondX: dmgX + 260, width: dmgX + 285 };
  const { width } = layout;
  const element = aggregate ? "hydro" : elementArt[text(meta?.elem) || rows[0]?.presentation?.element || ""] || "sr";
  const art = (relative: string) => themeArt(theme.root, relative);
  const font = typography(theme.root);
  const [background, texture, badge, first, talentRing, crown, emptyRelics, rarityFrames, rowImages] = await Promise.all([
    art(`common/bg/bg-${element}.webp`), art("common/cont/card-bg.png"),
    art("character/imgs/mark-icon.png"), art("character/imgs/mark-icon2.png"), art(`common/bg/talent-${element}.webp`),
    art("character/imgs/crown-sr.webp"), art("common/item/artifact-icon.webp"),
    Promise.all([1, 2, 3, 4, 5].map(star => art(`common/item/bg${star}.png`))),
    Promise.all(rows.map(async ({ characterId, characterName, presentation }) => {
      const name = text(object(theme.characters[characterId])?.name) || characterName || character?.name;
      const fallback = name && !/[\\/\p{Cc}]/u.test(name) && name !== "." && name !== ".."
        ? art(`meta-sr/character/${name}/imgs/face.webp`) : undefined;
      const [face, weapon, talents, sets] = await Promise.all([
        presentation?.face ? image(presentation.face) : fallback,
        image(presentation?.lightCone?.icon),
        Promise.all((presentation?.talents ?? []).map(talent => image(talent.icon))),
        Promise.all((presentation?.sets ?? []).map(set => image(set.icon))),
      ]);
      return { face, weapon, talents, sets };
    })),
  ]);
  const extra = coverage ? 20 : 0;
  const rowStart = 267 + extra;
  const height = rowStart + rows.length * 65 + 32;
  const panelWidth = width - 25;
  const displayScale = 1.4;
  return renderStarRailCard(Math.round(width * displayScale), Math.round(height * displayScale), ctx => {
    ctx.scale(displayScale, displayScale);
    const write = styles(ctx, font);
    function box(y: number, h: number, draw: () => void) {
      ctx.save();
      rounded(ctx, 10, y, panelWidth, h, 10);
      ctx.clip();
      if (texture) {
        const imageHeight = y === 97 ? h : h * 1.5;
        const imageWidth = imageHeight * texture.width / texture.height;
        for (let x = 10; x < 10 + panelWidth; x += imageWidth) ctx.drawImage(texture, x, y, imageWidth, imageHeight);
      } else fill(ctx, "#111d29", 10, y, panelWidth, h);
      draw();
      ctx.restore();
      rounded(ctx, 10.5, y + .5, panelWidth - 1, h - 1, 10);
      ctx.strokeStyle = "#ffffff66";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    function pill(value: string | number, color: string, x: number, y: number, w: number, extraEidolon = false) {
      fill(ctx, color, x, y, w, 15, 4);
      if (extraEidolon) {
        // Original .cons.has-ex-cons::before: 135deg rainbow, 1.5px inset border, 4px corners.
        const gradient = ctx.createLinearGradient(x, y, x + w, y + 15);
        ["#ff3366", "#ff9933", "#ffe600", "#33cc99", "#3399ff", "#cc33ff"].forEach((color, index) =>
          gradient.addColorStop(index / 5, color));
        ctx.save();
        rounded(ctx, x + .75, y + .75, w - 1.5, 13.5, 3.25);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }
      write(value, x + w / 2, y + 8, 12, white, "center");
    }
    function cell(value: string, x: number, y: number, size: number, color: string, width: number) {
      ctx.font = `${size}px ${font.body}`;
      const measured = ctx.measureText(value).width;
      const fittingSize = measured > width ? Math.max(8, Math.floor(size * width / measured)) : size;
      write(value, x, y, fittingSize, color, "left", false, false, width);
    }

    fill(ctx, "#242e45", 0, 0, width, height);
    picture(ctx, background, 0, 0, width, height, "cover", 0, 0);
    ctx.save();
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 3;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    const name = character?.name.replace(/^(?:穹|星)·(毁灭|存护|同谐|记忆|欢愉)$/u, "开拓者·$1");
    write(aggregate?.title ?? $t("group-relic-rank-card.text_9d9e52587d", { "value1": publicRanking ? $t("group-relic-rank-card.text_4eafa9e925") : "", "name": name, "value3": relicRankLabels[metric] }), 20, 63, 36, white, "left", false, true, width - 40);
    ctx.restore();
    box(97, 165 + extra, () => {
      fill(ctx, "#0006", 10, 97, panelWidth, 40);
      fill(ctx, "#ffffff46", 10, 137, panelWidth, 1);
      write(publicRanking ? $t("group-relic-rank-card.text_f48d2b932c") : $t("group-relic-rank-card.text_2a2a030720"), 30, 119, 16, gold);
      fill(ctx, "#0006", 10, 138, panelWidth, 124 + extra);
      const notes = publicRanking ? [
        [$t("group-relic-rank-card.text_a96c9a8541"), (metric === "damage" ? $t("group-relic-rank-card.text_fe2142d7c9") : $t("group-relic-rank-card.text_08ddb000a9")) + $t("group-relic-rank-card.text_4b77c35468")],
        [$t("group-relic-rank-card.text_b5f15473fd"), publicRanking.filters], [$t("group-relic-rank-card.text_5e29d121dd"), $t("group-relic-rank-card.text_67ce28e000", { "count": publicRanking.count, "length": rows.length })],
        [$t("group-relic-rank-card.text_3c8c5939d6"), $t("group-relic-rank-card.text_46fec63bf7")],
        [$t("group-relic-rank-card.text_ae72b532f4"), $t("group-relic-rank-card.text_cf61de2083")],
      ] : lines;
      for (const [index, [title, body]] of notes.entries()) {
        const y = 161 + index * 19;
        write("•", 36, y, 13);
        if (!publicRanking && index < 4) badgeArt(ctx, badge, index === 0 ? "damage" : "mark", 54, y - 8, 16, 16);
        const x = !publicRanking && index < 4 ? 73 : 54;
        write(title + "：", x, y, 13, gold, "left", true);
        const next = x + ctx.measureText(title + "：").width + 3;
        write(body, next, y, 13, white, "left", false, false, width - next - 38);
      }
      if (coverage) write(aggregate?.summary ?? relicRankCoverageText(coverage), 54, 257, 13, gold, "left", false, false, width - 85);
    });

    rows.forEach((row, index) => {
      const y = rowStart + index * 65;
      const known = row.presentation;
      const { face, weapon, talents, sets } = rowImages[index]!;
      const lightCone = known?.lightCone;
      const rowMetric = row.metric ?? metric;
      const badgeVariant = rowMetric === "damage" ? "damage" : "mark";
      const relicMark = rowMetric === "damage" || publicRanking ? row.relicMark : row;
      box(y, 60, () => {
        if (aggregate) {
          framed(ctx, rarityFrames[(known?.rarity ?? 1) - 1], 18, y + 9, 42, 42, 21, face, true);
        } else if (index === 0 && first && (metric === "damage" || metric === "mark")) badgeArt(ctx, first, badgeVariant, 15, y + 18, 48, 24);
        else {
          badgeArt(ctx, badge, badgeVariant, 27, y + 18, 24, 24);
          write(index + 1, 39, y + 30, 12, white, "center");
        }
        framed(ctx, rarityFrames[(known?.rarity ?? 1) - 1], 69, y + (60 - layout.face) / 2, layout.face, layout.face, layout.face / 2, face, true);
        if (known?.rank !== undefined) pill(known.rank, soulColors[known.rank] ?? "#666", layout.nameX, y + 13, 16, (known.exCons ?? 0) > 0);
        write(known?.name || row.characterName || character?.name || "", layout.nameX + (known?.rank === undefined ? 0 : 18), y + 21, 18, gold,
          "left", true, false, layout.talentX - layout.nameX - 19);
        write(row.uid, layout.nameX, y + 42, 12, white);

        for (let key = 0; key < slotCount; key++) {
          const t = known?.talents[key];
          if (aggregate && !t) continue;
          const x = layout.talentX + key * 50;
          picture(ctx, talentRing, x, y, 56, 56);
          picture(ctx, talents[key], x + 15, y + 15, 26, 26);
          if (t?.original !== undefined && t.original >= 10) picture(ctx, crown, x + 19, y - 2, 22, 22);
          const enhanced = t?.original !== undefined && t.level !== undefined && t.level > t.original;
          fill(ctx, enhanced ? "#2e353e" : white, x + 17, y + 40, 22, 18, 5);
          write(t?.level ?? "—", x + 28, y + 49, 12, enhanced ? "#ffdfa0" : "#000", "center", enhanced);
        }

        divider(ctx, layout.coneX - 15, y + 10);
        if (lightCone) {
          framed(ctx, rarityFrames[(lightCone.rarity ?? 1) - 1], layout.coneX, y + 12, 36, 36, 6);
          picture(ctx, weapon, layout.coneX - 5, y + 2, 46, 56);
          const coneTextX = layout.coneX + 46;
          cell(lightCone.name || "—", coneTextX, y + 30, 13, gold, 145);
          const affix = lightCone.affix;
          if (affix !== undefined) pill($t("group-relic-rank-card.text_8f16cda3b9", { "affix": affix }), soulColors[affix + 1] ?? "#666", layout.coneX + 200, y + 22, 25);
          if (lightCone.level !== undefined) write(`Lv.${lightCone.level}`, layout.coneX + 240, y + 30, 13);
        } else {
          rounded(ctx, layout.coneX, y + 12, 36, 36, 6);
          ctx.strokeStyle = "#ffffffb3";
          ctx.stroke();
          write("—", layout.coneX + 47, y + 31, 13, "#aaa");
        }

        framed(ctx, known?.sets.length ? rarityFrames[4] : undefined, layout.setX, y + 12, 36, 36, 6);
        if (known?.sets.length === 2) {
          picture(ctx, sets[0], layout.setX, y + 12, 25, 25);
          picture(ctx, sets[1], layout.setX + 11, y + 23, 25, 25);
        } else picture(ctx, sets[0] ?? emptyRelics, layout.setX + 1, y + 13, 34, 34);
        cell(known?.sets.map(set => set.name).join("+") || "—", layout.setX + 45, y + 22, 12, gold,
          layout.dmgX - layout.setX - 61);
        if (relicMark) pill(relicMark.grade, gradeColors[relicMark.grade] ?? "#aaa", layout.setX + 44, y + 34, 25);
        cell(groupPanelNumber(relicMark?.score.toFixed(1) ?? "—", theme.commaGroup),
          layout.setX + 73, y + 42, 16, white, layout.dmgX - layout.setX - 92);
        divider(ctx, layout.dmgX - 15, y + 10);
        ctx.font = `12px ${font.body}`;
        const damageName = rankLabelLayout(known?.damage?.title || $t("group-relic-rank-card.text_d5f4617e07"), 240, value => ctx.measureText(value).width, 12);
        damageName.lines.forEach((line, index) => write(line, layout.dmgX, y + 12 + index * 13, damageName.size, "#aaa"));
        const damageValue = known?.damage?.value ?? (rowMetric === "damage" && !publicRanking ? row.score.toFixed(1) : "—");
        cell(groupPanelNumber(damageValue, theme.commaGroup), layout.dmgX, y + 42, 18, white, layout.secondX - layout.dmgX - 20);
        divider(ctx, layout.secondX - 15, y + 10);
      });
    });
    write($t("group-relic-rank-card.text_00dfd4ad2c"), width / 2, height - 15, 14, white, "center");
  }, { mode, inlineImageByteLimit });
}
