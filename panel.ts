import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ProfileError, type createProfileStore } from "@lotus-yunzai/account";
import { GameRecordRequestError, HoyoRequestError, type createProfileHoyoClient } from "@lotus-yunzai/hoyo-client";
import { createRoleJsonArchive, type AcquireRoleArchiveLock } from "@lotus-yunzai/storage";
import { renderTemplate } from "../../lib/renderer/shotium.ts";
import { findPanelAvatar, makePanelDetailCard, makePanelListCards, makePanelRelicCard, readPanelDamageMetadata, readTheme } from "./panel-card.ts";
import { calculateEquipmentAttributeRows, changePanelLevel, formatPanelAttributeRows, type PanelAttributeRows } from "./panel-attributes.ts";
import { changePanelEidolon } from "./panel-eidolon.ts";
import { changePanelRelicSets } from "./panel-relic-set.ts";
import { changePanelFullTraces } from "./panel-trace-preview.ts";
import { changePanelCoreSkills } from "./panel-skill-preview.ts";
import { changePanelSuperimposition, replacePanelEquipment } from "./panel-equipment.ts";
import { hasPersonalDamage, personalDamageMetricLabel, personalDamageNames, readStarRailPersonalDamage } from "./panel-damage.ts";
import { renderStarRailPersonalDamage } from "./panel-damage-card.ts";
import type { createStarRailGroupRelicRank, StarRailGroupRankContext } from "./group-relic-rank.ts";
import { id as readId, normalizePanel, object, readLegacyPanel, text, type PanelAvatar, type PanelCommand, type PanelSnapshot } from "./panel-model.ts";

const targetDirectory = fileURLToPath(new URL("../../data/starrail/panels/", import.meta.url));
const legacyDirectory = fileURLToPath(new URL("../../data/PlayerData/sr/", import.meta.url));
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
    return readLegacyPanel(uid, data);
  } finally {
    await handle.close();
  }
}

function managedSnapshot(uid: string, raw: unknown) {
  if (raw === null) return;
  const stored = object(raw);
  if (stored?.version !== 1 || stored.uid !== uid || stored.source !== "miyoushe" || typeof stored.updatedAt !== "string" ||
      !Number.isFinite(Date.parse(stored.updatedAt)) || !Array.isArray(stored.avatars) || !stored.avatars.length ||
      stored.avatars.length > 256 || stored.avatars.some(row => !object(row) || !readId(row.id) || typeof row.name !== "string" ||
        !Array.isArray(row.skills) || !Array.isArray(row.traces) || !Array.isArray(row.stars) || !Array.isArray(row.stats) || !Array.isArray(row.relics))) {
    throw new Error("星铁面板档案无效。");
  }
  return stored as unknown as PanelSnapshot;
}

export function createStarRailPanel(
  profiles: ReturnType<typeof createProfileStore>, client: ReturnType<typeof createProfileHoyoClient>,
  lock: AcquireRoleArchiveLock, signal: AbortSignal, groupRank?: ReturnType<typeof createStarRailGroupRelicRank>,
) {
  const store = createRoleJsonArchive(targetDirectory, lock, { subject: "星铁面板", lockSuffix: "panel", maxBytes, rejectNull: true });
  const refreshing = new Set<string>();

  return async function query(qq: string, command: PanelCommand, context?: StarRailGroupRankContext) {
    const { type, profileId, name } = command;
    try {
      const observedAt = type === "relics" && groupRank?.allows(context) ? Date.now() : undefined;
      const { role, revision: initialRevision, ...account } = await profiles.requestContext(qq, profileId, "sr");
      const { uid } = role;
      const explicitUid = "uid" in command;
      if (explicitUid && command.uid !== uid) return "此 UID 与所选档案当前绑定的星铁角色不一致。";
      const key = `${qq}:${uid}`;
      let revision = initialRevision;
      let snapshot: PanelSnapshot | undefined;
      let updated = false;
      async function verify() {
        signal.throwIfAborted();
        const latest = await profiles.requestContext(qq, profileId, "sr").catch(() => undefined);
        if (!latest || latest.revision !== revision || latest.role.uid !== uid || latest.role.region !== role.region) {
          throw new ProfileError("changed", "星铁面板档案已变更，请重新查询。");
        }
      }

      if (type === "update") {
        if (refreshing.has(key)) return "此星铁角色面板正在更新，请稍后查询。";
        refreshing.add(key);
        try {
          const startedAt = new Date();
          const result = await client.fetchStarRailPanel({ ...account, role, revision }, { signal });
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
      } else {
        snapshot = managedSnapshot(uid, await store.read(qq, uid)) ?? await legacySnapshot(uid);
      }

      if (!snapshot?.avatars.length) return `UID ${uid} 暂无星铁角色面板，请先使用 *更新面板${profileId === 1 ? "" : profileId}。`;
      const theme = await readTheme();
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
        const card = await renderStarRailPersonalDamage(damage, theme.root).catch(() => undefined);
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
        models = await makePanelListCards(snapshot, theme, profileId, signal, updated);
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
          return `UID ${uid} 星铁面板 · ${snapshot.avatars.length} 位角色\n${snapshot.avatars.map(avatar => avatar.name).join("、")}`;
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
      if (error instanceof GameRecordRequestError) return error.message;
      if (error instanceof HoyoRequestError) {
        if (error.code === "profile-changed") return "星铁面板档案已变更，请重新查询。";
        if (error.code === "refresh") return "星铁面板 Cookie 未能续期，请确认当前档案登录状态。";
        if (error.code === "invalid-input") return "星铁面板更新需使用档案中已同步的国服星铁角色。";
        if (error.retcode === 10102) return "米游社面板未公开或当前档案没有绑定该角色，原面板已保留。";
      }
      return "星铁面板暂时无法读取或更新，请稍后重试。";
    }
  };
}
