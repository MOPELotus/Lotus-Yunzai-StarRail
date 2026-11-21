import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStarRailGachaRecordArchive } from "../gacha-record-archive.ts";
import { exportStarRailUigf } from "../gacha-uigf.ts";

const identity = { qq: "42", uid: "100000002" };
const options = { legacyTimezone: 8 };
const recorded = {
  uid: identity.uid, id: "1774275200000000001", gacha_type: "11", gacha_id: "2005", item_id: "1001",
  time: "2025-07-15 12:00:09", lang: "zh-cn", name: "希儿", item_type: "角色", rank_type: "5",
} as const;
const placeholder = {
  ...recorded, id: "1774275200000000002", item_id: "20006", name: "智库", item_type: "光锥", rank_type: "3", xhh_ph: 1,
};
const summary = { ...recorded, id: "1774275200000000003", xhh_src: "mini", xhh_pity: "12" };
const workshop = { ...summary, id: "1774275200000000004", gacha_type: "22", xhh_origin: "workshop" };

async function fixture(run: (store: ReturnType<typeof createStarRailGachaRecordArchive>,
  save: (pool: string, rows: readonly unknown[], backup?: boolean) => Promise<string>) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), "lotus-starrail-legacy-summary-"));
  const legacyDirectory = join(root, "srJson");
  const store = createStarRailGachaRecordArchive({ directory: join(root, "managed"), legacyDirectory },
    async () => ({ close() {} }));
  try {
    await run(store, async (pool, rows, backup = false) => {
      const identityPath = join(backup ? `${legacyDirectory}.backup` : legacyDirectory, identity.qq, identity.uid);
      await mkdir(identityPath, { recursive: true });
      const file = join(identityPath, `${pool}.json`);
      await writeFile(file, JSON.stringify(rows));
      return file;
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("纯旧汇总只提示镜像，无占位的真实备份仍可读", () => fixture(async (store, save) => {
  const file = await save("11", [placeholder, summary]);
  for (const pool of ["1", "2", "12", "21", "22"]) await save(pool, [{ ...workshop, gacha_type: pool }]);
  const previous = await readFile(file);
  expect(await store.read(identity, options)).toEqual({ status: "unavailable", reason: "mirror" });
  await save("11", [recorded], true);
  expect(await store.read(identity, options)).toMatchObject({
    status: "available", source: "backup", archive: { records: [{ id: recorded.id }] },
  });
  expect(await readFile(file)).toEqual(previous);
}));

test("旧同池汇总不进入逐抽导出，与占位同名的真实三星、同 ID 真实五星或附有垫抽数的真实记录照常保留", () => fixture(async (store, save) => {
  const realThreeStar = { ...placeholder, id: "1774275200000000005", xhh_ph: undefined };
  const file = await save("11", [placeholder, { ...summary, id: recorded.id }, { ...recorded, xhh_pity: "12" }, realThreeStar]);
  const previous = await readFile(file);
  const result = await store.read(identity, options);
  expect(result.status).toBe("available");
  if (result.status !== "available") return;
  const exported = exportStarRailUigf(result.archive, {
    uid: identity.uid, version: "v4", exportedAt: new Date("2025-07-16T00:00:00Z"),
    app: { name: "Lotus-Yunzai", version: "test" },
  });
  expect(exported).toMatchObject({ hkrpg: [{ list: [{ id: recorded.id }, { id: realThreeStar.id }] }] });
  expect(await readFile(file)).toEqual(previous);
}));

test("主档存在时优先使用，旧档占位仍不能参与离线交还", () => fixture(async (store, save) => {
  const old = { ...recorded, id: "1774275200000000006" };
  await save("11", [placeholder, summary]);
  const imported = await store.merge(identity, { uid: identity.uid, timezone: 8, lang: "zh-cn", records: [recorded] },
    async () => {}, options);
  expect(imported.total).toBe(1);
  const file = await save("11", [placeholder, summary, old]);
  const previous = await readFile(file);
  expect(await store.read(identity, options)).toMatchObject({
    status: "available", source: "managed", archive: { records: [{ id: recorded.id }] },
  });
  const handback = await store.prepareLegacyHandback(identity, 8);
  expect(handback.counts).toEqual({ modern: 1, legacy: 1, total: 2 });
  expect(handback.document).toMatchObject({ list: [{ id: recorded.id }, { id: old.id }] });
  expect(await readFile(file)).toEqual(previous);
}));
