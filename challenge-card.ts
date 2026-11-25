import { createTranslator as createTextTranslator } from "../../packages/i18n/index.ts";
import messageCatalog from "./i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import { withReadRetries } from "@lotus-yunzai/http";
import { createReadStream, type ReadStream } from "node:fs";
import { join } from "node:path";
import { nativeImageRasterScale } from "@lotus-yunzai/skia";
import { Canvas, FontLibrary, loadImage, type CanvasGradient, type Image } from "skia-canvas";
import { loadStarRailChallengePortraits, type ChallengePortraitOptions } from "./challenge-portraits.ts";
import { starRailChallengeThemeDirectory } from "./challenge-theme.ts";
import type { ChallengeResult } from "./challenge-model.ts";

const readArt = withReadRetries((url, init) => fetch(url, init));

type ChallengeData = { uid?: string; results?: readonly ChallengeResult[] };
type Floor = ChallengeResult["floors"][number];
type Peak = ChallengeResult["peak"][number];
type TeamNode = Partial<Floor["nodes"][number] & NonNullable<Peak["boss"]> & Peak["mobs"][number]>;
type Section = {
  label: string; periodLabel: string; simple: boolean; extraStars: number | "";
  period: string; stars: number | ""; floorTitle: string; nodes: TeamNode[];
  floorStars?: number | ""; floorMaxStars?: number; metrics: string[][];
};

// Adapted from Lotus-ReFactor core/render/starrail-abyss.js. See README.md.
// Native adaptation of genshin/resources/html/abyss/abyss-floor.{html,css}.
// All four SR modes share its inset frame, floor separators, four-avatar teams,
// original scene, star asset, fonts and cream level strips.
const GOLD = "#d3bc8d", WHITE = "#f1f1f4", MUTED = "#afb9ce"
const allowedHosts = new Set(["act-webstatic.mihoyo.com", "upload-bbs.mihoyo.com", "fastcdn.mihoyo.com"])
const imageLimit = 4 * 1024 * 1024
const LABELS = { hall: $t("challenge-card.text_59977c7f79"), story: $t("challenge-card.text_d66b949b63"), boss: $t("challenge-card.text_8dae72d970"), peak: $t("challenge-card.text_fdc6c58c58") }
let fontsLoaded = false
const hasValue = (value: unknown) => value !== undefined && value !== null && value !== ""
const valueOr = (value: unknown, suffix = "") => hasValue(value) ? `${value}${suffix}` : $t("challenge-card.text_46ca86da52")

