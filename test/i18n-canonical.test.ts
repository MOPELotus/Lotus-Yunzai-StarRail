import { expect, test } from "bun:test";

// Run before module imports so cached pool definitions also see the selected language.
test("custom text does not rename stored warp items or command discriminators", async () => {
  const runtime = new URL("../../../packages/i18n/index.ts", import.meta.url).href;
  const pools = new URL("../simulation/pools.ts", import.meta.url).href;
  const catalog = new URL("../i18n/zh-CN.json", import.meta.url).href;
  const zzz = new URL("../../zzz/pool-history.ts", import.meta.url).href;
  const zzzCatalog = new URL("../../zzz/i18n/zh-CN.json", import.meta.url).href;
  const source = `
    const {registerLanguage,setLanguage}=await import(${JSON.stringify(runtime)});
    const sr=(await Bun.file(new URL(${JSON.stringify(catalog)})).json()).messages;
    const zz=(await Bun.file(new URL(${JSON.stringify(zzzCatalog)})).json()).messages;
    registerLanguage('en',{starrail:Object.fromEntries(Object.keys(sr).map(k=>[k,'rewritten'])),zzz:Object.fromEntries(Object.keys(zz).map(k=>[k,'rewritten']))});
    setLanguage('en');
    const {createWarpPoolSource}=await import(${JSON.stringify(pools)});
    const pool=await createWarpPoolSource()('standard',1,Date.parse('2026-11-25T12:00:00+08:00'));
    const {zzzPoolHistoryCommand}=await import(${JSON.stringify(zzz)});
    console.log(JSON.stringify({names:pool.otherFive.map(x=>x.name),kinds:[...new Set(pool.otherFive.map(x=>x.kind))],command:zzzPoolHistoryCommand('%角色卡池历史')}));
  `;
  const child = Bun.spawn([process.execPath, "--eval", source], { stdout: "pipe", stderr: "pipe" });
  const output = await new Response(child.stdout).text();
  const errors = await new Response(child.stderr).text();
  expect(await child.exited, errors).toBe(0);
  const data = JSON.parse(output);
  expect(data.names).toContain("姬子");
  expect(data.names).not.toContain("rewritten");
  expect(data.kinds.sort()).toEqual(["光锥", "角色"]);
  expect(data.command).toEqual({ type: "角色", rank: "S" });
});
