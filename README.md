# dsh-rea-gate

REA registers roughly 263 `mcp__rea__*` tools on every DSH session. Most sessions never use them, and their schemas cost context on every request. This bundle keeps REA installed once for the whole host and decides **per workspace and per session** whether those tools are visible to the model. The default is off.

## What it does

- Hides REA's tools from a session by restricting that agent's tool set, not by uninstalling anything.
- Remembers the choice per workspace directory, so later sessions in the same project inherit it.
- Turns the tools on mid-session without restarting DSH.
- Ships a management console in three places: the sidebar **REA** panel, the **Plugins → dsh-rea-gate** detail page, and a session-header chip.
- Registers a `rea_gate` agent tool with `status`, `on`, `off`, `install`, `update` and `uninstall` actions.

## Requirements

- DSH `>=0.2.3-alpha.2 <0.3.0-0` (declared as `engines.dsh`).
- The REA CLI (`rea-agents`) for the install and update actions. Gating itself works whenever REA is already registered with DSH.
- Node.js 20 or newer, which DSH already requires.

## Install

Open **Plugins → Discover**, search for `REA`, and install it there. Restart DSH after installing so the bundle loads.

From a CLI profile, the equivalent command is:

```sh
dsh plugin --profile <profile> add dsh-rea-gate
```

The Desktop app owns its `desktop` profile and refuses `dsh plugin --profile desktop`, so use Discover there.

## Usage

Open the **REA** row in the sidebar, the plugin's detail page under **Plugins**, or the **REA** chip in a session header. All three control the same state.

The agent can also use the tool directly:

```text
rea_gate status
rea_gate on
rea_gate off remember=false
```

State lives in `$DSH_HOME/rea-gate.json`:

```json
{ "default": false, "workspaces": { "/path/to/project": true } }
```

`default` applies when no workspace rule matches. `on` and `off` save the workspace choice unless `remember: false` is passed.

## How the gate works

On `agent/created` the plugin reads the state file. For a workspace whose gate is closed it calls `agent.ctx.tools.restrict({ deny: [...] })` with the exact `mcp__rea__*` names currently registered, so those tools disappear from the model's tool list and stop costing schema tokens. Turning the gate on mid-session exposes them again without a restart.

## Permissions and side effects

- **Install** runs `rea setup --client dsh --yes`. When the `rea` command is missing it first runs `npm install --global rea-agents@latest`.
- **Uninstall** removes the registrations and skill files REA created for DSH. With `removePackage: true` it also runs `npm uninstall --global rea-agents`.
- The engine panel can write REA environment variables (`GHIDRA_INSTALL_DIR`, `JAVA_HOME`, `REA_APKTOOL_COMMAND`, …) into the DSH registration.
- Its HTTP routes live under `/api/dsh-rea-gate/` and are only reachable through the authenticated owner connection.

## Development

```sh
node --test tests/
```

The tests use a small React stand-in, so no browser is needed.

## 中文

REA 会向每个会话注册约 263 个 `mcp__rea__*` 工具，大多数会话用不到，schema 还会占用上下文。这个插件让 REA 在宿主中只安装一次，按工作区和会话决定工具是否对模型可见，默认关闭。

- 安装：在 **插件 → 发现** 里搜索 REA 安装，装完重启 DSH；命令行环境用 `dsh plugin --profile <profile> add dsh-rea-gate`。Desktop 的 `desktop` profile 由应用管理，请走「发现」。
- 使用：侧栏 **REA**、插件详情页、会话顶部胶囊，或 `rea_gate` 工具（`status` / `on` / `off` / `install` / `update` / `uninstall`）。
- 状态：`$DSH_HOME/rea-gate.json`，按工作区记住选择；`remember: false` 只改当前会话。
- 注意：`install` 会执行 `rea setup --client dsh --yes`，缺 CLI 时先 `npm install --global rea-agents@latest`；`uninstall` 会清理 REA 为 DSH 创建的注册和技能文件。

完整中文说明见 [docs/DETAIL.md](docs/DETAIL.md)。

## License

MIT
