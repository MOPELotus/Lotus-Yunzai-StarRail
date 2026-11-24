import { ProfileError, type createProfileStore } from "@lotus-yunzai/account";
import type { AcquireRoleArchiveLock } from "@lotus-yunzai/storage";
import { createPanelTransferCommand, type TransferWriteResult } from "../../lib/panel-transfer-command.ts";
import { createStarRailPanelArchive, retainPanelDiscardBoundary, panelDiscardedAt } from "./panel-discard.ts";
import { array, id, object, safeArt, statValue, text, whole, type PanelAvatar, type PanelSnapshot } from "./panel-model.ts";
import { matchesStarRailTraceOwner, starRailTraceOwner } from "./panel-trace-refresh.ts";
import { legacySnapshot, managedSnapshot } from "./panel.ts";

const panelSkills = new Set(["a", "e", "q", "t", "z", "xe", "me", "mt"]);
const syntheticRows = new Set(["change", "customize", "share"]);
type Profiles = Pick<ReturnType<typeof createProfileStore>, "savedRole" | "requestContext">;

function isoTime(input: unknown) {
  const stamp = typeof input === "string" && input.length <= 30 ? Date.parse(input) : NaN;
  if (Number.isFinite(stamp)) return new Date(stamp).toISOString();
}

function nonEmpty(value: unknown, maximum: number) {
  return whole(value, maximum) || undefined;
}

function transferStat(value: unknown): PanelAvatar["stats"][number] | undefined {
  const row = object(value);
  const key = text(row?.key, 35);
  const score = statValue(row?.value);
  if (key && /^[a-z][A-Za-z0-9]{0,34}$/u.test(key) && score) {
    return { key, value: score, base: statValue(row?.base) || undefined, times: whole(row?.times, 10) };
  }
}

function transferAvatar(value: unknown): PanelAvatar | undefined {
  const row = object(value);
  const key = id(row?.id), name = text(row?.name, 60), level = nonEmpty(row?.level, 80);
  const legacy = object(row?.legacy);
  const legacySource = text(legacy?.source, 40);
  if (!row || !key || !name || !level || (legacy && (!legacySource || syntheticRows.has(legacySource)))) return;
  const art = (value: unknown) => safeArt(value, false);
  const cone = object(row.cone);
  const coneId = id(cone?.id);
  const skills = array(row.skills).slice(0, 24).flatMap(row => {
    const skill = text(row.key, 4), level = nonEmpty(row.level, 25);
    return panelSkills.has(skill) && level ? [{ key: skill, level, original: nonEmpty(row.original, 25),
      effective: row.effective === true ? true as const : undefined, icon: art(row.icon) }] : [];
  });
  const traces = array(row.traces).slice(0, 24).flatMap(row => {
    const traceId = id(row.id);
    return traceId ? [{ id: traceId, active: row.active === true, name: text(row.name, 60), icon: art(row.icon) }] : [];
  });
  const slots = new Set<number>();
  const relics = array(row.relics).slice(0, 12).flatMap(row => {
    const relicId = id(row.id), slot = nonEmpty(row.slot, 6);
    if (!relicId || !slot || slots.has(slot)) return [];
    slots.add(slot);
    const main = typeof row.legacyMainId === "string" && /^\d{1,6}$/u.test(row.legacyMainId) ? row.legacyMainId : undefined;
    const subs = Array.isArray(row.legacySubIds)
      ? row.legacySubIds.slice(0, 4).filter((item): item is string => typeof item === "string" && /^\d{1,6},\d{1,3},-?\d{1,3}$/u.test(item)) : undefined;
    return [{ id: relicId, slot, name: text(row.name, 70), image: art(row.image), level: whole(row.level, 15),
      rarity: nonEmpty(row.rarity, 5), main: transferStat(row.main),
      subs: array(row.subs).slice(0, 4).flatMap(part => transferStat(part) ?? []), legacyMainId: main, legacySubIds: subs }];
  });
  return {
    id: key, name, level, rank: whole(row.rank, 6), exCons: whole(row.exCons, 6) ?? 0, rarity: nonEmpty(row.rarity, 5),
    element: text(row.element, 20), path: text(row.path, 20), face: art(row.face), splash: art(row.splash), skills, traces,
    stars: array(row.stars).slice(0, 6).map(star => ({ image: art(star.image), active: star.active === true })),
    stats: array(row.stats).slice(0, 45).flatMap(stat => transferStat(stat) ?? []), relics,
    cone: cone && coneId ? { id: coneId, name: text(cone.name, 70), rank: whole(cone.rank, 5), level: whole(cone.level, 80),
      promote: whole(cone.promote, 6), image: art(cone.image), description: text(cone.description, 1200) } : undefined,
    legacy: legacy && { source: legacySource, promote: whole(legacy.promote, 6), dataComplete: legacy.dataComplete === true,
      updatedAt: isoTime(legacy.updatedAt) },
  };
}

