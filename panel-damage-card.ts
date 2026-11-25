import { createTranslator as createTextTranslator } from "../../packages/i18n/index.ts";
import messageCatalog from "./i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import { layoutTrialDamageTitles, trialDamageTitleLineHeight } from "../../lib/panel-trial-display.ts";
import { readFile, realpath, stat } from "node:fs/promises";
import { join, sep } from "node:path";
import { renderStarRailCard } from "./render-card.ts";
import { Canvas, loadImage } from "skia-canvas";
import { groupPanelNumber } from "../../lib/group-panel-rank-settings.ts";
import { registerGachaThemeFont } from "../../packages/skia/gacha-theme-fonts.ts";
import { formatStarRailDamageChange, personalDamageEnemyLevel, personalDamageMetricLabel, type StarRailPersonalDamage } from "./panel-damage.ts";
import { readStarRailPanelPortrait } from "./panel-portrait.ts";

const elementBackground: Readonly<Record<string, string>> = { 量子: "quantum", 雷: "electro", 冰: "cryo", 虚数: "geo", 风: "anemo", 火: "pyro", 物理: "sr" };
const words = new Intl.Segmenter("zh-CN", { granularity: "word" });
const glyphUnits = (value: string) => [...value].reduce((width, char) => width + (/^[\x00-\x7f]$/u.test(char) ? 1 : 2), 0);

