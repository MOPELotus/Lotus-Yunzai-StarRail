"""One-shot JSON worker for the vendored HSR_Nous combat simulator."""
from dataclasses import replace
import json
from pathlib import Path
import re
import sys

if sys.version_info < (3, 10):
    print('{"error":"python-version"}')
    sys.exit(0)

ROOT = Path(__file__).resolve().parent
VENDOR = ROOT / "vendor"
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(VENDOR / "src"))

import yaml

from hsr_nous.sim import CombatEngine, MODE_EXPECTED
from hsr_nous.sim import engine as engine_module
from hsr_nous.sim.compile import compile_encounter
from hsr_nous.sim.compile.build_compiler import BuildCompiler
from hsr_nous.sim.pipeline import SettlementPipeline
from hsr_nous.sim.state import ActorState, Modifier
from hsr_nous.sim_schema.actor import PATH_ALIASES

from timeline import capture, explain_approximations, localized_label, public_timeline

LIBRARY = (VENDOR / "data" / "library",)
DEFAULTS = json.loads((ROOT / "defaults.json").read_text(encoding="utf-8"))
SEED = 20260628
engine_module.MAX_TURNS_SAFETY = 2500
STATS = {"hp":"hp","atk":"atk","def":"def_","spd":"spd","critRate":"crit_rate","critDmg":"crit_dmg",
         "energyRegen":"energy_regen","breakEffect":"break_effect","outgoingHeal":"heal_bonus",
         "effectHitRate":"effect_hit","effectRes":"effect_res","elation":"elation"}
AFFIX = {**STATS,"hpPct":"hp_pct","atkPct":"atk_pct","defPct":"def_pct","speedPct":"spd_pct"}
SKILLS = {"basic":"basic","skill":"skill","ult":"ultimate","talent":"talent",
          "elation":"elation_skill","memo":"memosprite_skill","memoTalent":"memosprite_talent"}
SLOTS = ("head", "hands", "body", "feet", "sphere", "rope")


class Unsupported(Exception):
    def __init__(self, kind, value):
        self.kind = kind
        self.value = value


def load(kind, ident, version="enhanced"):
    try:
        return BuildCompiler.load_template(kind, ident, roots=LIBRARY, legacy=version == "legacy")
    except FileNotFoundError:
        raise Unsupported(kind, ident) from None


def affix(key):
    if key.startswith("dmgBonus_"):
        return key.removeprefix("dmgBonus_").lower() + "_dmg"
    return AFFIX.get(key)


def relics_for(panel, notices):
    result = {}
    for piece in panel["relics"]:
        if not 1 <= piece["slot"] <= 6:
            continue
        set_id = piece["set"]
        try:
            load("relics", set_id)
        except Unsupported:
            notices.append(f"遗器套装 {set_id} 尚无机制模板，保留该部件词条")
            set_id = None
        relic = {"set_id": set_id}
        main = piece.get("main")
        if main and affix(main["key"]):
            relic["main"] = affix(main["key"])
            relic["main_value"] = main["value"]
        subs = {affix(k): v for k, v in piece["subs"].items() if affix(k)}
        relic["subs"] = {k: 1 for k in subs}
        relic["sub_values"] = subs
        result[SLOTS[piece["slot"] - 1]] = relic
    return result


def translate_skills(template, panel, notices):
    defaults = template.get("skill_levels", {})
    level_steps = template.get("eidolons", {})
    bonuses = {}
    for rank in range(1, panel["rank"] + 1):
        for skill, added in (level_steps.get(f"E{rank}", {}).get("skill_level_overrides") or {}).items():
            bonuses[skill] = bonuses.get(skill, 0) + added
    chosen = {}
    for key, stored in panel["skills"].items():
        skill = SKILLS.get(key)
        if not skill:
            continue
        value = stored["level"]
        if stored["effective"]:
            value -= bonuses.get(skill, 0)
        if value < 1:
            notices.append("有技能等级与已解锁星魂不一致，使用模板等级")
            continue
        chosen[skill] = value
    return {**defaults, **chosen}


