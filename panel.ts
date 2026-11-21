import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MAX_PROFILE_ID, ProfileError, type createProfileStore } from "@lotus-yunzai/account";
import { GameRecordRequestError, HoyoRequestError, type createProfileHoyoClient } from "@lotus-yunzai/hoyo-client";
import { createRoleJsonArchive, type AcquireRoleArchiveLock } from "@lotus-yunzai/storage";
import type { MessageEvent } from "../../lib/messages.ts";
import { renderTemplate } from "../../lib/renderer/shotium.ts";
import { findPanelAvatar, makePanelDetailCard, makePanelListCards, makePanelPracticeCards, makePanelRelicCard, makePanelRelicListCard, readPanelDamageMetadata, readPanelTalentCons, readTheme } from "./panel-card.ts";
import { calculateEquipmentAttributeRows, changePanelLevel, formatPanelAttributeRows, type PanelAttributeRows } from "./panel-attributes.ts";
import { changePanelEidolon } from "./panel-eidolon.ts";
import { changePanelRelicSets } from "./panel-relic-set.ts";
import { changePanelFullTraces } from "./panel-trace-preview.ts";
import { changePanelCoreSkills } from "./panel-skill-preview.ts";
import { changePanelNamedCone } from "./panel-cone-preview.ts";
import { changePanelSuperimposition, replacePanelEquipment } from "./panel-equipment.ts";
import { panelExportFile } from "./panel-file.ts";
import { applyStarRailTraces, confirmedStarRailTraces, matchesStarRailTraceOwner, readStarRailTraceArchive,
  starRailTraceOwner, type StarRailTraceOwner } from "./panel-trace-refresh.ts";
import { fetchStarRailShowcase, ShowcaseError, showcaseProviderNames, showcaseTarget } from "./panel-showcase.ts";
import { readShowcaseServer } from "./panel-showcase-config.ts";
import { hasPersonalDamage, personalDamageMetricLabel, personalDamageNames, readStarRailPersonalDamage } from "./panel-damage.ts";
import { renderStarRailPersonalDamage } from "./panel-damage-card.ts";
import type { createStarRailGroupRelicRank, StarRailGroupRankContext } from "./group-relic-rank.ts";
import { id as readId, normalizePanel, object, readLegacyPanel, text, whole, type PanelAvatar, type PanelCommand, type PanelSnapshot } from "./panel-model.ts";

const targetDirectory = fileURLToPath(new URL("../../data/starrail/panels/", import.meta.url));
const legacyDirectory = fileURLToPath(new URL("../../data/PlayerData/sr/", import.meta.url));
const showcaseDirectory = fileURLToPath(new URL("../../data/starrail/showcases/", import.meta.url));
const traceDirectory = fileURLToPath(new URL("../../data/starrail/trace-levels/", import.meta.url));
const maxBytes = 8 * 1024 * 1024;

async function legacySnapshot(uid: string) {
  if (!/^[1-9]\d{8,9}$/u.test(uid)) throw new Error("旧面板档案 UID 无效。");
  const root = resolve(Bun.env.LOTUS_STAR_RAIL_LEGACY_PANEL_DIR?.trim() || legacyDirectory);
  let handle;
  try {
    handle = await open(join(root, `${uid}.json`), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > maxBytes) throw new Error("旧星铁面板档案无效。");
    const bytes = Buffer.alloc(info.size);
    for (let pos = 0; pos < bytes.length;) {
      const { bytesRead } = await handle.read(bytes, pos, bytes.length - pos, pos);
      if (!bytesRead) throw new Error("旧星铁面板档案已变更。");
      pos += bytesRead;
    }
    const current = await handle.stat();
    if (current.size !== info.size || current.mtimeMs !== info.mtimeMs || current.ctimeMs !== info.ctimeMs) {
      throw new Error("旧星铁面板档案已变更。");
    }
    const data: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    return { snapshot: readLegacyPanel(uid, data), data: object(data)! };
  } finally {
    await handle.close();
  }
}

