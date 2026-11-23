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

const unauthorized = "星铁 UID 签名验证未通过或已过期，请在好友私聊重新验证。";
const discarded = "此 UID 的旧星铁面板已删除，无法通过签名导出。";

export function createStarRailSignedPanelExport(lock: AcquireRoleArchiveLock, signal: AbortSignal, {
  archiveDirectory, legacyPanelDirectory,
}: { readonly archiveDirectory?: string; readonly legacyPanelDirectory?: string } = {}) {
  const archive = createStarRailPanelArchive(lock, archiveDirectory);
  return async ({ qq, uid, authorize, uploadFile, signal: requester }: SignedStarRailExportRequest) => {
    const active = AbortSignal.any([signal, requester]);
    if (active.aborted) return;
    if (!/^[1-9]\d{0,15}$/u.test(qq) || !Number.isSafeInteger(Number(qq)) || !/^[1-9]\d{8,9}$/u.test(uid)) {
      return "请输入明确的星铁 UID，再进行签名验证导出。";
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
      if (!file) return `UID ${uid} 暂无可签名导出的本机旧星铁面板。`;
      const { name, bytes, format } = file;
      const outcome = await uploadFile({ name, bytes }).catch(() => "unknown");
      if (active.aborted) return;
      if (outcome === "rejected") return "星铁面板文件发送失败，请检查网关的文件发送功能。";
      if (outcome !== "confirmed") return "星铁面板文件发送结果未确认，请在当前会话查看。";
      return `已导出 ${name}（${format}）。`;
    } catch {
      if (!active.aborted) return "星铁签名面板导出失败，请检查本机旧面板档案。";
    }
  };
}
