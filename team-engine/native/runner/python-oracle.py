"""Execute deterministic runner inputs through the pinned vendored engine."""
import json
from pathlib import Path
import sys
from types import SimpleNamespace

engine_dir = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(engine_dir / "vendor" / "src"), str(engine_dir / "vendor" / "lib"), str(engine_dir)]

from hsr_nous.sim.engine import CombatEngine
from hsr_nous.sim.policy_api import ScriptedPolicy
from hsr_nous.sim_schema.action import Action
from hsr_nous.sim_schema.actor import Actor, StatBlock
from hsr_nous.sim_schema.encounter import Cycle, Encounter, TerminationConfig
from timeline import capture, public_timeline

class TestPolicy(ScriptedPolicy):
    def select_action(self, actor_state, legal, engine):
        want = "skill" if engine.state.skill_points > 0 else "basic"
        return next((a for a in legal if a.action_type == want), legal[0])

    def select_target(self, actor_state, action_type, candidates, engine=None):
        return candidates[0] if candidates else None

def instantiate(raw):
    return Actor(raw["id"], raw["name"], raw["kind"], raw["level"], StatBlock(
        **raw["stats"], weakness=raw["weakness"], toughness_bars=raw["toughnessBars"],
    ), skill_levels=raw["skillLevels"], summoner_id=raw.get("ownerId", ""))

def action(raw):
    return Action(raw["id"], raw["name"], raw["kind"], raw["target"],
                  raw.get("damageType"), raw["scaling"],
                  scaling_blast=raw["scalingBlast"] if raw["scalingBlast"] else None,
                  **raw["raw"])

def run(fixture):
    regular = fixture["team"] + fixture["enemies"]
    summons = fixture.get("summons", [])
    all_units = regular + [unit for wave in fixture["waves"] for unit in wave] + summons
    python_actors = {actor["id"]: instantiate(actor) for actor in all_units}
    actions = {unit["id"]: [action(a) for a in unit["actions"]] for unit in all_units}
    encounter = Encounter("stage", "stage", Cycle(150, 100, reset_on_wave=True),
                          [python_actors[actor["id"]] for actor in regular],
                          TerminationConfig(max_action_value=fixture["limit"]))
    engine = CombatEngine(encounter, mode="expected", actions_by_actor=actions,
                          policy=TestPolicy(),
                          wave_enemies={i: [python_actors[u["id"]] for u in wave]
                                        for i, wave in enumerate(fixture["waves"], 1)},
                          summon_defs={unit["id"]: SimpleNamespace(
                              actor=python_actors[unit["id"]], owner_id=unit["ownerId"], control="auto",
                              inheritance="none", max_hp_ratio=0,
                          ) for unit in summons})
    events = capture(engine)
    steps = []
    terminal = []
    targets = []
    engine.bus.subscribe("battle_end", lambda _, payload, _state: terminal.append(payload["reason"]))
    engine.bus.subscribe("on_action", lambda _, payload, _state:
                         targets.append([payload["actor"], payload["action_id"], payload["target"]]))
    engine.setup()
    for op, summon in fixture.get("operations", []):
        if op == "spawn":
            owner = engine.state.actors[engine.summon_defs[summon].owner_id]
            engine.summon_actor(owner, summon)
        elif op == "dismiss":
            engine.dismiss_summon_actor(summon)
        elif step := engine.step():
            steps.append([step["actor_id"], step["kind"], step["clock"], step["skipped"]])
    while step := engine.step():
        steps.append([step["actor_id"], step["kind"], step["clock"], step["skipped"]])
    state = engine.state
    contributors = {unit["id"]: unit["name"] for unit in fixture["team"]}
    data = SimpleNamespace(summon_defs=engine.summon_defs, system_actors=[], state_configs_by_actor={})
    opening, turns = public_timeline(events, engine, data, contributors)
    damage = {key: state.damage_by_actor[key] for key in contributors}
    for unit in summons:
        damage[unit["ownerId"]] += state.damage_by_actor.get(unit["id"], 0.0)
    total = sum(damage.values())
    numbers = sorted(({"name": name, "value": damage[key]} for key, name in contributors.items()),
                     key=lambda item: -item["value"])
    return {
        "steps": steps, "targets": targets, "end": terminal, "clock": state.clock, "turns": state.turn_count,
        "sp": state.skill_points, "units": {
            key: [unit.current_hp, unit.current_energy, unit.toughness, unit.alive, unit.broken, unit.bar_index]
            for key, unit in state.actors.items()
        },
        "report": {"total": total, "dps": total / 4, "damage": numbers, "actions": opening, "turns": turns, "warnings": []},
    }

print(json.dumps([run(fixture) for fixture in json.load(sys.stdin)]))
