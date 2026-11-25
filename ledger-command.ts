import { createTranslator as createTextTranslator } from "../../packages/i18n/index.ts";
import messageCatalog from "./i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import { fileURLToPath } from "node:url";
import { gameCommandProfileId, MAX_PROFILE_ID, ProfileError, type createProfileStore } from "@lotus-yunzai/account";
import { HoyoRequestError, type createProfileHoyoClient, type StarRailLedgerKind, type StarRailLedgerRow } from "@lotus-yunzai/hoyo-client";
import { renderStarRailLedgerCard } from "./account-report-renderer.ts";

const pattern = /^(?:#星铁|\*|＊|[#*]?sr)\s*(?:(星琼|古老梦华|体力|遗器|充值)记录|(光锥|武器)资产(?:流水|记录))(?:\s*(\d{1,6}))?(?:\s*档案\s*(\d{1,3}))?$/u;
const names = {
  星琼: "stellar", 古老梦华: "dreams", 体力: "power", 遗器: "relic", 充值: "dreams",
} as const satisfies Record<string, StarRailLedgerKind>;
const titles = {
  stellar: [$t("ledger-command.text_ae25247f75"), "Stellar"], dreams: [$t("ledger-command.text_2c4e19033b"), "Dreams"], power: [$t("ledger-command.text_d6d2aa99fd"), "Power"], relic: [$t("ledger-command.text_2f2b17beb4"), "Relic"],
  cone: [$t("ledger-command.text_e733238b28"), "Cone"],
} as const;
const theme = new URL("./monthly-theme/charge/", import.meta.url);

export function matchStarRailLedger(message: string) {
  const match = pattern.exec(message);
  if (!match) return;
  const kind: StarRailLedgerKind = match[2] ? "cone" : names[match[1] as keyof typeof names];
  return { kind, page: Number(match[3] ?? 1), profileId: gameCommandProfileId("sr", match[4]) };
}

export function makeStarRailLedgerCard(uid: string, kind: StarRailLedgerKind, page: number, rows: readonly StarRailLedgerRow[]) {
  const [type, typeen] = titles[kind];
  return {
    tplFile: fileURLToPath(new URL("charge.html", theme)),
    css: new URL("style.css", theme).href,
    background: new URL("bg_main.b435ab02..png", theme).href,
    decoration: new URL("Deco4.png", theme).href,
    uid, type, typeen, page, rows, imgType: "png" as const, viewport: { width: 780, height: 1000 }, scale: 1,
  };
}

interface Context {
  readonly user_id?: number;
  readonly message_type?: string;
  readonly isDelegated?: boolean;
  readonly privateCredentialSignal?: AbortSignal;
  readonly inlineImageByteLimit?: number;
}

export function createStarRailLedgerQuery(profiles: ReturnType<typeof createProfileStore>,
  client: ReturnType<typeof createProfileHoyoClient>, lifecycle: AbortSignal) {
  const changed = $t("ledger-command.text_ccc3907337");
  return async function query(context: Context, { kind, page, profileId }: NonNullable<ReturnType<typeof matchStarRailLedger>>) {
    const signal = context.privateCredentialSignal ? AbortSignal.any([lifecycle, context.privateCredentialSignal]) : lifecycle;
    if (signal.aborted) return [];
    const user = context.user_id;
    if ((context.message_type !== "private" && context.message_type !== "group") || context.isDelegated ||
        typeof user !== "number" || !Number.isSafeInteger(user) || user < 1) return $t("ledger-command.text_8c3d02e1ea");
    if (profileId < 1 || profileId > MAX_PROFILE_ID) return $t("ledger-command.text_68901e8078", { "MAX_PROFILE_ID": MAX_PROFILE_ID });
    if (page < 1) return $t("ledger-command.text_51c0dcaac9");
    const qq = String(user);
    try {
      const source = await profiles.requestSelectedContext(qq, profileId, "sr");
      const { rows, revision } = await client.fetchStarRailLedger(source, { kind, page, signal });
      async function verify() {
        signal.throwIfAborted();
        const active = await profiles.requestSelectedContext(qq, profileId, "sr").catch(() => undefined);
        if (active?.revision !== revision || active.role.uid !== source.role.uid ||
            active.role.region !== source.role.region || active.role.gameBiz !== source.role.gameBiz) {
          throw new HoyoRequestError("profile-changed", changed);
        }
        signal.throwIfAborted();
      }
      await verify();
      if (!rows.length) return $t("ledger-command.text_70a40a534c");
      const model = makeStarRailLedgerCard(source.role.uid, kind, page, rows);
      const image = await renderStarRailLedgerCard(model, { inlineImageByteLimit: context.inlineImageByteLimit }).catch(() => undefined);
      await verify();
      const photo = image?.png;
      return photo ? { type: "image" as const, file: photo } : [
        $t("ledger-command.text_390dd2bff8", { "uid": model.uid, "type": model.type, "page": page }),
        ...rows.map(row => `${row.time} · +${row.count} · ${row.reason}`),
      ].join("\n");
    } catch (error) {
      if (signal.aborted) return [];
      if (error instanceof ProfileError) {
        if (error.code === "missing" || error.code === "login-required") return $t("ledger-command.text_76720712c8", { "profileId": profileId });
        if (error.code === "role-missing") return $t("ledger-command.text_c0d14d54a7", { "profileId": profileId });
        if (error.code === "changed") return changed;
      }
      if (error instanceof HoyoRequestError) {
        if (error.code === "profile-changed") return changed;
        return error.message;
      }
      return $t("ledger-command.text_2e087cc1e0");
    }
  };
}
