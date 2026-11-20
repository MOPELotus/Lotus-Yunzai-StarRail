// ProfileChange.js supplies these short IDs, resolved by Avatar.setTrees in the fixed MIT source.
import { object, type PanelAvatar } from "./panel-model.ts";

const abilityIds = ["101", "102", "103"];
const attributeIds = Array.from({ length: 10 }, (_, i) => String(201 + i));
const fullTraceIds = [...abilityIds, ...attributeIds, "301", "302"];

export function changePanelFullTraces(
  target: PanelAvatar, metadata: unknown,
): { avatar: PanelAvatar; label: string } | { error: string } {
  const tree = object(metadata);
  const traits = new Map<string, string>();
  let prefix = "";
  for (const key of Object.keys(tree ?? {})) {
    const match = /^1?(\d{4})(\d{3})$/u.exec(key);
    if (!match) continue;
    prefix ||= match[1]!;
    traits.set(match[2]!, key);
  }
  if (!prefix || attributeIds.some(id => !traits.has(id))) {
    return { error: `「${target.name}」满行迹试算缺少角色行迹资料。` };
  }
  for (const id of abilityIds) traits.set(id, prefix + id);
  const existing = new Map(target.traces.map(trace => [trace.id, trace]));
  const traces = fullTraceIds.map(short => {
    const id = traits.get(short) ?? short;
    return { name: "", icon: "", ...existing.get(id), id, active: true };
  });
  return { avatar: { ...target, traces, stats: [] }, label: "临时行迹 · 满行迹" };
}
