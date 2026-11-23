import { renderStarRailCard, type StarRailCardOptions } from "./render-card.ts";
import { fileURLToPath } from "node:url";
import { Canvas, FontLibrary, loadImage, type CanvasRenderingContext2D as Context, type Image } from "skia-canvas";
import type { makeStarRailLedgerCard } from "./ledger-command.ts";
import type { makeStarRailMonthlyCard } from "./monthly-card.ts";
import type { StarRailMonthlyStatistics } from "./monthly-statistics.ts";
import type { makeStarRailOnlineCard } from "./online-command.ts";

const theme = new URL("./monthly-theme/", import.meta.url);
const font = '"Noto Sans CJK SC", sans-serif';
const colors = ["#5470c6", "#91cc75", "#fac858"];
const image = (path: string) => loadImage(new URL(path, theme));

function label(ctx: Context, value: string, x: number, y: number, size: number,
  { color = "#111", weight = 400, align = "left", maxWidth, family = font }: {
    color?: string; weight?: number; align?: CanvasTextAlign; maxWidth?: number; family?: string;
  } = {}) {
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = align;
  ctx.fillStyle = color;
  ctx.fillText(value, x, y, maxWidth);
}

function wrap(ctx: Context, value: string, width: number) {
  const lines: string[] = [];
  let row = "";
  for (const character of value) {
    if (row && ctx.measureText(row + character).width > width) {
      lines.push(row);
      row = "";
    }
    row += character;
  }
  if (row) lines.push(row);
  return lines;
}

function box(ctx: Context, x: number, y: number, width: number, height: number,
  radius: number | number[], fill?: string, stroke?: string, lineWidth = 1) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
}

function cover(ctx: Context, art: Image, width: number, height: number) {
  const factor = Math.max(width / art.width, height / art.height);
  ctx.drawImage(art, (width - art.width * factor) / 2, (height - art.height * factor) / 2, art.width * factor, art.height * factor);
}

export async function renderStarRailLedgerCard(model: ReturnType<typeof makeStarRailLedgerCard>, options: StarRailCardOptions = {}) {
  const [background, decoration] = await Promise.all([image("charge/bg_main.b435ab02..png"), image("charge/Deco4.png")]);
  const width = 730, columnWidths = [297, 143, 144], textSize = 22.4, tableY = 215;
  const metrics = new Canvas(1, 1).getContext("2d");
  metrics.font = `400 ${textSize}px ${font}`;
  const rows = model.rows.map(row => {
    const values = [row.time, String(row.count), row.reason].map((value, index) => wrap(metrics, value, columnWidths[index]! - 20));
    return { values, height: 21 + Math.max(1, ...values.map(lines => lines.length)) * 33 };
  });
  const tableBottom = tableY + 54 + rows.reduce((total, row) => total + row.height, 0);
  const height = tableBottom + 77;
  return renderStarRailCard(width, height, ctx => {
    ctx.fillStyle = "#203042";
    ctx.fillRect(0, 0, width, height);
    cover(ctx, background, width, height);
    cover(ctx, decoration, width, height);
    label(ctx, `UID ${model.uid}`, 10, 28, textSize, { weight: 900, color: "#e9e7e2" });
    label(ctx, `${model.type}记录`, 700, 89, 48, { weight: 900, color: "#edd3b2", align: "right" });
    ctx.fillStyle = "#c0c0c2";
    ctx.fillRect(0, 122, width, 3);
    label(ctx, `${model.typeen} History`, width, 145, 24, { weight: 900, color: "#fff", align: "right" });
    ctx.fillStyle = "#e9e7e2";
    ctx.fillRect(20, 200, 690, height - 220);
    box(ctx, 31.5, 211.5, 667, height - 243, [0, 85, 0, 0], undefined, "#c2ad7e", 3);
    const tableRow = (values: readonly (readonly string[])[], y: number, rowHeight: number, fill: string, heading = false) => {
      let x = 35;
      for (const [index, lines] of values.entries()) {
        const w = columnWidths[index]!;
        ctx.fillStyle = fill;
        ctx.fillRect(x, y, w, rowHeight - 2);
        lines.forEach((line, index) => label(ctx, line, x + w / 2, y + rowHeight / 2 + (index - (lines.length - 1) / 2) * 33,
          textSize, { color: heading ? "#fff" : "#000", align: "center", weight: heading ? 900 : 400 }));
        x += w + 2;
      }
    };
    tableRow([["时间"], ["获取数量"], ["变化原因"]], tableY, 54, "#c2ad7e", true);
    let y = tableY + 54;
    for (const [index, row] of rows.entries()) {
      tableRow(row.values, y, row.height, index % 2 ? "#e9e7e2" : "#fff");
      y += row.height;
    }
    label(ctx, `当前第${model.page}页`, width / 2, tableBottom + 28, textSize, { align: "center", color: "#000" });
  }, options);
}