// Translate mode data into the SAME source floor/team structure. Keep every
// result/peak record, selecting the deepest valid floor independently of API order.
export function buildStarRailAbyssSections(data: ChallengeData = {}): Section[] {
  return (data.results || []).flatMap(result => {
    const kind = result.kind
    const common = { label: result.label || LABELS[kind] || $t("challenge-card.text_861536167e"), periodLabel: result.periodLabel, simple: result.simple, extraStars: result.extraStars }
    if (kind === "peak" && result.peak?.length) return result.peak.map(record => {
      const nodes = [record.boss && { ...record.boss, label: $t("challenge-card.text_38028918f7") }, ...(record.mobs || []).map((mob, i) => ({ ...mob, label: $t("challenge-card.text_039da216ab", { "value1": i + 1 }) }))].filter(Boolean) as TeamNode[]
      const stars = hasValue(record.bossStars) || hasValue(record.mobStars) ? Number(record.bossStars || 0) + Number(record.mobStars || 0) : ""
      return { ...common, periodLabel: record.ended && result.periodLabel === "本期记录" ? $t("challenge-card.text_017a5a89ff") : result.periodLabel, period: record.period || result.period, stars, floorTitle: record.title || $t("challenge-card.text_fdc6c58c58"), nodes,
        metrics: [[$t("challenge-card.text_1445f22f32"), valueOr(record.bossStars, $t("challenge-card.text_d1005c4482"))], [$t("challenge-card.text_ec04c5b3d9"), valueOr(record.mobStars, $t("challenge-card.text_d1005c4482"))], [$t("challenge-card.text_643c087b2c"), valueOr(record.battleNum, $t("challenge-card.text_f81526efce"))], [$t("challenge-card.text_ab841b7070"), `${nodes.filter(node => node.cleared).length} / ${nodes.length}`]],
      }
    })
    const floors = (result.floors || []).filter(floor => hasValue(floor.stars) || hasValue(floor.round) || hasValue(floor.score) || floor.nodes?.length)
    const floor = selectDeepestFloor(floors, result.maxFloor, result.maxFloorId)
    return [{ ...common, period: result.period, stars: result.stars, floorTitle: floor?.title || $t("challenge-card.text_eec656bc76"), floorStars: floor?.stars,
      floorMaxStars: floor?.tierce ? 4 : Math.max(3, Number(floor?.stars || 0)), nodes: floor?.nodes || [],
      metrics: [[hasValue(floor?.score) ? $t("challenge-card.text_0599790b3f") : $t("challenge-card.text_cabe9e85d9"), hasValue(floor?.score) ? String(floor!.score) : valueOr(result.maxFloor)], [$t("challenge-card.text_2cabe9b98f"), valueOr(floor?.round, $t("challenge-card.text_c3af8aafb1"))], [$t("challenge-card.text_643c087b2c"), valueOr(result.battleNum, $t("challenge-card.text_f81526efce"))], [$t("challenge-card.text_eb0ae3d961"), valueOr(floor?.stars, $t("challenge-card.text_d1005c4482"))]],
    }]
  })
}

function selectDeepestFloor(floors: Floor[], maxFloor: string, maxFloorId: Floor["mazeId"]) {
  // Detailed responses can arrive deepest first; simple responses usually
  // contain only the deepest floor. Prefer the API's explicit maximum title,
  // including its star-awakening variant, rather than an array position.
  const baseTitle = (value: unknown) => String(value ?? "").replace(/星启模式$/, "").trim()
  const maximum = baseTitle(maxFloor)
  const matching = maximum ? floors.filter(floor => baseTitle(floor.title) === maximum) : []
  if (matching.length) return matching.find(floor => floor.tierce) || matching[0]
  const byId = (maxFloorId && floors.filter(floor => floor.mazeId === maxFloorId)) as Floor[] | "" | 0
  if ((byId as Floor[] | undefined)?.length) return (byId as Floor[]).find(floor => floor.tierce) || (byId as Floor[])[0]
  const numbered = floors.filter(floor => Number(floor.mazeId) > 0)
  if (numbered.length) return numbered.reduce((deepest, floor) => Number(floor.mazeId) > Number(deepest.mazeId) ? floor : deepest)
  return floors.at(-1)
}

async function image(src: string, local: boolean, signal: AbortSignal) {
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(8000)])
  let stream: ReadStream | ReadableStream<Uint8Array> | null | undefined
  try {
    if (local) {
      stream = createReadStream(src, { signal: deadline })
    } else {
      const url = new URL(src)
      if (url.protocol !== "https:" || !allowedHosts.has(url.hostname) || url.username || url.password || url.port) return null
      const response = await readArt(url, { redirect: "error", credentials: "omit", signal: deadline })
      stream = response.body
      if (!response.ok || response.redirected || Number(response.headers.get("Content-Length")) > imageLimit) return null
    }
    const chunks: Uint8Array[] = []
    let size = 0
    for await (const chunk of stream || []) {
      size += chunk.length
      if (size > imageLimit) return null
      chunks.push(chunk)
    }
    if (!chunks.length) return null
    const bytes = Buffer.concat(chunks)
    const png = bytes.length > 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    const jpg = bytes[0] === 255 && bytes[1] === 216
    const webp = bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP"
    if (!png && !jpg && !webp) return null
    if (png && (bytes.readUInt32BE(16) > 4096 || bytes.readUInt32BE(20) > 4096)) return null
    const result = await loadImage(bytes)
    return result.width <= 4096 && result.height <= 4096 ? result : null
  } catch {
    return null
  } finally {
    if (stream && typeof (stream as ReadStream).destroy === "function") (stream as ReadStream).destroy()
    else if (stream) void (stream as ReadableStream<Uint8Array>).cancel().catch(() => undefined)
  }
}