function managedSnapshot(uid: string, raw: unknown, showcase = false, allowEmpty = false) {
  if (raw === null) return;
  const stored = object(raw);
  const source = stored?.source;
  const allowedSource = showcase ? typeof source === "string" && Object.hasOwn(showcaseProviderNames, source) : source === "miyoushe";
  if (stored?.version !== 1 || stored.uid !== uid || !allowedSource || typeof stored.updatedAt !== "string" ||
      !Number.isFinite(Date.parse(stored.updatedAt)) || !Array.isArray(stored.avatars) || (!allowEmpty && !stored.avatars.length) ||
      stored.avatars.length > 256 || stored.avatars.some(row => !object(row) || !readId(row.id) || typeof row.name !== "string" ||
        !Array.isArray(row.skills) || !Array.isArray(row.traces) || !Array.isArray(row.stars) || !Array.isArray(row.stats) || !Array.isArray(row.relics))) {
    throw new Error("星铁面板档案无效。");
  }
  return stored as unknown as PanelSnapshot;
}

export function createStarRailPersonalPanelReader(lock: AcquireRoleArchiveLock) {
  const store = createRoleJsonArchive(targetDirectory, lock, { subject: "星铁面板", lockSuffix: "panel", maxBytes, rejectNull: true });
  const traces = createRoleJsonArchive(traceDirectory, lock, { subject: "星铁行迹", lockSuffix: "traces", maxBytes: 128 * 1024, rejectNull: true });
  return async (qq: string, uid: string, owner?: StarRailTraceOwner) => {
    const managed = managedSnapshot(uid, await store.read(qq, uid), false, true);
    const snapshot = managed?.avatars.length ? managed : (await legacySnapshot(uid))?.snapshot;
    if (!snapshot || !owner || owner.qq !== qq || owner.uid !== uid) return snapshot;
    const records = await traces.read(qq, uid).then(raw => readStarRailTraceArchive(owner, raw)).catch(() => undefined);
    return records ? applyStarRailTraces(snapshot, records) : snapshot;
  };
}

