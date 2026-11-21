"""Player-facing names and events for Star Rail's team damage card."""
import re

ACTION_LABELS = {
    "basic": "普攻", "skill": "战技", "ultimate": "终结技", "follow_up": "追加攻击",
    "elation_skill": "欢愉技", "memosprite_skill": "忆灵技", "assist": "助战技",
    "technique": "秘技",
}
KNOWN_APPROXIMATIONS = {
    "1220": "终结技视为追加攻击等细节未完整计入。",
    "1112": "账账继承托帕攻击力和部分暴击伤害效果按近似规则计算。",
}
EVENTS = ("on_turn_start", "on_action", "after_being_hit", "on_break",
          "on_state_change", "actor_enter", "on_cycle_start", "on_wave_start")


def capture(engine):
    events = []

    def record(kind, payload, _state):
        events.append((kind, round(engine.state.clock, 1), payload.copy()))

    for kind in EVENTS:
        engine.bus.subscribe(kind, record)
    return events


def localized_label(value, fallback):
    # Untranslated template labels and synthetic action/state IDs are not display names.
    if value and re.search(r"[\u3400-\u9fff]", value) and not re.search(r"[A-Za-z_]", value):
        return value
    return fallback


def explain_approximations(caveats, contributors):
    notes = {}
    for entry in caveats:
        actor = entry.get("actor")
        if actor and actor in contributors and str(entry.get("ref", "")).startswith("characters/"):
            notes[actor] = f"{contributors[actor]}：{KNOWN_APPROXIMATIONS.get(actor, '部分角色机制按近似规则计算。')}"
        elif str(entry.get("ref", "")).startswith(("light_cones/", "relics/")):
            notes["gear"] = "部分光锥或遗器的条件效果按近似规则计算。"
        else:
            notes["other"] = "部分触发条件按近似规则计算。"
    return list(notes.values())


def public_timeline(events, engine, compiled, contributors):
    summons = {key: item.owner_id for key, item in compiled.summon_defs.items()
               if item.owner_id in contributors}
    allies = set(contributors) | set(summons) | {item.actor_id for item in compiled.system_actors}
    names = {key: localized_label(compiled.summon_defs[key].actor.name, "召唤物") for key in summons}
    names.update(contributors)
    for actor_id, state in engine.state.actors.items():
        if actor_id not in names:
            fallback = "召唤物" if actor_id in summons else "目标"
            names[actor_id] = localized_label(state.actor.name, fallback)
    opening = {}
    rows = []
    pending = {}
    completed = {}

    def row(name, value, label):
        entry = {"title": name, "actionPoint": value, "label": label, "hits": {}}
        rows.append(entry)
        return entry

    def name(actor, fallback="队员"):
        return names.get(actor, fallback)

    for kind, av, event in events:
        actor = event.get("actor")
        if kind == "on_turn_start" and actor in contributors:
            opening.setdefault(actor, {"name": name(actor), "value": av})
            continue
        if kind == "actor_enter" and actor in summons and event.get("reason") == "summon":
            row(name(summons[actor]), av, f"召唤 · {name(actor, '召唤物')}登场")
            continue
        if kind == "on_cycle_start":
            row("战斗轮次", av, f"第 {event['cycle_index']} 轮开始")
            continue
        if kind == "on_wave_start" and event["wave_index"] > 0:
            row("敌人波次", av, f"第 {event['wave_index'] + 1} 波敌人登场")
            continue
        if kind == "on_state_change" and actor in allies:
            entering = bool(event.get("to_state"))
            config, _ = compiled.state_configs_by_actor.get(actor, (None, None))
            state = event.get("to_state") if entering else event.get("from_state")
            label = localized_label(config.name, None) if config and config.state == state else None
            verb = "进入" if entering else "退出"
            row(name(actor), av, f"{verb}「{label}」" if label else f"{verb}强化状态")
            continue
        if kind == "on_break" and event.get("source") in allies:
            row(name(event["source"]), av, f"击破弱点 · {name(event.get('target'), '目标')}")
            continue
        if kind not in ("on_action", "after_being_hit"):
            continue
        source = actor if kind == "on_action" else event.get("source")
        if source not in allies:
            continue
        action_type = event.get("action_type")
        action_id = str(event.get("action_id") or "")
        category = ACTION_LABELS.get(action_type, "行动" if kind == "on_action" else "伤害结算")
        action_key = (av, source, action_id or action_type)
        source_key = (av, source)
        if kind == "on_action":
            action = next((item for item in engine.actions_by_actor.get(source, ())
                           if str(item.action_id) == action_id), None)
            skill = localized_label(action.name, None) if action else None
            label = f"{category} · {skill}" if skill else category
            entry = pending.pop(action_key, None)
            if entry is None:
                entry = row(name(source), av, label)
            entry["label"] = label
            completed[source_key] = (entry, skill, action_type)
        elif event["amount"] > 0:
            entry = pending.get(action_key)
            if entry is None and action_id.startswith("hook_") and source_key in completed:
                previous, skill, previous_type = completed[source_key]
                hook_label = action_id.removeprefix("hook_").partition("·")[0]
                if hook_label == skill or action_type == previous_type == "ultimate":
                    entry = previous
            if entry is None:
                entry = row(name(source), av, "伤害结算")
                pending[action_key] = entry
            hits = entry["hits"]
            target = event["target"]
            hits[target] = hits.get(target, 0) + event["amount"]

    turns = []
    for entry in rows[:36]:
        hits = entry.pop("hits")
        lines = [entry.pop("label")]
        if hits:
            summary = f"造成 {sum(hits.values()):,.1f} 点伤害"
            if len(hits) > 1:
                summary += f" · 命中 {len(hits)} 个目标"
            lines.append(summary)
            lines.extend(f"{name(target, '目标')}受到 {amount:,.1f} 点伤害" for target, amount in hits.items())
        turns.append({**entry, "lines": lines[:8]})
    return list(opening.values())[:12], turns
