# 星铁队伍伤害引擎

- HSR_Nous 固定在 `00185ddc4d57039894caf19467f602e716329e40`。计算使用项目固定版本的 Bun 启动独立 TypeScript 工作进程，读取随模块提供的规则表与公开模板。规则解析、编译、战斗模拟及测试均可在本地用 Bun 运行。 [上游提交与许可](https://github.com/pzc2004/HSR_Nous/blob/00185ddc4d57039894caf19467f602e716329e40/LICENSE)
- `vendor/rulebook.yaml` 与 `vendor/data/library` 保留固定版原规则与模板，许可见 `vendor/LICENSE.HSR_Nous`。飞霄的两处雷狩接入原有追加攻击行动，使追加攻击能触发装备事件。`catalog.json` 是模板名、真实角色 ID、命途与装备名索引。`defaults.json` 记录本项目用于缺少个人面板的 E0、80 级、S1 基准配装。
- `native` 的 `fixed-reference.json` 测试数据由固定版原引擎在隔离环境生成，覆盖行动值调度、战斗状态、伤害拆解、事件字段和公开时间线。
- 目标是各自行动的精英假人，轮次使用首轮 150、以后每轮 100 行动值。默认策略优先消耗可用战技点，终结技另由引擎调度。已有模板公开 caveats 随卡片显示，DPS 按每轮伤害计算。结果是该规则、基准配装和自动行动策略下的估算，数值与以往引擎或游戏实战会不同。
