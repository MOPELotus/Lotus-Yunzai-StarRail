import { readFile, realpath, stat } from "node:fs/promises";
import { join, sep } from "node:path";
import { renderStarRailCard } from "./render-card.ts";
import { Canvas, loadImage } from "skia-canvas";
import { registerGachaThemeFont } from "../../packages/skia/gacha-theme-fonts.ts";
import { personalDamageEnemyLevel, personalDamageMetricLabel, type StarRailPersonalDamage } from "./panel-damage.ts";
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

export async function renderStarRailPersonalDamage(damage: StarRailPersonalDamage, theme: string, avatarId: string, inlineImageByteLimit?: number) {
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
    readStarRailPanelPortrait(root, avatarId, damage.name),
    picture(["common", "cont", "card-bg.png"]),
    font("StarRailDamageTitle", "NZBZ.ttf"), font("StarRailDamageBody", "HYWH-65W.ttf"),
  ]);
  const portrait = appearance?.image;
  const fallback = '"Noto Sans CJK SC", sans-serif';
  const heading = titleFont ? `${titleFont}, ${fallback}` : fallback;
  const body = bodyFont ? `${bodyFont}, ${fallback}` : fallback;
  const number = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 });
  const labels = damage.rows.map((row, index) => `${index + 1}. ${row.title}`);
  const rowMetrics = (["damage", "shield", "heal", "support"] as const).filter(metric => damage.rows.some(row => row.metric === metric));
  const resultHeading = rowMetrics.map(metric => personalDamageMetricLabel[metric]).join(" / ");
  const baseline = damage.rows[damage.selected]!;
  function formatSwapValue({ average, critical, display, percentage }: Pick<typeof baseline, "average" | "critical" | "display" | "percentage">) {
    if (average === undefined) return "—";
    return percentage ?? display ?? (number.format(average) + (critical === undefined ? "" : ` / ${number.format(critical)}`));
  }
  const measure = new Canvas(1, 1).getContext("2d");
  measure.font = `13px ${body}`;
  const swapTextWidth = Math.max(0, ...damage.swaps.flatMap(entry => entry.values.map(swap =>
    measure.measureText(formatSwapValue(swap ?? baseline)).width,
  )));
  const swapCellWidth = Math.max(110, Math.ceil(swapTextWidth + 12));
  const criticalGap = Math.max(162, glyphUnits(resultHeading) * 8 + 16);
  const rowWidth = 173 + criticalGap + 9 * Math.max(...labels.map(glyphUnits));
  const noteWidth = Math.max(...damage.rows.map((row, index) => row.note ? 112 + 9 * glyphUnits(labels[index]! + row.note) : 0));
  const width = Math.max(660, 210 + damage.swaps.length * swapCellWidth, rowWidth, noteWidth);
  const listHeight = 45 + damage.rows.length * 34;
  const swapTop = 161 + listHeight;
  const swapHeight = damage.swaps.length ? 110 + damage.swaps.length * 45 : 0;
  const buffTop = swapTop + (swapHeight ? swapHeight + 14 : 0);
  const buffLines = damage.buffs.flatMap(conditionLines);
  const height = buffTop + 73 + buffLines.length * 25;
  const valueX = width - 46, critX = valueX - criticalGap;
  const matrixX = (index: number) => 170 + (index + 0.5) * (width - 210) / damage.swaps.length;
  const metricLabel = personalDamageMetricLabel[baseline.metric];
  const swapHeading = baseline.percentage !== undefined ? "词条替换 · 变化（百分点） / 辅助比例"
    : baseline.critical === undefined ? `词条替换 · ${metricLabel}变化 / ${metricLabel}`
    : "词条替换 · 期望变化 / 期望与暴击伤害";

  return renderStarRailCard(width, height, ctx => {
    function text(value: string, x: number, y: number, size: number, color = "#f5f3f7", align: CanvasTextAlign = "left", family = body) {
      ctx.textAlign = align;
      ctx.fillStyle = color;
      ctx.font = `${size}px ${family}`;
      ctx.fillText(value, x, y);
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
    text(`${damage.name}伤害`, 40, 78, 44, "#fff", "left", heading);
    text(`${personalDamageEnemyLevel} 级弱点敌人 · ${baseline.title}`, 42, 113, 19, "#fff");
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    box(147, listHeight, "伤害计算");
    text("暴击伤害", critX, 173, 16, "#f5f3f7", "right");
    text(resultHeading, valueX, 173, 16, "#f5f3f7", "right");
    for (const [index, row] of damage.rows.entries()) {
      const y = 208 + index * 34, color = index === damage.selected ? "#f7d895" : "#f5f3f7";
      text(labels[index]!, 42, y, 18, color);
      if (row.note === undefined) {
        text(row.critical === undefined ? "—" : number.format(row.critical), critX, y, 18, color, "right");
      }
      const value = row.note ?? row.percentage ?? row.display ?? (row.average === undefined ? "—" : number.format(row.average));
      text(value, valueX, y, 18, color, "right");
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
          const deltaLabel = baseline.percentage === undefined ? number.format(delta) : delta.toFixed(1);
          const color = delta > 0 ? "#a9dfb4" : delta < 0 ? "#f5a8ac" : "#e1d9e8";
          text(swap ? `${delta > 0 ? "+" : ""}${deltaLabel}` : "—", x, y, 17, color, "center");
          text(formatSwapValue(value), x, y + 19, 13, "#e1d9e8", "center");
        });
      });
    }
    box(buffTop, 45 + buffLines.length * 25, "计算条件");
    buffLines.forEach((buff, i) => text(buff, 42, buffTop + 58 + i * 25, 17));
    text("Lotus-Yunzai · StarRail", width / 2, height - 12, 13, "#fff", "center");
  }, { mode: "gpu", inlineImageByteLimit });
}