def default_loadout(ident, template):
    base = DEFAULTS["paths"].get(template.get("path"))
    if not base:
        return {}
    preset = {**base, **DEFAULTS["characters"].get(ident, {})}
    elem = template.get("element")
    orb = preset["orb"]
    orb = f"{elem}_dmg" if orb == "element" and elem else ("hp_pct" if orb == "element" else orb)
    mains = ("hp", "atk", preset["body"], "spd", orb, preset["rope"])
    relics = {slot: {"set_id":preset["sets"][int(index >= 4)], "main":mains[index]}
              for index, slot in enumerate(SLOTS)}
    return {"light_cone_template":preset["cone"], "light_cone":{"superimposition":1}, "relics":relics}


def canonical_path(value):
    lowered = str(value or "").lower()
    return PATH_ALIASES.get(lowered, lowered)


def make_member(request, notices):
    ident = request["id"]
    version = request.get("version", "enhanced")
    template = load("characters", ident, version)
    panel = request.get("panel")
    member = {"character_template": ident, "version": version, "level": 80, "eidolon": 0}
    active_cone = None
    if panel is None:
        member.update(default_loadout(ident, template))
    else:
        member["level"] = panel["level"]
        member["eidolon"] = panel["rank"]
        member["skill_levels"] = translate_skills(template, panel, notices)
        member["relics"] = relics_for(panel, notices)
        notices.extend(panel.get("warnings", ()))
        weapon = panel["cone"]
        if weapon:
            try:
                active_cone = load("light_cones", weapon["id"])
            except Unsupported:
                notices.append(f"光锥 {weapon['id']} 尚无机制模板，只使用面板可核对的白值")
                if not all(key in panel["base"] for key in ("hp", "atk", "def")):
                    raise
            if active_cone and canonical_path(active_cone.get("path")) == canonical_path(template.get("path")):
                member["light_cone_template"] = weapon["id"]
                base = weapon.get("base") or {}
                member["light_cone"] = {"superimposition": weapon["rank"]}
                if all(isinstance(base.get(key), (int, float)) for key in ("hp", "atk", "def")):
                    member["light_cone"]["base_stats"] = {key:base[key] for key in ("hp", "atk", "def")}
            if weapon.get("level", 80) < 80 and not weapon.get("base") and not all(key in panel["base"] for key in ("hp","atk","def")):
                notices.append("缺少低等级光锥白值，沿用引擎模板的基础属性")
    return member, active_cone


def adjust_panel(actor, modifiers, panel, cone, active_cone, notices):
    if panel is None:
        return actor, modifiers
    white = {STATS[key]: value for key, value in panel["base"].items() if key in ("hp", "atk", "def", "spd")}
    if cone and "light_cone_template" not in cone:
        # Off-path light cones contribute their base stats without path-locked effects.
        base = panel["cone"].get("base") or active_cone.get("base_stats", {})
        for key, value in base.items():
            field = STATS.get(key, key)
            if field in {"hp", "atk", "def_"} and field not in white:
                white[field] = getattr(actor.stats, field) + value
    actor = replace(actor, stats=replace(actor.stats, **white))
    boost = panel.get("conePanelEffects")
    if boost is None and panel.get("cone"):
        # We cannot assume that a battle-start effect is also present in the saved out-of-battle panel.
        notices.append("未核对光锥常驻面板词条，采用实际装备计算")
        return actor, modifiers
    if len(white) < 4 and panel["level"] < 80:
        notices.append("未核对低等级白值，使用引擎的属性模板")
    initial = ActorState(actor=actor, current_hp=actor.stats.hp, modifiers={m.modifier_id:m for m in modifiers})
    baseline = SettlementPipeline(mode=MODE_EXPECTED).effective_stats(initial, _skip_cond=True, _skip_aura=True)
    residual = {}
    for key, value in panel["stats"].items():
        if key.startswith("dmgBonus_"):
            elem = key.removeprefix("dmgBonus_").lower()
            base_damage = baseline["dmg_bonus"].get(elem, 0) + baseline["dmg_bonus"].get("all", 0)
            residual["dmg_" + elem] = value - base_damage - (boost or {}).get(key, 0)
            continue
        field = STATS.get(key)
        if field not in baseline:
            continue
        target = value + (1 if key == "energyRegen" else 0)
        known = (boost or {}).get(key, 0)
        if key in ("hp", "atk", "def", "spd"):
            pct_key = "speedPct" if key == "spd" else key + "Pct"
            known += (boost or {}).get(pct_key, 0) * getattr(actor.stats, field)
        residual[field] = target - baseline[field] - known
    return actor, [*modifiers, Modifier("LOTUS_PANEL_RESIDUAL", "本人面板校准", "buff", dispellable=False, stat_effects=residual)]


