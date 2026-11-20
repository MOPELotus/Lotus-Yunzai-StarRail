import { MAX_PROFILE_ID, ProfileError, type createProfileStore, type GameRole } from "@lotus-yunzai/account";
import { createGachaFileImport, type GachaFileImportContext } from "@lotus-yunzai/gacha/file-import";
import { StarRailGachaArchiveError, type createStarRailGachaRecordArchive } from "./gacha-record-archive.ts";
import { convertStarRailUigfTimezone, exportStarRailUigf, selectStarRailUigf } from "./gacha-uigf.ts";

const importCommand = /^#星铁(强制)?导入记录(?:json)?([1-9]\d{0,2})?$/u;
const exportCommand = /^#星铁(强制)?导出记录(?:json)?(v2|v4)?([1-9]\d{0,2})?$/u;
const poolNames = { "11": "角色", "12": "光锥", "21": "角色联动", "22": "光锥联动", "2": "新手", "1": "常驻" } as const;
const oldExporters = new Set(["Miao-Yunzai", "TRSS-Yunzai", "Yunzai-Bot"]);

export interface StarRailGachaFileContext extends GachaFileImportContext {
  readonly normalizedMessage: string;
  readonly uploadFile?: (file: { readonly name: string; readonly bytes: Uint8Array }) => Promise<"confirmed" | "rejected" | "unknown">;
}

export function matchesStarRailGachaFiles(context: StarRailGachaFileContext): boolean {
  const imported = importCommand.exec(context.normalizedMessage);
  if (imported) return Number(imported[2] ?? 1) <= MAX_PROFILE_ID;
  const validId = (value: number | undefined) => value !== undefined && Number.isSafeInteger(value) && value > 0;
  if (context.attachment && /\.json$/iu.test(context.attachment.name) &&
      validId(context.self_id) && validId(context.user_id) &&
      (context.message_type === "private" || (context.message_type === "group" && validId(context.group_id)))) return true;
  const exported = exportCommand.exec(context.normalizedMessage);
  return !!exported && Number(exported[3] ?? 1) <= MAX_PROFILE_ID;
}

export function starRailLegacyArchiveTimezone(role: GameRole) {
  if (role.region === "prod_gf_cn" || role.region === "prod_qd_cn" || (!role.region && /^[125]\d{8}$/u.test(role.uid))) return 8;
}

function usesLegacyServerTime(input: unknown) {
  if (typeof input !== "object" || !input || !("info" in input)) return false;
  const { info } = input;
  return typeof info === "object" && info !== null && "export_app" in info &&
    typeof info.export_app === "string" && oldExporters.has(info.export_app);
}

function describe(error: unknown, profileId: number) {
  if (error instanceof ProfileError) {
    if (error.code === "missing") return `[starrail] 请先登录 profile ${profileId}。`;
    if (error.code === "role-missing") return `[starrail] profile ${profileId} 没有同步星铁 UID。`;
    if (error.code === "changed") return "星铁档案角色已变化，请重新操作。";
  }
  if (error instanceof StarRailGachaArchiveError) return error.message;
  if (error instanceof TypeError &&
      /^(?:UIGF|SRGF|星铁|当前星铁档案|该文件版本不支持星铁联动|该星铁文件包含显示占位记录)/u.test(error.message)) return error.message;
}

export function createStarRailGachaFiles(
  profiles: Pick<ReturnType<typeof createProfileStore>, "savedRole">,
  archive: ReturnType<typeof createStarRailGachaRecordArchive>,
  signal: AbortSignal,
  appVersion: string,
  hasDisplayHistory?: (qq: string, uid: string) => Promise<boolean>,
) {
  const savedRole = (qq: string, profileId: number) => profiles.savedRole(qq, profileId, "sr");
  const receive = createGachaFileImport({
    prefix: "*", gameName: "星铁", signal, savedRole, failure: describe,
    async importDocument(input, { qq, profileId, role, verifyProfile }) {
      const incoming = selectStarRailUigf(input, { uid: role.uid,
        legacyServerTime: starRailLegacyArchiveTimezone(role) === 8 && usesLegacyServerTime(input) });
      const result = await archive.merge({ qq, uid: role.uid }, incoming, verifyProfile, { legacyTimezone: starRailLegacyArchiveTimezone(role) });
      const lines = result.pools.flatMap(({ pool, received, added, total }) => received
        ? [`${poolNames[pool]}记录：读取 ${received} 条，新增 ${added} 条，共 ${total} 条`] : []);
      return [`UID ${role.uid} · 星铁逐抽记录导入成功`, ...lines,
        `可使用 *逐抽记录${profileId === 1 ? "" : profileId} 查看，或使用 *导出记录${profileId === 1 ? "" : profileId} 导出。`].join("\n");
    },
  });

  return async (context: StarRailGachaFileContext) => {
    const imported = importCommand.exec(context.normalizedMessage);
    if (imported || context.attachment) {
      const reply = await receive(context, imported);
      if (imported || reply !== undefined) return reply;
    }
    const exporting = exportCommand.exec(context.normalizedMessage);
    if (!exporting) return;
    const profileId = Number(exporting[3] ?? 1);
    if (profileId > MAX_PROFILE_ID) return;
    const { message_type, user_id, uploadFile } = context;
    if (typeof user_id !== "number" || !Number.isSafeInteger(user_id) || user_id < 1) {
      return "请从登录档案对应的 QQ 会话导出星铁抽卡记录。";
    }
    const version = exporting[2] === "v2" ? "v2" : "v4";
    if (message_type === "group" && !exporting[1]) {
      const suffix = `${version === "v2" ? "jsonv2" : ""}${profileId === 1 ? "" : profileId}`;
      return `建议私聊导出，若你确认要在此导出，请发送【*强制导出记录${suffix}】。`;
    }
    if (!uploadFile) return "当前会话暂不支持发送抽卡文件。";
    try {
      const qq = String(user_id);
      const role = await savedRole(qq, profileId);
      const { uid } = role;
      const data = await archive.read({ qq, uid }, { legacyTimezone: starRailLegacyArchiveTimezone(role) });
      if (data.status === "unavailable") {
        if (data.reason === "mirror") return "旧星铁档案含有用于显示的占位记录，无法导出真实逐抽。";
        if (await hasDisplayHistory?.(qq, uid)) return "本地只有星铁显示用汇总记录，无法导出真实逐抽。";
        return "本地没有可导出的星铁逐抽记录。可先用 *导入记录 导入 UIGF 或 SRGF 文件。";
      }
      const exportArchive = version === "v4" && !Number.isInteger(data.archive.timezone)
        ? convertStarRailUigfTimezone(data.archive, 0) : data.archive;
      const document = exportStarRailUigf(exportArchive, {
        uid, version, exportedAt: new Date(), app: { name: "Lotus-Yunzai", version: appVersion },
      });
      const file = { name: `${uid}.json`, bytes: Buffer.from(JSON.stringify(document, null, "\t") + "\n") };
      if (await savedRole(qq, profileId).then((current) => current.uid, () => undefined) !== uid) {
        return "星铁档案角色已变化，请重新导出。";
      }
      if (signal.aborted) return;
      const delivered = await uploadFile(file);
      if (delivered === "rejected") return "导出文件发送失败，请检查网关是否支持发送文件。";
      if (delivered !== "confirmed") return "文件发送结果未确认，请在当前会话核对。";
      return `已导出 ${file.name}，共 ${data.archive.records.length} 条星铁逐抽记录。`;
    } catch (error) {
      if (!signal.aborted) return describe(error, profileId) ?? "星铁逐抽记录导出失败，请检查本地档案。";
    }
  };
}
