import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ProfileError, type createProfileStore } from "@lotus-yunzai/account";
import { GameRecordRequestError, HoyoRequestError, type createProfileHoyoClient } from "@lotus-yunzai/hoyo-client";
import { createRoleJsonArchive, type AcquireRoleArchiveLock } from "@lotus-yunzai/storage";
import { renderTemplate } from "../../lib/renderer/shotium.ts";
import { findPanelAvatar, makePanelDetailCard, makePanelListCards, makePanelRelicCard, readTheme } from "./panel-card.ts";
import { id as readId, normalizePanel, object, readLegacyPanel, type PanelCommand, type PanelSnapshot } from "./panel-model.ts";

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
  lock: AcquireRoleArchiveLock, signal: AbortSignal,
) {
  const store = createRoleJsonArchive(targetDirectory, lock, { subject: "星铁面板", lockSuffix: "panel", maxBytes, rejectNull: true });
  const refreshing = new Set<string>();

  return async function query(qq: string, { type, profileId, name }: PanelCommand) {
    try {
      const { role, revision: initialRevision, ...account } = await profiles.requestContext(qq, profileId, "sr");
      const { uid } = role;
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
      let models;
      let selected;
      let relicScore: { readonly mark: string; readonly markClass: string } | undefined;
      if (type === "detail" || type === "relics") {
        selected = findPanelAvatar(snapshot.avatars, name, theme);
        if (!selected) return `当前星铁面板中没有「${name}」，请用 *面板${profileId === 1 ? "" : profileId} 查看列表。`;
        if (type === "relics") {
          const relics = await makePanelRelicCard(snapshot, selected, theme, signal);
          await verify();
          if (!relics) return `「${selected.name}」暂无可评分的遗器，可用 *更新面板${profileId === 1 ? "" : profileId} 补齐面板。`;
          models = [relics];
          relicScore = relics.artisDetail;
        } else {
          models = [await makePanelDetailCard(snapshot, selected, theme, signal)];
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
            return `UID ${uid}\n${visible}`;
          }
          return `UID ${uid} 星铁面板 · ${snapshot.avatars.length} 位角色\n${snapshot.avatars.map(avatar => avatar.name).join("、")}`;
        }
        images.push(...result.map(file => ({ type: "image" as const, file })));
      }
      await verify();
      if (images.length === 1) return images[0];
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
