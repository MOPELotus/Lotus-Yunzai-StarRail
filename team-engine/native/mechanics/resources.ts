// HSR Nous resource ledger, adapted from the MIT-licensed pinned engine.
import type { ActorState, BattleState } from "../combat/index.ts";
import { number } from "../compile/library.ts";
import type { CompiledActor } from "../compile/types.ts";
import type { EventPayload } from "./events.ts";
import { dataOf } from "./modifiers.ts";

interface ResourceHost {
  readonly state: BattleState;
  template(id: string): CompiledActor | undefined;
  emit(event: string, payload: EventPayload): void;
  waterfall(event: string, payload: EventPayload): EventPayload;
  punchlineOverride?(): number | undefined;
}
interface Banger {
  readonly value: number;
  turns: number;
}

export class ResourceBook {
  readonly #provenance = new Map<ActorState, Map<string, Set<string>>>();
  readonly #bangers = new Map<ActorState, Banger[]>();

  constructor(readonly host: ResourceHost) {}

  initialize(actor: ActorState): void {
    this.#bangers.delete(actor);
    this.#provenance.delete(actor);
    for (const [id, { raw }] of Object.entries(this.host.template(actor.actor.id)?.resources ?? {})) {
      actor.resources.set(id, number(raw.current));
    }
  }

  value(actor: ActorState, id: string): number {
    if (id === "punchline") return this.host.punchlineOverride?.() ?? this.host.state.punchline;
    if (id === "certified_banger") return (this.#bangers.get(actor) ?? []).reduce((sum, row) => sum + row.value, 0);
    return actor.resources.get(id) ?? 0;
  }

  entries(actor: ActorState): Record<string, number> {
    const values = Object.fromEntries([...actor.resources].map(([id, value]) => ["res_" + id, value]));
    values.res_punchline = this.value(actor, "punchline");
    values.res_certified_banger = this.value(actor, "certified_banger");
    return values;
  }

  uniqueSources(actor: ActorState, id: string): number {
    return this.#provenance.get(actor)?.get(id)?.size ?? 0;
  }

  #declaration(actor: ActorState, id: string): EventPayload {
    return this.host.template(actor.actor.id)?.resources[id]?.raw ?? {};
  }

  #emitGain(actor: ActorState, id: string, amount: number, current: number, overflow = 0) {
    this.host.emit("on_resource_gain", { actor: actor.actor.id, resource_id: id, amount, current, overflow });
  }

  gain(actor: ActorState, id: string, requested: number, sourceId = "", fromBank = false): number {
    if (!Number.isFinite(requested)) throw new TypeError(id + " 的资源改变量不是有限数值");
    if (id === "punchline") {
      const previous = this.host.state.punchline;
      const current = Math.max(0, previous + requested);
      this.host.state.punchline = current;
      this.#emitGain(actor, id, current - previous, current);
      return current - previous;
    }
    if (id === "certified_banger") {
      const entries = this.#bangers.get(actor) ?? [];
      if (requested > 0) entries.push({ value: requested, turns: actor.resources.get("banger_turns") ?? 2 });
      else {
        let left = -requested;
        while (left > 0 && entries.length) left -= entries.pop()!.value;
      }
      this.#bangers.set(actor, entries);
      this.#emitGain(actor, id, requested, this.value(actor, id));
      return requested;
    }
    const old = this.value(actor, id);
    let amount = requested;
    if (requested < 0) {
      const after = this.host.waterfall("before_consume",
        { actor: actor.actor.id, resource_id: id, amount: -requested, reason: "" });
      if (after.cancel) return 0;
      amount = -number(after.amount, -requested);
    }
    const declaration = this.#declaration(actor, id);
    let cap = number(declaration.max, Infinity);
    for (const modifier of actor.modifiers.values()) {
      const raw = dataOf(modifier);
      const override = number(raw.max_override);
      if (override > 0 && raw.target_resource === id) cap = cap === Infinity ? override : Math.max(cap, override);
    }
    const overflow = Math.max(0, old + amount - cap);
    const current = Math.max(0, Math.min(cap, old + amount));
    if (overflow && !fromBank && declaration.overflow_mode === "bank") {
      const bankId = id + "_bank";
      const bankOld = this.value(actor, bankId);
      const bankNew = Math.min(bankOld + overflow, number(this.#declaration(actor, bankId).max, Infinity));
      actor.resources.set(bankId, bankNew);
      if (bankNew !== bankOld) this.#emitGain(actor, bankId, bankNew - bankOld, bankNew);
    }
    actor.resources.set(id, current);
    if (declaration.provenance && amount > 0 && sourceId) {
      const values = this.#provenance.get(actor) ?? new Map<string, Set<string>>();
      const sources = values.get(id) ?? new Set<string>();
      sources.add(sourceId);
      values.set(id, sources);
      this.#provenance.set(actor, values);
    }
    if (current <= 0) this.#provenance.get(actor)?.delete(id);
    this.#emitGain(actor, id, current - old, current, overflow);
    if (amount < 0) this.host.emit("after_consume", {
      actor: actor.actor.id, resource_id: id, amount: old - current, current,
    });
    return current - old;
  }

  set(actor: ActorState, id: string, amount: number, sourceId = ""): void {
    this.gain(actor, id, amount - this.value(actor, id), sourceId);
  }

  refund(actor: ActorState, id: string): void {
    const bankId = id + "_bank";
    const available = this.value(actor, bankId);
    if (!available) return;
    this.gain(actor, id, available, "", true);
    actor.resources.set(bankId, 0);
    this.#emitGain(actor, bankId, -available, 0);
  }

  tickBanger(actor: ActorState): void {
    const entries = this.#bangers.get(actor);
    if (!entries?.length) return;
    const expired = entries.filter(row => --row.turns <= 0);
    this.#bangers.set(actor, entries.filter(row => row.turns > 0));
    const current = this.value(actor, "certified_banger");
    for (const { value } of expired) this.host.emit("on_banger_expire",
      { actor: actor.actor.id, value, current });
  }
}