export function createStarRailPanelTransfer(profiles: Profiles, lockFile: AcquireRoleArchiveLock, signal: AbortSignal, {
  archiveDirectory, legacy = legacySnapshot, now = Date.now,
}: { readonly archiveDirectory?: string; readonly legacy?: typeof legacySnapshot; readonly now?: () => number } = {}) {
  const archive = createStarRailPanelArchive(lockFile, archiveDirectory);

  return createPanelTransferCommand("sr", signal, async (qq, profileId, active) => {
    async function owner() {
      const before = await profiles.requestContext(qq, profileId, "sr");
      const selected = await profiles.savedRole(qq, profileId, "sr");
      const latest = await profiles.requestContext(qq, profileId, "sr", selected.uid);
      const identity = starRailTraceOwner(latest, selected);
      if (!identity || identity.qq !== qq) throw new ProfileError("invalid", "星铁角色与登录账号不一致。");
      if (before.revision !== latest.revision) throw new ProfileError("changed", "星铁面板档案已变更。");
      return { identity, revision: latest.revision };
    }
    const bound = await owner();
    const { uid } = bound.identity;
    const discarded = panelDiscardedAt(await archive.read(qq, uid));
    async function verify() {
      active.throwIfAborted();
      const latest = await owner();
      if (latest.revision !== bound.revision || !matchesStarRailTraceOwner(bound.identity, latest.identity) ||
          panelDiscardedAt(await archive.read(qq, uid)) !== discarded) throw new ProfileError("changed", "星铁面板档案已变更。");
      active.throwIfAborted();
    }
    return {
      uid, verify,
      async read() {
        const saved = managedSnapshot(uid, await archive.read(qq, uid), false, true);
        const current = saved?.avatars.length ? saved : discarded ? undefined : (await legacy(uid))?.snapshot;
        if (!current) return;
        const avatars = current.avatars.map(transferAvatar).filter(row => row !== undefined);
        if (avatars.length) return Buffer.from(JSON.stringify({ version: 1, game: "sr",
          panel: { uid, source: current.source, updatedAt: isoTime(current.updatedAt), avatars } }));
      },
      async write(bytes) {
        let imported;
        try {
          const input: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
          const incoming = object(input);
          imported = object(incoming?.panel);
          if (incoming?.version !== 1 || incoming.game !== "sr" || imported?.uid !== uid ||
              (imported.source !== "legacy" && imported.source !== "miyoushe") ||
              !Array.isArray(imported.avatars) || imported.avatars.length > 256) return { state: "invalid" };
        } catch {
          return { state: "invalid" };
        }
        const rows = imported.avatars.map(transferAvatar).filter(row => row !== undefined);
        if (!rows.length || new Set(rows.map(row => row.id)).size !== rows.length) return { state: "invalid" };
        const importedOn = isoTime(imported.updatedAt);
        const available = rows.filter(row => {
          const observedAt = Date.parse(row.legacy?.updatedAt ?? importedOn ?? "");
          return !discarded || observedAt > discarded && observedAt <= now() + 30_000;
        });
        if (!available.length) return { state: "discarded" };
        return archive.update<TransferWriteResult>({ qq, uid }, verify, async current => {
          const boundary = panelDiscardedAt(current);
          if (boundary !== discarded) throw new ProfileError("changed", "星铁面板档案已变更。");
          const saved = managedSnapshot(uid, current, false, true) ?? (!boundary ? (await legacy(uid))?.snapshot : undefined);
          const existing = new Set(saved?.avatars.map(row => row.id));
          const additions = available.filter(row => !existing.has(row.id));
          if ((saved?.avatars.length ?? 0) + additions.length > 256) return { result: { state: "invalid" } };
          if (!additions.length) return { result: { state: "unchanged", added: 0 } };
          const document: PanelSnapshot = { version: 1, uid,
            source: saved?.avatars.length && saved.source === "miyoushe" ? "miyoushe" : imported.source === "miyoushe" ? "miyoushe" : "legacy",
            updatedAt: saved?.updatedAt ?? importedOn ?? new Date(now()).toISOString(),
            avatars: [...saved?.avatars ?? [], ...additions] };
          return { document: retainPanelDiscardBoundary(document, boundary), result: { state: "saved", added: additions.length } };
        });
      },
    };
  });
}
