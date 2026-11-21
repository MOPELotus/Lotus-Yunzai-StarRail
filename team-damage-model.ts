import { MAX_PROFILE_ID } from "@lotus-yunzai/account";
import { canonicalStarRailPanelCharacter, id, object, text, type PanelAvatar } from "./panel-model.ts";

const spellings = /^(?:#?(?:崩坏星穹铁道|星穹铁道|星穹|星铁|星轨|穹轨|崩铁|铁道)|\*+)\s*(?:队伍伤害|队伤|伤害)(详情|过程|全图)?/u;

export function parseStarRailTeamDamage(message: string) {
  const prefix = spellings.exec(message);
  if (!prefix) return;
  let body = message.slice(prefix[0].length);
  const front = /^(\d+)(?!\d)/u.exec(body);
  const back = front || /(?:lv|等级)\s*\d+$/iu.test(body) ? undefined
    : /(?:\s*档案\s*|(?<![a-zA-Z.\d])\s*)([1-9]\d{0,2})$/u.exec(body);
  const profileId = Number(front?.[1] ?? back?.[1] ?? 1);
  if (profileId < 1 || profileId > MAX_PROFILE_ID) return { profileId, detail: false, cycle: 5, enemies: 3, roles: [], uid: "" };
  if (front) body = body.slice(front[0].length);
  if (back) body = body.slice(0, back.index);
  const explicit = /^\s+([1-9]\d{7,9})(?!\d)/u.exec(body);
  if (explicit) body = body.slice(explicit[0].length);
  const round = /(?:轮次|轮|cycle)\s*(\d{1,2})|(\d{1,2})(?:轮|T)/giu;
  const enemy = /([135])\s*(?:怪|目标|敌)/gu;
  const cycles = round.exec(body);
  const enemies = Number(enemy.exec(body)?.[1] ?? 3);
  const roles = body.replaceAll(round, " ").replaceAll(enemy, " ").split(/[\s,，、。|｜]+/u).filter(Boolean);
  return { profileId, detail: !!prefix[1], cycle: Math.min(20, Math.max(1, Number(cycles?.[1] ?? cycles?.[2] ?? 5))),
    enemies, roles, uid: explicit?.[1] ?? "" };
}

export type TeamDamageCommand = NonNullable<ReturnType<typeof parseStarRailTeamDamage>>;
type Json = Record<string, unknown>;
const aliases = new Map<string, string[]>([
  ["飞托阮同", ["飞霄", "托帕", "阮梅", "同谐主"]],
  ["飞托阮主", ["飞霄", "托帕", "阮梅", "同谐主"]],
  ["飞霄追击", ["飞霄", "托帕", "阮梅", "同谐主"]],
  ["追击队", ["飞霄", "托帕", "阮梅", "同谐主"]],
  ["黄泉队", ["黄泉", "椒丘", "砂金", "佩拉"]],
  ["黄椒砂佩", ["黄泉", "椒丘", "砂金", "佩拉"]],
  ["黑塔队", ["大黑塔", "翡翠", "阮梅", "藿藿"]],
]);
const roleAliases: Record<string, string[]> = {
  "开拓者·同谐": ["同谐主", "同协主", "和谐主", "开拓者同谐", "同谐开拓者"],
  "开拓者·记忆": ["记忆主", "开拓者记忆", "记忆开拓者"],
  "开拓者·毁灭": ["毁灭主", "物理主", "开拓者毁灭"],
  "开拓者·存护": ["存护主", "火主", "开拓者存护"],
  "开拓者·虚无": ["虚无主", "开拓者虚无"],
  "开拓者·巡猎": ["巡猎主", "开拓者巡猎"],
  "阮•梅": ["阮梅", "阮·梅"],
  "托帕&账账": ["托帕", "账账", "托帕账账", "托帕帐帐"],
  "银狼LV.999": ["银狼lv999", "银狼lv.999", "银狼LV999", "狼尊"],
  "千冶•刃": ["千冶刃", "千冶·刃"],
};
const roleKey = (input: string) => input.normalize("NFKC").toLowerCase().replace(/[\s·•・.。&_\-—/\\|:,、()[\]【】「」『』]/gu, "");

export interface TeamRole extends Json {
  item_id: string | number;
  nick_name?: string;
  name?: string;
  element?: string;
  dps_template?: Json;
}

export function teamRoleName(role: TeamRole) {
  return text(role.nick_name) || text(role.name) || String(role.item_id);
}

export class TeamDamageError extends Error {}

export function resolveTeamDamageRoles(tokens: readonly string[], catalog: readonly TeamRole[]) {
  const entries = new Map<string, TeamRole>();
  for (const role of [...catalog].sort((a, b) => Number(b.item_id) - Number(a.item_id))) {
    const name = teamRoleName(role);
    const enhanced = canonicalStarRailPanelCharacter(String(role.item_id), true) !== String(role.item_id);
    const aliases = [name, text(role.name), String(role.item_id), ...(Object.hasOwn(roleAliases, name) ? roleAliases[name]! : [])];
    if (enhanced) aliases.push(`${name}Pro`, `加强${name}`, `${name}加强`, `加强版${name}`);
    if (/[&＆]/u.test(name)) aliases.push(name.split(/[&＆]/u)[0]!, name.replace(/[&＆]/u, "和"), name.replace(/[&＆]/u, "与"));
    const trailblazer = name.match(/^开拓者[·•.・]?(.*)$/u)?.[1];
    if (trailblazer) aliases.push(`${trailblazer}主`, `${trailblazer}开拓者`);
    for (const term of aliases.map(roleKey)) if (term && !entries.has(term)) entries.set(term, role);
  }
  const terms = [...entries.keys()].sort((a, b) => b.length - a.length);
  const expanded = tokens.length === 1 ? aliases.get(roleKey(tokens[0]!)) ?? tokens : tokens;
  const selected: TeamRole[] = [];
  for (const token of expanded) {
    if (selected.length === 4) break;
    let remaining = roleKey(token);
    const segmented: TeamRole[] = [];
    while (remaining) {
      const term = terms.find(candidate => remaining.startsWith(candidate));
      if (!term) throw new TeamDamageError(`无法识别星铁角色：${text(token, 30)}`);
      segmented.push(entries.get(term)!);
      remaining = remaining.slice(term.length);
    }
    selected.push(...segmented.slice(0, 4 - selected.length));
  }
  if (!selected.length) throw new TeamDamageError("请指定星铁队伍角色，例如 *队伍伤害飞托阮同。");
  const unsupported = selected.find(role => !object(role.dps_template));
  if (unsupported) throw new TeamDamageError(`${teamRoleName(unsupported)} 暂无队伍伤害模板。`);
  return selected;
}

const damageKeys: Record<string, readonly [string, string]> = {
  wuli: ["phy", "physicalAddHurt"], physical: ["phy", "physicalAddHurt"],
  huo: ["fire", "fireAddHurt"], fire: ["fire", "fireAddHurt"], bing: ["ice", "iceAddHurt"], ice: ["ice", "iceAddHurt"],
  lei: ["elec", "elecAddHurt"], elec: ["elec", "elecAddHurt"], thunder: ["elec", "elecAddHurt"],
  feng: ["wind", "windAddHurt"], wind: ["wind", "windAddHurt"],
  liangzi: ["quantum", "quantumAddHurt"], quantum: ["quantum", "quantumAddHurt"],
  xushu: ["imaginary", "imaginaryAddHurt"], imaginary: ["imaginary", "imaginaryAddHurt"],
};
const ratios = {
  cpct: "criticalChance", cdmg: "criticalDamage", recharge: "spRatio", heal: "healRatio",
  stance: "stanceBreakRatio", effPct: "statusProbability", effDef: "statusResistance",
} as const;
const primaries = { hp: "hp", atk: "attack", def: "defense", speed: "speed" } as const;

export function teamPanelInput(avatar: PanelAvatar, role: TeamRole, stats = avatar.stats) {
  const numbers = new Map(stats.map(row => [row.key, row]));
  const number = (value?: string) => value && /^[-+]?\d+(?:\.\d+)?%?$/u.test(value) ? Number.parseFloat(value) : undefined;
  const combatValues: Record<string, number> = {};
  for (const [stat, key] of Object.entries(primaries)) {
    const row = numbers.get(stat);
    const base = number(row?.base), final = number(row?.value);
    if (!base || !final) return;
    combatValues[`${key}Base`] = base;
    combatValues[`${key}Final`] = final;
  }
  function ratio(key: string) {
    const value = numbers.get(key)?.value;
    const parsed = number(value) ?? 0;
    return value?.endsWith("%") || Math.abs(parsed) > 1 ? parsed / 100 : parsed;
  }
  for (const [stat, key] of Object.entries(ratios)) combatValues[key] = ratio(stat);
  const damage = role.element && damageKeys[role.element];
  if (damage) combatValues[damage[1]] = ratio(damage[0]);

  const cone = avatar.cone;
  if (cone && (!id(cone.id) || !cone.level || !cone.rank)) return;
  return { rank: avatar.rank ?? 0, level: avatar.level ?? 80,
    weapon: cone ? { id: Number(cone.id), level: cone.level, rankLevel: cone.rank } : null, combatValues };
}
