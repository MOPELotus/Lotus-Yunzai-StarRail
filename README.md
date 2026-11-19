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

## 角色面板

- `*更新面板` 从米游社读取当前档案下的国服星铁角色面板，保存新快照并返回角色列表。
- `*面板`、`*角色面板` 查看已保存的角色列表。
- `*三月七面板`、`*三月详情` 查看角色属性、技能、星魂、光锥和遗器。可用喵喵原有角色别名。各指令可加档案编号，例如 `*更新面板2`、`*银枝详情 2`。

旧喵喵快照 `data/PlayerData/sr/<UID>.json` 可直接只读查询，也可用 `LOTUS_STAR_RAIL_LEGACY_PANEL_DIR` 指定快照目录。查询仍使用当前 QQ 档案已同步的 UID。新面板写入 `data/starrail/panels/<QQ>/<UID>.json`，保存角色面板字段。旧面板在角色、光锥和遗器元数据齐全时，用喵喵静态规则补算综合属性并标注来源。缺少复算所需的数据时，仍可查看旧快照中的装备和行迹，缺项属性保留空值。更新后优先使用米游社明细。

模块保留喵喵面板列表和角色详情的 HTML/CSS 结构。可用 `LOTUS_STAR_RAIL_PANEL_THEME_DIR` 指定获准使用的原喵喵 `resources/`。默认复用 `LOTUS_STAR_RAIL_GACHA_THEME_DIR` 或 `data/starrail/miao-theme/`。原图片、字体与数据各自遵循其授权。面板拉取接受米游社官方 CDN 头像；同时存在本机主题图时优先用本机图。

面板列表、详情样式、角色别名及遗器词条转换来自 Miao-Plugin `2860761836069af80bacee5cb85b6dd2e91ea0b0` 的 `apps/profile/ProfileList.js`、`models/serv/api/MysPanelHSR{Api,Data,Mappings}.js`、`models/artis/ArtisAttr.js`、`resources/character/profile-{list,detail}.{html,css}`、`resources/common/{common.css,layout/elem.html}` 及 `resources/meta-sr/character/alias.js`。保留 MIT 许可。 [Miao-Plugin 固定版本](https://github.com/MOPELotus/miao-plugin/tree/2860761836069af80bacee5cb85b6dd2e91ea0b0) · [MIT 许可](LICENSES/Miao-Plugin-MIT.txt)

旧面板复算及行迹布局沿用同版 Miao-Plugin 的 `models/attr/{Attr,AttrData}.js`、`models/Character.js`、`models/character/CharTalent.js`、`models/Weapon.js`、`models/artis/ArtisAttr.js`、`apps/profile/ProfileDetail.js` 与 `resources/meta-sr/{artifact,weapon}/` 里的静态规则。打包的 `panel-theme/static-panel-rules.json` 只摘录套装静态属性键值及光锥静态叠影表索引。装备数值仍从本地授权主题元数据读取。

## 遗器评分

使用 `*银枝遗器` 或 `*三月圣遗物2` 查看指定角色的逐件评分、词条权重和总分。沿用面板指令的角色别名与档案编号。评分读取当前档案关联的已保存面板，也可以直接读取对应 UID 的旧喵喵面板，无需新的米游社请求。缺词条的遗器单独提示。总评级沿用原实现，以六个位置的平均分确定。

评分、固定位置与元素主词条判定来自同版 Miao-Plugin 的 `models/artis/{ArtisMark,ArtisMarkCfg,ArtisAttr}.js` 和 `resources/meta-sr/artifact/{meta.js,meta.json,artis-mark.js}`，椒丘、风堇、缇宝的特殊规则来自其各自角色目录的 `artis.js`。卡图沿用 `apps/profile/ProfileArtis.js` 与 `resources/character/artis-mark.{html,css}`。模块随附角色满级基础属性的必要字段及遗器数值规则，来源为同版星铁元数据。角色立绘、遗器图和字体继续使用上节的本机主题或官方 CDN。 [Miao-Plugin 固定版本](https://github.com/MOPELotus/miao-plugin/tree/2860761836069af80bacee5cb85b6dd2e91ea0b0) · [MIT 许可](LICENSES/Miao-Plugin-MIT.txt)

## 模拟跃迁

- `*单抽`、`*十连`、`*百连` 进入当前角色活动跃迁。可用 `*单抽2`、`*十连光锥2` 选择当期指定卡池，也可用 `*十连常驻` 进行群星跃迁。
- `*我的星轨票` 查询模拟票数。默认每天北京时间 04:00 补至 100 张专票和 10 张通票。每个 QQ 共用票数，同一会话内的同类活动卡池共用保底，角色、光锥和常驻各有独立保底。真实账号及抽卡档案无需绑定。
- 模拟使用基础概率、硬保底和近似软保底。内置 4.7 第一期官方 UP 与一套固定常驻名单，供聊天内娱乐使用。自选非 UP、积分、商城及游戏内持有情况不参与模拟。当前期次结束时，活动卡池等待配置更新，常驻池仍可用。
- 模拟存档默认写入宿主 `data/starrail/simulation/<QQ>/1.json`，可用 `LOTUS_STAR_RAIL_WARP_STATE_DIR` 指定目录。旧模拟 Redis 余额和保底可保留作原部署备份，本模块从自己的存档读写。
- `LOTUS_STAR_RAIL_WARP_BANNERS` 可指向 UTF-8 JSON 文件，替换内置活动日历。每项包含 `slot`（1–4）、`start` 和 `end`（带时区的 ISO 时间）、`character`、`cone`、四星角色数组 `characters4` 和四星光锥数组 `cones4`。同一编号的有效区间不能重叠，结束时刻不再开放。单个卡池可按以下格式配置。

  ```json
  [
    {
      "slot": 1,
      "start": "2026-11-11T11:00:00+08:00",
      "end": "2026-12-22T15:00:00+08:00",
      "character": "星神★阿哈",
      "cone": "当第一声『阿哈』响起",
      "characters4": ["艾丝妲", "玲可", "驭空"],
      "cones4": ["宇宙市场趋势", "天才们的休憩", "黑夜如影随行"]
    }
  ]
  ```

模拟逻辑和结果图由 Lotus-Yunzai 编写。角色和光锥插图按现有本机主题目录读取，发行仓只包含渲染代码。内置活动数据来自游戏发布方的 [4.7 版本活动跃迁](https://www.taptap.cn/moment/868905398936014841) 与 [4.7 版本更新说明](https://www.taptap.cn/moment/869248465039788964)。首日开始时间按公告预计维护完成时刻配置。
