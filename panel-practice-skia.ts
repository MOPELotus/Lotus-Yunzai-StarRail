import { createTranslator as createTextTranslator } from "../../packages/i18n/index.ts";
import messageCatalog from "./i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import { Canvas } from "skia-canvas";
import { renderPng } from "@lotus-yunzai/skia";
import { fill, image, picture, rounded, soulColors, styles, themeArt, typography } from "./panel-skia-theme.ts";
import type { makePanelPracticeCards } from "./panel-card.ts";

type Model = Awaited<ReturnType<typeof makePanelPracticeCards>>[number];
const width = 600, density = 4;
const tableX = 10, tableY = 107, tableWidth = 575, rowHeight = 36;
const columns = [23, 94, 29, 35, 26, 28, 28, 28, 176, 108];
const headers = ["#", $t("panel-practice-skia.text_c47b54e84e"), "Lv", $t("panel-practice-skia.text_9bd2d5af77"), "A", "E", "Q", "T", $t("panel-practice-skia.text_e733238b28"), $t("panel-practice-skia.text_2f2b17beb4")];
const columnX = columns.map((_, index) => tableX + columns.slice(0, index).reduce((a, b) => a + b, 0));
const rarityColors = ["#0000", "#c8c8c859", "#a8ff8559", "#89a8ff59", "#c386ff59", "#ffd48459"];
const talentBgs = ["#0000", "#3c3f414c", "#17b83a80", "#1b80d480", "#925aff8c", "#ff241a8c"];
const talentColor = ["#006cc7", "#333", "#005800", "#333", "#720465", "#b70000"];
const levelClasses = [[0, 1, 1, 2, 3, 4, 5], [0, 1, 1, 1, 2, 2, 3, 3, 3, 4, 5]];

function gradeColors(grade: string | undefined) {
  if (grade === "ACE" || grade === "MAX") return ["#ffe4b480", "#ff5722"] as const;
  if (grade === "SS" || grade === "SSS") return ["#dfbeff80", "#531ba9cf"] as const;
  if (grade === "S" || grade === "A") return ["#bed0ff80", "#3955b7"] as const;
  return ["#ababab80", "#aaa"] as const;
}

