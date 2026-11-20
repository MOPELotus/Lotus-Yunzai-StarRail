// Same-archive equipment replacement follows apps/profile/ProfileChange.js in the MIT source.
import { MAX_PROFILE_ID } from "@lotus-yunzai/account";
import type { PanelAvatar } from "./panel-model.ts";
import { readRelicSetNames } from "./panel-relic-set.ts";

const allRelics = "relics" as const;
type EquipmentSlot = number | typeof allRelics;
const parts: Readonly<Record<string, EquipmentSlot>> = {
  光锥: 0, 武器: 0,
  头: 1, 帽子: 1, 头部: 1,
  手: 2, 手套: 2, 手部: 2,
  衣: 3, 衣服: 3, 甲: 3, 躯干: 3,
  鞋: 4, 靴: 4, 鞋子: 4, 靴子: 4, 脚: 4, 脚部: 4,
  球: 5, 位面球: 5,
  绳: 6, 线: 6, 链接绳: 6, 连接绳: 6,
  遗器: allRelics, 圣遗物: allRelics,
};
const partNames = ["光锥", "头部", "手部", "躯干", "脚部", "位面球", "连接绳"];
const role = String.raw`[\p{L}\p{N}·・•_.&★ -]{1,28}?`;
const partPattern = Object.keys(parts).sort((a, b) => b.length - a.length).join("|");
const changePattern = new RegExp(
  String.raw`^(?:#星铁|\*)(${role})(?:(伤害)([1-9]\d{0,5})?|详细|详情|面板|面版)?\s*换\s*([^\p{Cc}\p{Cf}]{1,100}?)(?:\s+([1-9]\d{0,2}))?$`,
  "u",
);
const donorPattern = new RegExp(String.raw`^(${role})\s*((?:${partPattern})(?:\s*\+\s*(?:${partPattern})){0,6})$`, "u");
const superimpositionPattern = /^(?:([1-5一二三四五满])(?:叠影?|精炼?)|(?:叠影?|精炼?)([1-5一二三四五]))\s*([^+]{1,64})$/u;
const invalidTierPrefix = /^(?:[0-9零一二三四五六七八九十满])?(?:叠影?|精炼?)/u;
const tiers = "一二三四五";
const eidolonPattern = /^([0-6零一二三四五六满])(?:命|魂|星魂)$/u;
const eidolonDigits = "零一二三四五六";

type DonorEquipment = { donor: string; slots: EquipmentSlot[]; eidolon?: number };
type Superimposition = { superimposition: number; coneName: string; eidolon?: number };

type EquipmentCommand = {
  type: "damage" | "detail";
  name: string;
  profileId: number;
  scenario: number | undefined;
  equipment: DonorEquipment | Superimposition | { eidolon: number } | { relicSets: string[] } | { fullTraces: true; eidolon?: number };
};

export function parseEquipmentChange(message: string): EquipmentCommand | undefined {
  const match = changePattern.exec(message);
  if (!match) return;
  const [, target, mode, scenario, requested, archive] = match;
  const name = target?.trim();
  const request = requested?.trim();
  const profileId = Number(archive ?? 1);
  if (!name || !request || profileId > MAX_PROFILE_ID || name.includes("换") || /\d{9,}/u.test(name + request)) return;

  const command = { type: mode === "伤害" ? "damage" as const : "detail" as const, name, profileId,
    scenario: scenario === undefined ? undefined : Number(scenario) };
  const segments = request.split("换").map(segment => segment.trim());
  if (segments.length === 2) {
    const first = segments[0]!, second = segments[1]!;
    const firstEidolon = readEidolon(first);
    const eidolon = firstEidolon ?? readEidolon(second);
    if (eidolon === undefined) return;
    const other = firstEidolon !== undefined ? second : first;
    if (other === "满行迹") return { ...command, equipment: { fullTraces: true, eidolon } };
    const equipment = readEquipment(other);
    if (!equipment) return;
    return { ...command, equipment: { ...equipment, eidolon } };
  }
  if (segments.length !== 1) return;

  const eidolon = readEidolon(request);
  if (eidolon !== undefined) return { ...command, equipment: { eidolon } };
  if (request === "满行迹") return { ...command, equipment: { fullTraces: true } };
  if (request.startsWith("满行迹") || request.endsWith("满行迹")) {
    const rank = readEidolon(request.replace("满行迹", "").trim());
    if (rank !== undefined) return { ...command, equipment: { fullTraces: true, eidolon: rank } };
  }
  const relicSets = readRelicSetNames(request);
  if (relicSets) return { ...command, equipment: { relicSets } };
  const equipment = readEquipment(request);
  if (equipment) return { ...command, equipment };
}

