import { fileURLToPath } from "node:url";
import { MAX_PROFILE_ID, ProfileError, type createProfileStore } from "@lotus-yunzai/account";
import { HoyoRequestError, type createProfileHoyoClient, type StarRailLedgerKind, type StarRailLedgerRow } from "@lotus-yunzai/hoyo-client";
import { renderStarRailLedgerCard } from "./account-report-renderer.ts";

const pattern = /^(?:#星铁|\*|＊|[#*]?sr)\s*(星琼|古老梦华|体力|遗器|充值)记录(?:\s*(\d{1,6}))?(?:\s*档案\s*(\d{1,3}))?$/u;
const names = {
  星琼: "stellar", 古老梦华: "dreams", 体力: "power", 遗器: "relic", 充值: "dreams",
} as const satisfies Record<string, StarRailLedgerKind>;
const titles = {
  stellar: ["星琼", "Stellar"], dreams: ["古老梦华", "Dreams"], power: ["体力", "Power"], relic: ["遗器", "Relic"],
} as const;
const theme = new URL("./monthly-theme/charge/", import.meta.url);

export function matchStarRailLedger(message: string) {
  const match = pattern.exec(message);
  if (!match) return;
  return {
    kind: names[match[1] as keyof typeof names], page: Number(match[2] ?? 1), profileId: Number(match[3] ?? 1),
  };
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
  const changed = "星铁档案已变更，请重新查询流水。";
  return async function query(context: Context, { kind, page, profileId }: NonNullable<ReturnType<typeof matchStarRailLedger>>) {
    const signal = context.privateCredentialSignal ? AbortSignal.any([lifecycle, context.privateCredentialSignal]) : lifecycle;
    if (signal.aborted) return [];
    const user = context.user_id;
    if ((context.message_type !== "private" && context.message_type !== "group") || context.isDelegated ||
        typeof user !== "number" || !Number.isSafeInteger(user) || user < 1) return "请从本人 QQ 会话查询星铁流水。";
    if (profileId < 1 || profileId > MAX_PROFILE_ID) return `档案编号须为 1–${MAX_PROFILE_ID}。`;
    if (page < 1) return "流水页码须大于零。";
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
      if (!rows.length) return "暂无记录。";
      const model = makeStarRailLedgerCard(source.role.uid, kind, page, rows);
      const image = await renderStarRailLedgerCard(model, { inlineImageByteLimit: context.inlineImageByteLimit }).catch(() => undefined);
      await verify();
      const photo = image?.png;
      return photo ? { type: "image" as const, file: photo } : [
        `UID ${model.uid} · ${model.type}记录 · 第 ${page} 页`,
        ...rows.map(row => `${row.time} · +${row.count} · ${row.reason}`),
      ].join("\n");
    } catch (error) {
      if (signal.aborted) return [];
      if (error instanceof ProfileError) {
        if (error.code === "missing" || error.code === "login-required") return `请先登录档案 ${profileId}。`;
        if (error.code === "role-missing") return `档案 ${profileId} 没有已同步的星铁角色。`;
        if (error.code === "changed") return changed;
      }
      if (error instanceof HoyoRequestError) {
        if (error.code === "profile-changed") return changed;
        return error.message;
      }
      return "查询星铁流水失败，请稍后重试。";
    }
  };
}
