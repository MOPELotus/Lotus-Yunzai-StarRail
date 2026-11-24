export type Numbers = Record<string, number>;
export type Params = Record<string, number | boolean | null>;
export type SkillValues = Record<string, Numbers>;
export type DamageMetric = "damage" | "shield" | "heal" | "support";
export type DamageValue = { avg: number; dmg?: number; display?: string; metric?: DamageMetric };
export type RuleResult = DamageValue | { type: "text"; avg: string } | { note: string };
export type DamageFn = EngineDamageFn;

export type BaseAttr = { base: number; plus: number; pct: number; inc?: number };
// Numeric operations in the original rules use AttrItem's value coercion.
export type RuleAttr = number & BaseAttr;
export type Variables = {
  attr: Readonly<Record<string, RuleAttr>> & {
    weapon?: { name?: string };
    staticAttr?: Readonly<Record<string, BaseAttr>>;
    t?: { dmg: number };
  };
  calc: (attr: BaseAttr | number) => number;
  talent: SkillValues;
  cons: number;
  exCons?: number;
  trees: Record<string, boolean>;
  params: Params;
  artis: Numbers;
  weaponTypeName?: string;
  charId?: string;
  weapon: { name?: string; affix: number };
  refine: number;
  level: number;
  mastery?: string;
  characterName: string;
  element: string;
};
export type Buff = {
  title?: string | ((variables: Variables) => string);
  data?: Record<string, number | string | boolean | null | undefined | ((variables: Variables) => string | number | boolean | null | undefined)>;
  isStatic?: boolean;
  sort?: number;
  cons?: number;
  maxCons?: number;
  mastery?: string;
  tree?: number;
  trees?: number;
  check?: (variables: Variables) => unknown;
};
export type DamageDetail = {
  title: string | ((variables: Variables) => string);
  cons?: number;
  params?: Readonly<Params>;
  check?: (variables: Variables) => unknown;
  dmgKey?: string;
  tree?: number;
  dmg: (variables: Variables, damage: DamageFn, cons?: number) => RuleResult;
};
export type Rule = {
  createdBy?: string;
  details: readonly DamageDetail[];
  buffs?: readonly Buff[];
  defDmgIdx?: number | ((meta: { cons: number }) => number);
  mainAttr: string;
  defParams?: Params | ((variables: Variables) => Params);
};
export type IndexedBuff = Omit<Buff, "title"> & { title?: string; idx?: number; key?: string };
export type WeaponRule = IndexedBuff | ((tables: Numbers) => IndexedBuff);
export type WeaponRules = Readonly<Record<string, WeaponRule | WeaponRule[]>>;
export type StaticIndex = (index: number, key: string) => IndexedBuff;
export type DynamicIndex = (title: string, key: string | Numbers, index?: number) => WeaponRule;

// The vendored engine resolves stat and skill names from its original rule tables.
export type EngineAttr = Record<string, unknown> & {
  staticAttr: Record<string, BaseAttr>;
  element: string | undefined;
  characterName: string;
  weaponTypeName: string | undefined;
  weapon: Partial<Variables["weapon"]>;
  enemy: { def: number; ignore: number; phy: number };
  superBreak: { ignore: number };
  atk: BaseAttr;
  dmg: BaseAttr;
  phy: BaseAttr;
  coloringDmg: BaseAttr;
  cdmg: BaseAttr;
  cpct: BaseAttr;
  enemydmg: BaseAttr;
  joy: BaseAttr;
  mastery: BaseAttr;
  stance: BaseAttr;
  heal: BaseAttr & { inc: number };
  shield: BaseAttr & { inc: number };
  multi: number;
  fyplus: number;
  fypct: number;
  elevated: number;
  merrymakes: number;
  punchline: number;
  kx: number;
  fykx: number;
  refine: number;
};
export type DamageMetadata = Pick<Variables, "characterName" | "cons" | "exCons" | "level" | "talent" | "trees" | "weapon"> & { mastery?: string };
export type DamageTag = string | false;
export type DynamicDamage = Partial<Record<"dynamicDmg" | "dynamicPhy" | "dynamicCpct" | "dynamicCdmg" | "dynamicEnemydmg", number>>;
export type CalcArgs = {
  pctNum: number; talent: DamageTag; ele: DamageTag; basicNum: number; mode: string; dynamicData: DynamicDamage | false; params: Params | false;
};
export type CalcData = {
  ds: { calc: (attr: BaseAttr | number) => number };
  attr: EngineAttr;
  level: number;
  enemyLv: number;
  showDetail?: boolean;
  game: "sr" | "gs";
};
export type EngineDamageFn = {
  (pctNum?: number, talent?: DamageTag, ele?: DamageTag, basicNum?: number, mode?: string, dynamicData?: DynamicDamage | false, params?: Params | false): DamageValue;
  basic: (amount?: number, skill?: DamageTag, ele?: DamageTag, dynamicData?: DynamicDamage | false, params?: Params | false) => DamageValue;
  reaction: (ele?: DamageTag, params?: Params | false, talent?: string) => DamageValue;
  dynamic: (pctNum?: number, talent?: DamageTag, dynamicData?: DynamicDamage | false, ele?: DamageTag, params?: Params | false) => DamageValue;
  heal: (amount: number) => DamageValue;
  shield: (amount: number) => DamageValue;
  swirl: () => DamageValue;
};
