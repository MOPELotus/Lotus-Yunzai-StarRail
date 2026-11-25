import { createTranslator as createTextTranslator } from "../../packages/i18n/index.ts";
import messageCatalog from "./i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
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

const statNames = [$t("team-damage-command.text_d4b0baf955"), $t("team-damage-command.text_15bccc3951"), $t("team-damage-command.text_b84ee11f4f"), $t("team-damage-command.text_0e14d148b4"), $t("team-damage-command.text_092a6b7674"), $t("team-damage-command.text_84c7536950")];
const number = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 });

function teamDamageReport(uid: string, command: TeamDamageCommand, team: readonly TeamMember[], result: TeamBattleResult) {
  const summary = [
    { label: $t("team-damage-command.text_a3c16bf938"), value: number.format(result.total) }, { label: "DPS", value: number.format(result.dps) },
    { label: $t("team-damage-command.text_4890584bb5"), value: String(command.cycle) }, { label: $t("team-damage-command.text_57060c88a3"), value: $t("team-damage-command.text_6100756358", { "enemies": command.enemies }) },
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
      return $t("team-damage-command.text_cc3df32e08");
    }
    const profileId = command.profileId;
    if (profileId < 1 || profileId > MAX_PROFILE_ID) return $t("team-damage-command.text_68901e8078", { "MAX_PROFILE_ID": MAX_PROFILE_ID });
    if (!command.roles.length) return $t("team-damage-command.text_0a6ba292fe");
    if (running >= 2) return $t("team-damage-command.text_c72814bac2");
    running++;
    const changed = $t("team-damage-command.text_a6a8149326");
    try {
      const qq = String(user);
      const account = await profiles.requestSelectedContext(qq, profileId, "sr");
      const { uid, region, gameBiz } = account.role;
      if (command.uid && command.uid !== uid) return $t("team-damage-command.text_370919db22");
      const verify = async () => {
        signal.throwIfAborted();
        const current = await profiles.requestSelectedContext(qq, profileId, "sr").catch(() => undefined);
        if (current?.revision !== account.revision || current.role.uid !== uid ||
            current.role.region !== region || current.role.gameBiz !== gameBiz) throw new ProfileError("changed", changed);
        signal.throwIfAborted();
      };
      const owner = starRailTraceOwner(account, account.role);
      const [panelSource, theme] = await Promise.all([
        readPanel(qq, uid, owner).then(snapshot => ({ snapshot, unreadable: false }), () => ({ snapshot: undefined, unreadable: true })),
        readTheme(),
      ]);
      const { snapshot, unreadable } = panelSource;
      const defaultSource = unreadable ? $t("team-damage-command.text_084e056f0b") : $t("team-damage-command.text_644ac819c8");
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
          weapon: cone?.id ? (panel ? text(avatar?.cone?.name) : "") || starRailTeamCones[cone.id] || $t("team-damage-command.text_5ac28ebeb7") : $t("team-damage-command.text_2e03e7c94f"),
          weaponLevel: cone?.id ? cone.level ?? 0 : 0, weaponRank: cone?.id ? cone.rank : 0,
          source: panel ? $t("team-damage-command.text_afc2e4bf23") : avatar ? $t("team-damage-command.text_2f4bc2cc7b") : defaultSource,
          face: await readPanelAvatarFace(theme, avatar?.id ?? key),
          stats: ["cpct", "cdmg", "atk", "speed", "stance", "effPct"].map(key =>
            panel ? stats.find(row => row.key === key)?.value ?? $t("team-damage-command.text_7450cc5b16") : $t("team-damage-command.text_7450cc5b16")),
        });
      }
      await verify();
      const result = await calculateTeamDamage(members, command.cycle, command.enemies, signal);
      await verify();
      const report = teamDamageReport(uid, command, team, result);
      const file = await renderStarRailTeamDamage(report, theme.root, signal, verify, context.inlineImageByteLimit).catch(() => undefined);
      await verify();
      if (file) return [{ type: "image" as const, file }];
      return [
        $t("team-damage-command.text_576f92da9a", { "uid": uid, "profileId": profileId }),
        report.summary.map(row => `${row.label} ${row.value}`).join(" · "),
        ...team.map(member => `${member.name} · ${member.source}`),
        ...report.contribution.map(row => `${row.name} · ${row.value}（${row.share}）`),
        ...(report.timeline ? [$t("team-damage-command.text_fbcb52baf5", { "timeline": report.timeline })] : []),
        ...report.turns.flatMap(turn => [turn.title, ...turn.lines.slice(0, 2)]),
        ...report.warnings.map(note => $t("team-damage-command.text_dc2d9ae906", { "note": note })),
        $t("team-damage-command.text_84523086f8", { "engine": report.engine }),
      ].join("\n");
    } catch (error) {
      if (signal.aborted) return [];
      if (error instanceof ProfileError) {
        if (error.code === "missing" || error.code === "login-required") return $t("team-damage-command.text_76720712c8", { "profileId": profileId });
        if (error.code === "role-missing") return $t("team-damage-command.text_c0d14d54a7", { "profileId": profileId });
        if (error.code === "changed") return changed;
      }
      if (error instanceof TeamDamageError) return error.message;
      return $t("team-damage-command.text_a0f7cf98b3");
    } finally {
      running--;
    }
  };
}
