import { Canvas } from "skia-canvas";
import { renderPng } from "@lotus-yunzai/skia";
import { fill, image, picture, rounded, soulColors, styles, themeArt, typography } from "./panel-skia-theme.ts";
import type { makePanelListCards } from "./panel-card.ts";

type Model = Awaited<ReturnType<typeof makePanelListCards>>[number];
const width = 650;
const density = 4;
const bodyX = 10, bodyWidth = 625, columns = 8, cardWidth = 75, cardHeight = 96;

export async function renderStarRailPanelList(model: Model, theme: string, mode: "auto" | "gpu" = "auto") {
  const font = typography(theme);
  const [background, texture, stars, faces] = await Promise.all([
    themeArt(theme, "common/bg/bg-sr.webp"),
    themeArt(theme, "common/cont/card-bg.png"),
    Promise.all([1, 2, 3, 4, 5].map(n => themeArt(theme, `common/item/bg${n}.png`))),
    Promise.all(model.chars.map(char => image(char.face))),
  ]);
  const gridTop = model.msg ? 111 : 94;
  const gridHeight = Math.ceil(model.chars.length / columns) * cardHeight + 20;
  const footerTop = gridTop + gridHeight;
  const height = footerTop + 35 + 37;
  const measure = new Canvas(1, 1).getContext("2d");

  return renderPng(width * density, height * density, ctx => {
    ctx.scale(density, density);
    const text = styles(ctx, font);
    fill(ctx, "#242e45", 0, 0, width, height);
    picture(ctx, background, 0, 0, width, height, "cover", 0, 0);
    ctx.save();
    ctx.shadowColor = "#000b";
    ctx.shadowBlur = 3;
    text("#面板列表", bodyX + 20, 40, 36, "#fff", "left", false, true);
    measure.font = `36px ${font.title}`;
    text(`UID:${model.uid}`, bodyX + 34 + measure.measureText("#面板列表").width, 49, 14, "#fff");
    const infoY = model.msg ? 88 : 71;
    if (model.msg) text(model.msg, bodyX + 20, 71, 14, "#fff");
    text("使用", bodyX + 20, infoY, 14);
    const command = `*${model.chars[0]?.abbr ?? "三月七"}面板${model.profileSuffix}`;
    text(command, bodyX + 50, infoY, 14, "#d3bc8e");
    measure.font = `14px ${font.body}`;
    text("查看角色详情", bodyX + 53 + measure.measureText(command).width, infoY, 14);
    ctx.restore();

    ctx.save();
    rounded(ctx, bodyX, gridTop, bodyWidth, gridHeight + 35, 10);
    ctx.clip();
    if (texture) {
      const h = gridHeight + 35, w = h * texture.width / texture.height;
      for (let x = bodyX; x < bodyX + bodyWidth; x += w) ctx.drawImage(texture, x, gridTop, w, h);
    } else fill(ctx, "#26394f", bodyX, gridTop, bodyWidth, gridHeight + 35);
    for (const [index, character] of model.chars.entries()) {
      const x = bodyX + 10 + (index % columns) * cardWidth, y = gridTop + 15 + Math.floor(index / columns) * cardHeight;
      ctx.save();
      ctx.shadowColor = "#000";
      ctx.shadowBlur = 3;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      fill(ctx, "#fff", x + 6, y, 64, 64, 32);
      ctx.restore();
      ctx.save();
      rounded(ctx, x + 8, y + 2, 60, 60, 30);
      ctx.clip();
      const star = stars[Number(character.star) - 1];
      if (star) picture(ctx, star, x + 8, y + 2, 60, 60, "cover");
      const face = faces[index];
      if (face) {
        const faceWidth = 60 * face.width / face.height;
        ctx.drawImage(face, x + 38 - faceWidth / 2, y + 2, faceWidth, 60);
      }
      ctx.restore();

      const cons = String(character.cons);
      measure.font = `12px ${font.body}`;
      const badgeWidth = measure.measureText(cons).width * .8 + 7;
      measure.font = `14px ${font.body}`;
      const showNew = character.isNew && model.hasNew;
      const nameWidth = Math.min(cardWidth - badgeWidth - (showNew ? 14 : 4), measure.measureText(character.abbr).width);
      const total = nameWidth + badgeWidth + (showNew ? 13 : 2);
      let textX = x + (cardWidth - total) / 2;
      if (showNew) {
        fill(ctx, "#90e800", textX, y + 73, 8, 8, 4);
        textX += 11;
      }
      text(character.abbr, textX, y + 77, 14, "#fff", "left", false, false, nameWidth);
      const badgeX = textX + nameWidth + 2;
      fill(ctx, soulColors[Number(character.cons)] ?? soulColors[0], badgeX, y + 70.5, badgeWidth, 13, 3);
      text(cons, badgeX + badgeWidth / 2, y + 77, 10, "#fff", "center");
    }
    fill(ctx, "#0006", bodyX, footerTop, bodyWidth, 35);
    if (model.hasNew) {
      fill(ctx, "#90e800", bodyX + 15, footerTop + 14, 8, 8, 4);
      text("本次更新角色", bodyX + 26, footerTop + 18, 12, "#fff");
    } else if (model.updateTime.profile) {
      text(`更新时间：${model.updateTime.profile}`, bodyX + 15, footerTop + 18, 12, "#fff");
    }
    text(`当前更新服务：${model.servName}`, bodyX + bodyWidth - 15, footerTop + 18, 12, "#fff", "right");
    ctx.restore();
    rounded(ctx, bodyX, gridTop, bodyWidth, gridHeight + 35, 10);
    ctx.strokeStyle = "#ffffff40";
    ctx.stroke();
    text(model.cardBrand, width / 2, height - 18, 14, "#fff", "center");
  }, mode, { allowHalfScale: true });
}