export { starRailChallengeThemeDirectory } from "./challenge-theme.ts";

/**
 * @param {() => Promise<boolean>} [checkNapCat]
 * @param {import("./challenge-portraits.ts").ChallengePortraitOptions} [portraitOptions]
 * @param {number} [inlineImageByteLimit]
 */
export async function renderStarRailAbyss(data: ChallengeData, signal: AbortSignal, checkNapCat?: () => Promise<boolean>, portraitOptions?: ChallengePortraitOptions, inlineImageByteLimit?: number) {
  const theme = starRailChallengeThemeDirectory()
  if (!fontsLoaded) {
    for (const [family, path] of [
      ["AbyssText", join(theme, "fonts", "HYWenHei-55W.ttf")],
      ["AbyssNumber", join(theme, "fonts", "tttgbnumber.ttf")],
    ] as const) {
      if (await Bun.file(path).exists()) {
        try {
          FontLibrary.use(family, [path])
        } catch {
          // Missing or invalid local font leaves system font fallback available.
        }
      }
    }
    fontsLoaded = true
  }
  const canvas = new Canvas(760, 10, { gpu: true })
  canvas.gpu = true
  function checkGpu(target = canvas) {
    const engine = target.engine
    if (engine.renderer !== "GPU" || !engine.device || /llvmpipe|lavapipe|swiftshader|software/iu.test(engine.device)) {
      throw new Error($t("challenge-card.text_40566f68ec"))
    }
    return engine
  }
  const ctx = canvas.getContext("2d")
  checkGpu()
  const family = '"AbyssText", MiSans, "Noto Sans CJK SC", sans-serif'
  function text(value: unknown, x: number, y: number, size = 18, color = WHITE, width = 650, align: "left" | "center" | "right" = "left", number = false) {
    const label = String(value ?? "")
    ctx.font = `${size}px ${number ? '"AbyssNumber", ' : ""}${family}`
    while (ctx.measureText(label).width > width && size > 12) {
      size -= 0.5
      ctx.font = `${size}px ${number ? '"AbyssNumber", ' : ""}${family}`
    }
    ctx.fillStyle = color; ctx.textBaseline = "top"; ctx.textAlign = align
    ctx.fillText(label, align === "center" ? x + width / 2 : align === "right" ? x + width : x, y)
  }
  function wrap(value: unknown, width: number, size = 17) {
    ctx.font = `${size}px ${family}`
    const lines = []
    for (const paragraph of String(value || "").split(/\r?\n/)) {
      let line = ""
      for (const char of paragraph) {
        if (line && ctx.measureText(line + char).width > width) { lines.push(line); line = "" }
        line += char
      }
      if (line) lines.push(line)
    }
    return lines
  }
  const sections = buildStarRailAbyssSections(data)
  if (!sections.length) throw new Error($t("challenge-card.text_3e77a8a7f3"))
  const layouts = sections.map(section => {
    const titleLines = wrap(section.floorTitle, hasValue(section.floorStars) ? 500 : 672, 26)
    const headerHeight = 396 + Math.max(0, titleLines.length - 1) * 33
    const nodes = section.nodes.map((node, index) => {
      const buffLines = wrap(node.buff, 624)
      const isEnemy = Boolean(node.title)
      const titleLines = isEnemy ? wrap(node.title, node.icon ? 526 : 636, 22) : []
      const meta = [node.time, hasValue(node.score) ? $t("challenge-card.text_5e30b11066", { "score": node.score }) : "", hasValue(node.round) ? $t("challenge-card.text_cf73161826", { "round": node.round }) : "", hasValue(node.stars) ? $t("challenge-card.text_2225a79161", { "stars": node.stars }) : "", node.defeated === true ? $t("challenge-card.text_d9859d4dfa") : node.defeated === false ? $t("challenge-card.text_997b8953ac") : "", hasValue(node.cleared) ? (node.cleared ? $t("challenge-card.text_4fa9ac4eca") : $t("challenge-card.text_0b7e23d486")) : "", node.hard ? $t("challenge-card.text_6777457444") : "", node.fast ? $t("challenge-card.text_aafebd0727") : ""].filter(Boolean).join(" · ")
      const metaLines = wrap(meta || $t("challenge-card.text_9b06719da5"), 636, 16)
      const label = /^节点\d+$/.test(node.label || "") ? (section.nodes.length === 2 ? (index === 0 ? $t("challenge-card.text_3401df6359") : $t("challenge-card.text_38866b106e")) : $t("challenge-card.text_584f039ab2", { "value1": [$t("challenge-card.text_51a75f4634"), $t("challenge-card.text_084b42f6e9"), $t("challenge-card.text_a4c3313deb")][index] || index + 1 })) : (node.label || $t("challenge-card.text_afd424e506", { "value1": index + 1 }))
      const teamTop = (isEnemy ? Math.max(node.icon ? 132 : 82, 44 + titleLines.length * 29) : 42) + metaLines.length * 23 + 12
      const rows = Math.max(1, Math.ceil((node.avatars?.length || 0) / 4))
      return { node, label, titleLines, metaLines, teamTop, buffLines, rows, height: teamTop + rows * 195 + (buffLines.length ? 12 + buffLines.length * 25 : 0) + 12 }
    })
    return { section, titleLines, headerHeight, nodes, height: headerHeight + (nodes.length ? nodes.reduce((sum, item) => sum + item.height + 14, 0) : 130) }
  })
  const height = layouts.reduce((sum, item) => sum + item.height, 0) + 86
  const presetScale = nativeImageRasterScale()
  const configuredScale = presetScale === 1 ? 1 : Number(Bun.env.LOTUS_RENDER_SCALE ?? presetScale)
  let scale = Number.isFinite(configuredScale) ? Math.min(4, Math.max(1, configuredScale)) : 4
  // NapCat rejected a 3040×30680 fourfold three-period history card.
  if (scale === 4 && Math.round(height * scale) >= 30_680 && await checkNapCat?.()) scale = 2
  signal.throwIfAborted()
  canvas.width = Math.round(760 * scale)
  canvas.height = Math.round(height * scale)
  ctx.scale(scale, scale); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high"
  const bgPath = join(theme, "floor12.png")
  const starPath = join(theme, "star.png")
  const nodes = sections.flatMap(section => section.nodes)
  const refs = new Set(nodes.flatMap(node => node.icon ? [node.icon] : []))
  const [bg, star, portraits] = await Promise.all([
    image(bgPath, true, signal), image(starPath, true, signal),
    loadStarRailChallengePortraits(nodes.flatMap(node => node.avatars || []), signal, { ...portraitOptions, challengeThemeDirectory: theme }),
  ])
  const images = new Map<string, Image | null>()
  const sources = [...refs]
  for (let start = 0; start < sources.length; start += 12) {
    signal.throwIfAborted()
    await Promise.all(sources.slice(start, start + 12).map(async src => images.set(src, await image(src, false, signal))))
  }
  signal.throwIfAborted()
  function rect(x: number, y: number, w: number, h: number, fill: string | CanvasGradient, radius = 0) {
    ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill()
  }
  function line(x: number, y: number, w: number, color = "rgba(211,188,141,0.30)") {
    ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.stroke()
  }
  function starAt(x: number, y: number, size: number, active = true) {
    ctx.save(); ctx.globalAlpha = active ? 1 : 0.20
    if (star) ctx.drawImage(star, x, y, size, size)
    else text("★", x, y, size - 1, GOLD, size, "center")
    ctx.restore()
  }
  rect(0, 0, 760, height, "#1d2a4a")
  ctx.strokeStyle = "rgba(211,188,141,0.65)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(12, 12, 736, height - 24, 14); ctx.stroke()
  ctx.strokeStyle = "rgba(255,255,255,0.13)"; ctx.beginPath(); ctx.roundRect(18, 18, 724, height - 36, 10); ctx.stroke()
  let offset = 0
  for (const layout of layouts) {
    const { section, headerHeight } = layout
    ctx.save(); ctx.translate(0, offset)
    if (bg) ctx.drawImage(bg, 20, 0, 720, 720 * bg.height / bg.width)
    const shade = ctx.createLinearGradient(0, 0, 0, 450)
    shade.addColorStop(0, "rgba(10,19,39,0.20)"); shade.addColorStop(1, "rgba(10,19,39,0)")
    rect(20, 0, 720, 450, shade)
    text($t("challenge-card.text_8cfc959b53"), 44, 39, 18, GOLD)
    text(section.simple ? $t("challenge-card.text_ac7beb46f7") : $t("challenge-card.text_861536167e"), 430, 40, 16, MUTED, 284, "right")
    text(section.label, 44, 83, 44)
    starAt(536, 84, 40); text(hasValue(section.stars) ? section.stars : $t("challenge-card.text_b336a174cd"), 583, 86, 42, GOLD, 65, "center", true)
    text($t("challenge-card.text_1178be2f21"), 651, 100, 17, MUTED, 68)
    text(`UID ${data.uid || $t("challenge-card.text_e026c6693d")}`, 46, 144, 22, WHITE, 340, "left", true)
    text(section.periodLabel, 540, 146, 19, GOLD, 174, "right")
    if (Number(section.extraStars) > 0) text($t("challenge-card.text_6a973cfe36", { "extraStars": section.extraStars }), 540, 169, 13, GOLD, 174, "right")
    line(44, 185, 672); text(section.period || $t("challenge-card.text_2eb61f6740"), 44, 200, 18, MUTED, 672)
    rect(44, 242, 672, 80, "rgba(9,17,34,0.40)", 10)
    section.metrics.forEach(([label, value], i) => {
      const x = 44 + i * 168
      text(label, x, 255, 16, MUTED, 168, "center"); text(value, x + 8, 281, 23, WHITE, 152, "center", true)
      if (i) { ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.beginPath(); ctx.moveTo(x, 257); ctx.lineTo(x, 307); ctx.stroke() }
    })
    layout.titleLines.forEach((value, i) => text(value, 44, 346 + i * 33, 26, GOLD, hasValue(section.floorStars) ? 500 : 672))
    if (hasValue(section.floorStars)) for (let i = 0; i < section.floorMaxStars!; i++) starAt(716 - section.floorMaxStars! * 35 + i * 35, 346, 29, i < Number(section.floorStars))
    line(44, headerHeight - 13, 672)
    let y = headerHeight
    for (const item of layout.nodes) {
      const { node, height: nodeHeight, teamTop } = item
      rect(44, y, 672, nodeHeight, "rgba(10,18,35,0.32)", 10); rect(44, y, 3, 37, GOLD, 2)
      text(item.label, 62, y + 10, 22, GOLD, 636)
      if (node.title) {
        const enemy = images.get(node.icon!)
        if (enemy) ctx.drawImage(enemy, 62, y + 44, 80, 80)
        item.titleLines.forEach((value, i) => text(value, node.icon ? 158 : 62, y + 46 + i * 29, 22, WHITE, node.icon ? 526 : 636))
      }
      item.metaLines.forEach((value, i) => text(value, 62, y + teamTop - 12 - (item.metaLines.length - i) * 23, 16, MUTED, 636))
      for (const [i, avatar] of (node.avatars || []).entries()) {
        const x = 62 + (i % 4) * 159, top = y + teamTop + Math.floor(i / 4) * 195
        ctx.save(); ctx.beginPath(); ctx.roundRect(x, top, 141, 157, 5); ctx.clip()
        const rarity = ctx.createLinearGradient(x, top, x, top + 134)
        rarity.addColorStop(0, Number(avatar.rarity) >= 5 ? "#776058" : "#51456d"); rarity.addColorStop(1, Number(avatar.rarity) >= 5 ? "#c2996a" : "#9b81b3")
        rect(x, top, 141, 134, rarity)
        const portrait = portraits.get(avatar)
        if (portrait) {
          const ratio = Math.max(141 / portrait.width, 134 / portrait.height), sw = 141 / ratio, sh = 134 / ratio
          ctx.drawImage(portrait, (portrait.width - sw) / 2, 0, sw, sh, x, top, 141, 134)
        } else {
          ctx.fillStyle = "rgba(25,27,43,0.40)"
          ctx.beginPath()
          ctx.arc(x + 70.5, top + 54, 21, 0, Math.PI * 2)
          ctx.moveTo(x + 108.5, top + 117)
          ctx.ellipse(x + 70.5, top + 117, 38, 35, 0, 0, Math.PI * 2)
          ctx.fill()
        }
        rect(x, top + 133, 141, 24, "#e9e5dc"); text(hasValue(avatar.level) ? `Lv.${avatar.level}` : $t("challenge-card.text_5a16e3ffc8"), x, top + 138, 16, "#25252c", 141, "center", true)
        if (hasValue(avatar.rank)) {
          const rank = Number(avatar.rank)
          rect(x + 84, top, 57, 27, rank >= 5 ? "#af533f" : rank >= 3 ? "#3d8d6c" : rank > 0 ? "#477fa9" : "rgba(10,18,35,0.68)", 2)
          text($t("challenge-card.text_c0985f1db5", { "rank": avatar.rank }), x + 84, top + 5, 16, WHITE, 57, "center", true)
        }
        ctx.restore(); text(avatar.name || $t("challenge-card.text_89a31344ea"), x, top + 164, 17, WHITE, 141, "center")
      }
      if (!node.avatars?.length) text($t("challenge-card.text_82b8ea560a"), 62, y + teamTop + 54, 20, MUTED, 636, "center")
      item.buffLines.forEach((value, i) => text(value, 62, y + teamTop + item.rows * 195 + 12 + i * 25, 17, MUTED, 624))
      y += nodeHeight + 14
    }
    if (!layout.nodes.length) text($t("challenge-card.text_b9dce57bba"), 44, y + 44, 23, MUTED, 672, "center")
    ctx.restore(); offset += layout.height
  }
  for (const [x, y, direction] of [[26, 26, 1], [734, 26, -1], [26, height - 26, 1], [734, height - 26, -1]] as const) line(x, y, direction * 22, GOLD)
  line(44, offset + 6, 672); text($t("challenge-card.text_8b60fabcb0"), 44, offset + 27, 16, "#fff", 672, "center")
  const png = await canvas.toBuffer("png", { filters: "auto" })
  signal.throwIfAborted()
  const engine = checkGpu()
  if (inlineImageByteLimit === undefined || png.byteLength <= inlineImageByteLimit) return { png, engine }
  if (scale === 4) {
    const reduced = new Canvas(760 * 2, Math.round(height * 2), { gpu: true })
    reduced.gpu = true
    checkGpu(reduced)
    reduced.getContext("2d").drawCanvas(canvas, 0, 0, reduced.width, reduced.height)
    const image = await reduced.toBuffer("png", { filters: "auto" })
    signal.throwIfAborted()
    if (image.byteLength <= inlineImageByteLimit) return { png: image, engine: checkGpu(reduced) }
  }
  throw new Error($t("challenge-card.text_93f9437557"))
}
