import { createTranslator as createTextTranslator } from "../../packages/i18n/index.ts";
import messageCatalog from "./i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { AcquireRoleArchiveLock } from "@lotus-yunzai/storage";
import type { ChatFile, ChatFileResult } from "../../lib/chat-files.ts";
import { createStarRailPanelArchive, panelDiscardedAt } from "./panel-discard.ts";
import { panelExportFile } from "./panel-file.ts";
import { legacySnapshot } from "./panel-legacy.ts";

interface SignedStarRailExportRequest {
  readonly qq: string;
  readonly uid: string;
  readonly authorize: (uid: string) => Promise<boolean>;
  readonly uploadFile: (file: ChatFile) => Promise<ChatFileResult>;
  readonly signal: AbortSignal;
}

const unauthorized = $t("panel-signed-export.text_7c5e3b9314");
const discarded = $t("panel-signed-export.text_c20b3795ad");

export function createStarRailSignedPanelExport(lock: AcquireRoleArchiveLock, signal: AbortSignal, {
  archiveDirectory, legacyPanelDirectory,
}: { readonly archiveDirectory?: string; readonly legacyPanelDirectory?: string } = {}) {
  const archive = createStarRailPanelArchive(lock, archiveDirectory);
  return async ({ qq, uid, authorize, uploadFile, signal: requester }: SignedStarRailExportRequest) => {
    const active = AbortSignal.any([signal, requester]);
    if (active.aborted) return;
    if (!/^[1-9]\d{0,15}$/u.test(qq) || !Number.isSafeInteger(Number(qq)) || !/^[1-9]\d{8,9}$/u.test(uid)) {
      return $t("panel-signed-export.text_a7587db4f3");
    }
    const authorized = async () => {
      active.throwIfAborted();
      const allowed = await authorize(uid).catch(() => false);
      active.throwIfAborted();
      return allowed === true;
    };
    try {
      if (!await authorized()) return unauthorized;
      // Only use the caller's partition to check the existing deletion boundary.
      // A signature grant cannot export any QQ-scoped snapshot or refreshed traces.
      if (panelDiscardedAt(await archive.read(qq, uid))) return discarded;
      active.throwIfAborted();
      const old = await legacySnapshot(uid, undefined, legacyPanelDirectory);
      const file = old?.snapshot.avatars.length ? panelExportFile(old.snapshot, old.data) : undefined;

      if (!await authorized()) return unauthorized;
      if (panelDiscardedAt(await archive.read(qq, uid))) return discarded;
      if (!await authorized()) return unauthorized;
      if (!file) return $t("panel-signed-export.text_dc49cf310a", { "uid": uid });
      const { name, bytes, format } = file;
      const outcome = await uploadFile({ name, bytes }).catch(() => "unknown");
      if (active.aborted) return;
      if (outcome === "rejected") return $t("panel-signed-export.text_4314bb01b9");
      if (outcome !== "confirmed") return $t("panel-signed-export.text_f9bbf47236");
      return $t("panel-signed-export.text_b3621679ed", { "name": name, "format": format });
    } catch {
      if (!active.aborted) return $t("panel-signed-export.text_6c7b3968dc");
    }
  };
}
