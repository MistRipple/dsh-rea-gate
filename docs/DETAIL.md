# REA 管理

在侧栏打开 **REA**，或在 **插件 → REA 管理** 中操作。REA 在宿主中共享一个 MCP 服务。门控按会话决定工具是否进入模型上下文，新会话默认关闭。

## 安装与更新

面板显示当前 REA 版本和 DSH 注册状态。安装后先用 **检查更新** 查询 npm 稳定版。发现新版时会显示可更新的版本，更新后以本机读回的版本为准。已是最新版时可以手动重新检查。

| 操作 | 行为 |
|---|---|
| 安装 REA | 已有 CLI 时运行 `rea setup --client dsh --yes`。找不到 CLI 时，先通过 `npm install --global rea-agents@latest` 安装并自动定位全局 bin 目录，再注册到 DSH。 |
| 重装最新版 / 重新安装 REA | 未注册但本机保留 CLI，或 `rea` 命令存在却无法运行（如 Node.js 缺失或版本过旧）时，面板展示具体原因并提供从 npm 重新安装最新版 `rea-agents` 并注册到 DSH 的入口。 |
| 检查更新 | 读取当前 npm registry 的稳定版标签。 |
| 更新 REA | 使用 REA 自带的 `rea update`，随后读取实际版本。 |
| 注册到 DSH / 修复注册 | 对已安装的命令行工具运行 DSH setup。注册状态正常时也可在 **DSH 集成维护** 一行手动重新注册。 |
| 卸载 REA 集成 | 在 **DSH 集成维护** 一行选择卸载，并确认影响范围。默认仅清理 REA 为各客户端创建的注册和技能文件；勾选后可同时执行 `npm uninstall --global rea-agents` 彻底卸载命令行包。 |

维护命令完成后面板会回读本机状态，并在顶部状态卡片中汇总当前版本、DSH 注册状态与宿主已加载的 MCP 工具数量。若磁盘注册和工具加载不同步，可先点击 **重新检测**；差异仍在时，重新打开 DSH 以重建 MCP 连接。

## 会话开关

- **新会话默认设置**只有一个开关，决定之后新建的会话是否启用 REA，不会改动正在运行的对话。不再有按工作区的单独规则；旧版本保存的规则会被忽略。
- **输入框左下角的 REA 下拉**（位于权限选择右侧）即时应用，只影响当前会话，不保存任何规则；未安装时置灰，安装在面板里完成。助手通过 `rea_gate` 的 `on` / `off` 切换时同样只影响当前会话，不能修改保存的默认值。助手只能使用 `status`、`on`、`off`，安装、更新、卸载只能在本面板操作。
- 用 `rea_gate status` 确认当前会话可见工具数。门控根据宿主当时已注册的精确工具名设置可见性。

偏好保存在 `$DSH_HOME/rea-gate.json`，例如：

```json
{ "default": false }
```

## 分析引擎与依赖

**重新检测**会重新运行 `rea doctor --client dsh --format json` 并探测本机常见位置和 PATH 中的 Java、apktool 与 adb 状态。体检最长可能运行 30 秒，期间面板先显示缓存结果并提示「体检仍在后台运行」，完成后自动更新。引擎按场景分组展示；点击任意条目可展开中文配置说明、带路径输入框的环境变量配置（保存后自动同步到 DSH 注册并重新检测）、结构化的 `rea doctor` 诊断信息及官方下载/配置入口（已配置但检测异常的条目会默认展开提醒）。

`Ghidra`、`Java (JDK)`、`apktool` 和 `adb` 在 macOS、Linux、Windows 上都支持在展开详情里点击 **一键安装**，体验一致：安装后自动探测路径并写入配置，再重新检测。已安装 Homebrew 的 macOS 走 `brew install`；其余情况（Linux、Windows，以及没有 Homebrew 的 macOS）改为下载官方发布包：Ghidra 和 apktool 来自 GitHub Release，Temurin 21 来自 adoptium.net，platform-tools 来自 dl.google.com。只有厂商给出 SHA-256（Google 为 SHA-1）且下载内容与之一致才会解压，解压到 `$DSH_HOME/rea-engines/`，不需要管理员权限。Ghidra 和 apktool 在找不到 JDK 时会先装 Temurin。没有免费安装包的引擎（Hopper、IDA、jadx、Kuna），以及厂商没有提供对应构建的 ARM 版 Linux/Windows，只显示官方链接和路径输入框。JDK 检测会查看各平台的常见位置和上述下载目录。

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

每个路径输入框右侧都有一个文件夹图标，点击后弹出系统自带的选择对话框，选中的路径只会填进输入框，仍需点击 **保存并检测** 才生效。`GHIDRA_INSTALL_DIR` 和 `JAVA_HOME` 选文件夹（优先使用 DSH 自带的目录选择器），其余变量选文件（macOS 上的 `.app` 也可选）。macOS 使用系统对话框，Windows 使用资源管理器对话框，Linux 使用 `zenity`，没有时改用 `kdialog`；两者都没有时提示直接填写路径。

环境变量必须填写真实存在的绝对路径（支持 `~`），路径类型不符会在保存前被拒绝。其中 `REA_*_COMMAND`、`HOPPER_LAUNCHER_PATH` 等指向 REA 会执行的程序，请只指向可信软件。

没有上游检查结果的条目会报告环境变量是否已设置。Java、apktool 和 adb 也可能通过 `PATH` 找到。引擎只在相关分析中需要，JavaScript / Electron 和 .NET 静态检查可以直接开始。

## 维护接口

这些路由由宿主认证后的 owner API 提供。门控插件自身只依赖 `tools`，通过子插件按需接入 `connection`。

| 路由 | 请求 | 返回或行为 |
|---|---|---|
| `/api/dsh-rea-gate/state` | GET | 注册（含 `healthy` 判定）、版本、默认值、`exposed` 和引擎。用 `session=<id>` 查询会话可见数，用 `refresh=1` 重新体检。`checks: "pending"` 表示体检仍在后台运行，面板会自动重读。 |
| `/api/dsh-rea-gate/toggle` | POST | `{ open }` 设置默认值，`{ session, open }` 只切换该会话。带 `workspace` 或 `remember` 的请求会被拒绝（400）。 |
| `/api/dsh-rea-gate/toggle` | POST | `{ action }` 支持 `install`、`reinstall`、`update`、`uninstall`（可选 `removePackage: true`）、`check-update`、`install-engine`（`engine`）、`set-env`（`values`）与 `pick-path`（`kind` 为 `dir` 或 `file`，弹出本机选择对话框，只返回选中的路径）。 |
| `/api/dsh-rea-gate/diagnose` | GET | `graph.selfPresent` 表示宿主模块图中是否包含本插件（供命令行或开发排查；面板底部的 **高级诊断** 仅展示 DSH 注册配置路径）。 |

门控关闭的会话会被定期复查：REA 晚于会话连接、或更新后新增的工具会被补充隐藏。若关闭的会话仍能看到 REA 工具，状态里的 `exposed` 为 true，下拉显示「REA 关（未生效）」。

实机挂载通过客户端 `Slots.listSubTree` 确认，查询 `sidebar.panellist` 的 occupants 是否包含 `rea-gate`。若重合成后仍显示旧面板，退出并重新打开 Desktop 以载入新版组件。
