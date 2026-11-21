import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadStarRailChallengePortraits } from "../challenge-portraits.ts";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC", "base64");
const signal = new AbortController().signal;
const artwork = "https://act-webstatic.mihoyo.com/fixture.png";

test("头像冷读只向可信 CDN 匿名获取，后续从缓存读取同一个规范 URL", async () => {
  const root = await mkdtemp(join(tmpdir(), "lotus-sr-challenge-art-"));
  try {
    const cacheFile = join(root, "portraits.sqlite");
    const avatar = { id: 1224, icon: artwork + "?session=fixture" };
    const same = { id: 1224, icon: artwork };
    const unknown = { id: 1001, icon: "https://localhost/placeholder.png" };
    let requests = 0;
    const load = (online: boolean) => loadStarRailChallengePortraits([avatar, same, unknown], signal, {
      cacheFile, transport: async (url, options) => {
        requests++;
        expect(online).toBe(true);
        expect(url.href).toBe(artwork);
        expect(options.credentials).toBe("omit");
        expect(options.redirect).toBe("error");
        expect(new Headers(options.headers).get("Cookie")).toBeNull();
        return new Response(png, { headers: { "content-type": "image/png" } });
      },
    });
    const cold = await load(true);
    expect(cold.get(avatar)?.width).toBe(1);
    expect(cold.get(same)).toBe(cold.get(avatar));
    expect(cold.has(unknown)).toBe(false);
    const cached = await load(false);
    expect(cached.get(avatar)?.width).toBe(1);
    expect(requests).toBe(1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("CDN 失败才查同 ID 本机头像，区别三月七两个命途，拒绝主题外软链", async () => {
  const root = await mkdtemp(join(tmpdir(), "lotus-sr-challenge-local-"));
  try {
    const themeDirectory = join(root, "theme");
    const avatarPath = (name: string) => join(themeDirectory, "meta-sr", "character", name, "imgs");
    for (const name of ["三月七", "三月七·巡猎"]) await mkdir(avatarPath(name), { recursive: true });
    const outside = join(root, "outside.webp");
    await writeFile(outside, png);
    await symlink(outside, join(avatarPath("三月七"), "face.webp"));
    await writeFile(join(avatarPath("三月七·巡猎"), "face-q.webp"), png);

    const first = { id: 1001, icon: artwork, name: "三月七·巡猎" };
    const second = { id: 1224, icon: artwork, name: "三月七" };
    const noIcon = { id: 1224, icon: "" };
    const images = await loadStarRailChallengePortraits([first, second, noIcon], signal, {
      cacheFile: join(root, "portraits.sqlite"), themeDirectory,
      transport: async () => new Response("unavailable", { status: 503 }),
    });
    expect(images.has(first)).toBe(false);
    expect(images.get(second)?.width).toBe(1);
    expect(images.get(noIcon)).toBe(images.get(second));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
