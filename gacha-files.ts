import { createTranslator as createTextTranslator } from "../../packages/i18n/index.ts";
import messageCatalog from "./i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import { gameCommandProfileId, MAX_PROFILE_ID, ProfileError, type createProfileStore, type GameRole } from "@lotus-yunzai/account";
import { createGachaFileImport, type GachaFileImportContext } from "@lotus-yunzai/gacha/file-import";
import { StarRailGachaArchiveError, type createStarRailGachaRecordArchive } from "./gacha-record-archive.ts";
import { convertStarRailUigfTimezone, exportStarRailUigf, selectStarRailUigf } from "./gacha-uigf.ts";

const importCommand = /^#星铁(强制)?导入记录(?:json)?([1-9]\d{0,2})?$/u;
const exportCommand = /^#星铁(强制)?导出(?:抽卡|跃迁)?记录(?:json)?(v2|v4)?([1-9]\d{0,2})?$/u;
const poolNames = { "11": $t("gacha-files.text_c47b54e84e"), "12": $t("gacha-files.text_e733238b28"), "21": $t("gacha-files.text_957dff2ffa"), "22": $t("gacha-files.text_7085c8362b"), "2": $t("gacha-files.text_dcfce30c45"), "1": $t("gacha-files.text_300b6634fe") } as const;
const oldExporters = new Set(["Miao-Yunzai", "TRSS-Yunzai", "Yunzai-Bot"]);

export function normalizeStarRailGachaCommand(message: string) {
  return message.replace(/^#?(?:[*＊]?sr|＊)/u, "#星铁");
}

export interface StarRailGachaFileContext extends GachaFileImportContext {
  readonly normalizedMessage: string;
  readonly uploadFile?: (file: { readonly name: string; readonly bytes: Uint8Array }) => Promise<"confirmed" | "rejected" | "unknown">;
}

export function matchesStarRailGachaFiles(context: StarRailGachaFileContext): boolean {
  const command = normalizeStarRailGachaCommand(context.normalizedMessage);
  const imported = importCommand.exec(command);
  if (imported) return Number(imported[2] ?? 1) <= MAX_PROFILE_ID;
  const validId = (value: number | undefined) => value !== undefined && Number.isSafeInteger(value) && value > 0;
  if (context.attachment && /\.json$/iu.test(context.attachment.name) &&
      validId(context.self_id) && validId(context.user_id) &&
      (context.message_type === "private" || (context.message_type === "group" && validId(context.group_id)))) return true;
  const exported = exportCommand.exec(command);
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
    if (error.code === "missing") return $t("gacha-files.text_76720712c8", { "profileId": profileId });
    if (error.code === "role-missing") return $t("gacha-files.text_9d881700c6", { "profileId": profileId });
    if (error.code === "changed") return $t("gacha-files.text_dfa9a8476e");
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
    prefix: "*", gameName: $t("gacha-files.text_a2927891f0"), signal, savedRole, failure: describe,
    async importDocument(input, { qq, profileId, role, verifyProfile }) {
      const incoming = selectStarRailUigf(input, { uid: role.uid,
        legacyServerTime: starRailLegacyArchiveTimezone(role) === 8 && usesLegacyServerTime(input) });
      const result = await archive.merge({ qq, uid: role.uid }, incoming, verifyProfile, { legacyTimezone: starRailLegacyArchiveTimezone(role) });
      const lines = result.pools.flatMap(({ pool, received, added, total }) => received
        ? [$t("gacha-files.text_22818ce802", { "value1": poolNames[pool], "received": received, "added": added, "total": total })] : []);
      return [$t("gacha-files.text_14ebef0aba", { "uid": role.uid }), ...lines,
        $t("gacha-files.text_c682ba42fc", { "value1": profileId === 1 ? "" : profileId, "value2": profileId === 1 ? "" : profileId })].join("\n");
    },
  });

  return async (context: StarRailGachaFileContext) => {
    const command = normalizeStarRailGachaCommand(context.normalizedMessage);
    const imported = importCommand.exec(command);
    if (imported || context.attachment) {
      const reply = await receive(context, imported);
      if (imported || reply !== undefined) return reply;
    }
    const exporting = exportCommand.exec(command);
    if (!exporting) return;
    const profileId = gameCommandProfileId("sr", exporting[3]);
    if (profileId > MAX_PROFILE_ID) return;
    const { message_type, user_id, uploadFile } = context;
    if (typeof user_id !== "number" || !Number.isSafeInteger(user_id) || user_id < 1) {
      return $t("gacha-files.text_2fc6862de2");
    }
    const version = exporting[2] === "v2" ? "v2" : "v4";
    if (message_type === "group" && !exporting[1]) {
      const suffix = `${version === "v2" ? "jsonv2" : ""}${profileId}`;
      return $t("gacha-files.text_05215407ac", { "suffix": suffix });
    }
    if (!uploadFile) return $t("gacha-files.text_0cbb353158");
    try {
      const qq = String(user_id);
      const role = await savedRole(qq, profileId);
      const { uid } = role;
      const data = await archive.read({ qq, uid }, { legacyTimezone: starRailLegacyArchiveTimezone(role) });
      if (data.status === "unavailable") {
        if (data.reason === "mirror") return $t("gacha-files.text_fba856fffa");
        if (await hasDisplayHistory?.(qq, uid)) return $t("gacha-files.text_14f0ea7012");
        return $t("gacha-files.text_5f88409e7e");
      }
      const exportArchive = version === "v4" && !Number.isInteger(data.archive.timezone)
        ? convertStarRailUigfTimezone(data.archive, 0) : data.archive;
      const document = exportStarRailUigf(exportArchive, {
        uid, version, exportedAt: new Date(), app: { name: "Lotus-Yunzai", version: appVersion },
      });
      const file = { name: `${uid}.json`, bytes: Buffer.from(JSON.stringify(document, null, "\t") + "\n") };
      if (await savedRole(qq, profileId).then((current) => current.uid, () => undefined) !== uid) {
        return $t("gacha-files.text_dfe7cd4b53");
      }
      if (signal.aborted) return;
      const delivered = await uploadFile(file);
      if (delivered === "rejected") return $t("gacha-files.text_9c28fa7343");
      if (delivered !== "confirmed") return $t("gacha-files.text_44ad33e91e");
      return $t("gacha-files.text_7078b9441c", { "name": file.name, "length": data.archive.records.length });
    } catch (error) {
      if (!signal.aborted) return describe(error, profileId) ?? $t("gacha-files.text_fd0ac9c381");
    }
  };
}
