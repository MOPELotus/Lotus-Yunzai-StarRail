import { fileURLToPath } from "node:url";
import { createRoleJsonArchive, type AcquireRoleArchiveLock } from "@lotus-yunzai/storage";
import { object, type PanelSnapshot } from "./panel-model.ts";

const defaultDirectory = fileURLToPath(new URL("../../data/starrail/panels/", import.meta.url));

export function createStarRailPanelArchive(lock: AcquireRoleArchiveLock, directory = defaultDirectory) {
  return createRoleJsonArchive(directory, lock, { subject: "星铁面板", lockSuffix: "panel", maxBytes: 8 * 1024 * 1024, rejectNull: true });
}

export function panelDiscardedAt(raw: unknown): number {
  const boundary = object(raw)?.panelDiscardedAt;
  return typeof boundary === "number" && Number.isSafeInteger(boundary) && boundary > 0 ? boundary : 0;
}

export function discardedStarRailPanel(uid: string, boundary: number) {
  return {
    version: 1, uid, source: "miyoushe", updatedAt: new Date(boundary).toISOString(), avatars: [], panelDiscardedAt: boundary,
  } satisfies PanelSnapshot & { panelDiscardedAt: number };
}

export function retainPanelDiscardBoundary(next: PanelSnapshot, boundary: number) {
  // An explicit refresh may restore new data while old archives and observations stay discarded.
  return boundary ? { ...next, panelDiscardedAt: boundary } : next;
}
