import { createTranslator as createTextTranslator } from "../../../packages/i18n/index.ts";
import messageCatalog from "../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import { readWarpRandomCandidates } from "./pools.ts";
import { defaultWarpRates, readWarpAllowance, type createWarpSettingsStore, type WarpAllowance, type WarpPoolNames, type WarpRates,
  type WarpSettings } from "./settings.ts";

const allowanceFields = { "专属票": "special", "专票": "special", "普通票": "regular", "通票": "regular", "撤回时间": "recallSeconds" } as const;
const rateFields = {
  "小保底概率": "featuredFive", "五星角色概率": "characterFive", "四星角色概率": "characterFour",
  "五星光锥概率": "coneFive", "四星光锥概率": "coneFour",
} as const;
const poolFields = { "五星角色": "characterFive", "四星角色": "characterFour", "五星光锥": "coneFive", "四星光锥": "coneFour" } as const;
const toggleFields = {
  "自定义": "enabled", "开关": "enabled", "总开关": "enabled", "百连": "multiple",
  "双黄": "weeklyBonus", "每周双黄": "weeklyBonus", "卡池同步": "automaticPools", "卡池自动同步": "automaticPools",
} as const;
const globalFields = [...Object.keys(rateFields), ...Object.keys(poolFields), ...Object.keys(toggleFields),
  $t("simulation.admin.text_077b20bfaa"), $t("simulation.admin.text_79013b55dd"), $t("simulation.admin.text_d95dc3efdf"), $t("simulation.admin.text_ddf210db3b"), $t("simulation.admin.text_6f2a65988f")].sort((left, right) => right.length - left.length);
const globalPattern = new RegExp(`^#星铁(?:模拟)?抽卡设置\\s*(?:(${globalFields.join("|")})\\s*(.*))?$`, "u");
const allowancePattern = new RegExp(`^(?:#星铁设置(?:星铁)?抽卡|#设置星铁抽卡)\\s*(?:(${Object.keys(allowanceFields).join("|")})\\s*(.*))?$`, "u");

export function parseWarpAdministration(message: string) {
  const allowance = allowancePattern.exec(message);
  if (allowance) return { scope: "allowance" as const, field: allowance[1], value: allowance[2]?.trim() };
  const global = globalPattern.exec(message);
  if (global) return { scope: "global" as const, field: global[1], value: global[2]?.trim() };
}

function take<T>(source: readonly T[], count: number, random: () => number) {
  const candidates = [...source];
  return Array.from({ length: Math.min(count, candidates.length) }, () => {
    const [value] = candidates.splice(Math.floor(random() * candidates.length), 1);
    return value!;
  });
}

function number(input: string | undefined, min: number, max: number) {
  if (!input || !/^\d{1,5}$/u.test(input)) throw new RangeError($t("simulation.admin.text_e9d7324c5b", { "min": min, "max": max }));
  return Math.max(min, Math.min(Number(input), max));
}

function toggle(input: string | undefined) {
  if (!input) return true;
  if (/^(?:开启|启用|打开|开|是|1|true)$/iu.test(input ?? "")) return true;
  if (/^(?:关闭|禁用|关|否|0|false)$/iu.test(input ?? "")) return false;
  throw new RangeError($t("simulation.admin.text_daa505cc19"));
}

type PoolCandidates = Awaited<ReturnType<typeof readWarpRandomCandidates>>;

