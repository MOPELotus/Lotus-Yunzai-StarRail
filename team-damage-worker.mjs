// Runs as a one-shot Linux sandbox process. The old runtime is mounted from the user's verified installation.
import { readFileSync } from "node:fs";
import { StarRailDpsEngine } from "./legacy/services/starRailTeamDamage/engine.js";

const { dictionary, roles, panels, promotions, cycle, enemies } = JSON.parse(readFileSync(0, "utf8"));
const promotionEndpoint = "https://api.lingyuan.design/api/v1/guang/promotions";
let coneMissing = false;
globalThis.fetch = async () => { throw new Error("External requests are unavailable"); };
const engine = new StarRailDpsEngine({
  systemData: dictionary,
  async fetch(url, options) {
    if (url !== promotionEndpoint || options?.method !== "POST") throw new Error("Unsupported public data request");
    const body = JSON.parse(options.body);
    if (Object.keys(body).length !== 1 || !Array.isArray(body.item_ids) || body.item_ids.length !== 1) {
      throw new Error("Unsupported public data query");
    }
    const [id] = body.item_ids;
    if (!/^[1-9]\d{0,11}$/u.test(String(id)) || !Object.hasOwn(promotions, id)) {
      coneMissing = true;
      throw new Error("Missing local light-cone data");
    }
    return Response.json({ data: [{ item_id: id, values: promotions[id] }] });
  },
});

const clean = value => typeof value === "string" ? value.replaceAll("{NICKNAME}", "开拓者").replace(/<[^>]+>/gu, "").trim() : "";
const named = (value, id) => clean(value) || clean(roles.find(role => Number(role.item_id) === Number(id))?.nick_name) || "行动";
const finite = value => Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : 0;

function turnRows(logs) {
  const turns = [];
  for (const log of logs) {
    if (turns.length === 36) break;
    if (typeof log === "string") {
      const line = clean(log);
      if (line) turns.push({ title: "行动", lines: [line] });
      continue;
    }
    if (!log || finite(log.object_id) >= 9_000_000) continue;
    const name = named(log.name, log.object_id);
    const title = `${name}的回合`;
    const actionPoint = Math.ceil(finite(log.actionPoint ?? log.action_points ?? log.actionPoints));
    const lines = [];
    for (const skill of log.skills ?? []) {
      lines.push(clean(skill.desc));
      for (const damage of skill.damages ?? []) lines.push(clean(damage.desc));
    }
    for (const other of log.others ?? []) lines.push(clean(other?.desc ?? other?.text));
    const visible = lines.filter(Boolean);
    const desc = clean(log.desc);
    if (!visible.length && desc && desc !== title) visible.push(desc);
    if (visible.length) turns.push({ title, actionPoint, lines: visible.slice(0, 8) });
  }
  return turns;
}

try {
  await engine.ensureLoaded();
  const roleIds = roles.map(role => Number(role.item_id));
  const configs = new Set(engine.defaultModule("0909").map(config => Number(config.item_id)));
  const missing = roleIds.find(id => !configs.has(id));
  if (missing) {
    console.log(JSON.stringify({ error: "unsupported", roleId: missing }));
  } else {
    const result = await engine.calculate({ roleIds, roles, panelDataById: panels, battleCycle: cycle, enemyTotal: enemies });
    console.log(JSON.stringify({
      total: result.totalDamage,
      dps: result.teamDps,
      damage: result.groupRoleDamages.slice(0, 16).map(row => ({ name: named(row.name, row.object_id), value: finite(row.value) }))
        .sort((a, b) => b.value - a.value),
      actions: result.actionQueue.slice(0, 12).map(row => ({ name: named(row.name, row.objectId), value: Math.round(finite(row.actionPoints) * 10) / 10 })),
      turns: turnRows(result.battleLogs),
    }));
  }
} catch {
  console.log(JSON.stringify({ error: coneMissing ? "missing-cone" : "engine" }));
} finally {
  engine.clearTimers();
}