export async function renderStarRailMonthlyCard(model: ReturnType<typeof makeStarRailMonthlyCard>, options: StarRailCardOptions = {}) {
  const [background, jade, pass] = await Promise.all([image("month/kll.jpg"), image("month/星琼.png"), image("month/车票.png")]);
  const width = 625, metrics = new Canvas(1, 1).getContext("2d");
  metrics.font = `400 17px ${font}`;
  const groups = model.groups.map(group => ({ ...group, lines: wrap(metrics, `${group.name} ${group.count}`, 185) }));
  const legendHeight = groups.reduce((height, group) => height + 23 * group.lines.length + 7, 0);
  const chartY = 514, chartHeight = Math.max(300, legendHeight + 20), height = chartY + chartHeight + 71;
  return renderStarRailCard(width, height, ctx => {
    ctx.fillStyle = "#faf9f7";
    ctx.fillRect(0, 0, width, height);
    cover(ctx, background, width, height);
    label(ctx, `${model.month} | 开拓日历`, 7, 50, 36, { weight: 700 });
    label(ctx, "继续努力，星辰大海在等着你呢！", 7, 98, 20, { color: "#2e353e" });
    model.incomes.forEach((income, index) => {
      const y = 121 + index * 111;
      box(ctx, 7.5, y + 0.5, 581, 100, [5, 25, 5, 5], "rgba(244,242,229,.60)", "#cecece");
      label(ctx, income.label, 18, y + 35, 30, { color: "#f38d38", weight: 700 });
      ctx.drawImage(jade, 18, y + 65, 20, 20);
      const first = `星琼：${income.hcoin}`;
      label(ctx, first, 43, y + 76, 24, { color: "#565656", weight: 700 });
      const second = 63 + ctx.measureText(first).width;
      ctx.drawImage(pass, second, y + 65, 20, 20);
      label(ctx, `星轨通票&星轨专票：${income.railsPass}`, second + 25, y + 76, 24,
        { color: "#565656", weight: 700, maxWidth: 575 - second - 25 });
    });
    box(ctx, 7.5, 454.5, 581, chartHeight + 65, [5, 25, 5, 5], "rgba(244,242,229,.60)", "#cecece");
    label(ctx, "本月星琼收入", 18, 489, 30, { color: "#f38d38", weight: 700 });
    const cy = chartY + chartHeight / 2, cx = 399, radius = 111;
    ctx.lineWidth = 39;
    ctx.strokeStyle = "#edeae5";
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
    for (const group of groups) {
      if (!group.visible) continue;
      const start = -Math.PI / 2 - group.offset / radius;
      const length = Number(group.dash.split(" ")[0]);
      ctx.strokeStyle = group.color;
      ctx.beginPath(); ctx.arc(cx, cy, radius, start, start + length / radius); ctx.stroke();
    }
    for (const group of groups) if (group.showPercentage) {
      label(ctx, `${group.percentage}%`, cx + group.x - 145, cy + group.y - 145, 15, { color: "#20202a", align: "center" });
    }
    label(ctx, "总计", cx, cy - 12, 24, { weight: 700, align: "center" });
    label(ctx, String(model.total), cx, cy + 21, 24, { weight: 700, align: "center", maxWidth: 176 });
    let y = cy - legendHeight / 2;
    for (const group of groups) {
      box(ctx, 52, y + 6, 19, 11, 2, group.color);
      for (const [index, line] of group.lines.entries()) label(ctx, line, 77, y + 12 + 23 * index, 17);
      y += group.lines.length * 23 + 7;
    }
    label(ctx, model.cardBrand, width / 2, height - 35, 24, { color: "#8f8f8f", align: "center" });
  }, options);
}