def stage_for(count, cycles):
    return {"stage_id": "lotus_team_simulation", "mode": "forgotten_hall",
            "enemies": [{"enemy_template": "sandbag", "actor_id": f"enemy_{index+1}",
                         "name": f"假人 {index+1}"} for index in range(count)],
            "termination": {"mode": "fixed_av", "max_action_value": 150 + 100 * (cycles - 1)}}


def simulate(request):
    rows = request["roles"]
    cycles = request["cycle"]
    enemies = request["enemies"]
    if not 1 <= len(rows) <= 4 or not 1 <= cycles <= 20 or enemies not in (1, 3, 5):
        raise ValueError("invalid team request")
    if any(not re.fullmatch(r"[1-9][0-9]{3}", row["id"]) for row in rows):
        raise ValueError("invalid role")
    notices = []
    models = [make_member(row, notices) for row in rows]
    build = {"team": [model[0] for model in models], "policy": {"action_rules": [
        {"condition":"skill_points > 0", "action":"skill","priority":50},
        {"condition":"true","action":"basic","priority":0},
    ]}}
    compiled = compile_encounter(build, stage_for(enemies, cycles), template_roots=LIBRARY)
    modifiers = dict(compiled.modifiers_by_actor)
    team = []
    for actor, row, (member, active_cone) in zip(compiled.build_team, rows, models):
        panel = row.get("panel")
        adjusted, mods = adjust_panel(actor, list(modifiers.get(actor.actor_id, ())), panel,
                                      member if active_cone else None, active_cone, notices)
        team.append(adjusted)
        modifiers[actor.actor_id] = mods
    compiled = replace(compiled, build_team=tuple(team), modifiers_by_actor=modifiers)
    engine = CombatEngine.from_compiled(compiled, mode=MODE_EXPECTED, seed=SEED)
    events = capture(engine)
    result = engine.run()
    if result.truncated:
        return {"error":"limit"}
    contributors = {a.actor_id: a.name for a in team}
    damages = {aid: 0.0 for aid in contributors}
    for aid, damage in result.damage_by_actor.items():
        actor = result.actors.get(aid)
        definition = compiled.summon_defs.get(aid)
        owner = (actor.actor.summoner_id if actor else None) or (definition.owner_id if definition else None)
        target = owner if owner in contributors else aid
        if target in damages:
            damages[target] += damage
        elif damage > 0 and actor and actor.actor.actor_type != "monster":
            contributors[aid] = localized_label(actor.actor.name, "助战单位")
            damages[aid] = damage
    actions, turns = public_timeline(events, engine, compiled, contributors)
    damage = [{"name":contributors[aid],"value":value} for aid,value in sorted(damages.items(),key=lambda item:-item[1])]
    notes = explain_approximations(compiled.caveats, contributors)
    # The engine's aggregate includes damage dealt by enemies. This report is for the allied side.
    total = sum(damages.values())
    return {"total":total,"dps":total/cycles,"damage":damage,"actions":actions,
            "turns":turns,"warnings":list(dict.fromkeys(notices + notes))[:8]}


if __name__ == "__main__":
    try:
        stdin = sys.stdin.buffer.read(512 * 1024 + 1)
        if len(stdin) > 512 * 1024:
            sys.exit("Invalid team request")
        request = json.loads(stdin)
        response = simulate(request)
    except Unsupported as error:
        response = {"error":error.kind,"id":error.value}
    except (OSError, yaml.YAMLError):
        response = {"error":"data"}
    except (ValueError, KeyError, TypeError):
        response = {"error":"invalid"}
    print(json.dumps(response, ensure_ascii=True, allow_nan=False))
