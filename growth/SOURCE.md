# 星铁养成计算素材

卡片根据 TimeRainStarSky/Yunzai-genshin 固定提交 `0290a17cd42c52671e3130fe4a0a5aa38a64faa4` 的 `resources/html/calculator/calculator-sr.html`、`calculator-sr.css` 还原布局。用户可在 `LOTUS_STAR_RAIL_GROWTH_THEME_DIR` 指定自己有权使用的旧 `resources/` 目录。历史部署模板可位于 `data/starrail/genshin-theme/`。

有旧资源时使用 `img/other/bg{3,4,5}.png`、`font/tttgbnumber.ttf`、`html/calculator/skillbg.png`，并从旧 CSS 读取行迹行底图。未配置或文件缺损时用 Skia 绘制背景、图标框及文字，字体采用系统中文后备字体。角色、行迹与材料图片通过宿主已限制的官方图片读取链加载。仓库只存绘制代码。
