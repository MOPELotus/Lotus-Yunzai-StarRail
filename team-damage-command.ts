import { MAX_PROFILE_ID, ProfileError, type createProfileStore } from "@lotus-yunzai/account";
import { renderStarRailTeamDamage, type TeamMember } from "./team-damage-card.ts";
import { calculateEquipmentAttributeRows, leveledAttributes, readPanelStaticConeEffects } from "./panel-attributes.ts";
import { readPanelAvatarFace, readPanelDamageMetadata, readTheme } from "./panel-card.ts";
import type { createStarRailPersonalPanelReader } from "./panel.ts";
import { canonicalStarRailPanelCharacter, text } from "./panel-model.ts";
import { resolveTeamDamageRoles, teamRoleName, TeamDamageError, type TeamDamageCommand } from "./team-damage-model.ts";
import { calculateTeamDamage, starRailTeamCatalog, starRailTeamCones, starRailTeamDefaultCone, starRailTeamEngine, type TeamBattleResult,
  type TeamSimulationMember } from "./team-damage-runtime.ts";
import { projectTeamOwnedPanel } from "./team-owned-panel.ts";
import { starRailTraceOwner } from "./panel-trace-refresh.ts";

const statNames = ["暴击率", "暴击伤害", "攻击力", "速度", "击破", "效果命中"];
const number = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 });

function teamDamageReport(uid: string, command: TeamDamageCommand, team: readonly TeamMember[], result: TeamBattleResult) {
  const summary = [
    { label: "总伤害", value: number.format(result.total) }, { label: "DPS", value: number.format(result.dps) },
    { label: "轮次", value: String(command.cycle) }, { label: "目标", value: `${command.enemies} 怪` },
  ];
  const contribution = result.damage.map(row => ({ ...row, value: number.format(row.value),
    share: result.total > 0 ? `${(row.value / result.total * 100).toFixed(1)}%` : "0%" }));
  const timeline = result.actions.slice(0, 4).map(row => row.name).join(" → ");
  const turns = command.detail ? result.turns.slice(0, 8) : [];
  return { uid, profileId: command.profileId, summary, team, contribution, timeline, turns, statNames,
    engine: starRailTeamEngine, warnings: result.warnings.slice(0, command.detail ? 4 : 2) };
}

interface Context {
  readonly user_id?: number;
  readonly message_type?: string;
  readonly isDelegated?: boolean;
  readonly privateCredentialSignal?: AbortSignal;
  readonly calculationSignal?: AbortSignal;
  readonly inlineImageByteLimit?: number;
}

