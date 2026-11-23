import { readFile, realpath, stat } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { loadImage } from "skia-canvas";
import { registerGachaThemeFont } from "../../../packages/skia/gacha-theme-fonts.ts";
import { readStarRailGachaItems, starRailGachaThemeDirectory } from "../gacha-detail-source.ts";
import { renderStarRailCard, type StarRailCardOptions } from "../render-card.ts";
import type { WarpPull } from "./draw.ts";
import { starRailReincarnationThemeDirectory } from "./reincarnation-theme.ts";

type Picture = Awaited<ReturnType<typeof loadImage>>;
type Context = Parameters<Parameters<typeof renderStarRailCard>[2]>[0];
const width = 2200, height = 1040;
const cardWidth = 484, cardHeight = 246.4, gutter = 20;
const palette = { 3: "#7ba5d7", 4: "#b892ff", 5: "#fefe8b" };
const fallbackFont = '"Noto Sans CJK SC", sans-serif';
const backgroundLayers = [
  ["bg2.png", 0.85], ["bkg-line.png", 0.4], ["CS_Gacha_BG_Stars3.png", 0.3], ["GachaImg_Common_Star.png", 0.5],
] as const;
const elementName: Readonly<Record<string, string>> = {
  火: "Fire", 冰: "Ice", 雷: "Thunder", 风: "Wind", 量子: "Quantum", 虚数: "Imaginary", 物理: "Physical",
};
const elementIcon: Readonly<Record<string, string>> = {
  火: "elem-fire", 冰: "elem-ice", 雷: "elem-elec", 风: "elem-wind", 量子: "elem-auantum", 虚数: "elem-imaginary", 物理: "elem-phy",
};
const paths = new Set(["开拓", "毁灭", "巡猎", "智识", "同谐", "虚无", "存护", "丰饶", "记忆", "欢愉"]);

interface WarpCard extends StarRailCardOptions {
  readonly title: string;
  readonly nickname?: string;
  readonly pity: number;
  readonly pulls: readonly WarpPull[];
  readonly page: number;
  readonly pages: number;
  readonly themeDirectory?: string;
}

