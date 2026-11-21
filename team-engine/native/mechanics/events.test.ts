import { expect, test } from "bun:test";
import type { CompiledHook } from "../compile/types.ts";
import { eventFields, HookDispatch, validateEvent, waterfallEvents } from "./events.ts";

function hook(ownerId: string, event: string, patch: Partial<CompiledHook> = {}): CompiledHook {
  return { raw: {}, expressions: new Map(), effects: [], source: "fixture", ownerId,
    event, accumulated: false, flushTriggers: [], ...patch };
}

test("event contracts match the pinned bus and reject misspelled payload fields", async () => {
  const source = await Bun.file(new URL("../../vendor/src/hsr_nous/sim/bus.py", import.meta.url)).text();
  const [contracts, fields] = source.split("DEFAULT_PAYLOAD_FIELDS: Dict[str, frozenset] = {");
  expect([...contracts!.matchAll(/"([a-z_]+)": "(emit|waterfall)",/g)].map(match => match[1]!).sort())
    .toEqual(Object.keys(eventFields).sort());
  expect([...contracts!.matchAll(/"([a-z_]+)": "waterfall",/g)].map(match => match[1]!).sort())
    .toEqual([...waterfallEvents].sort());
  for (const [, event, names] of fields!.matchAll(/"([a-z_]+)": frozenset\(\{([^}]+)\}\)/g)) {
    const pinned = [...names!.matchAll(/'([a-z_]+)'/g)].map(match => match[1]!).sort();
    expect(eventFields[event! as keyof typeof eventFields].split(" ").sort()).toEqual(pinned);
  }
  expect(() => validateEvent("before_take_damage", { amount: 50 }, false)).toThrow();
  expect(() => validateEvent("on_action", { misspelled: 1 }, false)).toThrow();
  expect(() => validateEvent("before_take_damage", { cancel: true }, true)).not.toThrow();
});

test("ordinary hooks match one condition snapshot and honor death during execution", () => {
  const owners = new Map(["a", "b", "c"].map(id => [id, { alive: true }]));
  const hits: string[] = [];
  const bus = new HookDispatch(["c", "b", "a"].map(id => hook(id, "on_action")), {
    owner: id => owners.get(id), condition: h => h.ownerId !== "b" || hits.length === 0,
    filter: () => true, warn: () => {},
    effect: h => {
      hits.push(h.ownerId);
      if (h.ownerId === "a") owners.get("c")!.alive = false;
      return undefined;
    },
  }, { on_action: ["a", "b"] });
  bus.emit("on_action", { actor: "a" });
  expect(hits).toEqual(["a", "b"]);
});

test("accumulates unique targets and flushes after ordinary hooks", () => {
  const effects: unknown[] = [];
  const queued = hook("a", "on_hp_decrease", { accumulated: true, flushTriggers: ["on_action"] });
  const bus = new HookDispatch([queued, hook("a", "on_action")], {
    owner: () => ({ alive: true }), condition: () => true, filter: () => true, warn: () => {},
    effect: (h, _, payload) => { effects.push([h.event, payload.targets]); return undefined; },
  });
  for (const target of ["first", "second", "first"]) bus.emit("on_hp_decrease", { target });
  bus.emit("on_action", { actor: "a" });
  bus.emit("on_action", { actor: "a" });
  expect(effects).toEqual([["on_action", undefined], ["on_hp_decrease", ["first", "second"]], ["on_action", undefined]]);
});

test("waterfall uses the latest amount and stops on cancellation", () => {
  const calls: string[] = [];
  const bus = new HookDispatch(["a", "b", "c"].map(id => hook(id, "before_consume")), {
    owner: () => ({ alive: true }), condition: (h, _, payload) => h.ownerId !== "b" || payload.amount === 5,
    filter: () => true, warn: () => {},
    effect: h => {
      calls.push(h.ownerId);
      return h.ownerId === "a" ? { amount: 5 } : { cancel: true };
    },
  });
  expect(bus.waterfall("before_consume", { amount: 20 })).toEqual({ amount: 5, cancel: true });
  expect(calls).toEqual(["a", "b"]);
});
