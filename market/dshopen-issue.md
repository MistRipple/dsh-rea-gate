**插件地址 / Plugin link**

`dsh-rea-gate` — https://github.com/MistRipple/dsh-rea-gate

**简短说明 / Summary**

REA 会向每个 DSH 会话注册约 263 个 `mcp__rea__*` 工具，大多数会话用不到，schema 还会占用上下文。这个插件让 REA 在宿主中只安装一次，按会话决定工具是否对模型可见，默认关闭；侧栏面板、插件详情页和输入框左下角的下拉都能开关，agent 也可以直接调用 `rea_gate` 工具。

Keep REA installed once per host and gate its MCP tools per session instead of uninstalling it.

**补充信息 / Additional details**

- Logo: https://github.com/MistRipple/dsh-rea-gate/blob/main/icon.svg
- 已验证 DSH：0.2.3-alpha.2（macOS Desktop）
- 许可证：MIT
- npm：`dsh-rea-gate@0.3.0`
- `engines.dsh`：`>=0.2.3-alpha.2 <0.3.0-0`
- 插件本身不主动联网。用户在面板里点击时才会访问网络或执行本机命令：`检查更新` 运行 `npm view rea-agents`；`install` / `update` 调用本机 REA CLI，缺 CLI 时执行 `npm install --global rea-agents@latest`；`卸载` 运行 `rea uninstall`（会清理 REA 为所有客户端创建的注册）；一键安装引擎在 macOS 上执行 `brew install`。
- 这些操作只在面板里提供，agent 工具 `rea_gate` 仅有 `status` / `on` / `off`。
