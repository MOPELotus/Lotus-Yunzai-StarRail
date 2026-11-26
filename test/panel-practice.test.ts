import { expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { makePanelPracticeCards, readTheme } from "../panel-card.ts";
import { normalizePanel, parsePanelCommand, readLegacyPanel } from "../panel-model.ts";

const uid = "500000671", profileAt = Date.parse("2024-07-01T02:03:00Z"), mysAt = Date.parse("2024-07-02T03:04:00Z");
const active = new AbortController().signal;

test("星铁练度沿用旧别名、档案及四五星筛选，角色抽卡统计和伤害另走原入口", () => {
  for (const message of ["#星铁面板练度统计", "*练度统计", "#星铁练度列表", "#星铁角色列表"]) {
    expect(parsePanelCommand(message)).toEqual({ type: "practice", profileId: 1, name: "", rarity: undefined });
  }
  expect(parsePanelCommand("#星铁我的物理五星角色汇总force 档案2"))
    .toEqual({ type: "practice", profileId: 2, name: "", rarity: 5 });
  expect(parsePanelCommand("#星铁角色汇总四星2")).toEqual({ type: "practice", profileId: 2, name: "", rarity: 4 });
  for (const message of ["#星铁角色统计2", "#星铁抽卡统计", "#原神练度统计", "#星铁喵喵练度统计", "*阵容伤害"]) {
    expect(parsePanelCommand(message)).toBeUndefined();
  }
});

test("本地练度模型沿用基础等级排序、星魂加级、光锥及遗器套装评分", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lotus-starrail-practice-"));
  try {
    async function fixture(path: string, content = "") {
      const target = join(directory, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content);
    }
    await Promise.all([
      fixture("meta-sr/character/data.json", JSON.stringify({
        1302: { name: "银枝", star: 5 }, 1001: { name: "三月七", star: 4 }, 1002: { name: "丹恒", star: 4 },
      })),
      fixture("meta-sr/character/三月七/data.json", JSON.stringify({ id: 1001, talentCons: { a: 3, e: 5, q: 3, t: 5 } })),
      fixture("meta-sr/character/三月七/imgs/face.webp"),
      fixture("meta-sr/weapon/data.json", JSON.stringify({ 23001: { name: "长夜", abbr: "长夜", type: "存护", star: 5 } })),
      fixture("meta-sr/weapon/存护/长夜/icon-s.webp"),
      fixture("meta-sr/artifact/data.json", JSON.stringify({ set: { name: "实证套装", idxs: {
        1: { name: "头部", ids: { 61021: 5 } }, 3: { name: "躯干", ids: { 61023: 5 } },
      } } })),
      fixture("meta-sr/artifact/实证套装/arti-1.webp"),
      fixture("character/imgs/bg-02.jpg"),
      fixture("character/imgs/main-02.png"),
    ]);
    const raw = { uid, _profile: profileAt, _mys: mysAt, avatars: {
      1302: { id: 1302, level: 79, cons: 2, _source: "homo", talent: { a: 6, e: 10, q: 10, t: 10 },
        artis: { 1: { id: 61021, level: 15, star: 5, mainId: 1, attrIds: ["7,2,1"] },
          3: { id: 61023, level: 15, star: 5, mainId: 4, attrIds: ["8,3,3", "9,1,0"] } } },
      1001: { id: 1001, level: 80, cons: 5, _source: "homo", talent: { a: 4, e: 7, q: 8, t: 5 },
        weapon: { id: 23001, level: 70, affix: 2 } },
      1002: { id: 1002, level: 80, cons: 6, _source: "mys", talent: { a: 5, e: 4 } },
      1003: { id: 1003, level: 1, cons: 0, _source: "mys" },
    } };
    const snapshot = readLegacyPanel(uid, raw);
    const theme = await readTheme(directory);
    const [model] = await makePanelPracticeCards(snapshot, theme, active, undefined, raw);
    expect(model?.avatars.map(row => row.id)).toEqual(["1001", "1002", "1302"]);
    expect(model?.avatars[0]).toMatchObject({ talent: [
      { level: 5, original: 4 }, { level: 9, original: 7 }, { level: 10, original: 8 }, { level: 7, original: 5 },
    ], talentSum: 24, cons: 5, weapon: { level: 70, star: 5, affix: 2 } });
    expect(model?.avatars[0]?.face).toContain("face.webp");
    expect(model?.avatars[0]?.weapon?.icon).toContain("icon-s.webp");
    expect(model?.avatars[1]).toMatchObject({ talentSum: 4, rating: { mark: "0.0", markClass: "D" } });
    expect(model?.avatars[2]?.rating).toMatchObject({ mark: expect.any(String), markClass: expect.any(String) });
    expect(model?.avatars[2]?.relics).toHaveLength(1);
    expect(model?.avatars[2]?.relics[0]).toContain("arti-1.webp");
    expect(model?.updateTime).toEqual({ profile: "07-01 10:03", mys: "07-02 11:04" });
    expect(model?.background).toContain("bg-02.jpg");
    expect(model?.main).toContain("main-02.png");
    expect((await makePanelPracticeCards(snapshot, theme, active, 5, raw))[0]?.avatars.map(row => row.id)).toEqual(["1302"]);
    expect(snapshot.avatars.find(row => row.id === "1001")?.skills.find(row => row.key === "e")?.level).toBe(7);

    const compiler = require("art-template") as { compile(template: string, options: { filename: string }): (data: object) => string };
    const html = compiler.compile(await Bun.file(model!.tplFile).text(), { filename: model!.tplFile })(model!);
    for (const expected of ["UID:500000671 共3名角色", "光锥", "遗器", "11:04", "bg-02.jpg", "icon-s.webp", "Lotus-Yunzai"]) {
      expect(html).toContain(expected);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("练度长图输出、头像展示及群榜武器名称完整分行显示", async () => {
  const rows = Array.from({ length: 31 }, (_, index) => ({
    id: index + 1000, name: `角色${index}`, level: 80, rarity: 4, rank: 0,
    skills: [{ remake: "普攻", level: 4 }, { remake: "战技", level: 7 }, { remake: "终结技", level: 9 }],
  }));
  const snapshot = normalizePanel(uid, rows, new Date(profileAt));
  const theme = await readTheme("/dev/null");
  const pages = await makePanelPracticeCards(snapshot, theme, active, 4);
  expect(pages.map(page => [page.total, page.start, page.avatars.length])).toEqual([[31, 0, 31]]);
  expect(pages[0]?.avatars[0]).toMatchObject({ id: "1030", talentSum: 4, talent: [{ level: 4 }, { level: 7 }, { level: 9 }, { level: "—" }] });
  expect(await makePanelPracticeCards(snapshot, theme, active, 5)).toEqual([]);
  expect(await makePanelPracticeCards({ ...snapshot, avatars: [] }, theme, active, undefined)).toEqual([]);
});