export async function renderStarRailOnlineCard(model: NonNullable<ReturnType<typeof makeStarRailOnlineCard>>, options: StarRailCardOptions = {}) {
  const [logo, mascot, timeline] = await Promise.all([
    image("online/logo.png"), image("online/pamu.png"), image("online/jeremy-thomas-E0AHdsENmDg-unsplash.jpg"),
  ]);
  const width = 800, detailsY = 854, detailStride = 110;
  const footerY = detailsY + model.details.length * detailStride + 7, height = footerY + (model.complete ? 96 : 120);
  return renderStarRailCard(width, height, ctx => {
    ctx.fillStyle = "#f5edd6";
    ctx.fillRect(0, 0, width, height);
    box(ctx, 5.5, 43.5, 779, 141, 20, "#fcf3cc", "#f5daa9");
    box(ctx, 12, 50, 767, 128, 15, undefined, "#f5daa9", 2);
    ctx.drawImage(logo, 12, 60, 200, 200 * logo.height / logo.width);
    label(ctx, model.nickname, 260, 114, 30, { maxWidth: 200 });
    const nicknameWidth = Math.min(200, ctx.measureText(model.nickname).width);
    label(ctx, model.uid, 267 + nicknameWidth, 117, 24, { color: "#2e353e", maxWidth: 340 - nicknameWidth });
    label(ctx, `${model.region}${model.level ? ` ${model.level}级` : ""}`, 260, 151, 24, { color: "#aaac9c" });
    ctx.drawImage(mascot, 620, 20, 180, 180 * mascot.height / mascot.width);

    label(ctx, "近期每日在线时长", 400, 226, 24, { align: "center" });
    const barWidth = (700 - Math.max(0, model.bars.length - 1) * 14) / Math.max(1, model.bars.length);
    model.bars.forEach((bar, index) => {
      const x = 50 + index * (barWidth + 14), center = x + barWidth / 2;
      const h = Math.max(2, 2.2 * bar.height), color = (index + 1) % 3 === 0 ? colors[2] : colors[index % 2];
      ctx.fillStyle = "#98979733";
      ctx.fillRect(x, 260, barWidth, 220);
      ctx.fillStyle = color!;
      ctx.fillRect(center - barWidth * 0.34, 480 - h, barWidth * 0.68, h);
      label(ctx, bar.hours, center, 470 - h, 16, { color: "#20282e", align: "center" });
      label(ctx, bar.shortDate, center, 494, 16, { color: "#20282e", align: "center" });
    });
    label(ctx, `${model.year} 年每日在线时长热力图`, 400, 544, 24, { align: "center" });
    for (const month of model.months) label(ctx, month.label, 50 + month.x, 605, 13);
    for (const cell of model.cells) {
      box(ctx, 50 + cell.x, 578 + cell.y, 11, 16, 0, cell.color, "#b9b5a9", 0.25);
    }

    label(ctx, "近期在线可视化", 400, 799, 24, { align: "center" });
    for (const [index, value] of ["0", "6", "12", "18", "24"].entries()) {
      label(ctx, value, 104 + index * 159, 838, 16, { align: "center" });
    }
    for (const [index, detail] of model.details.entries()) {
      const y = detailsY + index * detailStride, x = 104, span = 646;
      label(ctx, detail.date, x - 2, y + 49, 12, { align: "right" });
      ctx.save();
      if (!detail.covered) ctx.globalAlpha = 0.35;
      box(ctx, x, y, span, 102, 10);
      ctx.clip();
      ctx.drawImage(timeline, (timeline.width - span) / 2, (timeline.height - 102) / 2, span, 102, x, y, span, 102);
      let left = x;
      ctx.fillStyle = "rgba(237,237,237,0.70)";
      for (const block of detail.blocks) {
        const blockWidth = span * block.width / 100;
        if (!block.online) ctx.fillRect(left, y, blockWidth, 102);
        left += blockWidth;
      }
      ctx.restore();
      ctx.save();
      if (!detail.covered) ctx.globalAlpha = 0.35;
      box(ctx, x + 1, y, span - 2, 102, 10, undefined, "#000", 2);
      ctx.restore();
    }
    const noteHeight = model.complete ? 30 : 54;
    box(ctx, 51, footerY, 698, noteHeight, 5, undefined, "#a45000", 2);
    label(ctx, model.note, 400, footerY + 16, 16, { color: "#a45000", align: "center" });
    if (!model.complete) label(ctx, "已达到查询页数上限，仅显示本次读取的记录。", 400, footerY + 40, 16,
      { color: "#a45000", align: "center" });
    label(ctx, model.cardBrand, 400, footerY + noteHeight + 32, 24, { align: "center" });
  }, options);
}

