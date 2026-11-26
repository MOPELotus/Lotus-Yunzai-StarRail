import { expect, test } from "bun:test";
import { readStarRailPersonalDamage } from "../panel-damage.ts";
import { normalizePanel } from "../panel-model.ts";
import health from "./fixtures/panel-damage-hp-support.json";
import elation from "./fixtures/panel-damage-elation.json";

test("验证刃、刃Pro、爻光真实面板计算与出图", () => {
  for (const fixture of [...health, ...elation].filter(row => ["1205", "2205", "1502"].includes(row.avatar.id))) {
    const { setNames, ...inputs } = fixture.metadata;
    const sets = new Map(Object.entries(setNames));
    const metadata = { ...inputs, setForId: (id: string) => sets.get(id) };
    const expected = readStarRailPersonalDamage(fixture.avatar, metadata).damage;
    expect(expected?.rows[expected.selected]?.average).toBeGreaterThan(0);
    const element = fixture.avatar.id === "1502" ? "physical" : "wind";
    for (const value of [element, element.toUpperCase(), element[0]!.toUpperCase() + element.slice(1)]) {
      expect(readStarRailPersonalDamage({ ...fixture.avatar, element: value }, metadata).damage).toEqual(expected);
      const snapshot = normalizePanel("100000001", [{ id: fixture.avatar.id, name: fixture.avatar.name, level: 80, rank: 0, element: value }]);
      expect(snapshot.avatars[0]?.element).toBe(fixture.avatar.element);
    }
    if (fixture.avatar.id === "1502") {
      const equipped = new Set(fixture.avatar.relics.filter(row => row.slot <= 4).map(row => row.id));
      const damage = readStarRailPersonalDamage({ ...fixture.avatar, element }, { ...metadata,
        setForId: (id: string) => equipped.has(id) ? "应天涉远的卜者" : sets.get(id) }).damage;
      expect(damage?.rows[damage.selected]?.average).toBeGreaterThan(0);
    }
  }
});