export function createStarRailPanel(
  profiles: ReturnType<typeof createProfileStore>, client: ReturnType<typeof createProfileHoyoClient>,
  lock: AcquireRoleArchiveLock, signal: AbortSignal, groupRank?: ReturnType<typeof createStarRailGroupRelicRank>,
) {
  const store = createRoleJsonArchive(targetDirectory, lock, { subject: "星铁面板", lockSuffix: "panel", maxBytes, rejectNull: true });
  const showcases = createRoleJsonArchive(showcaseDirectory, lock, { subject: "星铁公开展板", lockSuffix: "showcase", maxBytes, rejectNull: true });
  const traces = createRoleJsonArchive(traceDirectory, lock, { subject: "星铁行迹", lockSuffix: "traces", maxBytes: 128 * 1024, rejectNull: true });
  const refreshing = new Set<string>();

  return async function query(qq: string, command: PanelCommand,
    context?: StarRailGroupRankContext & Pick<MessageEvent, "uploadFile"> & { readonly reply?: (message: string) => unknown }) {
    const { type, profileId, name } = command;
    const uploadFile = context?.uploadFile;
    if (profileId < 1 || profileId > MAX_PROFILE_ID) return `档案编号须为 1–${MAX_PROFILE_ID}。`;
    if (type === "refresh-traces" && context?.isDelegated) return "请在本人 QQ 会话刷新星铁角色行迹。";
    if ((type === "reload" || type === "showcase") && context?.isDelegated) return "请在本人 QQ 会话重新加载或查询星铁公开展板。";
    if (type === "export") {
      const group = context?.message_type === "group";
      if (group && !command.share) {
        return `请私聊发送【*导出面板${profileId === 1 ? "" : profileId}】。如确认将本人面板发到本群，请发送【*强制导出面板${profileId === 1 ? "" : profileId}】。`;
      }
      if (context?.isDelegated || (context?.message_type !== "private" && (!group || !context.group_id || !context.self_id ||
          (context.adapter !== undefined && context.adapter !== "onebot" && context.adapter !== "milky")))) return "请在绑定网关的私聊会话中导出星铁面板。";
      if (!uploadFile) return "当前会话不支持发送星铁面板文件。";
    }
    try {
      const account = await profiles.requestContext(qq, profileId, "sr").catch(error => {
        if (type !== "update" && type !== "export" && type !== "refresh-traces" && error instanceof ProfileError && error.code === "login-required") return undefined;
        throw error;
      });
      const role = account?.role ?? await profiles.savedRole(qq, profileId, "sr");
      const observedAt = type === "relics" && account && groupRank?.allows(context) ? Date.now() : undefined;
      const { uid } = role;
      const explicitUid = "uid" in command;
      if (explicitUid && command.uid !== uid) return "此 UID 与所选档案当前绑定的星铁角色不一致。";
      const key = `${qq}:${uid}`;
      let revision = account?.revision;
      let traceOwner: StarRailTraceOwner | undefined;
      let snapshot: PanelSnapshot | undefined;
      let legacy: Record<string, unknown> | undefined;
      let updated = false;
      let publicLookup = false;
      async function verify() {
        signal.throwIfAborted();
        const selectedRole = traceOwner ? await profiles.savedRole(qq, profileId, "sr").catch(() => undefined) : undefined;
        const latestAccount = account ? await profiles.requestContext(qq, profileId, "sr").catch(() => undefined) : undefined;
        const latestRole = account ? latestAccount?.role : await profiles.savedRole(qq, profileId, "sr").catch(() => undefined);
        if (!latestRole || latestAccount?.revision !== revision || latestRole.uid !== uid || latestRole.region !== role.region ||
            latestRole.gameBiz !== role.gameBiz || (traceOwner && (!latestAccount || !selectedRole ||
              !matchesStarRailTraceOwner(traceOwner, starRailTraceOwner(latestAccount, selectedRole))))) {
          throw new ProfileError("changed", "星铁面板档案已变更，请重新查询。");
        }
      }

      if (type === "update" && account) {
        if (refreshing.has(key)) return "此星铁角色面板正在更新，请稍后查询。";
        refreshing.add(key);
        try {
          const startedAt = new Date();
          const result = await client.fetchStarRailPanel(account, { signal });
          revision = result.revision;
          await verify();
          if (!result.avatars.length) return "米游社未返回星铁角色数据，原面板已保留。";
          const next = normalizePanel(uid, result.avatars, startedAt);
          snapshot = await store.update({ qq, uid }, verify, current => {
            const previous = managedSnapshot(uid, current);
            if (previous?.updatedAt && next.updatedAt && previous.updatedAt > next.updatedAt) return { result: previous };
            updated = true;
            return { document: next, result: next };
          });
        } finally {
          refreshing.delete(key);
        }
      } else if (type !== "showcase") {
        snapshot = managedSnapshot(uid, await store.read(qq, uid), false, type === "practice");
        if (!snapshot || (type === "practice" && !snapshot.avatars.length)) {
          const old = await legacySnapshot(uid);
          snapshot = old?.snapshot;
          if (old?.snapshot.avatars.length) legacy = old.data;
        }
        if (type !== "refresh-traces" && !snapshot?.avatars.length) snapshot = managedSnapshot(uid, await showcases.read(qq, uid), true, type === "practice") ?? snapshot;
      }

      if (type === "refresh-traces" && account) {
        const selectedRole = await profiles.savedRole(qq, profileId, "sr");
        if (selectedRole.uid !== uid || selectedRole.region !== role.region || selectedRole.gameBiz !== role.gameBiz) {
          return "所选档案当前绑定的星铁角色无法核验。";
        }
        const owner = starRailTraceOwner(account, selectedRole);
        if (!owner) return "档案的登录凭据与账号不一致，请重新登录。";
        traceOwner = owner;
        if (!snapshot?.avatars.length) return `请先使用 *更新面板${profileId === 1 ? "" : profileId} 获取本人星铁面板。`;
        if (refreshing.has(key)) return "此星铁角色面板正在更新，请稍后查询。";
        refreshing.add(key);
        try {
          await verify();
          const started = Date.now();
          const result = await client.fetchStarRailPanel(account, { signal });
          revision = result.revision;
          await verify();
          const incoming = confirmedStarRailTraces(snapshot, result.avatars, started);
          const entries = Object.entries(incoming);
          if (!entries.length) return "米游社未返回可核对的角色技能等级，已保留原行迹。";
          const avatarIds = new Set(snapshot.avatars.map(avatar => avatar.id));
          const count = await traces.update({ qq, uid }, verify, current => {
            const records = Object.fromEntries(Object.entries(readStarRailTraceArchive(owner, current)).filter(([id]) => avatarIds.has(id)));
            let saved = 0;
            for (const [id, entry] of entries) {
              if ((records[id]?.at ?? 0) >= entry.at) continue;
              records[id] = entry;
              saved++;
            }
            return saved ? { document: { version: 2, owner, records }, result: saved } : { result: 0 };
          });
          await verify();
          if (!count) return "此档案已有更新的星铁角色行迹，原存档已保留。";
          return `星铁角色行迹刷新成功，共核对 ${count} 位角色的普攻、战技、终结技和天赋。可用 *角色名详情${profileId === 1 ? "" : profileId} 查看。`;
        } finally {
          refreshing.delete(key);
        }
      }

      if (type === "showcase" || (type === "reload" && !snapshot?.avatars.length && context?.reply)) {
        publicLookup = true;
        const bound = await profiles.savedRole(qq, profileId, "sr");
        if (bound.uid !== uid || bound.region !== role.region || bound.gameBiz !== role.gameBiz) {
          return "所选档案当前绑定的星铁角色无法核验。";
        }
        const target = showcaseTarget(bound, await readShowcaseServer());
        const refreshKey = `showcase:${key}`;
        if (refreshing.has(refreshKey)) return "此星铁公开展板正在查询，请稍后再试。";
        refreshing.add(refreshKey);
        try {
          const cached = managedSnapshot(uid, await showcases.read(qq, uid), true);
          const started = new Date();
          if (cached?.source === target.provider && cached.updatedAt &&
              Date.parse(cached.updatedAt) + (whole(cached.showcaseTtl, 86_400) ?? 60) * 1000 > started.getTime()) {
            snapshot = cached;
          } else {
            await verify();
            if (type === "reload") {
              const notice = `本地暂无星铁面板，正在向 ${showcaseProviderNames[target.provider]} 查询此绑定 UID 的公开展板。`;
              const delivered = await Promise.resolve().then(() => context?.reply?.(notice)).catch(() => false);
              if (delivered !== true) return `通知发送失败，已取消公开展板回退。可使用 *展板更新面板${profileId === 1 ? "" : profileId} 主动查询。`;
            }
            await verify();
            const next = await fetchStarRailShowcase(target, signal, undefined, started);
            snapshot = await showcases.update({ qq, uid }, verify, current => {
              const previous = managedSnapshot(uid, current, true);
              if (previous?.source === target.provider && previous.updatedAt && Date.parse(previous.updatedAt) > started.getTime()) {
                return { result: previous };
              }
              return { document: next, result: next };
            });
          }
        } finally {
          refreshing.delete(refreshKey);
        }
      }

      if (!snapshot?.avatars.length) {
        if (type === "reload") await verify();
        if (type === "relic-list" || type === "practice") {
          await verify();
          if (type === "practice") return `UID ${uid} 暂无星铁角色数据，请先使用 *更新面板${profileId === 1 ? "" : profileId}。`;
          return "请先获取角色面板数据后再查看遗器列表。";
        }
        return `UID ${uid} 暂无星铁角色面板，请先使用 *更新面板${profileId === 1 ? "" : profileId}。`;
      }
      if (account && context?.user_id?.toString() === qq && !context.isDelegated &&
          (type === "detail" || type === "damage" || type === "export" || type === "practice") && (snapshot.source === "legacy" || snapshot.source === "miyoushe")) {
        const selectedRole = await profiles.savedRole(qq, profileId, "sr").catch(() => undefined);
        const owner = selectedRole && starRailTraceOwner(account, selectedRole);
        if (owner) {
          const records = await traces.read(qq, uid).then(raw => readStarRailTraceArchive(owner, raw)).catch(() => undefined);
          if (records && Object.keys(records).length) {
            traceOwner = owner;
            await verify();
            snapshot = applyStarRailTraces(snapshot, records);
          }
        }
      }
      if (type === "export" && uploadFile) {
        const talentCons = new Map<string, Record<string, unknown>>();
        const ranked = legacy && snapshot.avatars.filter(avatar => (avatar.rank ?? 0) > 0 && avatar.skills.some(skill => skill.effective));
        if (ranked?.length) {
          const theme = await readTheme();
          await Promise.all(ranked.map(async avatar => {
            const unlocks = await readPanelTalentCons(avatar, theme);
            if (unlocks) talentCons.set(avatar.id, unlocks);
          }));
        }
        const { name, bytes, format, unresolved } = panelExportFile(snapshot, legacy, talentCons);
        await verify();
        const outcome = await uploadFile({ name, bytes }).catch(() => "unknown");
        if (outcome === "rejected") return "星铁面板文件发送失败，请检查网关的文件发送功能。";
        if (outcome !== "confirmed") return "星铁面板文件发送结果未确认，请在当前会话查看。";
        const retained = unresolved ? `旧格式有 ${unresolved} 项技能无法确认基础等级，已保留原档对应字段。` : "";
        return `已导出 ${name}（${format}）。${retained}`;
      }
      const theme = await readTheme();
      if (type === "practice") {
        const models = await makePanelPracticeCards(snapshot, theme, signal, command.rarity, legacy);
        await verify();
        if (!models.length) return `UID ${uid} 暂无符合筛选条件的星铁角色。`;
        const first = models[0]!;
        const title = `UID ${uid} · 面板练度统计 · 共 ${first.total} 名角色`;
        const nodes = [];
        for (const model of models) {
          const files = await renderTemplate(model).catch(() => false as const);
          await verify();
          if (files && files.length) nodes.push(...files.map(file => ({ type: "image" as const, file })));
          else {
            const updateTimes = [model.updateTime.profile && `更新面板 ${model.updateTime.profile}`,
              model.updateTime.mys && `米游社 ${model.updateTime.mys}`].filter(Boolean).join(" · ");
            nodes.push([title, ...model.avatars.map(row => {
              const weapon = row.weapon && `${row.weapon.name} Lv.${row.weapon.level ?? "—"} 叠影 ${row.weapon.affix ?? "—"}`;
              const rating = row.rating ? `遗器 ${row.rating.mark} ${row.rating.markClass}` : "遗器暂无面板数据";
              return `${row.name} · Lv.${row.level ?? "—"} · ${row.cons ?? "—"} 魂 · A/E/Q/T ${row.talent.map(skill => skill.level).join("/")} · ${weapon || "光锥—"} · ${rating}`;
            }), ...(updateTimes ? [updateTimes] : [])].join("\n"));
          }
        }
        return nodes.length === 1 ? nodes[0] : { type: "forward" as const, nodes: [title, ...nodes] };
      }
      if (type === "relic-list") {
        const model = await makePanelRelicListCard(snapshot, theme, signal, explicitUid);
        await verify();
        if (!model.eligible) return "请先获取角色面板数据后再查看遗器列表。";
        if (!model.artis.length) return "当前面板没有符合旧版词条筛选条件的遗器。";
        const title = `UID ${uid} · 遗器列表`;
        const files = await renderTemplate(model);
        await verify();
        if (files && files.length) {
          const images = files.map(file => ({ type: "image" as const, file }));
          return images.length === 1 ? images[0] : { type: "forward" as const, nodes: [title, ...images] };
        }
        return [title, ...model.artis.map(({ avatar, name, mark, markClass }) => `${avatar} · ${name} · ${mark} 分 · ${markClass}`)].join("\n");
      }
      let selected: PanelAvatar | undefined;
      const skillPreview = "equipment" in command && "skillLevels" in command.equipment;
      let equipmentLabel: string | undefined;
      let equipmentRows: PanelAttributeRows | undefined;
      let equipmentMetadata: Awaited<ReturnType<typeof readPanelDamageMetadata>>;
      const archiveSuffix = profileId === 1 ? "" : ` ${profileId}`;
      if (type === "damage" || type === "detail" || type === "relics") {
        selected = findPanelAvatar(snapshot.avatars, name, theme);
        await verify();
        if (!selected) return `当前星铁面板中没有「${name}」，请用 *面板${archiveSuffix} 查看列表。`;
        if (type === "damage" && !hasPersonalDamage(selected.id)) {
          return `「${selected.name}」的星铁个人伤害规则尚未接入。当前支持${personalDamageNames}。`;
        }
        if ("equipment" in command) {
          const change = command.equipment;
          let temporary = selected;
          let promotion: number | undefined;
          const labels: string[] = [];
          if ("donor" in change) {
            const donor = findPanelAvatar(snapshot.avatars, change.donor, theme);
            if (!donor) return `当前星铁面板中没有换装来源「${change.donor}」。`;
            const replacement = replacePanelEquipment(temporary, donor, change.slots);
            if ("error" in replacement) return replacement.error;
            temporary = replacement.avatar;
            labels.push(replacement.label);
          } else if ("superimposition" in change) {
            const equipped = temporary.cone && object(theme.weapons[temporary.cone.id]);
            const replacement = changePanelSuperimposition(temporary, change.superimposition, change.coneName, text(equipped?.name));
            if ("error" in replacement) return replacement.error;
            temporary = replacement.avatar;
            labels.push(replacement.label);
          } else if ("namedCone" in change) {
            const named = object(theme.weapons[change.namedCone]);
            const previous = temporary.cone && object(theme.weapons[temporary.cone.id]);
            const coneName = text(named?.name), coneStar = whole(named?.star, 5);
            if (!coneName || !coneStar) return "本地主题缺少指定光锥资料。";
            const originalMetadata = await readPanelDamageMetadata(temporary, theme);
            await verify();
            if (!originalMetadata || !temporary.level) return `「${temporary.name}」缺少可确认的当前光锥和角色属性资料。`;
            const current = changePanelLevel(temporary, temporary.level, originalMetadata);
            if ("error" in current) return current.error;
            const replacement = changePanelNamedCone(current.avatar, { id: change.namedCone, name: coneName, star: coneStar }, whole(previous?.star, 5));
            if ("error" in replacement) return replacement.error;
            temporary = replacement.avatar;
            promotion = current.promotion;
            labels.push(replacement.label);
          } else if ("relicSets" in change) {
            const replacement = changePanelRelicSets(temporary, change.relicSets, theme.relicSets);
            if ("error" in replacement) return replacement.error;
            temporary = replacement.avatar;
            labels.push(replacement.label);
          }

          // A donor changes the cone metadata, but the talent thresholds belong to the target.
          equipmentMetadata = await readPanelDamageMetadata(temporary, theme);
          // At a saved level boundary, the level preview needs the original base HP before other changes clear it.
          if ("level" in change && equipmentMetadata) {
            const replacement = changePanelLevel(temporary, change.level, equipmentMetadata);
            if ("error" in replacement) {
              await verify();
              return replacement.error;
            }
            temporary = replacement.avatar;
            promotion = replacement.promotion;
            labels.push(replacement.label);
          }
          if ("eidolon" in change && change.eidolon !== undefined) {
            const replacement = changePanelEidolon(temporary, change.eidolon, equipmentMetadata?.character.talentCons);
            if ("error" in replacement) {
              await verify();
              return replacement.error;
            }
            temporary = replacement.avatar;
            labels.unshift(replacement.label);
          }
          if ("fullTraces" in change) {
            const replacement = changePanelFullTraces(temporary, equipmentMetadata?.character.tree);
            if ("error" in replacement) {
              await verify();
              return replacement.error;
            }
            temporary = replacement.avatar;
            labels.push(replacement.label);
          }
          if ("skillLevels" in change) {
            const replacement = changePanelCoreSkills(temporary, change.skillLevels, equipmentMetadata?.character.talentCons);
            if ("error" in replacement) {
              await verify();
              return replacement.error;
            }
            temporary = replacement.avatar;
            labels.push(replacement.label);
          }
          equipmentRows = equipmentMetadata && calculateEquipmentAttributeRows(temporary, equipmentMetadata, promotion);
          await verify();
          if (!equipmentRows) return `「${selected.name}」临时面板无法复算，缺少角色、光锥或遗器的完整数据。`;
          equipmentLabel = labels.join(" · ");
          selected = { ...temporary, stats: formatPanelAttributeRows(equipmentRows) };
        }
      }

      if (type === "damage" && selected) {
        const metadata = equipmentMetadata ?? await readPanelDamageMetadata(selected, theme);
        const scenario = "scenario" in command ? command.scenario : undefined;
        const result = metadata ? readStarRailPersonalDamage(selected, metadata, scenario, equipmentRows, skillPreview) : { reason: "角色或光锥主题数据不齐", scenarioCount: undefined };
        await verify();
        if (result.scenarioCount !== undefined) {
          return equipmentLabel
            ? `${selected.name}在当前星魂下支持 ${result.scenarioCount} 个伤害场景，请调整原试算指令中的伤害序号。`
            : `${selected.name}在当前星魂下支持 ${result.scenarioCount} 个伤害场景，可用 *${selected.name}伤害${archiveSuffix} 查看编号。`;
        }
        if (!result.damage) return `${selected.name}伤害计算暂不可用。${result.reason}。`;
        const damage = equipmentLabel ? { ...result.damage, buffs: [equipmentLabel, ...result.damage.buffs] } : result.damage;
        const card = await renderStarRailPersonalDamage(damage, theme.root, selected.id).catch(() => undefined);
        await verify();
        if (card) return { type: "image" as const, file: card.png };
        return [equipmentLabel, ...damage.rows.map(row => {
          if (row.average === undefined) return `${row.title} · ${row.note}`;
          return row.critical === undefined ? `${row.title} · ${personalDamageMetricLabel[row.metric]} ${row.percentage ?? row.display ?? Math.round(row.average)}` :
            `${row.title} · 暴击 ${Math.round(row.critical)} · 期望 ${Math.round(row.average)}`;
        })].filter(Boolean).join("\n");
      }
      let models;
      let relicScore: { readonly mark: string; readonly markClass: string; readonly incomplete: number } | undefined;
      if (selected) {
        if (type === "relics") {
          const relics = await makePanelRelicCard(snapshot, selected, theme, signal);
          await verify();
          if (!relics) return `「${selected.name}」暂无可评分的遗器，可用 *更新面板${profileId === 1 ? "" : profileId} 补齐面板。`;
          models = [relics];
          relicScore = relics.artisDetail;
        } else {
          models = [await makePanelDetailCard(snapshot, selected, theme, signal, { equipmentLabel, skillPreview, localOnly: explicitUid })];
        }
      } else {
        models = await makePanelListCards(snapshot, theme, profileId, signal, updated, type === "reload" || publicLookup);
      }
      const images = [];
      for (const model of models) {
        await verify();
        const result = await renderTemplate(model);
        if (!result) {
          await verify();
          if (type === "update") return `UID ${uid} 星铁面板已更新，共 ${snapshot.avatars.length} 位角色。图片暂时无法生成。`;
          if (selected) {
            if (relicScore) return `UID ${uid} · ${selected.name} · 遗器总分 ${relicScore.mark} · ${relicScore.markClass}`;
            const visible = [selected.name, selected.level && `Lv.${selected.level}`, selected.rank !== undefined && `${selected.rank}魂`,
              selected.cone?.name, ...selected.relics.map(relic => relic.name)].filter(Boolean).join(" · ");
            return [`UID ${uid}`, equipmentLabel, visible].filter(Boolean).join("\n");
          }
          const label = snapshot.source === "miyoushe" || snapshot.source === "legacy"
            ? "星铁面板" : `星铁公开展板 · ${showcaseProviderNames[snapshot.source]}`;
          return `UID ${uid} ${label} · ${snapshot.avatars.length} 位角色\n${snapshot.avatars.map(avatar => avatar.name).join("、")}`;
        }
        images.push(...result.map(file => ({ type: "image" as const, file })));
      }
      await verify();
      if (images.length === 1) {
        if (observedAt !== undefined && groupRank && context && context.user_id?.toString() === qq && selected && relicScore?.incomplete === 0) {
          await groupRank.observe(context, profileId, role, {
            characterId: selected.id, score: Number(relicScore.mark), grade: relicScore.markClass, observedAt,
          }, verify).catch(() => undefined);
          await verify();
        }
        return images[0];
      }
      if (images.length) return { type: "forward" as const, nodes: [`UID ${uid} · ${snapshot.avatars.length} 位角色`, ...images] };
    } catch (error) {
      if (signal.aborted) return;
      if (error instanceof ProfileError) {
        if (error.code === "changed") return "星铁面板档案已变更，请重新查询。";
        if (error.code === "missing" || error.code === "login-required") return `[starrail] 请先登录 profile ${profileId}。`;
        if (error.code === "role-missing") return `[starrail] profile ${profileId} 没有同步星铁 UID。`;
      }
      if (error instanceof ShowcaseError) return error.message;
      if (error instanceof GameRecordRequestError) return error.message;
      if (error instanceof HoyoRequestError) {
        if (error.code === "profile-changed") return "星铁面板档案已变更，请重新查询。";
        if (error.code === "refresh") return "星铁面板 Cookie 未能续期，请确认当前档案登录状态。";
        if (error.code === "invalid-input") return "星铁面板更新需使用档案中已同步的国服星铁角色。";
        if (error.retcode === 10102) return "米游社面板未公开或当前档案没有绑定该角色，原面板已保留。";
      }
      if (type === "export") return "星铁面板导出失败，请检查本地面板档案。";
      if (type === "reload") return "星铁面板暂时无法重新加载，请检查本地面板档案。";
      if (type === "refresh-traces") return "星铁角色行迹暂时无法刷新，已保留原行迹。";
      return "星铁面板暂时无法读取或更新，请稍后重试。";
    }
  };
}
