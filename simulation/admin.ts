import { warpRandomCandidates } from "./pools.ts";
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
  "概率复位", "随机卡池", "转生间隔", "违禁词", "屏蔽词"].sort((left, right) => right.length - left.length);
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
  if (!input || !/^\d{1,5}$/u.test(input)) throw new RangeError(`请输入 ${min}–${max} 的整数。`);
  return Math.max(min, Math.min(Number(input), max));
}

function toggle(input: string | undefined) {
  if (!input) return true;
  if (/^(?:开启|启用|打开|开|是|1|true)$/iu.test(input ?? "")) return true;
  if (/^(?:关闭|禁用|关|否|0|false)$/iu.test(input ?? "")) return false;
  throw new RangeError("请提供开启或关闭。");
}

function editGlobal(settings: WarpSettings, field: string, value: string | undefined, random: () => number) {
  if (field === "概率复位") settings.rates = { ...defaultWarpRates };
  else if (field === "转生间隔") settings.reincarnationMinutes = number(value, 1, 1440);
  else if (Object.hasOwn(rateFields, field)) {
    const key = rateFields[field as keyof typeof rateFields] as keyof WarpRates;
    settings.rates[key] = number(value, 0, key === "featuredFive" ? 100 : 10_000);
  } else if (Object.hasOwn(toggleFields, field)) {
    settings[toggleFields[field as keyof typeof toggleFields]] = toggle(value);
  } else if (field === "随机卡池") {
    settings.automaticPools = false;
    settings.poolNames = {
      characterFive: take(warpRandomCandidates.characterFive, 2, random), characterFour: take(warpRandomCandidates.characterFour, 3, random),
      coneFive: take(warpRandomCandidates.coneFive, 2, random), coneFour: take(warpRandomCandidates.coneFour, 5, random),
    };
  } else if (Object.hasOwn(poolFields, field)) {
    const key = poolFields[field as keyof typeof poolFields] as keyof WarpPoolNames;
    let names: unknown;
    try {
      names = value?.startsWith("[") ? JSON.parse(value) : value?.split(/[,，]/u).map(name => name.trim()).filter(Boolean);
    } catch {}
    if (!Array.isArray(names) || !names.length || !names.every(name => typeof name === "string")) {
      throw new RangeError("请输入卡池名称。多个名称用逗号分隔，名称内有逗号时请用 JSON 字符串数组。");
    }
    settings.automaticPools = false;
    settings.poolNames[key] = names;
  }
  return settings;
}

function summarize(settings: WarpSettings) {
  const switchText = (value: boolean) => value ? "开启" : "关闭";
  const poolNames = Object.entries(poolFields).map(([label, field]) => `${label} ${settings.poolNames[field]?.join("、") ?? "随官方配置"}`);
  const rates = settings.rates;
  return [
    "星铁模拟跃迁设置",
    `模拟 ${switchText(settings.enabled)} · 多连 ${switchText(settings.multiple)} · 每周双黄 ${switchText(settings.weeklyBonus)}`,
    `卡池 ${settings.automaticPools ? "自动同步" : "手工设置"} · 转生间隔 ${settings.reincarnationMinutes} 分钟`,
    `角色池五星 ${rates.characterFive}/10000 · 四星 ${rates.characterFour}/10000`,
    `光锥池五星 ${rates.coneFive}/10000 · 四星 ${rates.coneFour}/10000`,
    `五星小保底 ${rates.featuredFive === null ? "角色 50% · 光锥 75%" : rates.featuredFive + "%"}`,
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
    if (field === "违禁词" || field === "屏蔽词") return "全局词表通过群管的屏蔽词设置管理。";
    return summarize(field ? await settings.update(current => editGlobal(current, field, value, random), verifyOwner) : await settings.read());
  }
  const saved = field ? await settings.update(current => {
    const key: keyof WarpAllowance = allowanceFields[field as keyof typeof allowanceFields];
    const amount = key === "recallSeconds" ? number(value, 0, 120) : number(value, 1, 10_000);
    if (group) current.groups[group] = { ...current.groups[group], [key]: amount };
    else current.allowance[key] = amount;
    return current;
  }, verifyOwner) : await settings.read();
  const { special, regular, recallSeconds } = readWarpAllowance(saved, group);
  return `${group ? "本群" : "默认"}模拟跃迁设置\n每日专票 ${special} 张 · 通票 ${regular} 张 · 撤回 ${recallSeconds} 秒`;
}
