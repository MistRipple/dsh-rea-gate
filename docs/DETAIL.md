# REA 管理

在侧栏打开 **REA**，或在 **插件 → REA 管理** 中操作。REA 在宿主中共享一个 MCP 服务。门控按会话决定工具是否进入模型上下文，未单独设置的工作区默认关闭。

## 安装与更新

面板显示当前 REA 版本和 DSH 注册状态。安装后先用 **检查更新** 查询 npm 稳定版。发现新版时会显示可更新的版本，更新后以本机读回的版本为准。已是最新版时可以手动重新检查。

| 操作 | 行为 |
|---|---|
| 安装 REA | 已有 CLI 时运行 `rea setup --client dsh --yes`。找不到 CLI 时，先通过 `npm install --global rea-agents@latest` 安装并自动定位全局 bin 目录，再注册到 DSH。 |
| 重装最新版 | 未注册但本机保留 CLI 时，可直接从 npm 重新安装最新版 `rea-agents` 并注册到 DSH。 |
| 检查更新 | 读取当前 npm registry 的稳定版标签。 |
| 更新 REA | 使用 REA 自带的 `rea update`，随后读取实际版本。 |
| 注册到 DSH / 修复注册 | 对已安装的命令行工具运行 DSH setup。注册状态正常时也可在 **DSH 集成维护** 一行手动重新注册。 |
| 卸载 REA 集成 | 在 **DSH 集成维护** 一行选择卸载，并确认影响范围。默认仅清理 REA 为各客户端创建的注册和技能文件；勾选后可同时执行 `npm uninstall --global rea-agents` 彻底卸载命令行包。 |

维护命令完成后面板会回读本机状态，并在 **运行状态与更新** 中汇总当前版本、DSH 注册状态与宿主已加载的 MCP 工具数量。若磁盘注册和工具加载不同步，可先点击 **重新检测**；差异仍在时，重新打开 DSH 以重建 MCP 连接。

## 工作区与会话

- **会话与工作区设置**支持配置新会话默认值，同时列出已记录独立偏好的工作区，可直接切换开关或点击 **重置** 恢复继承全局默认。全局默认只影响之后新建的会话，不会改动正在运行的对话；工作区规则的修改会立即作用到该目录下所有运行中的会话。目录已被删除的规则会标记为 **目录不存在**，可直接重置。
- **工作区按真实目录记忆**：符号链接会被解析，git worktree 与其主仓库共用一条规则，子目录里的会话继承最近的上级规则，并且在这样的会话里切换胶囊会更新那条上级规则。
- **会话顶部的 REA 胶囊**即时应用，并保存该工作区的规则。助手通过 `rea_gate` 的 `on` / `off` 切换时默认只影响当前会话，需要同时保存工作区规则时设置 `remember: true`。助手只能使用 `status`、`on`、`off`，安装、更新、卸载只能在本面板操作。
- 用 `rea_gate status` 确认当前会话可见工具数。门控根据宿主当时已注册的精确工具名设置可见性。

偏好保存在 `$DSH_HOME/rea-gate.json`，例如：

```json
{ "default": false, "workspaces": { "/path/to/project": true } }
```

## 分析引擎与依赖

**重新检测**会重新运行 `rea doctor --client dsh --format json` 并探测本机 Homebrew / PATH 中的 Java、apktool 与 adb 状态。体检最长可能运行 30 秒，期间面板先显示缓存结果并提示「体检仍在后台运行」，完成后自动更新。引擎按场景分组展示；点击任意条目可展开中文配置说明、带路径输入框的环境变量配置（保存后自动同步到 DSH 注册并重新检测）、结构化的 `rea doctor` 诊断信息及官方下载/配置入口（已配置但检测异常的条目会默认展开提醒）。

在已安装 Homebrew 的 macOS 上，`Ghidra`、`Java (JDK)`、`apktool` 和 `adb` 支持在展开详情中直接点击 **一键安装**（安装后自动探测路径并写入配置）。

| 引擎 | 宿主环境变量 |
|---|---|
| Ghidra | `GHIDRA_INSTALL_DIR`、`JAVA_HOME` |
| Hopper | `HOPPER_LAUNCHER_PATH` |
| IDA | `REA_IDA_MCP_CONFIG` |
| Java | `JAVA_HOME` |
| jadx | `REA_JADX_MCP_JAR`、`JAVA_HOME` |
| apktool | `REA_APKTOOL_COMMAND` |
| adb | `REA_ADB_PATH` |
| Kuna | `REA_KUNA_COMMAND` |

每个条目都带有对应的下载或配置入口。REA、Ghidra、Hopper、IDA、Java、jadx、apktool、platform-tools 和 Kuna 均从各自的官方或上游页面打开。IDA 额外提供 IDA MCP 配置指南。

环境变量必须填写真实存在的绝对路径（支持 `~`），路径类型不符会在保存前被拒绝。其中 `REA_*_COMMAND`、`HOPPER_LAUNCHER_PATH` 等指向 REA 会执行的程序，请只指向可信软件。

没有上游检查结果的条目会报告环境变量是否已设置。Java、apktool 和 adb 也可能通过 `PATH` 找到。引擎只在相关分析中需要，JavaScript / Electron 和 .NET 静态检查可以直接开始。

## 维护接口

这些路由由宿主认证后的 owner API 提供。门控插件自身只依赖 `tools`，通过子插件按需接入 `connection`。

| 路由 | 请求 | 返回或行为 |
|---|---|---|
| `/api/dsh-rea-gate/state` | GET | 注册（含 `healthy` 判定）、版本、默认值、工作区规则（含 `missing`）、`exposed` 和引擎。用 `session=<id>` 查询会话可见数，用 `refresh=1` 重新体检。`checks: "pending"` 表示体检仍在后台运行，面板会自动重读。 |
| `/api/dsh-rea-gate/toggle` | POST | `{ open }` 设置默认值，`{ workspace, open }` 设置工作区规则，`{ session, open, remember? }` 切换会话。 |
| `/api/dsh-rea-gate/toggle` | POST | `{ action }` 支持 `install`、`reinstall`、`update`、`uninstall`（可选 `removePackage: true`）、`check-update`、`install-engine`（`engine`）、`set-env`（`values`）与 `reset-workspace`（`workspace`）。 |
| `/api/dsh-rea-gate/diagnose` | GET | `graph.selfPresent` 表示宿主模块图中是否包含本插件。面板底部的 **高级诊断** 可直接查询。 |

没有工作区目录的会话通过胶囊切换时只对当前会话生效，不会改动全局默认；此时显式传 `remember: true` 会被拒绝，因为无法保存工作区规则。

门控关闭的会话会被定期复查：REA 晚于会话连接、或更新后新增的工具会被补充隐藏。若关闭的会话仍能看到 REA 工具，状态里的 `exposed` 为 true，胶囊显示「REA 关（未生效）」。

实机挂载通过客户端 `Slots.listSubTree` 确认，查询 `sidebar.panellist` 的 occupants 是否包含 `rea-gate`。若重合成后仍显示旧面板，退出并重新打开 Desktop 以载入新版组件。
