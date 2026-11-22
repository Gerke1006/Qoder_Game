# Qoder_Game 融合版交付说明

## 项目内容

- 基于队友最新完整玩法源码融合。
- 保留并升级原创中世纪手绘风预加载界面。
- 已完成主菜单、战斗 HUD、波次横幅、奖励、暂停和结算界面的视觉统一。
- 支持真实加载进度、资源失败降级、键盘操作和 `prefers-reduced-motion`。

## 运行方式

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
```

## 验证状态

- `tsc --noEmit` 通过。
- `vite build` 通过。
- 主菜单、玩法说明、战斗、奖励、暂停、结算和不同窗口尺寸已完成浏览器回归。
- 压缩包不包含 `.git`、`node_modules` 和 `dist`，避免携带本地历史、缓存和生成文件。
