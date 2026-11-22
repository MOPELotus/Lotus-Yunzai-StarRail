import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createStarRailGachaFiles } from "../gacha-files.ts";
import { createStarRailGachaRecordArchive, prepareIndependentStarRailGachaImport } from "../gacha-record-archive.ts";

const uid = "100000002";
const otherUid = "100000003";
const row = {
  uid, id: "1774275200000000001", gacha_type: "11", gacha_id: "2005", item_id: "1001",
  time: "2025-07-15 12:00:09", lang: "zh-cn", name: "希儿", item_type: "角色", rank_type: "5",
};

async function fixture(run: (root: string, source: string, directory: string) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), "lotus-starrail-independent-"));
  const source = join(root, "gatcha");
  const directory = join(source, uid);
  try {
    await mkdir(directory, { recursive: true });
    await run(root, source, directory);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function runConverter(source: string, output: string) {
  const path = fileURLToPath(new URL("../import-independent-gacha-cli.ts", import.meta.url));
  const job = Bun.spawn([process.execPath, "--no-env-file", path, source, uid, "5.5", output], {
    stdout: "pipe", stderr: "pipe",
  });
  const [status, stdout, stderr] = await Promise.all([job.exited, new Response(job.stdout).text(), new Response(job.stderr).text()]);
  return { status, stdout, stderr };
}

test("独立旧档生成私有文件，由星铁档案命令核对角色并安全合并", () => fixture(async (root, source, directory) => {
  const filename = join(directory, "11.json");
  const original = JSON.stringify([row, { ...row, id: "1774275200000000002", xhh_src: "mini" }]);
  await writeFile(filename, original);
  await writeFile(join(directory, "22.json"), JSON.stringify([{ ...row, gacha_type: "22", id: "1774275200000000003" }]));
  await symlink(directory, join(source, otherUid));
  const output = join(root, "import.json");
  expect(await runConverter(source, output)).toMatchObject({ status: 0, stdout: expect.stringContaining("2 条") });
  const content = await readFile(output);
  expect((await stat(output)).mode & 0o777).toBe(0o600);
  expect(await runConverter(source, output)).toMatchObject({ status: 1, stderr: expect.stringContaining("已存在") });
  expect(await runConverter(source, join(directory, "new.json"))).toMatchObject({ status: 1, stderr: expect.stringContaining("旧档案以外") });
  expect(await readFile(output)).toEqual(content);
  expect(await readFile(filename, "utf8")).toBe(original);

  const store = createStarRailGachaRecordArchive({ directory: join(root, "managed"), legacyDirectory: join(root, "srJson") },
    async () => ({ close() {} }));
  let selected = otherUid;
  const controller = new AbortController();
  try {
    const receive = createStarRailGachaFiles({
      async savedRole() {
        return { uid: selected, region: "prod_gf_cn", gameBiz: "hkrpg_cn", chosen: true, nickname: "" };
      },
    }, store, controller.signal, "test");
    const chat = { message_type: "private", self_id: 11, user_id: 42, canReadAttachments: true, reply() {} };
    const command = { ...chat, normalizedMessage: "#星铁导入记录" };
    const attachment = { ...chat, normalizedMessage: "", attachment: { name: "import.json", async read() { return content; } } };
    await receive(command);
    expect(await receive(attachment)).toContain("UID 匹配");
    selected = uid;
    await receive(command);
    expect(await receive(attachment)).toContain("导入成功");
    await receive(command);
    expect(await receive(attachment)).toContain("新增 0 条");
    expect(await store.read({ qq: "42", uid }, {})).toMatchObject({ source: "managed", archive: {
      timezone: 0, records: [{ id: row.id, time: "2025-07-15 06:30:09" }, { gacha_type: "22" }],
    } });
  } finally {
    controller.abort();
  }
}));

test("独立旧档拒绝不明归属、其他 UID、汇总占位、冲突和符号链接", () => fixture(async (_root, source, directory) => {
  const filename = join(directory, "11.json");
  const prepare = () => prepareIndependentStarRailGachaImport(source, uid, 8);
  for (const [rows, message] of [
    [[{ ...row, uid: undefined }], "缺少 UID"],
    [[{ ...row, uid: otherUid }], "其他 UID"],
    [[{ ...row, xhh_ph: 1 }], "汇总或占位"],
    [[row, { ...row, item_id: "1002" }], "编号相同但内容不同"],
  ] as const) {
    await writeFile(filename, JSON.stringify(rows));
    await expect(prepare()).rejects.toThrow(message);
  }
  await symlink(directory, join(source, otherUid));
  await expect(prepareIndependentStarRailGachaImport(source, otherUid, 8)).rejects.toThrow("实际目录");
  await expect(prepareIndependentStarRailGachaImport(source, "../outside", 8)).rejects.toThrow("UID 无效");
  await rm(filename);
  await symlink("/dev/zero", filename);
  await expect(prepare()).rejects.toThrow("普通 JSON");
}));