export function createStarRailTeamDamageQuery(profiles: ReturnType<typeof createProfileStore>,
  readPanel: ReturnType<typeof createStarRailPersonalPanelReader>, lifecycle: AbortSignal) {
  let running = 0;
  return async function query(context: Context,
    command: TeamDamageCommand) {
    const transport = context.calculationSignal ?? context.privateCredentialSignal;
    const signal = transport ? AbortSignal.any([lifecycle, transport]) : lifecycle;
    if (signal.aborted) return [];
    const user = context.user_id;
    if (context.isDelegated || !Number.isSafeInteger(user) || !user || user < 1 ||
        (context.message_type !== "private" && context.message_type !== "group")) {
      return "请从本人 QQ 会话查询星铁队伍伤害。";
    }
    const profileId = command.profileId;
    if (profileId < 1 || profileId > MAX_PROFILE_ID) return `档案编号须为 1–${MAX_PROFILE_ID}。`;
    if (!command.roles.length) return "请指定星铁队伍角色，例如 *队伍伤害飞托阮同。";
    if (running >= 2) return "星铁队伍伤害正在计算，请稍后重试。";
    running++;
    const changed = "计算期间星铁档案已变更，请重新查询。";
    try {
      const qq = String(user);
      const account = await profiles.requestSelectedContext(qq, profileId, "sr");
      const { uid, region, gameBiz } = account.role;
      if (command.uid && command.uid !== uid) return "此 UID 与所选档案当前绑定的星铁角色不一致。";
      const verify = async () => {
        signal.throwIfAborted();
        const current = await profiles.requestSelectedContext(qq, profileId, "sr").catch(() => undefined);
        if (current?.revision !== account.revision || current.role.uid !== uid ||
            current.role.region !== region || current.role.gameBiz !== gameBiz) throw new ProfileError("changed", changed);
        signal.throwIfAborted();
      };
      const owner = starRailTraceOwner(account, account.role);
      const [snapshot, theme] = await Promise.all([readPanel(qq, uid, owner), readTheme()]);
      const roles = resolveTeamDamageRoles(command.roles, starRailTeamCatalog, {
        customAliases: theme.customAliases, ownedIds: snapshot?.avatars.map(avatar => avatar.id),
      });
      const members: TeamSimulationMember[] = [];
      const team: TeamMember[] = [];
      for (const role of roles) {
        const key = String(role.item_id);
        const enhanced = canonicalStarRailPanelCharacter(key, true);
        const avatar = snapshot?.avatars.find(candidate => enhanced !== key && candidate.id === enhanced) ??
          (role.enhancementRequested ? undefined : snapshot?.avatars.find(candidate => candidate.id === key));
        const meta = avatar && await readPanelDamageMetadata(avatar, theme);
        let stats = avatar?.stats ?? [];
        if (avatar && meta && !stats.length) {
          const computed = calculateEquipmentAttributeRows(avatar, meta);
          if (computed) stats = computed.map(row => ({ key: row.key, base: String(row.base), value: `${row.value}${row.ratio ? "%" : ""}` }));
        }
        const staticCone = avatar ? (avatar.cone ? meta && readPanelStaticConeEffects(avatar, meta) : []) : undefined;
        const coneBase = meta && avatar?.cone ? leveledAttributes(meta.cone, avatar.cone.level, avatar.cone.promote, true) : undefined;
        const panel = avatar && projectTeamOwnedPanel(avatar, stats, staticCone, coneBase);
        const version = role.enhancementRequested ? "enhanced" : role.hasLegacy && enhanced !== key && avatar?.id === key ? "legacy" : undefined;
        members.push({ id: key, version, panel });
        const cone = panel ? panel.cone : { id: starRailTeamDefaultCone(key, role.path ?? ""), level: 80, rank: 1 };
        team.push({
          name: teamRoleName(role).replaceAll("{NICKNAME}", "开拓者"),
          level: panel?.level ?? 80, rank: panel?.rank ?? 0,
          weapon: cone?.id ? (panel ? text(avatar?.cone?.name) : "") || starRailTeamCones[cone.id] || "光锥资料未记录" : "未装备",
          weaponLevel: cone?.id ? cone.level ?? 0 : 0, weaponRank: cone?.id ? cone.rank : 0,
          source: panel ? "本人面板" : avatar ? "基准配装（本地数据不全）" : "基准配装",
          face: await readPanelAvatarFace(theme, avatar?.id ?? key),
          stats: ["cpct", "cdmg", "atk", "speed", "stance", "effPct"].map(key =>
            panel ? stats.find(row => row.key === key)?.value ?? "未记录" : "未记录"),
        });
      }
      await verify();
      const result = await calculateTeamDamage(members, command.cycle, command.enemies, signal);
      await verify();
      const report = teamDamageReport(uid, command, team, result);
      const files = await renderStarRailTeamDamage(report, theme.root, signal, verify, context.inlineImageByteLimit).catch(() => []);
      await verify();
      if (files.length) return files.map(file => ({ type: "image" as const, file }));
      return [
        `星铁队伍伤害 · UID ${uid} · 档案 ${profileId}`,
        report.summary.map(row => `${row.label} ${row.value}`).join(" · "),
        ...team.map(member => `${member.name} · ${member.source}`),
        ...report.contribution.map(row => `${row.name} · ${row.value}（${row.share}）`),
        ...(report.timeline ? [`起手顺序 ${report.timeline}`] : []),
        ...report.turns.flatMap(turn => [turn.title, ...turn.lines.slice(0, 2)]),
        ...report.warnings.map(note => `模拟说明 · ${note}`),
        `计算引擎 · ${report.engine}。固定假人和自动行动策略，数值仅供参考。`,
      ].join("\n");
    } catch (error) {
      if (signal.aborted) return [];
      if (error instanceof ProfileError) {
        if (error.code === "missing" || error.code === "login-required") return `请先登录档案 ${profileId}。`;
        if (error.code === "role-missing") return `档案 ${profileId} 没有已同步的星铁角色。`;
        if (error.code === "changed") return changed;
      }
      if (error instanceof TeamDamageError) return error.message;
      return "星铁队伍伤害计算失败，请稍后重试。";
    } finally {
      running--;
    }
  };
}
