"""Parity fixture for the vendored HSR_Nous 00185dd engine."""
import json
from pathlib import Path
import sys

vendor = Path(__file__).resolve().parents[2] / "vendor"
sys.path[:0] = [str(vendor / "src"), str(vendor / "lib")]

from hsr_nous.sim.engine import CombatEngine
from hsr_nous.sim.pipeline import SettlementPipeline
from hsr_nous.sim.scheduler import Scheduler
from hsr_nous.sim.state import ActorState, Modifier
from hsr_nous.sim_schema.action import Action
from hsr_nous.sim_schema.actor import Actor, StatBlock
from hsr_nous.sim_schema.encounter import Cycle, Encounter

def actor(raw):
    return Actor(
        raw["id"], raw["id"], raw["kind"], raw["level"],
        StatBlock(
            dmg_bonus=raw.get("damageBonus", {}),
            resistance=raw.get("resistance", {}), weakness=raw.get("weakness", []),
            toughness_bars=raw.get("toughnessBars", []), **raw["stats"],
        ),
    )

def scheduler_trace(fixture, actors):
    by_id = {a.actor_id: a for a in actors}
    scheduler = Scheduler(actors)
    results = []

    def turn_tuple(turn):
        unit, kind, time = turn
        return [unit.actor_id, kind, time]

    for op, *args in fixture:
        if op == "pop":
            results.append(turn_tuple(scheduler.next_actor()))
        elif op == "preview":
            results.append([turn_tuple(turn) for turn in scheduler.preview(*args)])
        elif op == "countdown":
            scheduler.grant_countdown(*args)
        elif op == "extra":
            scheduler.grant_extra_turn(*args)
        elif op == "shift":
            scheduler.advance_action(by_id[args[0]], args[1])
        elif op == "delay":
            scheduler.delay_action(by_id[args[0]], args[1])
        elif op == "speed":
            scheduler.on_speed_change(by_id[args[0]], 0, args[1])
        elif op == "now":
            scheduler.act_now(by_id[args[0]])
        elif op == "undo":
            scheduler.undo_gauge_reset(by_id[args[0]])
        elif op == "eta":
            results.append(scheduler.form_exit_eta(*args))
        elif op in ("add", "rejoin"):
            new_actor = actor(args[0])
            by_id[new_actor.actor_id] = new_actor
            scheduler.add_actor(new_actor)
        elif op == "reset":
            scheduler.reset_action_gauge(except_countdown=args[0])
        elif op == "exempt":
            scheduler._wave_reset_exempt.add(scheduler.handle_of(args[0]))
        else:
            getattr(scheduler, op)(*args)
    return results

def state_trace(actors, times, newcomer):
    first = Cycle(150, 100, reset_on_wave=True)
    engine = CombatEngine(Encounter("case", "case", first, actors), mode="expected")
    spawn_energy = engine._spawn_actor(actors[0]).current_energy
    engine._init_state()
    a = engine.state.actors[actors[0].actor_id]
    t = engine.state.actors[actors[1].actor_id]
    output = [engine.state.skill_points, engine.state.cycle_end_clock,
              a.current_hp, spawn_energy, t.toughness, a.current_energy]
    for time in times:
        engine.state.clock = time
        engine._tick_cycle()
        output.append([engine.state.cycle_index, engine.state.cycle_end_clock])
    engine.wave_enemies = {1: [actor(newcomer)]}
    t.alive = False
    engine._advance_wave_if_needed()
    output.append([engine.state.cycle_index, engine.state.cycle_end_clock])
    output.append([engine.state.actors[newcomer["id"]].toughness, engine.state.actors[newcomer["id"]].current_energy])
    output.append(vars(engine.pipeline.gain_energy(a, 100)))
    output.append(vars(engine.pipeline.consume_energy(a, 250)))
    output.append(vars(engine.pipeline.toughness_damage(t, 11, "wind", False)))
    output.append(vars(engine.pipeline.toughness_damage(t, 11, "wind")))
    t.bar_index = len(t.extra_bars) + 1
    output.append(vars(engine.pipeline.toughness_damage(t, 11, "wind")))
    return output

