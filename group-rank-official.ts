import type { createProfileStore } from "@lotus-yunzai/account";
import type { createProfileHoyoClient } from "@lotus-yunzai/hoyo-client";
import type { AcquireRoleArchiveLock } from "@lotus-yunzai/storage";
import { createOfficialGroupPanels } from "../../lib/group-panel-accounts.ts";
import { createStarRailPanelArchive, panelDiscardedAt, retainPanelDiscardBoundary } from "./panel-discard.ts";
import { normalizePanel, object } from "./panel-model.ts";

export function createStarRailOfficialGroupPanels(profiles: ReturnType<typeof createProfileStore>,
  client: ReturnType<typeof createProfileHoyoClient>, lock: AcquireRoleArchiveLock, directory?: string) {
  const archive = createStarRailPanelArchive(lock, directory);
  return createOfficialGroupPanels(profiles, "sr", (source, signal) => client.fetchStarRailPanel(source, { signal }),
    async (result, entry, verify, _context, startedAt) => {
      const qq = String(entry.qq), uid = entry.role.uid;
      const boundary = panelDiscardedAt(await archive.read(qq, uid));
      if (boundary > entry.observedAt) throw new Error("group-panel-discarded");
      const snapshot = normalizePanel(uid, result.avatars, new Date(Math.max(startedAt, boundary + 1)));
      await archive.update({ qq, uid }, async () => {
        await verify();
        if (panelDiscardedAt(await archive.read(qq, uid)) !== boundary) throw new Error("group-panel-discarded");
      }, current => {
        const previous = object(current)?.updatedAt;
        if (typeof previous === "string" && previous > snapshot.updatedAt!) throw new Error("group-panel-newer-snapshot");
        return { document: retainPanelDiscardBoundary(snapshot, boundary), result: undefined };
      });
      return snapshot;
    });
}
