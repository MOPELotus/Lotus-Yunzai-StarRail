// Same-archive equipment replacement follows apps/profile/ProfileChange.js in the MIT source.
import { MAX_PROFILE_ID } from "@lotus-yunzai/account";
import type { PanelAvatar } from "./panel-model.ts";

const allRelics = "relics" as const;
const parts: Readonly<Record<string, (number | typeof allRelics)>> = {
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
const pattern = new RegExp(
  String.raw`^(?:#星铁|\*)(${role})(?:(伤害)([1-9]\d{0,5})?|详细|详情|面板|面版)?\s*换\s*(${role})\s*((?:${partPattern})(?:\s*\+\s*(?:${partPattern})){0,6})(?:\s+([1-9]\d{0,2}))?$`,
  "u",
);

export function parseEquipmentChange(message: string) {
  const match = pattern.exec(message);
  if (!match) return;
  const [, target, mode, scenario, requestedDonor, requestedParts, archive] = match;
  const name = target?.trim(), donor = requestedDonor?.trim();
  const profileId = Number(archive ?? 1);
  if (!name || !donor || !requestedParts || profileId > MAX_PROFILE_ID || /\d{9,}|换/u.test(name + donor)) return;
  const slots = requestedParts.split("+").map(key => parts[key.trim()]!);
  return {
    type: mode === "伤害" ? "damage" as const : "detail" as const, name, profileId,
    scenario: scenario === undefined ? undefined : Number(scenario),
    equipment: { donor, slots },
  };
}

export function replacePanelEquipment(target: PanelAvatar, donor: PanelAvatar, slots: readonly (number | typeof allRelics)[]) {
  if (slots.length !== new Set(slots).size) return { error: "同一个装备部位只能指定一次。" };
  if (slots.includes(allRelics) && !donor.relics.length) return { error: `「${donor.name}」的星铁面板没有遗器记录。` };
  const originalRelics = slots.includes(allRelics) ? donor.relics : target.relics;
  const relics = originalRelics.filter(part => !slots.includes(part.slot));
  let cone = target.cone;
  for (const slot of slots) {
    if (slot === allRelics) continue;
    if (slot === 0) {
      if (!donor.cone) return { error: `「${donor.name}」的星铁面板没有光锥记录。` };
      cone = donor.cone;
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