function readEquipment(request: string): DonorEquipment | Superimposition | undefined {
  const rankChange = superimpositionPattern.exec(request);
  if (!rankChange) return readDonorEquipment(request);
  const rankLabel = rankChange[1] ?? rankChange[2]!;
  const coneName = rankChange[3]!.trim();
  const rank = rankLabel === "满" ? 5 : tiers.includes(rankLabel) ? tiers.indexOf(rankLabel) + 1 : Number(rankLabel);
  return { superimposition: rank, coneName };
}

function readEidolon(request: string) {
  const label = eidolonPattern.exec(request)?.[1];
  if (label === undefined) return;
  return label === "满" ? 6 : eidolonDigits.includes(label) ? eidolonDigits.indexOf(label) : Number(label);
}

function readDonorEquipment(request: string): DonorEquipment | undefined {
  if (invalidTierPrefix.test(request)) return;
  const donorChange = donorPattern.exec(request);
  const donor = donorChange?.[1]?.trim();
  const requestedParts = donorChange?.[2];
  if (!donor || !requestedParts) return;
  const slots = requestedParts.split("+").map(key => parts[key.trim()]!);
  return { donor, slots };
}

export function changePanelSuperimposition(target: PanelAvatar, rank: number, requestedName: string, canonicalName: string) {
  const cone = target.cone;
  if (!cone) return { error: `「${target.name}」的星铁面板没有光锥记录。` };
  const coneName = canonicalName || cone.name;
  if (requestedName !== "武器" && requestedName !== "光锥" && requestedName !== coneName) {
    return { error: `「${target.name}」当前装备「${coneName || cone.id}」，请指定当前光锥。` };
  }
  const avatar = { ...target, cone: { ...cone, rank, description: "" }, stats: [] };
  return { avatar, label: `临时换装 · ${coneName || cone.id} · 叠影${rank}阶` };
}

export function replacePanelEquipment(target: PanelAvatar, donor: PanelAvatar, slots: readonly EquipmentSlot[]) {
  if (slots.length !== new Set(slots).size) return { error: "同一个装备部位只能指定一次。" };
  if (slots.includes(allRelics) && !donor.relics.length) return { error: `「${donor.name}」的星铁面板没有遗器记录。` };
  const originalRelics = slots.includes(allRelics) ? donor.relics : target.relics;
  const relics = originalRelics.filter(part => !slots.includes(part.slot));
  let cone = target.cone;
  for (const slot of slots) {
    if (slot === allRelics) continue;
    if (slot === 0) {
      if (!donor.cone) return { error: `「${donor.name}」的星铁面板没有光锥记录。` };
      cone = { ...donor.cone, description: "" };
      continue;
    }
    const equipped = donor.relics.filter(part => part.slot === slot);
    if (equipped.length !== 1) return { error: `「${donor.name}」的星铁面板缺少可用的${partNames[slot]}记录。` };
    relics.push(equipped[0]!);
  }
  const avatar = { ...target, cone, relics: relics.sort((a, b) => a.slot - b.slot), stats: [] };
  const label = `临时换装 · ${donor.name} · ${slots.map(slot => slot === allRelics ? "全部遗器" : partNames[slot]).join("、")}`;
  return { avatar, label };
}