function editGlobal(settings: WarpSettings, field: string, value: string | undefined, random: () => number, candidates?: PoolCandidates) {
  if (field === "概率复位") settings.rates = { ...defaultWarpRates };
  else if (field === "转生间隔") settings.reincarnationMinutes = number(value, 1, 1440);
  else if (Object.hasOwn(rateFields, field)) {
    const key = rateFields[field as keyof typeof rateFields] as keyof WarpRates;
    settings.rates[key] = number(value, 0, key === "featuredFive" ? 100 : 10_000);
  } else if (Object.hasOwn(toggleFields, field)) {
    settings[toggleFields[field as keyof typeof toggleFields]] = toggle(value);
  } else if (field === "随机卡池" && candidates) {
    settings.automaticPools = false;
    settings.poolNames = {
      characterFive: take(candidates.characterFive, 2, random), characterFour: take(candidates.characterFour, 3, random),
      coneFive: take(candidates.coneFive, 2, random), coneFour: take(candidates.coneFour, 5, random),
    };
  } else if (Object.hasOwn(poolFields, field)) {
    const key = poolFields[field as keyof typeof poolFields] as keyof WarpPoolNames;
    let names: unknown;
    try {
      names = value?.startsWith("[") ? JSON.parse(value) : value?.split(/[,，]/u).map(name => name.trim()).filter(Boolean);
    } catch {}
    if (!Array.isArray(names) || !names.length || !names.every(name => typeof name === "string")) {
      throw new RangeError($t("simulation.admin.text_ddf27ebdcc"));
    }
    settings.automaticPools = false;
    settings.poolNames[key] = names;
  }
  return settings;
}

function summarize(settings: WarpSettings) {
  const switchText = (value: boolean) => value ? $t("simulation.admin.text_8da97ddda9") : $t("simulation.admin.text_3fd47edce4");
  const poolNames = Object.entries(poolFields).map(([label, field]) => `${label} ${settings.poolNames[field]?.join("、") ?? $t("simulation.admin.text_b2d71ca5fe")}`);
  const rates = settings.rates;
  return [
    $t("simulation.admin.text_071b2e76e9"),
    $t("simulation.admin.text_3f091e82a2", { "value1": switchText(settings.enabled), "value2": switchText(settings.multiple), "value3": switchText(settings.weeklyBonus) }),
    $t("simulation.admin.text_f7fb1e0060", { "value1": settings.automaticPools ? $t("simulation.admin.text_6e9adb42a2") : $t("simulation.admin.text_1c74bf5ef1"), "reincarnationMinutes": settings.reincarnationMinutes }),
    $t("simulation.admin.text_c65eda7337", { "characterFive": rates.characterFive, "characterFour": rates.characterFour }),
    $t("simulation.admin.text_a19bd40fbc", { "coneFive": rates.coneFive, "coneFour": rates.coneFour }),
    $t("simulation.admin.text_23494e5361", { "value1": rates.featuredFive === null ? $t("simulation.admin.text_1c1b92a4e7") : rates.featuredFive + "%" }),
    ...poolNames,
  ].join("\n");
}

export async function runWarpAdministration(request: NonNullable<ReturnType<typeof parseWarpAdministration>>, {
  settings, group, verifyOwner, random,
}: {
  readonly settings: ReturnType<typeof createWarpSettingsStore>; readonly group?: string; readonly verifyOwner: () => Promise<void>;
  readonly random: () => number;
}) {
  const { field, value } = request;
  if (request.scope === "global") {
    if (field === "违禁词" || field === "屏蔽词") return $t("simulation.admin.text_bd2d7757e5");
    const candidates = field === "随机卡池" ? await readWarpRandomCandidates() : undefined;
    return summarize(field ? await settings.update(current => editGlobal(current, field, value, random, candidates), verifyOwner) : await settings.read());
  }
  const saved = field ? await settings.update(current => {
    const key: keyof WarpAllowance = allowanceFields[field as keyof typeof allowanceFields];
    const amount = key === "recallSeconds" ? number(value, 0, 120) : number(value, 0, 10_000);
    if (group) current.groups[group] = { ...current.groups[group], [key]: amount };
    else current.allowance[key] = amount;
    return current;
  }, verifyOwner) : await settings.read();
  const { special, regular, recallSeconds } = readWarpAllowance(saved, group);
  return $t("simulation.admin.text_e903d5f1e2", { "value1": group ? $t("simulation.admin.text_0d5f4509dd") : $t("simulation.admin.text_844b8cc8df"), "special": special, "regular": regular, "recallSeconds": recallSeconds });
}
