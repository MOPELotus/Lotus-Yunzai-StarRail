import { readFile, realpath, stat } from "node:fs/promises";
import { join, sep } from "node:path";
import { renderPng } from "@lotus-yunzai/skia";
import { loadImage } from "skia-canvas";
import { registerGachaThemeFont } from "../../packages/skia/gacha-theme-fonts.ts";
import { personalDamageEnemyLevel, type StarRailPersonalDamage } from "./panel-damage.ts";

const elementBackground: Readonly<Record<string, string>> = { 量子: "quantum", 雷: "electro", 冰: "cryo", 虚数: "geo" };
const words = new Intl.Segmenter("zh-CN", { granularity: "word" });

function conditionLines(buff: string) {
  const units = (value: string) => [...value].reduce((width, char) => width + (/^[\x00-\x7f]$/u.test(char) ? 1 : 2), 0);
  const lines: string[] = [];
  let line = "";
  for (const { segment } of words.segment(buff)) {
    if (line && units(line + segment) > 64 && !/^[，。、！？；：）】%]/u.test(segment)) {
      lines.push(line.trim());
      line = "";
    }
    line += segment;
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

export async function renderStarRailPersonalDamage(damage: StarRailPersonalDamage, theme: string) {
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
  const [bg, portrait, texture, titleFont, bodyFont] = await Promise.all([
    picture(["common", "bg", `bg-${elementBackground[damage.element] ?? "sr"}.webp`]),
    picture(["meta-sr", "character", damage.name, "imgs", "splash.webp"]),
    picture(["common", "cont", "card-bg.png"]),
    font("StarRailDamageTitle", "NZBZ.ttf"), font("StarRailDamageBody", "HYWH-65W.ttf"),
  ]);
  const fallback = '"Noto Sans CJK SC", sans-serif';
  const heading = titleFont ? `${titleFont}, ${fallback}` : fallback;
  const body = bodyFont ? `${bodyFont}, ${fallback}` : fallback;
  const number = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 });
  const width = Math.max(660, 190 + damage.swaps.length * 110);
  const listHeight = 45 + damage.rows.length * 34;
  const swapTop = 161 + listHeight, swapHeight = 110 + damage.swaps.length * 45;
  const buffTop = swapTop + swapHeight + 14;
  const buffLines = damage.buffs.flatMap(conditionLines);
  const height = buffTop + 73 + buffLines.length * 25;
  const valueX = width - 46, critX = valueX - 162;
  const matrixX = (index: number) => 170 + (index + 0.5) * (width - 210) / damage.swaps.length;
  const baseline = damage.rows[damage.selected]!;
  const shield = baseline.critical === undefined;

  return renderPng(width, height, ctx => {
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
      ctx.rect(257, 0, width - 257, 181);
      ctx.clip();
      const zoom = 446 / portrait.width;
      ctx.drawImage(portrait, 218, -32, 446, portrait.height * zoom);
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
    text(damage.rows.some(row => row.critical === undefined) ? "期望伤害 / 护盾量" : "期望伤害", valueX, 173, 16, "#f5f3f7", "right");
    for (const [index, row] of damage.rows.entries()) {
      const y = 208 + index * 34, color = index === damage.selected ? "#f7d895" : "#f5f3f7";
      text(`${index + 1}. ${row.title}`, 42, y, 18, color);
      text(row.critical === undefined ? "—" : number.format(row.critical), critX, y, 18, color, "right");
      text(number.format(row.average), valueX, y, 18, color, "right");
    }

    box(swapTop, swapHeight, shield ? "词条替换 · 护盾量变化 / 护盾量" : "词条替换 · 期望变化 / 期望与暴击伤害");
    damage.swaps.forEach((entry, index) => {
      text(entry.title, matrixX(index), swapTop + 60, 15, "#e2cb9e", "center");
      text(`+${entry.amount}`, matrixX(index), swapTop + 79, 14, "#e2cb9e", "center");
    });
    damage.swaps.forEach((entry, column) => {
      const y = swapTop + 111 + column * 45;
      text(`${entry.title} −${entry.amount}`, 42, y + 9, 15);
      entry.values.forEach((swap, index) => {
        const x = matrixX(index);
        const { average, critical } = swap ?? baseline;
        const delta = average - baseline.average;
        const color = delta > 0 ? "#a9dfb4" : delta < 0 ? "#f5a8ac" : "#e1d9e8";
        text(swap ? `${delta > 0 ? "+" : ""}${number.format(delta)}` : "—", x, y, 17, color, "center");
        const display = number.format(average) + (critical === undefined ? "" : ` / ${number.format(critical)}`);
        text(display, x, y + 19, 13, "#e1d9e8", "center");
      });
    });
    box(buffTop, 45 + buffLines.length * 25, "计算条件");
    buffLines.forEach((buff, i) => text(buff, 42, buffTop + 58 + i * 25, 17));
    text("Lotus-Yunzai · StarRail", width / 2, height - 12, 13, "#fff", "center");
  }, "gpu");
}