class SampleRng:
    def __init__(self, value):
        self.value = value
        self.calls = 0

    def random(self):
        self.calls += 1
        return self.value

def settlement_trace(source, target, cases):
    output = []
    for case in cases:
        src = ActorState(source, source.stats.hp)
        tgt = ActorState(target, case.get("hp", target.stats.hp), broken=case.get("broken", False))
        pipe = SettlementPipeline(mode=case.get("mode", "expected"))
        pipe.rng = SampleRng(case.get("roll", .1))
        action = None
        if "action" in case:
            data = case["action"]
            action = Action("test", "test", data["kind"], "single", data.get("damageType"), data["scaling"])
        if "fixedHpBars" in case or case.get("defenseOverride", False):
            tgt.modifiers["fixed"] = Modifier(
                "fixed", "fixed", "buff", fixed_hp_bars=case.get("fixedHpBars", 0),
                override_effects={"def_": 0} if case.get("defenseOverride", False) else {},
            )
        if effects := case.get("sourceEffects"):
            src.modifiers["source"] = Modifier("source", "source", "buff", stat_effects=effects)
        mod = None
        if data := case.get("modifier"):
            mod = Modifier(
                data["id"], data["id"], "dot", dot_element=data["element"], dot_ratio=data["ratio"],
                stacks=data.get("stacks", 1), dot_source_atk=data.get("sourceAtk", 0),
                dot_snapshot_ctx=data.get("snapshot", {}),
            )
        if boost := case.get("scoped"):
            def scoped(carrier, event, accept, **kwargs):
                if event.get("action_type") == "skill" and event.get("damage_type") == "wind":
                    values = boost["source"] if carrier is src else boost["target"]
                    return sum(value for key, value in values.items() if accept(key))
                return 0
            pipe._scoped_boost = scoped
        result = pipe.settle_damage(
            case["category"], src, tgt, action=action, skill_level=case.get("skillLevel", 1),
            modifier=mod, element=case.get("element", ""), params=case.get("parameters", {}),
        )
        output.append({"value": result.value, "node": result.node, "hp": tgt.current_hp, "rolls": pipe.rng.calls})
    return output

def support_trace(source, target):
    src = ActorState(source, source.stats.hp)
    tgt = ActorState(target, 59_800)
    pipe = SettlementPipeline(mode="expected")
    tgt.modifiers["cap"] = Modifier("cap", "cap", "buff",
                                   stat_effects={"recoverable_hp_reduction": .4, "incoming_heal": .1})
    capped = pipe.heal(src, tgt, 85, atk_scaling=.3, hp_scaling=.25)
    hp_after_cap = tgt.current_hp
    tgt.current_hp = 75_000
    above_cap = pipe.heal(src, tgt, 85, atk_scaling=.3, hp_scaling=.25)
    return [
        pipe.hit_chance(pipe.effective_stats(src), pipe.effective_stats(tgt), .82, .05),
        pipe.toughness_damage_amount(src, 15),
        pipe.shield_value(src, {"flat": 19, "scaling": {"hp": .3, "def_": 1.3, "atk": .15}}),
        pipe.dot_snapshot_context(src, tgt, "wind", .55, base_chance=.82),
        pipe.dot_snapshot_context(src, tgt, "", None),
        vars(capped), hp_after_cap, vars(above_cap), tgt.current_hp,
    ]

fixture = json.load(sys.stdin)
allies_and_target = [actor(raw) for raw in fixture["actors"]]
print(json.dumps({
    "scheduler": scheduler_trace(fixture["scheduler"], allies_and_target),
    "state": state_trace(allies_and_target, fixture["ticks"], fixture["newcomer"]),
    "settlement": settlement_trace(*allies_and_target, fixture["settlement"]),
    "support": support_trace(*allies_and_target),
}))
