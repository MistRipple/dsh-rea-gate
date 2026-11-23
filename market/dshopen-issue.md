# dshopen.org 收录申请（复制到 issue 表单）

提交地址：https://github.com/polang233/dsh-plugin-index/issues/new?template=plugin-add.yml

## 插件地址 / Plugin link

```text
dsh-rea-gate
https://github.com/MistRipple/dsh-rea-gate
```

## 简短说明 / Summary

```text
REA 会向每个 DSH 会话注册约 263 个 mcp__rea__* 工具，大多数会话用不到，schema 还会占用上下文。
这个插件让 REA 在宿主中只安装一次，按工作区和会话决定工具是否对模型可见，默认关闭。
侧栏面板、插件详情页和会话顶部胶囊都能开关，agent 也可以直接调用 rea_gate 工具。
Keep REA installed once per host and gate its MCP tools per workspace and session instead of uninstalling it.
```

## 插件实际效果 / Screenshots

（建议附 1–3 张真实截图：侧栏 REA 面板、会话顶部 REA 胶囊、插件详情页；提交前遮盖路径和密钥。）

## 补充信息 / Additional details

```text
Logo: https://github.com/MistRipple/dsh-rea-gate/blob/main/icon.svg
已验证 DSH 版本：0.2.3-alpha.2（macOS Desktop）
许可证：MIT
包：dsh-rea-gate@0.3.0（npm）
声明：engines.dsh = >=0.2.3-alpha.2 <0.3.0-0；dsh.bundle.patch 指向 cordis.patch.yml
插件自身不联网；install/update 动作会调用本机 REA CLI（rea setup / rea update），
缺少 CLI 时会执行 npm install --global rea-agents@latest。
```
