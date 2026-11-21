import { expect, test } from "bun:test";
import { parsePanelCommand } from "../panel-model.ts";
import { fetchStarRailShowcase, showcaseTarget } from "../panel-showcase.ts";

const cn = { uid: "500000123", region: "prod_qd_cn", gameBiz: "hkrpg_cn" };
const os = { uid: "800000123", region: "prod_official_asia", gameBiz: "hkrpg_global" };
const now = new Date("2026-01-01T00:00:00.000Z");
const signal = new AbortController().signal;
const character = {
  avatarId: 1001, level: 80, promotion: 6, rank: 2, equipment: { tid: 21001, level: 80, promotion: 6, rank: 2 },
  skillTreeList: [{ pointId: 1001001, level: 6 }, { pointId: 1001201, level: 1 }],
  relicList: [{ tid: 61011, type: 1, level: 15, mainAffixId: 1, subAffixList: [{ affixId: 2, cnt: 2, step: -1 }] }],
};

test("旧展板和备用入口选择原服务器位，拒绝错区服和私有 Token 服务", () => {
  expect(parsePanelCommand("*备用更新面板2")).toEqual({ type: "showcase", name: "", profileId: 2 });
  expect(parsePanelCommand(`#星铁展板获取游戏角色详情${os.uid} 档案2`)).toEqual({ type: "showcase", name: "", uid: os.uid, profileId: 2 });
  expect(parsePanelCommand("#原神展板更新面板")).toBeUndefined();
  expect(showcaseTarget(cn, "0").provider).toBe("mihomo");
  expect(showcaseTarget(cn, "234").provider).toBe("avocado");
  expect(showcaseTarget(os, "234").provider).toBe("enka");
  expect(showcaseTarget({ ...os, region: "", gameBiz: "" }, "2").region).toBe("prod_official_asia");
  expect(() => showcaseTarget({ ...os, region: cn.region }, "0")).toThrow("区服不一致");
  expect(() => showcaseTarget({ ...os, gameBiz: "hkrpg_cn" }, "0")).toThrow("区服不一致");
  expect(() => showcaseTarget(cn, "1")).toThrow("旧私有 Token");
});

test("Mihomo 原始接口仅发绑定 UID，展板覆盖同名助战，角色和词条迁入同一面板模型", async () => {
  const result = await fetchStarRailShowcase(showcaseTarget(cn, "0"), signal, async (url, init) => {
    expect(url.href).toBe(`https://api.mihomo.me/sr_info/${cn.uid}`);
    expect(init).toMatchObject({ method: "GET", credentials: "omit", redirect: "error" });
    expect(init.body).toBeUndefined();
    expect([...new Headers(init.headers)]).toEqual([["accept", "application/json"], ["user-agent", "Lotus-Yunzai"]]);
    return Response.json({ ttl: 120, detailInfo: { uid: Number(cn.uid), nickname: "未使用个人签名", region: cn.region,
      assistAvatarList: [{ ...character, level: 50 }], avatarDetailList: [character] } });
  }, now);
  expect(result).toMatchObject({ uid: cn.uid, source: "mihomo", updatedAt: now.toISOString(), showcaseTtl: 120, avatars: [{
    id: "1001", name: "三月七", level: 80, rank: 2, legacy: { source: "homo", promote: 6, dataComplete: true },
    skills: [{ key: "a", level: 6 }], traces: [{ id: "1001201", active: true }],
    cone: { id: "21001", rank: 2 }, relics: [{ id: "61011", rarity: 5, legacyMainId: "1", legacySubIds: ["2,2,-1"] }],
  }] });
  expect(JSON.stringify(result)).not.toContain("未使用个人签名");
});

test("显式备用源使用自己的固定域和字段，失败不改换其他来源", async () => {
  let requests = 0;
  const alt = async (url: URL) => {
    requests++;
    switch (url.hostname) {
      case "avocado.wiki":
        expect(url.pathname).toBe(`/v1/raw/info/${cn.uid}`);
        return Response.json({ playerDetailInfo: { uid: cn.uid, displayAvatars: [{ avatarId: 1001, level: 70,
          equipment: { id: 21001, level: 75 }, behaviorList: [{ id: 1001001, level: 5 }],
          relics: [{ id: 61011, type: 1, level: 12, main_affix_id: 1, sub_affix_id: [{ id: 2, cnt: 1 }] }] }] } });
      case "enka.network":
        expect(url.pathname).toBe(`/api/hsr/uid/${os.uid}`);
        return Response.json({ uid: os.uid, detailInfo: { assistAvatarDetail: { AvatarID: 1001, Level: 70 } } });
      default:
        throw new Error("未授权的测试来源");
    }
  };
  expect(await fetchStarRailShowcase(showcaseTarget(cn, "3"), signal, alt)).toMatchObject({ source: "avocado", avatars: [{
    cone: { id: "21001" }, skills: [{ key: "a", level: 5 }], relics: [{ legacySubIds: ["2,1,0"] }],
  }] });
  expect(await fetchStarRailShowcase(showcaseTarget(os, "4"), signal, alt)).toMatchObject({ source: "enka", avatars: [{ id: "1001" }] });
  for (const response of [
    { detailInfo: { uid: os.uid, avatarDetailList: [character] } },
    { detailInfo: { uid: cn.uid, region: os.region, avatarDetailList: [character] } },
    { detailInfo: { avatarDetailList: [character] } },
  ]) {
    await expect(fetchStarRailShowcase(showcaseTarget(cn, "0"), signal, async () => { requests++; return Response.json(response); }))
      .rejects.toThrow("UID 或区服不匹配");
  }
  await expect(fetchStarRailShowcase(showcaseTarget(cn, "0"), signal, async () => { requests++; return Response.json({
    detailInfo: { uid: cn.uid, isDisplayAvatar: false, avatarDetailList: [character] },
  }); })).rejects.toThrow("没有展示角色");
  await expect(fetchStarRailShowcase(showcaseTarget(cn, "0"), signal, async () => { requests++; return new Response(null, { status: 429 }); }))
    .rejects.toThrow("过于频繁");
  expect(requests).toBe(7);
});
