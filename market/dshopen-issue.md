**插件地址 / Plugin link**

`dsh-rea-gate` — https://github.com/MistRipple/dsh-rea-gate

**简短说明 / Summary**

REA 会向每个 DSH 会话注册约 263 个 `mcp__rea__*` 工具，大多数会话用不到，schema 还会占用上下文。这个插件让 REA 在宿主中只安装一次，按工作区和会话决定工具是否对模型可见，默认关闭；侧栏面板、插件详情页和会话顶部胶囊都能开关，agent 也可以直接调用 `rea_gate` 工具。

Keep REA installed once per host and gate its MCP tools per workspace and session instead of uninstalling it.

**补充信息 / Additional details**

- Logo: https://github.com/MistRipple/dsh-rea-gate/blob/main/icon.svg
- 已验证 DSH：0.2.3-alpha.2（macOS Desktop）
- 许可证：MIT
- npm：`dsh-rea-gate@0.3.0`
- `engines.dsh`：`>=0.2.3-alpha.2 <0.3.0-0`
- 插件自身不联网；`install` / `update` 会调用本机 REA CLI，缺 CLI 时执行 `npm install --global rea-agents@latest`。