async function asset(root: string | undefined, relative: string, maxBytes = 8 * 1024 * 1024) {
  if (!root) return;
  try {
    const file = await realpath(resolve(root, relative.replace(/^\//u, "")));
    if (!file.startsWith(root + sep)) return;
    const info = await stat(file);
    if (info.isFile() && info.size > 0 && info.size <= maxBytes) return file;
  } catch {}
}

async function loadTheme(directory: string, pulls: readonly WarpPull[]) {
  const configured = Bun.env.LOTUS_STAR_RAIL_WARP_THEME_DIR?.trim();
  const [root, warp] = await Promise.all([
    realpath(directory).catch(() => undefined),
    realpath(configured || resolve(directory, "simulation")).catch(() => undefined),
  ]);
  const images = new Map<string, Promise<Picture | undefined>>();
  function picture(root: string | undefined, relative: string) {
    const key = (root ?? "") + "\0" + relative;
    let pending = images.get(key);
    if (!pending) {
      pending = asset(root, relative).then(async file => {
        if (!file) return;
        const bytes = await readFile(file);
        const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
        const webp = bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
        const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
        if (png || webp || jpeg) return loadImage(bytes);
      }).catch(() => undefined);
      images.set(key, pending);
    }
    return pending;
  }
  const item = root && await readStarRailGachaItems(root).catch(() => undefined);
  const [layers, backdrop, titleIcon, star, fonts, artwork] = await Promise.all([
    Promise.all(backgroundLayers.map(async ([name, opacity]) => ({ image: await picture(warp, "img/bg/" + name), opacity }))),
    picture(root, "common/bg/bg-sr.webp"),
    picture(warp, "img/bg/DrawcardIcon.png"),
    picture(warp, "img/bg/StarBig.png"),
    asset(warp, "font/SR.ttf").then(async file => file ?? asset(root, "common/font/HYWH-65W.ttf"))
      .then(file => file ? registerGachaThemeFont("StarRailWarp", file) : undefined).catch(() => undefined),
    Promise.all(pulls.map(async pull => {
      const path = typeof item === "function" ? item({ name: pull.name, item_type: pull.kind })?.img : undefined;
      if (!path) return {};
      const cone = pull.kind === "光锥";
      const full = cone ? path : path.replace(/face\.webp$/u, "splash.webp");
      const cropped = cone ? path : path.replace(/face\.webp$/u, "preview.webp");
      const target = pulls.length === 1 ? full : cropped;
      const metadataFile = cone ? undefined : await asset(root, join(dirname(path.replace(/^\//u, "")), "../data.json"), 128 * 1024);
      const metadata = metadataFile ? await readFile(metadataFile, "utf8").then(content => JSON.parse(content)).catch(() => undefined) : undefined;
      const rawPath = cone ? path.split("/")[2] : metadata?.weapon;
      const pathName = typeof rawPath === "string" && paths.has(rawPath) ? rawPath : undefined;
      const element = typeof metadata?.elem === "string" ? metadata.elem : "";
      const [portrait, pathArt, elementArt] = await Promise.all([
        picture(root, target).then(image => image ?? picture(root, path)),
        pathName ? (cone && pulls.length === 1
          ? picture(root, `meta-sr/public/icons/type-${pathName}s.webp`)
              .then(image => image ?? picture(warp, `img/icon/weaponlife/${pathName}.png`))
          : picture(warp, `img/icon/weaponlife/${pathName}.png`)
              .then(image => image ?? picture(root, `meta-sr/public/icons/type-${pathName}s.webp`))) : undefined,
        elementName[element] ? picture(warp, `img/icon/damage/${elementName[element]}.png`)
          .then(image => image ?? picture(root, `meta-sr/public/icons/${elementIcon[element]}.webp`)) : undefined,
      ]);
      const allegiance = typeof metadata?.allegiance === "string" ? metadata.allegiance : undefined;
      return { portrait, pathArt, elementArt, pathName, allegiance, element };
    })),
  ]);
  return { layers, backdrop, titleIcon, star, artwork, font: fonts ? `${fonts}, ${fallbackFont}` : fallbackFont };
}

export async function renderWarpReincarnation({
  name, nickname, qq, path, allegiance, description, avatar, colors, inlineImageByteLimit, mode,
}: StarRailCardOptions & {
  readonly name: string; readonly nickname: string; readonly qq: string; readonly path?: string; readonly allegiance?: string;
  readonly description?: string; readonly avatar?: Uint8Array; readonly colors?: Readonly<Record<string, string>>;
}) {
  const themeDirectory = starRailGachaThemeDirectory();
  const theme = await loadTheme(themeDirectory, [{ name, kind: "角色", rarity: 5, order: 1, featured: false }]);
  const art = theme.artwork[0];
  const warp = await realpath(starRailReincarnationThemeDirectory()).catch(() =>
    realpath(resolve(themeDirectory, "simulation")).catch(() => undefined));
  function picture(relative: string) {
    return asset(warp, relative).then(file => file ? loadImage(file).catch(() => undefined) : undefined);
  }
  const faction = allegiance ?? art?.allegiance;
  const factionKey = faction?.startsWith("仙舟") && faction !== "仙舟「罗浮」" ? "仙舟联盟" : faction;
  const [otherPortrait, backdrop, emblem, userAvatar, titleFont, detailFont] = await Promise.all([
    path ? picture(`img/icon/other/${name}.png`) : undefined,
    picture("img/bg/bg1.png"),
    factionKey ? picture(`img/icon/allegiance/${factionKey}.png`) : undefined,
    avatar?.length ? loadImage(Buffer.from(avatar)).catch(() => undefined) : undefined,
    asset(warp, "font/NZBZ.ttf").then(file => file ? registerGachaThemeFont("StarRailRelifeTitle", file) : theme.font).catch(() => theme.font),
    asset(warp, "font/SHCN-Bold.otf", 16 * 1024 * 1024).then(file => file ? registerGachaThemeFont("StarRailRelifeDetail", file) : theme.font).catch(() => theme.font),
  ]);
  const fields = [["命途", path ?? art?.pathName], ["阵营", faction]] as const;
  const elementColor: Readonly<Record<string, string>> = {
    虚数: "#EDBE43", 量子: "#6A79E3", 风: "#40C48B", 冰: "#48C0F8", 雷: "#D850F8", 火: "#ED453C", 物理: "#808080",
  };
  const element = art?.element ?? "";
  const color = path ? "#D850F8" : (colors?.[element] ?? elementColor[element] ?? "#D850F8");
  const width = 1630, height = 777;
  return renderStarRailCard(width, height, ctx => {
    ctx.fillStyle = "#121025";
    ctx.fillRect(0, 0, width, height);
    if (backdrop ?? theme.backdrop) imageBox(ctx, (backdrop ?? theme.backdrop)!, 0, 0, width, height, true);
    const portrait = otherPortrait ?? art?.portrait;
    if (portrait) {
      const portraitWidth = 800 * portrait.width / portrait.height;
      imageBox(ctx, portrait, width * 0.7 - portraitWidth / 2, 0, portraitWidth, 800);
    }
    const ribbon = ctx.createLinearGradient(88, 0, 738, 0);
    for (const [point, opacity] of [[0, "#fff5"], [0.24, "#fff"], [0.76, "#fff"], [1, "#fff5"]] as const) ribbon.addColorStop(point, opacity);
    ctx.save();
    ctx.beginPath();
    ctx.arc(175, 100, 75, 0, 2 * Math.PI);
    ctx.clip();
    if (userAvatar && userAvatar.width <= 1024 && userAvatar.height <= 1024) imageBox(ctx, userAvatar, 100, 25, 150, 150, true);
    else {
      ctx.fillStyle = color;
      ctx.fillRect(100, 25, 150, 150);
      label(ctx, [...nickname][0] ?? "星", 175, 121, titleFont, 54, 86, "center");
    }
    ctx.restore();
    label(ctx, nickname, 290, 91, titleFont, 65, 445, "left", color);
    label(ctx, qq, 290, 152, titleFont, 48, 445, "left", color);
    ctx.fillStyle = ribbon;
    ctx.fillRect(88, 200, 650, 173);
    label(ctx, "恭喜你转生成了", 413, 261, titleFont, 59, 570, "center", color);
    label(ctx, name, 413, 350, titleFont, 95, 570, "center", color);
    for (const [index, [field, value]] of fields.entries()) {
      if (!value) continue;
      const top = 420 + index * 80;
      ctx.fillStyle = ribbon;
      ctx.fillRect(88, top, 650, 53);
      label(ctx, `${field}：${value}`, 413, top + 40, detailFont, 38, 540, "center", color);
    }
    if (emblem) {
      const fade = ctx.createLinearGradient(10, 0, 216, 0);
      for (const [stop, value] of [[0, "#fff0"], [0.35, "#fff"], [0.65, "#fff"], [1, "#fff0"]] as const) fade.addColorStop(stop, value);
      ctx.fillStyle = fade;
      ctx.fillRect(10, 372, 206, 213);
      imageBox(ctx, emblem, 10, 372, 206, 213);
    }
    const identity = "身份：" + (description ?? (path ? "星神" : "星穹铁道角色"));
    const { rows, size, line } = wrapIdentity(ctx, identity, detailFont);
    ctx.fillStyle = ribbon;
    ctx.fillRect(88, 580, 650, rows.length * line + 14);
    for (const [index, row] of rows.entries()) {
      label(ctx, row, 413, 589 + size + index * line, detailFont, size, 610, "center", color);
    }
    label(ctx, "Lotus-Yunzai · StarRail", 20, 756, theme.font, 22, 550);
  }, { inlineImageByteLimit, mode });
}

function wrapIdentity(ctx: Context, text: string, font: string) {
  for (let size = 30; size >= 16; size -= 2) {
    ctx.font = `${size}px ${font}`;
    const line = size + 5;
    const rows: string[] = [];
    let row = "";
    for (const glyph of text) {
      if (row && ctx.measureText(row + glyph).width > 610) {
        const glyphs = [...row];
        if (glyphs.length > 1 && /[、，。；：？！）】」』》,.!?]/u.test(glyph)) {
          const last = glyphs.pop()!;
          rows.push(glyphs.join(""));
          row = last + glyph;
        } else {
          rows.push(row);
          row = glyph;
        }
      } else row += glyph;
    }
    if (row) rows.push(row);
    if (rows.length * line <= 151) return { rows, size, line };
    if (size === 16) return { rows: [...rows.slice(0, 6), rows[6]!.slice(0, -1) + "…"], size, line };
  }
  throw new Error("转生身份排版无效。");
}

type Theme = Awaited<ReturnType<typeof loadTheme>>;
type Art = Theme["artwork"][number];

function imageBox(ctx: Context, image: Picture, x: number, y: number, w: number, h: number, cover = false) {
  const zoom = (cover ? Math.max : Math.min)(w / image.width, h / image.height);
  const drawnWidth = image.width * zoom, drawnHeight = image.height * zoom;
  ctx.drawImage(image, x + (w - drawnWidth) / 2, y + (h - drawnHeight) / 2, drawnWidth, drawnHeight);
}

function label(ctx: Context, value: string, x: number, y: number, font: string, size: number,
  maxWidth: number, align: CanvasTextAlign = "left", color = "#fff") {
  ctx.fillStyle = color;
  ctx.font = `${size}px ${font}`;
  ctx.textAlign = align;
  ctx.fillText(value, x, y, maxWidth);
}

function rankStars(ctx: Context, pull: WarpPull, theme: Theme, x: number, y: number, size: number) {
  if (!theme.star) {
    label(ctx, "★".repeat(pull.rarity), x, y + size, theme.font, size, 220, "left", palette[pull.rarity]);
    return;
  }
  for (let index = 0; index < pull.rarity; index++) imageBox(ctx, theme.star, x + index * size * 0.96, y, size, size);
}

function drawSingle(ctx: Context, pull: WarpPull, art: Art, theme: Theme) {
  const cone = pull.kind === "光锥";
  if (art.portrait) {
    const fraction = cone ? 0.6 : 1;
    imageBox(ctx, art.portrait, width * (1 - fraction) / 2, height * (1 - fraction) / 2, width * fraction, height * fraction);
  }
  const x = 300, top = 500, captionWidth = 480;
  ctx.fillStyle = "#fff";
  ctx.fillRect(x + 195, top, 90, 44);
  label(ctx, [...pull.kind].join(" "), x + 240, top + 34, theme.font, 30, 84, "center", "#111");
  const caption = ctx.createLinearGradient(x, top, x + captionWidth, top);
  caption.addColorStop(0, "#777c");
  caption.addColorStop(0.5, "#000e");
  caption.addColorStop(1, "#6b6b6bc2");
  ctx.fillStyle = caption;
  ctx.fillRect(x, top + 59, captionWidth, 130);
  const icon = cone ? art.pathArt : art.elementArt;
  if (icon) imageBox(ctx, icon, x + 39, top + 68, 110, 110);
  label(ctx, pull.name, x + 169, top + 115, theme.font, 45, 286);
  rankStars(ctx, pull, theme, x + 169, top + 132, 39);
  if (!cone && art.pathName) {
    if (art.pathArt) imageBox(ctx, art.pathArt, x + 156, top + 193, 46, 46);
    label(ctx, art.pathName, x + 213, top + 227, theme.font, 30, 160);
  }
}

function drawResult(ctx: Context, pull: WarpPull, art: Art, theme: Theme, x: number, y: number) {
  const accent = palette[pull.rarity];
  const cone = pull.kind === "光锥";
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = accent + "90";
  ctx.shadowBlur = pull.rarity > 3 ? 20 : 8;
  ctx.fillStyle = "#0b0c11";
  ctx.fillRect(0, 0, cardWidth, cardHeight);
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.rect(0, 0, cardWidth, cardHeight);
  ctx.clip();
  const wash = ctx.createLinearGradient(0, cardHeight, 0, 0);
  wash.addColorStop(0, accent + "88");
  wash.addColorStop(0.67, "#0b0c11");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, cardWidth, cardHeight);
  const stars = theme.layers[2]?.image;
  if (stars) {
    ctx.globalAlpha = 0.6;
    ctx.drawImage(stars, 0, -cardHeight * 3.2, cardWidth * 2, cardWidth * 2 * stars.height / stars.width);
    ctx.globalAlpha = 1;
  }
  if (art.portrait) {
    if (cone) {
      const zoom = Math.min(cardHeight * 1.5 / art.portrait.height, 0.82 * cardWidth / art.portrait.width);
      const w = art.portrait.width * zoom, h = art.portrait.height * zoom;
      ctx.drawImage(art.portrait, cardWidth - w, 0, w, h);
    } else {
      imageBox(ctx, art.portrait, cardWidth * 0.1, 0, cardWidth * 0.9, cardHeight, true);
    }
  }
  const icon = cone ? art.pathArt : art.elementArt;
  const iconSize = cone ? 88 : 62;
  if (icon) imageBox(ctx, icon, cone ? 66 : 28, cone ? 54 : 108, iconSize, iconSize);
  rankStars(ctx, pull, theme, cone ? 58 : 44, 151, 32);
  label(ctx, pull.name, 24, 220, theme.font, 32, cardWidth - 48);
  if (pull.featured || pull.pity !== undefined) {
    const text = [pull.featured && "UP", pull.pity !== undefined && `${pull.pity} 抽`].filter(Boolean).join(" · ");
    ctx.fillStyle = accent;
    ctx.fillRect(cardWidth - 166, cardHeight - 46, 166, 46);
    label(ctx, text, cardWidth - 18, cardHeight - 16, theme.font, 27, 142, "right", "#0b0c11");
  }
  ctx.fillStyle = accent;
  ctx.fillRect(0, cardHeight - 7, cardWidth, 7);
  ctx.restore();
}

export async function renderWarpCard({
  title, nickname = "开拓者", pity, pulls, page, pages, themeDirectory = starRailGachaThemeDirectory(), mode, inlineImageByteLimit,
}: WarpCard) {
  if (pulls.length < 1 || pulls.length > 10) throw new RangeError("每张跃迁卡需有 1–10 抽。");
  const theme = await loadTheme(themeDirectory, pulls);
  return renderStarRailCard(width, height, ctx => {
    ctx.fillStyle = "#0b0c11";
    ctx.fillRect(0, 0, width, height);
    if (!theme.layers[0]?.image && theme.backdrop) {
      imageBox(ctx, theme.backdrop, 0, 0, width, height, true);
    }
    for (const { image, opacity } of theme.layers) {
      if (!image) continue;
      ctx.globalAlpha = opacity;
      imageBox(ctx, image, 0, 0, width, height, true);
    }
    ctx.globalAlpha = 1;
    if (pulls.length === 1) {
      drawSingle(ctx, pulls[0]!, theme.artwork[0]!, theme);
    } else {
      // The original three lines keep the draw order and lean at ten degrees.
      for (const [row, [start, end]] of ([[0, 3], [3, 7], [7, 10]] as const).entries()) {
        const group = pulls.slice(start, end);
        if (!group.length) break;
        const groupWidth = group.length * (cardWidth + gutter) - gutter;
        ctx.save();
        ctx.translate(width / 2 + (row - 1) * 165, 220 + row * (cardHeight + gutter));
        ctx.rotate(-Math.PI / 18);
        for (const [index, pull] of group.entries()) {
          const step = row === 0 && index === 1 ? -6.6 : row === 2 && index === 1 ? 44 : 0;
          drawResult(ctx, pull, theme.artwork[start + index]!, theme, index * (cardWidth + gutter) - groupWidth / 2, -cardHeight / 2 + step);
        }
        ctx.restore();
      }
    }
    if (theme.titleIcon) imageBox(ctx, theme.titleIcon, 110, 42, 55, 55);
    const titleX = theme.titleIcon ? 185 : 110;
    label(ctx, "跃迁记录", titleX, 82, theme.font, 44, 240);
    const nameX = titleX + ctx.measureText("跃迁记录").width + 37;
    const nameWidth = Math.min(ctx.measureText(nickname).width, 480);
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.roundRect(nameX, 40, nameWidth + 30, 57, 20);
    ctx.fill();
    label(ctx, nickname, nameX + 15, 82, theme.font, 44, nameWidth, "left", "#0b0c11");
    ctx.font = `46px ${theme.font}`;
    const poolWidth = Math.min(820, ctx.measureText(title).width + 36);
    const count = `当前垫 ${pity} 抽`;
    const countWidth = ctx.measureText(count).width + 36;
    ctx.fillStyle = "#05050599";
    ctx.fillRect(width - 55 - poolWidth, 20, poolWidth, 82);
    ctx.fillRect(50, 120, countWidth, 82);
    label(ctx, title, width - 73, 81, theme.font, 46, poolWidth - 36, "right");
    label(ctx, count, 68, 181, theme.font, 46, countWidth - 36);
    label(ctx, `${page} / ${pages}`, width - 54, height - 19, theme.font, 27, 155, "right");
    label(ctx, "Lotus-Yunzai · StarRail", 17, height - 14, theme.font, 24, 408);
  }, { mode, inlineImageByteLimit });
}