export async function renderStarRailPanelPractice(model: Model, theme: string, mode: "auto" | "gpu" = "auto") {
  const font = typography(theme);
  const [background, banner, crown, emptyRelic, relicBg, rows] = await Promise.all([
    themeArt(theme, "common/bg/bg-sr.webp"), image(model.main),
    themeArt(theme, "common/item/crown-sr-o.png"), themeArt(theme, "common/item/artifact-icon.webp"),
    themeArt(theme, "common/item/bg5.png"),
    Promise.all(model.avatars.map(async row => ({
      face: await image(row.face), weapon: await image(row.weapon?.icon), relics: await Promise.all(row.relics.map(image)),
    }))),
  ]);
  const footerY = tableY + (model.avatars.length + 1) * rowHeight;
  const height = footerY + 83;
  const measure = new Canvas(1, 1).getContext("2d");

  return renderPng(width * density, height * density, ctx => {
    ctx.scale(density, density);
    const text = styles(ctx, font);
    fill(ctx, "#242e45", 0, 0, width, height);
    if (background) {
      const h = width * background.height / background.width;
      for (let y = 0; y < height; y += h) ctx.drawImage(background, 0, y, width, h);
    } else if (banner) ctx.drawImage(banner, 0, -25, width, width * banner.height / banner.width);
    ctx.save();
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 3;
    text($t("panel-practice-skia.text_8cb98d4472"), 35, 51, 36, "#fff", "left", false, true);
    text($t("panel-practice-skia.text_eebb4bced5", { "uid": model.uid, "total": model.total }), 35, 82, 16);
    ctx.restore();

    ctx.save();
    rounded(ctx, tableX, tableY, tableWidth, footerY + 36 - tableY, 10);
    ctx.clip();
    fill(ctx, "#000c", tableX, tableY, tableWidth, rowHeight);
    headers.forEach((label, i) => {
      const x = columnX[i]!, w = columns[i]!;
      ctx.strokeStyle = "#fff3";
      ctx.strokeRect(x, tableY, w, rowHeight);
      text(label, x + w / 2, tableY + 18, 14, "#d3bc8e", "center", true);
    });
    model.avatars.forEach((row, index) => {
      const y = tableY + (index + 1) * 36;
      const art = rows[index]!;
      fill(ctx, index % 2 ? "#fff" : "#f0f0f0", tableX, y, tableWidth, rowHeight);
      fill(ctx, rarityColors[row.star ?? 0] ?? "#0000", tableX, y, columns[0]! + columns[1]!, rowHeight);
      const nameColor = row.star === 5 ? "#6f4b00" : row.star === 4 ? "#720465" : "#333";
      text(model.start + index + 1, 21.5, y + 18, 14, "#333", "center");
      picture(ctx, art.face, 36, y + 3, 30, 30);
      text(row.name, 71, y + 18, 14, nameColor, "left", false, false, 53);
      text(row.level ?? "—", columnX[2]! + columns[2]! / 2, y + 18, 14, "#333", "center");
      const soulX = columnX[3]! + columns[3]! / 2;
      fill(ctx, soulColors[row.cons ?? 0] ?? soulColors[0], soulX - 8, y + 7, 16, 22, 4);
      text(row.cons ?? "—", soulX, y + 18, 13, "#fff", "center");
      row.talent.forEach((skill, i) => {
        const x = columnX[4 + i]!, w = columns[4 + i]!;
        const cls = levelClasses[i ? 1 : 0]?.[skill.original || 1] ?? 0;
        fill(ctx, talentBgs[cls] ?? "#0000", x, y, w, 36);
        if (cls === 5) picture(ctx, crown, x, y, w, 36);
        const raised = skill.original !== undefined && typeof skill.level === "number" && skill.level > skill.original;
        text(skill.level, x + w / 2, y + 18, raised ? 15 : 14, raised ? talentColor[cls] : "#333", "center", raised);
      });
      const coneX = columnX[8]!;
      const weapon = row.weapon;
      if (weapon) {
        fill(ctx, rarityColors[weapon.star ?? 0] ?? "#0000", coneX, y, columns[8]!, 36);
        text("Lv", coneX + 3, y + 19, 9, "#333");
        text(weapon.level ?? "—", coneX + 12, y + 18, 12, "#333");
        picture(ctx, art.weapon, coneX + 29, y, 28, 36);
        fill(ctx, soulColors[(weapon.affix ?? 0) + 1] ?? "#666", coneX + 58, y + 11, 12, 14, 3);
        text(weapon.affix ?? "—", coneX + 64, y + 18, 10, "#fff", "center");
        text(weapon.name, coneX + 73, y + 18, 12, weapon.star === 5 ? "#6f4b00" : weapon.star === 4 ? "#720465" : "#333", "left", false, false, 100);
      }
      const relicX = columnX[9]!;
      const [tint, markColor] = gradeColors(row.rating?.markClass);
      fill(ctx, tint, relicX, y, columns[9]!, 36);
      if (art.relics.length === 0) {
        fill(ctx, "#bbb", relicX + 5, y + 3, 30, 30, 4);
        picture(ctx, emptyRelic, relicX + 8, y + 6, 24, 24);
      } else {
        picture(ctx, relicBg, relicX + 5, y + 3, 30, 30, "cover");
        art.relics.forEach((icon, i) => {
          const compact = art.relics.length > 2;
          const size = compact ? 15 : art.relics.length > 1 ? 21 : 28;
          const dx = compact ? i % 2 * 14 : i * 8;
          const dy = compact ? Math.floor(i / 2) * 14 : i * 8;
          picture(ctx, icon, relicX + 6 + dx, y + 5 + dy, size, size);
        });
      }
      if (row.rating) {
        fill(ctx, markColor, relicX + 37, y + 11, 26, 14, 4);
        text(row.rating.markClass, relicX + 50, y + 18, 10, "#fff", "center");
        text(row.rating.mark, relicX + 65, y + 18, 14, "#333");
      } else text($t("panel-practice-skia.text_75ef5c86a9"), relicX + 40, y + 18, 11, "#666", "left", false, false, 64);
      ctx.strokeStyle = "#6663";
      columns.forEach((w, i) => ctx.strokeRect(columnX[i]!, y, w, rowHeight));
    });
    fill(ctx, "#000c", tableX, footerY, tableWidth, 36);
    const updated = [model.updateTime.profile && $t("panel-practice-skia.text_94fd113221", { "profile": model.updateTime.profile }), model.updateTime.mys && $t("panel-practice-skia.text_f42ae69be1", { "mys": model.updateTime.mys })].filter(Boolean).join("  ");
    if (updated) {
      measure.font = `12px ${font.body}`;
      const start = (width - measure.measureText($t("panel-practice-skia.text_c792f14b77") + updated).width) / 2;
      text($t("panel-practice-skia.text_d3f348a8d6"), start, footerY + 18, 12, "#d3bc8e");
      text(updated, start + 85, footerY + 18, 12, "#fff");
    } else text($t("panel-practice-skia.text_d251e43746"), width / 2, footerY + 18, 12, "#fff", "center");
    ctx.restore();
    rounded(ctx, tableX, tableY, tableWidth, footerY + 36 - tableY, 10);
    ctx.strokeStyle = "#fff5";
    ctx.stroke();
    text(model.cardBrand, width / 2, height - 28, 14, "#fff", "center");
  }, mode, { allowHalfScale: true });
}