function conditionLines(buff: string) {
  const lines: string[] = [];
  let line = "";
  for (const { segment } of words.segment(buff)) {
    if (line && glyphUnits(line + segment) > 64 && !/^[，。、！？；：）】%]/u.test(segment)) {
      lines.push(line.trim());
      line = "";
    }
    line += segment;
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

export async function renderStarRailPersonalDamage(damage: StarRailPersonalDamage, theme: string, avatarId: string, inlineImageByteLimit?: number,
  commaGroup?: number, builtInPortraitOnly = false) {
  const root = await realpath(theme);
  async function asset(parts: string[]) {
    try {
      const file = await realpath(join(root, ...parts));
      if (!file.startsWith(root + sep)) return;
      const info = await stat(file);
      if (info.isFile() && info.size <= 8 * 1024 * 1024) return file;
    } catch {}
  }
  async function picture(parts: string[]) {
    const file = await asset(parts);
    if (file) return readFile(file).then(bytes => loadImage(bytes)).catch(() => undefined);
  }
  async function font(scope: string, filename: string) {
    const file = await asset(["common", "font", filename]);
    try { if (file) return registerGachaThemeFont(scope, file); } catch {}
  }
  const [bg, appearance, texture, titleFont, bodyFont] = await Promise.all([
    picture(["common", "bg", `bg-${elementBackground[damage.element] ?? "sr"}.webp`]),
    readStarRailPanelPortrait(root, avatarId, damage.name, false, undefined, builtInPortraitOnly),
    picture(["common", "cont", "card-bg.png"]),
    font("StarRailDamageTitle", "NZBZ.ttf"), font("StarRailDamageBody", "HYWH-65W.ttf"),
  ]);
  const portrait = appearance?.image;
  const fallback = '"Noto Sans CJK SC", sans-serif';
  const heading = titleFont ? `${titleFont}, ${fallback}` : fallback;
  const body = bodyFont ? `${bodyFont}, ${fallback}` : fallback;
  const number = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 });
  const formatNumber = (value: number) => groupPanelNumber(number.format(value), commaGroup);
  const rowMetrics = (["damage", "shield", "heal", "support"] as const).filter(metric => damage.rows.some(row => row.metric === metric));
  const resultHeading = rowMetrics.map(metric => personalDamageMetricLabel[metric]).join(" / ");
  const baseline = damage.rows[damage.selected]!;
  function formatSwapValue({ average, critical, display, percentage }: Pick<typeof baseline, "average" | "critical" | "display" | "percentage">) {
    if (average === undefined) return "—";
    if (percentage !== undefined || display !== undefined) return groupPanelNumber(percentage ?? display!, commaGroup);
    return formatNumber(average) + (critical === undefined ? "" : ` / ${formatNumber(critical)}`);
  }
  const measure = new Canvas(1, 1).getContext("2d");
  measure.font = `13px ${body}`;
  const swapTextWidth = Math.max(0, ...damage.swaps.flatMap(entry => entry.values.map(swap =>
    measure.measureText(formatSwapValue(swap ?? baseline)).width,
  )));
  const swapCellWidth = Math.max(110, Math.ceil(swapTextWidth + 12));
  const criticalGap = Math.max(162, glyphUnits(resultHeading) * 8 + 16);
  const comparison = damage.rows.some(row => row.change !== undefined);
  measure.font = `18px ${body}`;
  const titles = layoutTrialDamageTitles(damage.rows, comparison ? 54 : 34, damage.trialTitleMode,
    line => measure.measureText(line).width <= 270);
  const labels = titles.rows.map(({ lines }, index) => [`${index + 1}. ${lines[0]}`, ...lines.slice(1)]);
  const rowWidth = 173 + criticalGap + 9 * Math.max(...labels.flat().map(glyphUnits));
  const noteWidth = Math.max(...damage.rows.map((row, index) => row.note ? 112 + 9 * glyphUnits(labels[index]![0]! + row.note) : 0));
  const width = Math.max(660, 210 + damage.swaps.length * swapCellWidth, rowWidth, noteWidth);
  const listHeight = 45 + titles.height;
  const swapTop = 161 + listHeight;
  const swapHeight = damage.swaps.length ? 110 + damage.swaps.length * 45 : 0;
  const buffTop = swapTop + (swapHeight ? swapHeight + 14 : 0);
  const buffLines = damage.buffs.flatMap(conditionLines);
  const height = buffTop + 73 + buffLines.length * 25;
  const valueX = width - 46, critX = valueX - criticalGap;
  const matrixX = (index: number) => 170 + (index + 0.5) * (width - 210) / damage.swaps.length;
  const metricLabel = personalDamageMetricLabel[baseline.metric];
  const selectedTitle = damage.trialTitleMode === 1 ? titles.rows[damage.selected]!.lines[0] : baseline.title;
  const swapHeading = baseline.percentage !== undefined ? $t("panel-damage-card.text_a78b2e2123")
    : baseline.critical === undefined ? $t("panel-damage-card.text_5f69dbdac8", { "metricLabel": metricLabel, "value2": metricLabel })
    : $t("panel-damage-card.text_ffb8baa1dc");

  return renderStarRailCard(width, height, ctx => {
    function text(value: string, x: number, y: number, size: number, color = "#f5f3f7", align: CanvasTextAlign = "left", family = body, maxWidth?: number) {
      ctx.textAlign = align;
      ctx.fillStyle = color;
      ctx.font = `${size}px ${family}`;
      if (maxWidth === undefined) ctx.fillText(value, x, y);
      else ctx.fillText(value, x, y, maxWidth);
    }

    function box(y: number, boxHeight: number, title: string) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(24, y, width - 48, boxHeight, 10);
      ctx.clip();
      ctx.fillStyle = "#19182ce8";
      ctx.fillRect(24, y, width - 48, boxHeight);
      if (texture) {
        ctx.globalAlpha = 0.42;
        ctx.drawImage(texture, 24, y, width - 48, boxHeight);
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = "#161325c9";
      ctx.fillRect(24, y, width - 48, 38);
      ctx.restore();
      text(title, 41, y + 26, 19, "#e2cb9e");
    }

    ctx.fillStyle = "#282645";
    ctx.fillRect(0, 0, width, height);
    if (bg) {
      const zoom = Math.max(width / bg.width, height / bg.height);
      ctx.drawImage(bg, 0, 0, bg.width * zoom, bg.height * zoom);
    }
    if (portrait) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(width - 403, 0, 403, 181);
      ctx.clip();
      const zoom = 446 / portrait.width;
      ctx.drawImage(portrait, width - 442, -32, 446, portrait.height * zoom);
      ctx.restore();
    }
    const subtitle = ctx.createLinearGradient(26, 0, 440, 0);
    subtitle.addColorStop(0, "#17152580");
    subtitle.addColorStop(0.84, "#17152555");
    subtitle.addColorStop(1, "#17152500");
    ctx.fillStyle = subtitle;
    ctx.fillRect(28, 91, 412, 31);
    ctx.shadowColor = "#171525";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 1;
    text($t("panel-damage-card.text_850202337a", { "name": damage.name }), 40, 78, 44, "#fff", "left", heading);
    text($t("panel-damage-card.text_8f95ea200f", { "personalDamageEnemyLevel": personalDamageEnemyLevel, "selectedTitle": selectedTitle }), 42, 113, 19, "#fff", "left", body, damage.trialTitleMode === 2 ? width - 84 : undefined);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    box(147, listHeight, comparison ? $t("panel-damage-card.text_fd3d6b9c0c") : $t("panel-damage-card.text_393374d45e"));
    text($t("panel-damage-card.text_15bccc3951"), critX, 173, 16, "#f5f3f7", "right");
    text(resultHeading, valueX, 173, 16, "#f5f3f7", "right");
    for (const [index, row] of damage.rows.entries()) {
      const y = 208 + titles.rows[index]!.top, color = index === damage.selected ? "#f7d895" : "#f5f3f7";
      labels[index]!.forEach((label, line) => text(label, 42, y + line * trialDamageTitleLineHeight, 18, color));
      if (row.note === undefined) {
        text(row.critical === undefined ? "—" : formatNumber(row.critical), critX, y, 18, color, "right");
      }
      const value = row.note ?? groupPanelNumber(row.percentage ?? row.display ?? (row.average === undefined ? "—" : number.format(row.average)), commaGroup);
      text(value, valueX, y, 18, color, "right");
      for (const [delta, x] of [[row.change?.critical, critX], [row.change?.average, valueX]] as const) {
        if (delta !== undefined) {
          text(formatStarRailDamageChange(delta), x, y + 19, 13,
            delta > 0 ? "#a9dfb4" : delta < 0 ? "#f5a8ac" : "#e1d9e8", "right");
        }
      }
    }

    const baselineAverage = baseline.average;
    if (baselineAverage !== undefined && swapHeight) {
      box(swapTop, swapHeight, swapHeading);
      damage.swaps.forEach((entry, index) => {
        text(entry.title, matrixX(index), swapTop + 60, 15, "#e2cb9e", "center");
        text(`+${entry.amount}`, matrixX(index), swapTop + 79, 14, "#e2cb9e", "center");
      });
      damage.swaps.forEach((entry, column) => {
        const y = swapTop + 111 + column * 45;
        text(`${entry.title} −${entry.amount}`, 42, y + 9, 15);
        entry.values.forEach((swap, index) => {
          const x = matrixX(index);
          const value = swap ?? baseline;
          const delta = (value.average ?? baselineAverage) - baselineAverage;
          const deltaLabel = baseline.percentage === undefined ? formatNumber(delta) : groupPanelNumber(delta.toFixed(1), commaGroup);
          const color = delta > 0 ? "#a9dfb4" : delta < 0 ? "#f5a8ac" : "#e1d9e8";
          text(swap ? `${delta > 0 ? "+" : ""}${deltaLabel}` : "—", x, y, 17, color, "center");
          text(formatSwapValue(value), x, y + 19, 13, "#e1d9e8", "center");
        });
      });
    }
    box(buffTop, 45 + buffLines.length * 25, $t("panel-damage-card.text_524ac5f976"));
    buffLines.forEach((buff, i) => text(buff, 42, buffTop + 58 + i * 25, 17));
    text($t("panel-damage-card.text_00dfd4ad2c"), width / 2, height - 12, 13, "#fff", "center");
  }, { mode: "gpu", inlineImageByteLimit });
}