const statisticsNumbers = "LotusStarRailStatisticsNumbers";
const statisticsColors = ["#73a9c6", "#d56565", "#70b2b4", "#bd9a5a", "#739970", "#7a6da7", "#597ea0", "#ffb6c1"];
const statisticsActions = new Map(["other", "adventure_reward", "space_reward", "daily_reward", "abyss_reward",
  "mail_reward", "event_reward", "combat_reward"].map((action, index) => [action, index]));
let statisticsFont = false;

export async function renderStarRailMonthlyStatistics(model: StarRailMonthlyStatistics, options: StarRailCardOptions = {}) {
  if (!statisticsFont) {
    FontLibrary.use(statisticsNumbers, fileURLToPath(new URL("statistics/tttgbnumber.ttf", theme)));
    statisticsFont = true;
  }
  const [logo, banner] = await Promise.all([image("statistics/logo.png"), image("statistics/header.webp")]);
  const contentWidth = 530, scale = 1.3;
  const pieHeight = Math.max(282, 52 + model.sources.length * 18);
  const height = 608 + pieHeight;
  const monthName = (key: string) => `${Number(key.slice(4))}月`;
  const cards = [
    [model.hcoin >= 10_000 ? `${(model.hcoin / 10_000).toFixed(2)}w` : String(model.hcoin), "总星琼"],
    [`${model.wishes}抽`, "总抽数"], [monthName(model.bestJade.key), "星琼最多"],
    [String(model.bestJade.snapshot.monthly.hcoin), `${monthName(model.bestJade.key)}星琼`],
    [`${model.railsPass}张`, "总专&通票"], [monthName(model.bestPass.key), "专&通票最多"],
    ...model.sources.slice(0, 2).map(({ count, name }) => [String(count), name]),
  ];
  return renderStarRailCard(Math.round(contentWidth * scale), Math.ceil(height * scale), ctx => {
    ctx.scale(scale, scale);
    const number = (value: string, x: number, y: number, size: number, color = "#1e1f20") =>
      label(ctx, value, x, y, size, { color, align: "center", family: `"${statisticsNumbers}", ${font}` });
    const section = (title: string, y: number, h: number) => {
      box(ctx, 15, y, 500, h, 15, "#fff");
      box(ctx, 7, y - 10, 76, 24, [15, 0, 15, 15], "#d4b98c");
      label(ctx, title, 16, y + 2, 14, { color: "#fff" });
    };
    ctx.fillStyle = "#f5f6fb";
    ctx.fillRect(0, 0, contentWidth, height);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(15, 20, 500, 71, [15, 50, 50, 15]);
    ctx.clip();
    ctx.fillStyle = "#516070";
    ctx.fillRect(15, 20, 500, 71);
    const bannerWidth = banner.width / banner.height * 71;
    ctx.drawImage(banner, 515 - bannerWidth, 20, bannerWidth, 71);
    ctx.restore();
    label(ctx, `ID: ${model.uid}`, 35, 43, 24, { color: "#e8ebee", family: `"${statisticsNumbers}", ${font}` });
    label(ctx, `${model.period.label}星琼统计`, 35, 69, 20, { weight: 700, color: "#f3f6f8" });
    ctx.drawImage(logo, 350, 13, 150, logo.height / logo.width * 150);

    section("数据总览", 112, 124);
    cards.forEach(([amount, title], index) => {
      const x = 82 + (index % 4) * 122;
      const y = 144 + Math.floor(index / 4) * 50;
      number(amount!, x, y, 22);
      label(ctx, title!, x, y + 22, 13, { color: "#7f858a", align: "center", maxWidth: 115 });
    });

    section("月份统计", 259, 302);
    const chartBottom = 522;
    const peak = Math.max(1, ...model.months.map(month => month.snapshot.monthly.hcoin));
    const decade = 10 ** Math.floor(Math.log10(Math.ceil(peak / 4)));
    const stepSize = [1, 2, 2.5, 5, 10].map(step => step * decade).find(step => step * 4 >= peak) ?? peak;
    const maximum = stepSize * 4;
    const chartWidth = 433;
    const step = chartWidth / model.months.length;
    const barWidth = Math.min(50, step * 0.65);
    ctx.strokeStyle = "#e4e9f0";
    for (let line = 0; line <= 4; line++) {
      const y = chartBottom - line * 50;
      ctx.beginPath(); ctx.moveTo(61, y); ctx.lineTo(500, y); ctx.stroke();
      number(String(Math.round(maximum * line / 4)), 40, y, 10, "#59616e");
    }
    model.months.forEach(({ key, snapshot, finalized }, index) => {
      const amount = snapshot.monthly.hcoin;
      const x = 64 + (index + 0.5) * step;
      const bar = 200 * amount / maximum;
      ctx.fillStyle = finalized ? "#5b8ff9" : "#95b3ec";
      ctx.fillRect(x - barWidth / 2, chartBottom - bar, barWidth, bar);
      number(String(amount), x, chartBottom - bar - 11, 10);
      label(ctx, monthName(key), x, chartBottom + 15, 12, { align: "center" });
    });

    section("详细统计", 582, pieHeight);
    const sum = model.sources.reduce((total, row) => total + row.count, 0);
    const cx = 154, cy = 582 + pieHeight / 2;
    let angle = -Math.PI / 2;
    ctx.lineWidth = 23;
    for (const [index, { name, count, action }] of model.sources.entries()) {
      const color = statisticsColors[statisticsActions.get(action ?? "") ?? index % statisticsColors.length]!;
      if (sum && count) {
        const end = angle + (count / sum) * 2 * Math.PI;
        ctx.beginPath(); ctx.arc(cx, cy, 84, angle, end); ctx.strokeStyle = color; ctx.stroke();
        const percent = Math.round(100 * count / sum);
        if (percent >= 2) {
          const center = (angle + end) / 2;
          number(`${percent}%`, cx + Math.cos(center) * 84, cy + Math.sin(center) * 84, 11, "#1e1f20");
        }
        angle = end;
      }
      const y = 609 + 18 * index;
      box(ctx, 280, y - 5, 10, 10, 2, color);
      label(ctx, name, 296, y, 13, { maxWidth: 140 });
      label(ctx, String(count), 492, y, 13, { align: "right", color: "#59616e" });
    }
    label(ctx, "总计", cx, cy - 10, 14, { align: "center" });
    number(String(sum), cx, cy + 13, 24);
    label(ctx, `已归档 ${model.months.length}/${model.period.last - model.period.first + 1} 个月 · Lotus-Yunzai`,
      contentWidth / 2, height - 12, 11, { color: "#7994a7", align: "center" });
  }, options);
}
