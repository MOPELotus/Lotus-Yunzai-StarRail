# Lotus-Yunzai StarRail

模块内包含星铁抽卡记录、逐抽档案和米游社挑战战绩。

## 挑战战绩

发送 `*混沌`、`*虚构`、`*末日` 或 `*异相仲裁` 查看当前档案中的对应战绩。`*深渊` 查询混沌回忆、虚构叙事和末日幻影，`*最新深渊` 使用米游社返回的日期选择最近开启的一项。缺少日期时返回三项战绩。亦支持 `#星铁` 前缀及旧别名。

可加「上期」「往期」或「简易」，例如 `*上期简易混沌 2`。`*往期异相仲裁` 展示官方返回的最近三期。指令默认使用档案 1，末尾可加档案编号。查询个人战绩使用该档中已同步的国服角色。米游社要求验证时，请在官方客户端处理后重试。

出图沿用旧深渊模板。可把有权使用的原版 `floor12.png`、`star.png`、`fonts/HYWenHei-55W.ttf` 与 `fonts/tttgbnumber.ttf` 放入宿主的 `data/starrail/challenge-theme/`，或用 `LOTUS_STAR_RAIL_CHALLENGE_THEME_DIR` 指定资源目录。缺少素材时使用模板底色、星标和系统字体。头像与关卡敌人图来自米游社响应中的官方 CDN。头像请求单独进行，无需发送登录信息。角色名称优先取米游社响应，随后使用部署中的星铁抽卡资料及模块自带的名称表补齐。

## 原实现和素材来源

- 指令、战绩请求与数据映射来自 Lotus-ReFactor `eaf7675324dae64e51652bf9669ef93247d02b42` 的 `apps/profileQuery.js`、`core/intercept/personal-query.js` 和 `services/starRailChallenge/service.js`。挑战图由同版本 `core/render/starrail-abyss.js` 迁入。版权归 MOPELotus。
- 深渊模板设计依据是 Miao-Yunzai `ac73baa0ca079d7fcacc158a9746774de497a102` 的 `plugins/genshin/resources/html/abyss/abyss-floor.html` 与 `abyss-floor.css`。原背景、星标及字体来自同版本 `plugins/genshin/resources/img/abyss` 与 `plugins/genshin/resources/font`，由运行方按素材授权提供。 [Miao-Yunzai](https://gitee.com/yoimiya-kokomi/Miao-Yunzai)
- 抽卡记录版式、卡池说明及挑战角色 ID 名称表使用了 Miao-Plugin 的代码和元数据，保留原 MIT 许可。挑战名称表仅摘录 `resources/meta-sr/character/data.json` 的 ID 和名称，来源为生产旧分支固定版本。 [Miao-Plugin 角色数据](https://github.com/MOPELotus/miao-plugin/blob/2860761836069af80bacee5cb85b6dd2e91ea0b0/resources/meta-sr/character/data.json) · [MIT 许可](LICENSES/Miao-Plugin-MIT.txt)
- [星铁官方异相仲裁玩法说明](https://www.hoyolab.com/article/41091494)
