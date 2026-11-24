# dsh-rea-gate

REA registers roughly 263 `mcp__rea__*` tools on every DSH session. Most sessions never use them, and their schemas cost context on every request. This bundle keeps REA installed once for the whole host and decides **per session** whether those tools are visible to the model. New sessions start closed unless you change the default.

## What it does

- Hides REA's tools from a session by restricting that agent's tool set, not by uninstalling anything.
- Keeps one global default for new sessions, and a separate switch for every running session.
- Turns the tools on mid-session without restarting DSH.
- Ships a management console in three places: the sidebar **REA** panel, the **Plugins → dsh-rea-gate** detail page, and a dropdown in each session's input box.
- Registers a `rea_gate` agent tool with `status`, `on` and `off` actions. Install, update and uninstall are deliberately not available to the agent; they run global package-manager commands and live in the REA panel only.

## Requirements

- DSH `>=0.2.2-rc.1 <0.3.0-0 || >=0.2.3-alpha.2 <0.3.0-0` (declared as `engines.dsh`).
  The range is split in two because semver only lets a prerelease satisfy a bound that names the same `major.minor.patch`: the first half covers the 0.2.2 release candidates and stable 0.2.x, the second the 0.2.3 alphas. Live-tested on 0.2.3-alpha.2; the 0.2.2 line (the npm `latest` tag, 0.2.2-rc.5) was checked against its published packages — every host and client API the bundle uses is present there — but not run in a live Desktop.
- The REA CLI (`rea-agents`) for the install and update actions. Gating itself works whenever REA is already registered with DSH.
- Node.js 20 or newer, which DSH already requires.
- macOS or Linux. The gate itself is plain JavaScript and should work anywhere DSH does; the install, update and engine helpers have Windows handling (`.cmd` launchers) that has not been tested on Windows. Homebrew engine installs are macOS only.

## Install

Open **Plugins → Discover**, search for `REA`, and install it there. Restart DSH after installing so the bundle loads.

From a CLI profile, the equivalent command is:

```sh
dsh plugin --profile <profile> add dsh-rea-gate
```

The Desktop app owns its `desktop` profile and refuses `dsh plugin --profile desktop`, so use Discover there.

## Usage

Open the **REA** row in the sidebar, the plugin's detail page under **Plugins**, or the **REA** dropdown at the lower left of a session's input box, right of the permission control. The panel and the plugin page set how new sessions start; the dropdown switches only its own session.

The agent can also use the tool directly:

```text
rea_gate status
rea_gate on
rea_gate off
```

State lives in `$DSH_HOME/rea-gate.json`:

```json
{ "default": false }
```

`default` is what a new session starts with. It applies only to sessions created afterwards: flipping it never changes the tool list of a conversation that is already running. There are no per-workspace rules; a rule saved by an older version is ignored and dropped the next time the file is written.

Every session has its own switch. The input-box dropdown and `rea_gate on` / `off` change only that session and save nothing, and a session keeps its choice across a plugin reload. The agent cannot change the saved default.

## How the gate works

On `agent/created` the plugin reads the state file. For a session that starts closed it calls `agent.ctx.tools.restrict({ deny: [...] })` with the exact `mcp__rea__*` names currently registered, so those tools disappear from the model's tool list and stop costing schema tokens. Turning the gate on mid-session exposes them again without a restart. If REA connects after a session was created, or an update adds tools, a periodic sweep hides the late arrivals from closed sessions; the dropdown shows `REA 关（未生效）` if a closed session can still see REA tools. Reloading the plugin re-applies each session's own choice to sessions that are already running, and a disposed session drops its bookkeeping.

## Permissions and side effects

- **Install** runs `rea setup --client dsh --yes`. When the `rea` command is missing it first runs `npm install --global rea-agents@latest`, which downloads and installs an unpinned package from the npm registry.
- **Uninstall** runs `rea uninstall`, which has no per-client option: it removes the registrations and skill files REA created for **every** client it configured, not only DSH. The panel asks for confirmation first. With the extra checkbox it also runs `npm uninstall --global rea-agents`.
- **Agent access** is limited to `status`, `on` and `off`. Install, update and uninstall are reachable only through the owner's panel.
- **Check for updates** runs `npm view rea-agents` and so contacts the npm registry; **Update** runs `rea update`.
- **One-click engine installs** (macOS with Homebrew) run `brew install ghidra`, `brew install openjdk@21`, `brew install apktool` or `brew install --cask android-platform-tools`.
- The engine panel can write REA environment variables (`GHIDRA_INSTALL_DIR`, `JAVA_HOME`, `REA_APKTOOL_COMMAND`, …) into the DSH registration. Values must be existing absolute paths of the right kind (`~` is expanded); anything else is refused before it is saved. Several of these variables name programs REA will execute, so only point them at software you trust.
- Panel messages follow the browser language (Chinese for `zh-*`, English otherwise).
- Its HTTP routes live under `/api/dsh-rea-gate/` and are only reachable through the authenticated owner connection.

## Development

```sh
npm test
```

The tests use a small React stand-in, so no browser is needed.

## 中文

REA 会向每个会话注册约 263 个 `mcp__rea__*` 工具，大多数会话用不到，schema 还会占用上下文。这个插件让 REA 在宿主中只安装一次，按会话决定工具是否对模型可见，默认关闭。

- 安装：在 **插件 → 发现** 里搜索 REA 安装，装完重启 DSH；命令行环境用 `dsh plugin --profile <profile> add dsh-rea-gate`。Desktop 的 `desktop` profile 由应用管理，请走「发现」。
- 使用：侧栏 **REA**、插件详情页、输入框左下角的 REA 下拉，或 `rea_gate` 工具（仅 `status` / `on` / `off`；安装、更新、卸载只能在面板里操作）。
- 状态：`$DSH_HOME/rea-gate.json`。只保存一个全局默认（新会话的初始状态）。输入框里的 REA 下拉和助手调用的 `rea_gate on/off` 都只改当前会话，互不影响，也不写文件；改全局默认不会动运行中的会话。旧版本保存的工作区规则会被忽略。
- 注意：`install` 会执行 `rea setup --client dsh --yes`，缺 CLI 时先 `npm install --global rea-agents@latest`；`uninstall` 执行 `rea uninstall`，会清理 REA 为**所有客户端**创建的注册和技能文件（该命令不支持按客户端限定），面板会先要求确认。`检查更新` 会访问 npm registry，一键安装引擎会执行 `brew install`。引擎环境变量必须是真实存在的绝对路径（支持 `~`）。界面语言跟随浏览器（中文或英文）。

完整中文说明见 [docs/DETAIL.md](docs/DETAIL.md)。

## License

MIT
