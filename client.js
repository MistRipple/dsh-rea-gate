window.__ModuleLoader__.load({
  id: 'dsh-rea-gate',
  factory(require) {
    const React = require('react')
    const { Button, IconChevronDownOutlineRegular, IconRefreshOutlineRegular, Menu, Pill, StateDot, Switch, writeClipboard } = require('@deepseek-ai/dsh-client-ui-primitives')
    const h = React.createElement

    // The panel follows the browser language: Chinese for zh-*, English otherwise.
    // Source strings are Chinese; `t` looks up the English text and falls back
    // to the source string. `__REA_GATE_LOCALE__` overrides the detection.
    const LOCALE = (() => {
      const forced = globalThis.__REA_GATE_LOCALE__
      const language = typeof forced === 'string' ? forced : globalThis.navigator?.language ?? ''
      return /^zh/i.test(language) ? 'zh' : 'en'
    })()

    // English text for the Chinese source strings. A '{}' marks a value filled in at that position.
    const EN = {
      '正在安装并注册 REA…': 'Installing and registering REA…',
      'REA 安装与注册已完成': 'REA installed and registered',
      '正在通过 npm 重新安装并注册最新版 REA…': 'Reinstalling the latest REA from npm and registering it…',
      'REA 已重新安装并注册到 DSH': 'REA reinstalled and registered with DSH',
      '正在更新 REA…': 'Updating REA…',
      'REA 更新命令已完成': 'REA update finished',
      '正在卸载 REA 集成…': 'Removing the REA integration…',
      'REA 集成已卸载': 'REA integration removed',
      '正在卸载 REA 集成与命令行包…': 'Removing the REA integration and command-line package…',
      'REA 集成与命令行包已彻底卸载': 'REA integration and command-line package fully removed',
      '正在重新注册 REA…': 'Registering REA again…',
      'REA 注册修复步骤已完成': 'REA registration repair finished',
      '正在保存…': 'Saving…',
      '无法保存会话默认设置，请重试。': 'Could not save the session default. Please try again.',
      '已保存': 'Saved',
      '正在通过 Homebrew 安装（可能需要几分钟）…': 'Installing with Homebrew (this can take a few minutes)…',
      '安装完成并已自动检测本机环境': 'Installed. The local environment was detected automatically.',
      '安装失败，请查看输出或点击官方链接手动下载。': 'Installation failed. Check the output or download it manually from the official link.',
      '正在保存路径并重新检测…': 'Saving the path and re-checking…',
      '路径配置已保存并重新检测': 'Path saved and re-checked',
      '无法保存路径配置，请重试。': 'Could not save the path. Please try again.',
      '例如 /opt/homebrew/opt/ghidra/libexec': 'e.g. /opt/homebrew/opt/ghidra/libexec',
      '例如 /opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home': 'e.g. /opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home',
      '例如 /usr/local/bin/hopper': 'e.g. /usr/local/bin/hopper',
      '例如 ~/.config/ida/mcp.json': 'e.g. ~/.config/ida/mcp.json',
      '例如 ~/tools/jadx-headless-mcp-0.7.1-all.jar': 'e.g. ~/tools/jadx-headless-mcp-0.7.1-all.jar',
      '例如 /opt/homebrew/bin/apktool': 'e.g. /opt/homebrew/bin/apktool',
      '例如 /opt/homebrew/bin/adb': 'e.g. /opt/homebrew/bin/adb',
      '例如 /usr/local/bin/kuna': 'e.g. /usr/local/bin/kuna',
      '原生二进制分析': 'Native binary analysis',
      'Android 逆向': 'Android reverse engineering',
      '共享运行时依赖': 'Shared runtime dependencies',
      '需 Java': 'Needs Java',
      'NSA 开源反编译与原生二进制分析框架。': 'Open-source decompiler and native binary analysis framework from the NSA.',
      '下载并解压 Ghidra 12.2+ 发行包，将解压后的根目录路径配置到环境变量 GHIDRA_INSTALL_DIR，同时确保具备兼容版本的 JDK。': 'Download and unpack Ghidra 12.2+, set GHIDRA_INSTALL_DIR to the unpacked root directory, and make sure a compatible JDK is available.',
      '下载 Ghidra': 'Download Ghidra',
      '供 Ghidra 和 jadx 使用的运行时环境。': 'Runtime used by Ghidra and jadx.',
      '若系统 PATH 中尚未配置兼容的 JDK，请安装 Temurin JDK 并设置 JAVA_HOME；如 PATH 已可直接调用 java，REA 也会尝试自动识别。': 'If no compatible JDK is on PATH, install Temurin JDK and set JAVA_HOME. If java already runs from PATH, REA will try to detect it automatically.',
      '下载 JDK': 'Download JDK',
      'macOS / Linux 交互式反汇编与反编译工具。': 'Interactive disassembler and decompiler for macOS and Linux.',
      '安装 Hopper 后运行 rea setup 自动接入，或将启动器路径配置到环境变量 HOPPER_LAUNCHER_PATH。': 'After installing Hopper, run rea setup to connect it automatically, or set HOPPER_LAUNCHER_PATH to the launcher path.',
      '下载 Hopper': 'Download Hopper',
      '原生二进制逆向平台，通过独立 IDA MCP 桥接。': 'Native binary reverse-engineering platform, bridged through a separate IDA MCP.',
      '安装 IDA 并按照指南配置上游 IDA MCP 注册 JSON，然后将该 JSON 文件路径设置到环境变量 REA_IDA_MCP_CONFIG。': 'Install IDA, configure the upstream IDA MCP registration JSON by following the guide, then set REA_IDA_MCP_CONFIG to that JSON file path.',
      '获取 IDA Free': 'Get IDA Free',
      'IDA MCP 配置指南': 'IDA MCP setup guide',
      'MCP 配置指南': 'MCP setup guide',
      'Android DEX / APK 反编译引擎。': 'Android DEX / APK decompilation engine.',
      '从上游仓库下载 jadx-headless-mcp 发行版 JAR 并核对完整性，再将该 JAR 的绝对路径配置到环境变量 REA_JADX_MCP_JAR。': 'Download the jadx-headless-mcp release JAR from the upstream repository, verify its integrity, then set REA_JADX_MCP_JAR to its absolute path.',
      '下载 jadx MCP': 'Download jadx MCP',
      '解码 APK 资源文件与 AndroidManifest 清单。': 'Decodes APK resources and the AndroidManifest.',
      '安装 apktool 并加入系统 PATH，或通过环境变量 REA_APKTOOL_COMMAND 指定可执行文件绝对路径。': 'Install apktool and add it to PATH, or set REA_APKTOOL_COMMAND to the absolute path of the executable.',
      '安装 apktool': 'Install apktool',
      '连接与调试 Android 真机和模拟器。': 'Connects to and debugs Android devices and emulators.',
      '安装 Android platform-tools 并加入 PATH，或通过环境变量 REA_ADB_PATH 指定 adb 可执行文件路径。': 'Install Android platform-tools and add it to PATH, or set REA_ADB_PATH to the adb executable.',
      '下载 platform-tools': 'Download platform-tools',
      '轻量级原生二进制反编译引擎。': 'Lightweight native binary decompilation engine.',
      '获取对应平台的 Kuna 可执行文件后，将其绝对路径配置到环境变量 REA_KUNA_COMMAND。': 'Get the Kuna executable for your platform, then set REA_KUNA_COMMAND to its absolute path.',
      '下载 Kuna': 'Download Kuna',
      '无法读取本机状态，请重试。': 'Could not read the local state. Please try again.',
      '无法查询 npm 稳定版，请重试。': 'Could not look up the stable npm version. Please try again.',
      '操作失败，请重新检测本机状态。': 'The action failed. Re-check the local state.',
      '复制': 'Copy',
      '已复制': 'Copied',
      '复制失败': 'Copy failed',
      '安装 REA': 'Install REA',
      '通过 npm 安装命令行工具并注册到 DSH。': 'Installs the command-line tool through npm and registers it with DSH.',
      '重新检测本机': 'Re-check this machine',
      '无法读取 REA 命令行状态。': 'Could not read the REA command-line status.',
      '注册到 DSH': 'Register with DSH',
      '已找到本机 REA，可直接注册。': 'REA was found on this machine and can be registered directly.',
      '修复注册': 'Repair registration',
      'DSH 注册需要重新配置。': 'The DSH registration needs to be configured again.',
      '更新 REA': 'Update REA',
      '发现 npm 稳定版 {}': 'Stable npm version {} found',
      '重新检查': 'Check again',
      '已是最新版': 'Up to date',
      '当前版本高于 npm 稳定版 {}': 'The installed version is newer than the stable npm version {}',
      '重试检查更新': 'Retry update check',
      '检查更新': 'Check for updates',
      'npm 稳定版 {}，请重新检测本机版本。': 'Stable npm version {}. Re-check the local version.',
      '可随时检查 npm 稳定版更新。': 'You can check for stable npm updates at any time.',
      '卸载 REA 集成': 'Remove the REA integration',
      '此操作会清理本机所有客户端中的 REA 注册信息，确认继续吗？': 'This clears the REA registrations of every client on this machine. Continue?',
      '将移除': 'Will remove',
      'REA 为 DSH 及其他客户端创建的注册和技能文件，以及本机全局 rea-agents 命令行包': 'The registrations and skill files REA created for DSH and other clients, plus the global rea-agents command-line package',
      'REA 为 DSH 及其他客户端创建的注册和技能文件': 'The registrations and skill files REA created for DSH and other clients',
      '将保留': 'Will keep',
      '门控偏好与本地分析引擎': 'Gate preferences and local analysis engines',
      'REA 命令行软件包、门控偏好与本地分析引擎': 'The REA command-line package, gate preferences and local analysis engines',
      '同时卸载本机 rea-agents 命令行包（npm uninstall -g rea-agents）': 'Also remove the rea-agents command-line package (npm uninstall -g rea-agents)',
      '取消': 'Cancel',
      '彻底卸载': 'Remove completely',
      '确认卸载': 'Confirm removal',
      '关闭提示': 'Dismiss',
      '命令输出': 'Command output',
      'DSH 已注册': 'Registered with DSH',
      'DSH 未注册': 'Not registered with DSH',
      'DSH 注册异常': 'DSH registration needs attention',
      'DSH 注册待确认': 'DSH registration unconfirmed',
      '本机注册已移除，但宿主仍显示已加载工具，可重新检测确认。': 'The local registration was removed, but the host still shows loaded tools. Re-check to confirm.',
      '工具尚未加载到当前宿主，重新检测后如仍未生效可重启 DSH。': 'The tools are not loaded in this host yet. If re-checking does not help, restart DSH.',
      '运行状态与更新': 'Status and updates',
      '未安装': 'Not installed',
      '版本待确认': 'Version unconfirmed',
      '宿主已加载 {} 个工具': 'Host has loaded {} tools',
      '宿主未加载': 'Not loaded in host',
      '正在查询 npm 稳定版…': 'Looking up the stable npm version…',
      '检查中…': 'Checking…',
      '重装最新版': 'Reinstall latest',
      'REA 安装指南': 'REA install guide',
      'DSH 集成维护': 'DSH integration maintenance',
      '重新注册': 'Re-register',
      '卸载集成': 'Remove integration',
      '新会话默认设置': 'Default for new sessions',
      '新会话默认启用 REA': 'Enable REA in new sessions by default',
      '仅对之后新建的会话生效；正在运行的会话可通过输入框左下角的 REA 下拉单独切换。': 'It applies only to sessions created afterwards; switch a running one with the REA dropdown at the lower left of its input box.',
      '已启用': 'Enabled',
      '已关闭': 'Disabled',
      '可用': 'Available',
      '需检查': 'Needs attention',
      '已配置，待验证': 'Configured, not verified',
      '未配置': 'Not configured',
      '待验证': 'Not verified',
      '已由宿主环境变量设置（可填写绝对路径覆盖）': 'Set by a host environment variable (enter an absolute path to override)',
      '填写 {} 的绝对路径': 'Enter the absolute path for {}',
      '已设置': 'Set',
      '未设置': 'Not set',
      '复制变量': 'Copy variable',
      '复制环境变量 {}': 'Copy environment variable {}',
      '{} 路径': '{} path',
      '保存 {}': 'Save {}',
      '保存并检测': 'Save and check',
      '清除 {}': 'Clear {}',
      '清除': 'Clear',
      '可选分析引擎。': 'Optional analysis engine.',
      '配置说明': 'Setup',
      '环境变量与路径配置': 'Environment variables and paths',
      '{} 环境变量': '{} environment variables',
      'Homebrew 安装': 'Homebrew install',
      '正在执行 {}（可能需要几分钟）…': 'Running {} (this can take a few minutes)…',
      '本机检测通过，在启用 REA 的会话中可直接调用此引擎。': 'The local check passed. This engine can be used directly in sessions where REA is enabled.',
      '异常诊断（rea doctor）': 'Problem details (rea doctor)',
      '检测详情（rea doctor）': 'Check details (rea doctor)',
      '复制 SHA-256': 'Copy SHA-256',
      '复制 SHA-256 校验值': 'Copy the SHA-256 checksum',
      '安装中…': 'Installing…',
      '一键安装 {}': 'Install {} with one click',
      '其他引擎': 'Other engines',
      '可用 {} / {}': '{} / {} available',
      '需检查 {}': '{} need attention',
      '上次检测 {}': 'Last checked {}',
      '点击条目展开配置与详情': 'Select an entry to expand its settings and details',
      '分析引擎与依赖': 'Analysis engines and dependencies',
      '正在重新检测本机状态…': 'Re-checking this machine…',
      '体检仍在后台运行，完成后会自动更新…': 'The check is still running in the background and will update when it finishes…',
      '检测中…': 'Checking…',
      '重新检测': 'Re-check',
      '{} 项': '{} items',
      '用 REA 查看 <应用路径> 的 Electron 入口模块和 preload 脚本。': 'Use REA to inspect the Electron entry module and preload script of <app path>.',
      '用 REA 列出 <文件路径> 中 .NET 程序集的公开类型和入口点。': 'Use REA to list the public types and entry points of the .NET assembly <file path>.',
      'REA 会话示例': 'REA session examples',
      '开启 REA 后可直接发给助手的逆向分析提示词模板': 'Prompt templates you can send to the assistant once REA is enabled',
      'REA 文档': 'REA docs',
      '复制示例：{}': 'Copy example: {}',
      '助手调用 rea_gate 的 on / off 只对本次会话生效，不会改动新会话的默认设置。': 'rea_gate on / off called by the assistant applies to this session only and never changes the default for new sessions.',
      '高级诊断': 'Advanced diagnostics',
      '查看 DSH 配置文件路径与宿主客户端模块图状态': 'View the DSH config file path and the host client module graph status',
      'DSH 注册配置路径': 'DSH registration config path',
      '复制路径': 'Copy path',
      '复制 DSH 配置路径': 'Copy the DSH config path',
      '插件诊断': 'Plugin diagnostics',
      '检查宿主是否已发布面板模块。': 'Check whether the host has published the panel module.',
      '正在检查模块图…': 'Checking the module graph…',
      '无法读取模块图，请重试。': 'Could not read the module graph. Please try again.',
      '模块已加入图（{}）': 'Module is in the graph ({})',
      '模块尚未加入图。': 'Module is not in the graph yet.',
      '检查模块图': 'Check module graph',
      '正在读取本机状态…': 'Reading the local state…',
      '重试': 'Retry',
      'REA 管理': 'REA management',
      '管理本机 REA 集成、新会话默认设置与可选分析引擎': 'Manage the local REA integration, the default for new sessions and optional analysis engines',
      '无法切换 REA': 'Could not switch REA',
      '门控已关闭，但本会话仍可见 {} 个 REA 工具': 'The gate is closed, but this session can still see {} REA tools',
      '本会话可见 {} 个 REA 工具': 'This session can see {} REA tools',
      'REA 开': 'REA on',
      'REA 关（未生效）': 'REA off (not effective)',
      'REA 关': 'REA off',
      'REA 未安装': 'REA not installed',
      'REA 未安装，请在侧栏的 REA 面板中安装': 'REA is not installed; install it from the REA panel in the sidebar',
      '开启 REA': 'Turn REA on',
      '关闭 REA': 'Turn REA off',
    }

    const t = (chinese) => (LOCALE === 'zh' ? chinese : EN[chinese] ?? chinese)
    // Tagged form for strings with values: the key is the text with '{}' in place of each value.
    function tt(strings, ...values) {
      const key = strings.join('{}')
      const text = LOCALE === 'zh' ? key : EN[key] ?? key
      let index = 0
      return text.replace(/\{\}/g, () => String(values[index++] ?? ''))
    }

    const PANEL_ID = 'rea-gate'
    // `rea doctor` may run for up to 30 s on the host; keep asking until it settles.
    const FOLLOW_UP_MS = 2_000
    const MAX_FOLLOW_UPS = 20
    // The chip re-reads this often while its page is visible.
    // Matches the shipped permission trigger next to it in the composer tool row.
    const COMPOSER_CSS = `
.rea-composer-gate { display: inline-flex; min-width: 0; }
.rea-composer-trigger {
  display: inline-flex; align-items: center; gap: 4px; min-width: 0; max-width: 220px; height: 28px;
  padding: 0 4px 0 12px; border: none; border-radius: var(--dsw-radius-sm); outline: none;
  background: transparent; color: var(--dsw-alias-label-secondary);
  font-size: 13px; line-height: 20px; font-weight: 500; cursor: pointer;
}
@media (hover: hover) {
  .rea-composer-trigger:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
}
.rea-composer-trigger:focus-visible {
  box-shadow: 0 0 0 2px var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
}
.rea-composer-trigger:disabled { color: var(--dsw-alias-label-dimmed); cursor: default; }
.rea-composer-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rea-composer-chevron {
  display: inline-flex; flex: 0 0 auto; color: var(--dsw-alias-label-caption); transition: transform 120ms ease;
}
.rea-composer-chevron-open { transform: rotate(180deg); }
`
    const CHIP_POLL_MS = 5_000

    const CSS = `
      .rea-gate {
        color: var(--dsw-alias-label-primary);
        font-size: 13px;
        line-height: 20px;
        min-width: 0;
        container-type: inline-size;
      }
      /* Matches DSH first-level system pages (PluginManagerPage / TaskManagerPage). */
      .rea-gate-page {
        width: 100%;
        height: 100%;
        min-width: 0;
        min-height: 0;
        overflow-x: hidden;
        overflow-y: auto;
        scrollbar-gutter: stable;
        background: var(--dsw-alias-bg-base);
        --dsh-scrollbar-width: 9px;
        --dsh-scrollbar-thumb-border: 2px;
      }
      .rea-gate-page-inner {
        box-sizing: border-box;
        width: 100%;
        max-width: 960px;
        margin: 0 auto;
        padding: 0 clamp(24px, 4vw, 48px) 48px;
      }
      @media (max-width: 767px) {
        .rea-gate-page-inner {
          padding-inline: 20px;
        }
      }
      .rea-gate h1, .rea-gate h3, .rea-gate h4, .rea-gate p, .rea-gate dl, .rea-gate dd { margin: 0; }
      .rea-gate h1 { font-size: 20px; font-weight: 500; line-height: 28px; }
      .rea-gate h3 { font-size: 14px; font-weight: 500; line-height: 20px; color: var(--dsw-alias-label-primary); }
      .rea-gate-controls { display: grid; gap: 24px; }
      .rea-gate-page .rea-gate-controls { gap: 28px; }

      .rea-gate .rea-page-head {
        display: flex; align-items: center; gap: 12px;
        padding-top: 28px; margin-bottom: 24px;
      }
      [data-platform='darwin'] .rea-gate-page .rea-page-head {
        padding-top: calc(28px + var(--dsh-frame-top-clearance, 0px));
      }
      .rea-gate .rea-logo {
        display: grid; place-items: center; flex: none;
        width: 36px; height: 36px; border-radius: var(--dsw-radius-sm, 8px);
        border: 0.5px solid var(--dsw-alias-settings-card-stroke, var(--dsw-alias-border-l2));
        background: var(--dsw-alias-bg-module-platform, var(--dsw-alias-bg-layer-2));
      }
      .rea-gate .rea-page-sub { margin-top: 2px; }

      .rea-gate .rea-heading {
        display: flex; align-items: flex-end; justify-content: space-between;
        gap: 8px 16px; flex-wrap: wrap; margin-bottom: 10px;
      }
      .rea-gate .rea-heading-main { min-width: 0; }
      .rea-gate .rea-heading-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 2px; }
      .rea-gate .rea-muted {
        color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
        font-size: 12px; line-height: 18px; overflow-wrap: anywhere;
      }
      .rea-gate .rea-label { font-size: 13px; font-weight: 500; line-height: 20px; }

      .rea-gate .rea-group {
        border: 0.5px solid var(--dsw-alias-settings-card-stroke, var(--dsw-alias-border-l2));
        background: var(--dsw-alias-settings-card-fill, var(--dsw-alias-bg-layer-1));
        border-radius: var(--dsw-radius-md, 12px);
        overflow: hidden;
        min-width: 0;
      }
      .rea-gate .rea-row {
        display: flex; align-items: center; justify-content: space-between;
        gap: 10px 16px; padding: 12px 16px; min-height: 28px;
      }
      .rea-gate .rea-row + .rea-row,
      .rea-gate .rea-divider { border-top: 0.5px solid var(--dsw-alias-border-l2); }
      .rea-gate .rea-content { padding: 12px 16px; min-width: 0; }
      .rea-gate .rea-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .rea-gate .rea-list { margin: 0; padding: 0; list-style: none; }
      .rea-gate .rea-stack { display: grid; gap: 8px; }
      .rea-gate .rea-status { display: inline-flex; align-items: center; gap: 6px; flex: none; }

      .rea-gate .rea-setting-row { flex-wrap: wrap; }
      .rea-gate .rea-setting-info { flex: 1 1 220px; min-width: 0; }
      .rea-gate .rea-setting-info p { margin-top: 2px; }
      .rea-gate .rea-setting-actions { margin-inline-start: auto; justify-content: flex-end; }

      /* Badges & Pills */
      .rea-gate .rea-badge {
        display: inline-flex; align-items: center; gap: 5px;
        padding: 2px 8px; border-radius: 999px;
        font-size: 11.5px; font-weight: 500; line-height: 16px;
        white-space: nowrap; font-variant-numeric: tabular-nums;
        background: var(--dsw-alias-bg-module-platform, var(--dsw-alias-bg-layer-2));
        color: var(--dsw-alias-label-secondary);
        border: 0.5px solid transparent;
      }
      .rea-gate .rea-badge[data-tone="ready"] {
        background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 12%, transparent);
        color: var(--dsw-alias-state-success-primary);
        border-color: color-mix(in srgb, var(--dsw-alias-state-success-primary) 24%, transparent);
      }
      .rea-gate .rea-badge[data-tone="attention"] {
        background: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #d97706) 13%, transparent);
        color: var(--dsw-alias-state-warn-primary, #b45309);
        border-color: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #d97706) 28%, transparent);
      }
      .rea-gate .rea-badge[data-tone="info"] {
        background: color-mix(in srgb, var(--dsw-alias-state-business-primary, #2563eb) 10%, transparent);
        color: var(--dsw-alias-state-business-primary, var(--dsw-alias-label-primary));
        border-color: color-mix(in srgb, var(--dsw-alias-state-business-primary, #2563eb) 22%, transparent);
      }
      .rea-gate .rea-version-pill {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 11.5px; line-height: 16px;
        padding: 2px 7px;
        border-radius: var(--dsw-radius-xs, 4px);
        background: var(--dsw-alias-bg-module-platform, var(--dsw-alias-bg-layer-2));
        color: var(--dsw-alias-label-primary);
        font-variant-numeric: tabular-nums;
      }

      /* Overview / Lifecycle */
      .rea-gate .rea-overview-title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .rea-gate .rea-overview-name { font-size: 14px; font-weight: 500; line-height: 22px; }
      .rea-gate .rea-overview-hint { margin-top: 4px; }
      .rea-gate .rea-maintenance-bar {
        padding: 8px 16px;
        background: var(--dsw-alias-bg-module-platform, var(--dsw-alias-bg-layer-2));
      }
      .rea-gate .rea-danger-ghost { color: var(--dsw-alias-state-error-primary) !important; }
      @media (hover: hover) {
        .rea-gate .rea-danger-ghost:hover:not(:disabled) {
          background: var(--dsw-alias-interactive-bg-hover-danger) !important;
        }
      }
      .rea-gate .rea-danger-solid {
        background: var(--dsw-alias-state-error-primary) !important;
        border-color: var(--dsw-alias-state-error-primary) !important;
        color: #fff !important;
      }

      /* Feedback Banner */
      .rea-gate .rea-feedback { display: grid; gap: 8px; }
      .rea-gate .rea-feedback-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
      .rea-gate .rea-dismiss {
        appearance: none; border: none; background: transparent; cursor: pointer;
        color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary)); font-size: 14px; line-height: 1;
        padding: 3px 6px; border-radius: var(--dsw-radius-xs, 4px); flex: none;
      }
      @media (hover: hover) {
        .rea-gate .rea-dismiss:hover {
          background: var(--dsw-alias-interactive-bg-hover);
          color: var(--dsw-alias-label-primary);
        }
      }
      .rea-gate .rea-output {
        max-height: 10em; overflow: auto; margin: 0; padding: 8px 10px;
        border-radius: var(--dsw-radius-sm, 8px);
        background: var(--dsw-alias-bg-module-platform, var(--dsw-alias-bg-layer-2));
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        white-space: pre-wrap; overflow-wrap: anywhere; font-size: 11.5px; line-height: 17px;
      }
      .rea-gate .rea-error { color: var(--dsw-alias-state-error-primary); }

      /* Subheaders inside cards */
      .rea-gate .rea-subhead {
        display: flex; align-items: center; justify-content: space-between; gap: 8px;
        padding: 7px 16px;
        background: var(--dsw-alias-bg-module-platform, var(--dsw-alias-bg-layer-2));
        font-size: 12px; font-weight: 500; line-height: 18px;
        color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
        font-variant-numeric: tabular-nums;
      }

      /* Engine Accordion List */
      .rea-gate .rea-engine-item { min-width: 0; }
      .rea-gate .rea-engine-item + .rea-engine-item { border-top: 0.5px solid var(--dsw-alias-border-l2); }
      .rea-gate .rea-engine-trigger {
        appearance: none; border: none; background: transparent; width: 100%; text-align: start;
        font: inherit; color: inherit; cursor: pointer;
        display: flex; align-items: center; justify-content: space-between; gap: 12px;
        padding: 12px 16px;
        transition: background 140ms var(--ds-ease-in-out, cubic-bezier(0.4, 0, 0.2, 1));
      }
      @media (hover: hover) {
        .rea-gate .rea-engine-trigger:hover {
          background: var(--dsw-alias-interactive-bg-hover);
        }
      }
      .rea-gate .rea-engine-trigger:focus-visible {
        outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
        outline-offset: -2px;
      }
      .rea-gate .rea-engine-left { display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1; }
      .rea-gate .rea-engine-mark {
        display: grid; place-items: center; flex: none;
        width: 22px; height: 22px; border-radius: 6px;
        background: var(--dsw-alias-bg-module-platform, var(--dsw-alias-bg-layer-2));
        color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
        font-size: 12px; font-weight: 600;
      }
      .rea-gate .rea-engine-mark[data-state="ready"] {
        background: var(--dsw-alias-state-success-primary);
        color: #fff;
      }
      .rea-gate .rea-engine-mark[data-state="attention"] {
        background: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #d97706) 16%, transparent);
        color: var(--dsw-alias-state-warn-primary, #b45309);
      }
      .rea-gate .rea-engine-text { min-width: 0; flex: 1; }
      .rea-gate .rea-engine-title-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
      .rea-gate .rea-engine-dep {
        font-size: 11px; line-height: 16px; padding: 0 6px; border-radius: var(--dsw-radius-xs, 4px);
        background: var(--dsw-alias-bg-module-platform, var(--dsw-alias-bg-layer-2));
        color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
      }
      .rea-gate .rea-engine-desc {
        margin-top: 2px;
        color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
        font-size: 12px; line-height: 18px;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .rea-gate .rea-engine-right { display: flex; align-items: center; gap: 10px; flex: none; }
      .rea-gate .rea-chevron {
        display: grid; place-items: center; flex: none;
        width: 20px; height: 20px;
        color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
        transition: transform 140ms var(--ds-ease-in-out, cubic-bezier(0.4, 0, 0.2, 1));
      }
      .rea-gate .rea-chevron[data-open="true"] { transform: rotate(90deg); }

      /* Expanded Engine Detail Drawer */
      .rea-gate .rea-engine-detail {
        margin: 0 16px 14px 50px;
        padding: 12px 14px;
        border-radius: var(--dsw-radius-sm, 8px);
        border: 0.5px solid var(--dsw-alias-border-l2);
        background: var(--dsw-alias-bg-module-platform, var(--dsw-alias-bg-layer-2));
        display: grid; gap: 12px;
      }
      .rea-gate .rea-detail-block { display: grid; gap: 6px; min-width: 0; }
      .rea-gate .rea-detail-label {
        font-size: 11px; font-weight: 500; line-height: 17px;
        color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
      }
      .rea-gate .rea-detail-guide { font-size: 12.5px; color: var(--dsw-alias-label-primary); line-height: 19px; }

      /* Env Var Chips & Path Config */
      .rea-gate .rea-env-list { display: grid; gap: 8px; }
      .rea-gate .rea-env-row {
        display: grid; gap: 8px;
        padding: 8px 10px; border-radius: var(--dsw-radius-sm, 8px);
        background: var(--dsw-alias-bg-base, var(--dsw-alias-bg-layer-1));
        border: 0.5px solid var(--dsw-alias-border-l2);
        min-width: 0;
      }
      .rea-gate .rea-env-head {
        display: flex; align-items: center; justify-content: space-between; gap: 8px; min-width: 0;
      }
      .rea-gate .rea-env-main { display: flex; align-items: center; gap: 8px; min-width: 0; flex-wrap: wrap; }
      .rea-gate .rea-env-code {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 12px; color: var(--dsw-alias-label-primary);
        overflow-wrap: anywhere;
      }
      .rea-gate .rea-env-state { font-size: 11.5px; color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary)); }
      .rea-gate .rea-env-state[data-set="true"] { color: var(--dsw-alias-state-success-primary); font-weight: 500; }
      .rea-gate .rea-env-edit {
        display: flex; align-items: center; gap: 6px; flex-wrap: wrap; min-width: 0;
      }
      .rea-gate .rea-path-input {
        flex: 1 1 200px; min-width: 0; height: 32px; box-sizing: border-box;
        padding: 0 10px;
        border: 0.5px solid var(--dsw-alias-border-l4, var(--dsw-alias-border-l2));
        border-radius: var(--dsw-radius-sm, 8px);
        background: var(--dsw-alias-bg-layer-3, var(--dsw-alias-bg-base));
        color: var(--dsw-alias-label-primary);
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 12px; line-height: 18px;
      }
      .rea-gate .rea-path-input::placeholder {
        color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
        font-family: inherit;
      }
      .rea-gate .rea-path-input:focus {
        outline: none;
        border-color: var(--dsw-alias-state-business-primary);
      }
      .rea-gate .rea-path-input:disabled { opacity: 0.6; }
      @media (pointer: coarse) {
        .rea-gate .rea-path-input { font-size: 16px; }
      }

      /* Diagnostic Callout inside Detail */
      .rea-gate .rea-diag-box {
        padding: 9px 11px; border-radius: var(--dsw-radius-sm, 8px);
        background: var(--dsw-alias-bg-base, var(--dsw-alias-bg-layer-1));
        border: 0.5px solid var(--dsw-alias-border-l2);
        border-inline-start: 2.5px solid var(--dsw-alias-border-l2);
        font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary);
        display: grid; gap: 8px;
      }
      .rea-gate .rea-diag-box[data-tone="attention"] {
        border-inline-start-color: var(--dsw-alias-state-warn-primary, #d97706);
        color: var(--dsw-alias-label-primary);
      }
      .rea-gate .rea-diag-box[data-tone="ready"] {
        border-inline-start-color: var(--dsw-alias-state-success-primary);
        color: var(--dsw-alias-label-primary);
      }
      .rea-gate .rea-hash-row {
        display: flex; align-items: center; justify-content: space-between; gap: 8px;
        padding: 5px 8px; border-radius: var(--dsw-radius-xs, 4px);
        background: var(--dsw-alias-bg-module-platform, var(--dsw-alias-bg-layer-2));
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 11.5px; min-width: 0;
      }
      .rea-gate .rea-hash-val { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
      .rea-gate .rea-inline-link {
        color: var(--dsw-alias-link, var(--dsw-alias-state-business-primary));
        text-decoration: none; font-weight: 500;
      }
      @media (hover: hover) {
        .rea-gate .rea-inline-link:hover { text-decoration: underline; }
      }

      /* Resource Links inside Detail & Headers */
      .rea-gate .rea-detail-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding-top: 2px; }
      .rea-gate .rea-download {
        display: inline-flex; align-items: center; gap: 4px;
        min-height: 28px; padding: 0 10px; border-radius: var(--dsw-radius-sm, 8px);
        border: 0.5px solid var(--dsw-alias-border-l2);
        background: var(--dsw-alias-bg-base, var(--dsw-alias-bg-layer-1));
        color: var(--dsw-alias-label-primary);
        font-size: 12px; font-weight: 500; text-decoration: none;
        transition: background 140ms var(--ds-ease-in-out, cubic-bezier(0.4, 0, 0.2, 1));
      }
      @media (hover: hover) {
        .rea-gate .rea-download:hover {
          background: var(--dsw-alias-interactive-bg-hover);
        }
      }
      .rea-gate .rea-download:focus-visible {
        outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
        outline-offset: 2px;
      }
      .rea-gate .rea-download-plain {
        border-color: transparent; background: transparent; padding-inline: 6px;
        color: var(--dsw-alias-link, var(--dsw-alias-state-business-primary)); font-weight: 400;
      }
      @media (hover: hover) {
        .rea-gate .rea-download-plain:hover {
          background: transparent;
          text-decoration: underline;
        }
      }

      /* Collapsible Cards (Usage Guide & Advanced Diagnostics) */
      .rea-gate .rea-disclosure-bar {
        display: flex; align-items: center; justify-content: space-between; gap: 12px;
        padding-inline-end: 16px;
        transition: background 140ms var(--ds-ease-in-out, cubic-bezier(0.4, 0, 0.2, 1));
      }
      @media (hover: hover) {
        .rea-gate .rea-disclosure-bar:hover {
          background: var(--dsw-alias-interactive-bg-hover);
        }
      }
      .rea-gate .rea-disclosure-main {
        appearance: none; border: none; background: transparent; flex: 1; min-width: 0;
        text-align: start; font: inherit; color: inherit; cursor: pointer;
        padding: 12px 0 12px 16px;
      }
      .rea-gate .rea-disclosure-main:focus-visible,
      .rea-gate .rea-disclosure-trigger:focus-visible {
        outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
        outline-offset: -2px;
      }
      .rea-gate .rea-disclosure-right {
        display: flex; align-items: center; gap: 10px; flex: none;
      }
      .rea-gate .rea-disclosure-chevron-btn {
        appearance: none; border: none; background: transparent; padding: 0;
        display: grid; place-items: center; cursor: pointer; color: inherit;
      }
      .rea-gate .rea-disclosure-trigger {
        appearance: none; border: none; background: transparent; width: 100%; min-width: 0;
        text-align: start; font: inherit; color: inherit; cursor: pointer;
        display: flex; align-items: center; justify-content: space-between; gap: 12px;
        padding: 12px 16px;
        transition: background 140ms var(--ds-ease-in-out, cubic-bezier(0.4, 0, 0.2, 1));
      }
      @media (hover: hover) {
        .rea-gate .rea-disclosure-trigger:hover {
          background: var(--dsw-alias-interactive-bg-hover);
        }
      }

      /* Prompt Example Cards */
      .rea-gate .rea-prompt-card {
        display: flex; align-items: center; justify-content: space-between; gap: 10px;
        padding: 9px 10px 9px 12px; border-radius: var(--dsw-radius-sm, 8px);
        background: var(--dsw-alias-bg-module-platform, var(--dsw-alias-bg-layer-2));
        min-width: 0;
      }
      .rea-gate .rea-prompt-text {
        display: flex; align-items: baseline; gap: 8px; min-width: 0; flex: 1;
        font-size: 12.5px; line-height: 19px; color: var(--dsw-alias-label-primary);
      }
      .rea-gate .rea-prompt-quote { color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary)); font-weight: 600; flex: none; }
      .rea-gate .rea-copy-btn { flex: none; min-width: 56px; justify-content: center; }
      .rea-gate .rea-copy-done { color: var(--dsw-alias-state-success-primary) !important; }

      /* Path row in Advanced Diagnostics */
      .rea-gate .rea-path-code {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 12px; line-height: 18px;
        color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
        overflow-wrap: anywhere;
      }

      /* Dialog */
      .rea-gate .rea-dialog {
        box-sizing: border-box; width: min(480px, calc(100vw - 32px));
        max-height: calc(100dvh - 32px); padding: 0; color: inherit;
        background: var(--dsw-alias-bg-layer-1, Canvas);
        border: 0.5px solid var(--dsw-alias-settings-card-stroke, var(--dsw-alias-border-l2));
        border-radius: var(--dsw-radius-lg, 16px);
        box-shadow: 0 16px 40px rgb(0 0 0 / 24%);
      }
      .rea-gate .rea-dialog::backdrop { background: var(--dsw-alias-bg-mask-1, rgb(0 0 0 / 24%)); }
      .rea-gate .rea-dialog-title { font-size: 15px; font-weight: 600; line-height: 22px; }
      .rea-gate .rea-dialog-body { padding: 0 16px 16px; display: grid; gap: 10px; overflow-wrap: anywhere; }
      .rea-gate .rea-impact-list {
        margin: 0; padding: 10px 12px; list-style: none; border-radius: var(--dsw-radius-sm, 8px);
        background: var(--dsw-alias-bg-module-platform, var(--dsw-alias-bg-layer-2));
        display: grid; gap: 6px; font-size: 12px; line-height: 18px;
      }
      .rea-gate .rea-impact-list li { display: flex; gap: 8px; }
      .rea-gate .rea-impact-tag { flex: none; font-weight: 600; min-width: 44px; }
      .rea-gate .rea-impact-remove { color: var(--dsw-alias-state-error-primary); }
      .rea-gate .rea-impact-keep { color: var(--dsw-alias-state-success-primary); }
      .rea-gate .rea-checkbox-row {
        display: flex; align-items: flex-start; gap: 8px; cursor: pointer;
        padding: 8px 10px; border-radius: var(--dsw-radius-sm, 8px);
        border: 0.5px solid var(--dsw-alias-border-l2);
        font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-primary);
      }
      .rea-gate .rea-checkbox-row input {
        margin-top: 2px; flex: none; accent-color: var(--dsw-alias-state-error-primary);
      }

      @container (max-width: 560px) {
        .rea-gate .rea-engine-desc { white-space: normal; }
        .rea-gate .rea-engine-detail { margin: 0 12px 12px 12px; }
        .rea-gate .rea-ws-item { flex-wrap: wrap; }
        .rea-gate .rea-ws-controls { margin-inline-start: auto; }
      }
    `

    const operations = {
      install: { pending: t('正在安装并注册 REA…'), success: t('REA 安装与注册已完成') },
      reinstall: { pending: t('正在通过 npm 重新安装并注册最新版 REA…'), success: t('REA 已重新安装并注册到 DSH') },
      update: { pending: t('正在更新 REA…'), success: t('REA 更新命令已完成') },
      uninstall: { pending: t('正在卸载 REA 集成…'), success: t('REA 集成已卸载') },
      'uninstall-full': { pending: t('正在卸载 REA 集成与命令行包…'), success: t('REA 集成与命令行包已彻底卸载') },
      repair: { pending: t('正在重新注册 REA…'), success: t('REA 注册修复步骤已完成') },
      preference: { pending: t('正在保存…'), failure: t('无法保存会话默认设置，请重试。'), success: t('已保存') },
      'install-engine': { pending: t('正在通过 Homebrew 安装（可能需要几分钟）…'), success: t('安装完成并已自动检测本机环境'), failure: t('安装失败，请查看输出或点击官方链接手动下载。') },
      'set-env': { pending: t('正在保存路径并重新检测…'), success: t('路径配置已保存并重新检测'), failure: t('无法保存路径配置，请重试。') },
    }

    function operationMeta(operation) {
      if (!operation) return null
      if (operation.startsWith('engine-install:')) return operations['install-engine']
      if (operation.startsWith('engine-env:')) return operations['set-env']
      return operations[operation] ?? null
    }

    const ENV_PLACEHOLDERS = {
      GHIDRA_INSTALL_DIR: t('例如 /opt/homebrew/opt/ghidra/libexec'),
      JAVA_HOME: t('例如 /opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home'),
      HOPPER_LAUNCHER_PATH: t('例如 /usr/local/bin/hopper'),
      REA_IDA_MCP_CONFIG: t('例如 ~/.config/ida/mcp.json'),
      REA_JADX_MCP_JAR: t('例如 ~/tools/jadx-headless-mcp-0.7.1-all.jar'),
      REA_APKTOOL_COMMAND: t('例如 /opt/homebrew/bin/apktool'),
      REA_ADB_PATH: t('例如 /opt/homebrew/bin/adb'),
      REA_KUNA_COMMAND: t('例如 /usr/local/bin/kuna'),
    }

    const ENGINE_GROUPS = [
      { id: 'native', title: t('原生二进制分析'), engines: ['ghidra', 'hopper', 'ida', 'kuna'] },
      { id: 'android', title: t('Android 逆向'), engines: ['jadx', 'apktool', 'adb'] },
      { id: 'runtime', title: t('共享运行时依赖'), engines: ['java'] },
    ]

    const providers = {
      ghidra: {
        name: 'Ghidra',
        dep: t('需 Java'),
        description: t('NSA 开源反编译与原生二进制分析框架。'),
        setup: t('下载并解压 Ghidra 12.2+ 发行包，将解压后的根目录路径配置到环境变量 GHIDRA_INSTALL_DIR，同时确保具备兼容版本的 JDK。'),
        href: 'https://github.com/NationalSecurityAgency/ghidra/releases',
        label: t('下载 Ghidra'),
      },
      java: {
        name: 'Java (JDK)',
        description: t('供 Ghidra 和 jadx 使用的运行时环境。'),
        setup: t('若系统 PATH 中尚未配置兼容的 JDK，请安装 Temurin JDK 并设置 JAVA_HOME；如 PATH 已可直接调用 java，REA 也会尝试自动识别。'),
        href: 'https://adoptium.net/temurin/releases/',
        label: t('下载 JDK'),
      },
      hopper: {
        name: 'Hopper',
        description: t('macOS / Linux 交互式反汇编与反编译工具。'),
        setup: t('安装 Hopper 后运行 rea setup 自动接入，或将启动器路径配置到环境变量 HOPPER_LAUNCHER_PATH。'),
        href: 'https://www.hopperapp.com/download.html',
        label: t('下载 Hopper'),
      },
      ida: {
        name: 'IDA',
        description: t('原生二进制逆向平台，通过独立 IDA MCP 桥接。'),
        setup: t('安装 IDA 并按照指南配置上游 IDA MCP 注册 JSON，然后将该 JSON 文件路径设置到环境变量 REA_IDA_MCP_CONFIG。'),
        href: 'https://hex-rays.com/ida-free',
        label: t('获取 IDA Free'),
        extraLinks: [
          {
            key: 'ida-guide',
            href: 'https://github.com/morluto/rea/blob/main/docs/providers/ida-provider.md',
            label: t('IDA MCP 配置指南'),
            text: t('MCP 配置指南'),
          },
        ],
      },
      jadx: {
        name: 'jadx',
        dep: t('需 Java'),
        description: t('Android DEX / APK 反编译引擎。'),
        setup: t('从上游仓库下载 jadx-headless-mcp 发行版 JAR 并核对完整性，再将该 JAR 的绝对路径配置到环境变量 REA_JADX_MCP_JAR。'),
        href: 'https://github.com/1013503897/jadx-headless-mcp/releases',
        label: t('下载 jadx MCP'),
      },
      apktool: {
        name: 'apktool',
        description: t('解码 APK 资源文件与 AndroidManifest 清单。'),
        setup: t('安装 apktool 并加入系统 PATH，或通过环境变量 REA_APKTOOL_COMMAND 指定可执行文件绝对路径。'),
        href: 'https://apktool.org/docs/install/',
        label: t('安装 apktool'),
      },
      adb: {
        name: 'adb',
        description: t('连接与调试 Android 真机和模拟器。'),
        setup: t('安装 Android platform-tools 并加入 PATH，或通过环境变量 REA_ADB_PATH 指定 adb 可执行文件路径。'),
        href: 'https://developer.android.com/tools/releases/platform-tools',
        label: t('下载 platform-tools'),
      },
      kuna: {
        name: 'Kuna',
        description: t('轻量级原生二进制反编译引擎。'),
        setup: t('获取对应平台的 Kuna 可执行文件后，将其绝对路径配置到环境变量 REA_KUNA_COMMAND。'),
        href: 'https://github.com/Noelo-Lab/kuna/releases',
        label: t('下载 Kuna'),
      },
    }

    async function call(path, init) {
      try {
        const response = await fetch('api/dsh-rea-gate/' + path, init)
        const result = await response.json()
        return response.ok || result?.ok === false ? result : null
      } catch {
        return null
      }
    }

    function post(body) {
      return call('toggle', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
    }

    function useGate() {
      const [state, setState] = React.useState(null)
      const [updateLookup, setUpdateLookup] = React.useState({ latest: null, checking: false, error: null })
      const [pending, setPending] = React.useState('load')
      const [feedback, setFeedback] = React.useState(null)
      // Reading and acting are tracked separately: a background re-read must
      // never swallow a click, and a click must not be undone by a read that
      // started before it finished.
      const reading = React.useRef(false)
      const acting = React.useRef(false)
      const epoch = React.useRef(0)
      const updateRequest = React.useRef(false)
      const followUps = React.useRef(0)
      const followTimer = React.useRef(null)
      const queuedLoad = React.useRef(null)

      React.useEffect(() => () => {
        if (followTimer.current) clearTimeout(followTimer.current)
      }, [])

      const load = React.useCallback(async (refresh = false, options = {}) => {
        if (reading.current) {
          // A requested re-check must not vanish because a background read is running.
          if (!options.silent) queuedLoad.current = Boolean(queuedLoad.current) || refresh
          return
        }
        reading.current = true
        const startedAt = epoch.current
        if (!options.silent) {
          followUps.current = 0
          setPending('load')
          setFeedback(null)
        }
        const next = await call(refresh ? 'state?refresh=1' : 'state')
        if (next && next.ok !== false) {
          // An action finished while this read was in flight; its result is newer.
          if (startedAt === epoch.current) setState(next)
          // A slow engine check answered with the cached view. Keep re-reading
          // until the background `rea doctor` settles (it may take up to 30 s)
          // instead of blocking the first paint or giving up after a few tries.
          if (next.checks === 'pending' && followUps.current < MAX_FOLLOW_UPS) {
            followUps.current += 1
            if (followTimer.current) clearTimeout(followTimer.current)
            followTimer.current = setTimeout(() => { void load(false, { silent: true }) }, FOLLOW_UP_MS)
            followTimer.current?.unref?.()
          }
        } else if (!options.silent) {
          setFeedback({ operation: 'load', error: true, title: t(t('无法读取本机状态，请重试。')) })
        }
        reading.current = false
        if (!options.silent) setPending(null)
        if (queuedLoad.current !== null) {
          const again = queuedLoad.current
          queuedLoad.current = null
          void load(again)
        }
      }, [])

      React.useEffect(() => { void load() }, [load])

      async function checkForUpdates() {
        if (updateRequest.current) return
        updateRequest.current = true
        setUpdateLookup(({ latest }) => ({ latest, checking: true, error: null }))
        const next = await post({ action: 'check-update' })
        if (next?.ok !== false && typeof next?.latest === 'string') {
          setUpdateLookup({ latest: next.latest, checking: false, error: null })
        } else {
          setUpdateLookup({
            latest: null, checking: false,
            error: { error: true, title: t('无法查询 npm 稳定版，请重试。'), output: next?.message },
          })
        }
        updateRequest.current = false
      }

      async function run(body, operation = body.action ?? 'preference') {
        if (acting.current) return false
        acting.current = true
        setPending(operation)
        setFeedback(null)
        const next = await post(body)
        epoch.current += 1
        if (typeof next?.installed === 'boolean') setState(next)
        const success = Boolean(next && next.ok !== false)
        const meta = operationMeta(operation)
        if (!success) {
          setFeedback({ operation, error: true, title: meta?.failure ?? t(t('操作失败，请重新检测本机状态。')), output: next?.message })
        } else if (meta?.success) {
          setFeedback({ operation, title: meta.success, output: next.message })
        }
        acting.current = false
        setPending(null)
        return success
      }

      const dismissFeedback = React.useCallback(() => setFeedback(null), [])
      const dismissUpdateError = React.useCallback(() => setUpdateLookup((prev) => ({ ...prev, error: null })), [])

      return { state, updateLookup, pending, feedback, run, load, checkForUpdates, dismissFeedback, dismissUpdateError }
    }

    function Chevron({ open }) {
      return h('span', { className: 'rea-chevron', 'data-open': String(Boolean(open)), 'aria-hidden': true },
        h('svg', { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none' },
          h('path', {
            d: 'M6 3.5L10.5 8L6 12.5',
            stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round',
          }),
        ),
      )
    }

    function Section({ title, meta, actions, children }) {
      return h('section', null,
        h('div', { className: 'rea-heading' },
          h('div', { className: 'rea-heading-main' },
            h('h3', null, title),
            meta && h('div', { className: 'rea-heading-meta' }, meta),
          ),
          actions,
        ),
        children,
      )
    }

    function Status({ state = 'idle', children }) {
      return h('span', { className: 'rea-status' }, h(StateDot, { state, size: 7 }), children)
    }

    function CopyButton({ text, label = t('复制'), copiedLabel = t('已复制'), ariaLabel }) {
      const [status, setStatus] = React.useState('idle')
      const timer = React.useRef(null)
      React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
      const copy = async (event) => {
        event?.stopPropagation?.()
        if (timer.current) clearTimeout(timer.current)
        try {
          if (writeClipboard) await writeClipboard(text)
          else await navigator.clipboard.writeText(text)
          setStatus('copied')
        } catch {
          setStatus('failed')
        }
        timer.current = setTimeout(() => setStatus('idle'), 1800)
        timer.current?.unref?.()
      }
      const caption = status === 'copied' ? copiedLabel : status === 'failed' ? t('复制失败') : label
      return h(Button, {
        variant: 'ghost',
        size: 'sm',
        className: status === 'copied' ? 'rea-copy-btn rea-copy-done' : 'rea-copy-btn',
        'aria-label': ariaLabel,
        onClick: copy,
      }, caption)
    }

    function DownloadLink({ href, label, plain, children }) {
      return h('a', {
        className: plain ? 'rea-download rea-download-plain' : 'rea-download',
        href,
        'aria-label': label,
        target: '_blank',
        rel: 'noopener noreferrer',
      }, children, h('span', { 'aria-hidden': true }, '↗'))
    }

    // The npm lookup returns a stable release. A prerelease of the same core is older.
    function compareToStable(current, latest) {
      const versionPattern = /^v?(\d+)\.(\d+)\.(\d+)(-[\w.-]+)?(?:\+[\w.-]+)?$/
      const local = current?.match(versionPattern)
      const remote = latest?.match(versionPattern)
      if (!local || !remote || remote[4]) return null
      for (let part = 1; part <= 3; part++) {
        const difference = Number(local[part]) - Number(remote[part])
        if (difference) return Math.sign(difference)
      }
      return local[4] ? -1 : 0
    }

    // The host decides what counts as healthy; the list is only a fallback for an older host.
    function registrationHealthy(state) {
      return state.registration?.healthy ?? ['aligned', 'healthy'].includes(state.registration?.state)
    }

    function versionAction(state, latest, retry) {
      if (state.cli === 'missing') return { action: 'install', label: t('安装 REA'), hint: t('通过 npm 安装命令行工具并注册到 DSH。') }
      if (state.cli === 'unavailable' && !state.version) {
        return { action: 'reload', label: t('重新检测本机'), hint: t('无法读取 REA 命令行状态。') }
      }
      if (!state.installed) {
        return state.version
          ? { action: 'install', operation: 'repair', label: t('注册到 DSH'), hint: t('已找到本机 REA，可直接注册。') }
          : { action: 'install', label: t('安装 REA') }
      }
      const registration = state.registration?.state
      if (registration && !registrationHealthy(state)) {
        return { action: 'install', operation: 'repair', label: t('修复注册'), hint: t('DSH 注册需要重新配置。') }
      }

      const comparison = compareToStable(state.version, latest)
      if (comparison === -1) return { action: 'update', label: t('更新 REA'), hint: tt`发现 npm 稳定版 ${latest}` }
      if (comparison === 0) return { action: 'check-update', label: t('重新检查'), hint: t('已是最新版'), secondary: true }
      if (comparison === 1) return { action: 'check-update', label: t('重新检查'), hint: tt`当前版本高于 npm 稳定版 ${latest}`, secondary: true }
      return {
        action: 'check-update',
        label: retry ? t('重试检查更新') : latest ? t('重新检查') : t('检查更新'),
        hint: latest ? tt`npm 稳定版 ${latest}，请重新检测本机版本。` : t('可随时检查 npm 稳定版更新。'),
      }
    }

    function UninstallDialog({ onConfirm, onDismiss }) {
      const dialog = React.useRef(null)
      const titleId = React.useId()
      const [removePackage, setRemovePackage] = React.useState(false)
      React.useEffect(() => {
        if (dialog.current && !dialog.current.open) dialog.current.showModal()
      }, [])
      const close = () => {
        dialog.current?.close()
        onDismiss()
      }
      return h('dialog', {
        className: 'rea-dialog', ref: dialog, 'aria-labelledby': titleId,
        onCancel: (event) => { event.preventDefault(); close() },
      },
        h('div', { className: 'rea-row' },
          h('h3', { id: titleId, className: 'rea-dialog-title' }, t('卸载 REA 集成')),
        ),
        h('div', { className: 'rea-dialog-body' },
          h('p', { className: 'rea-muted' }, t('此操作会清理本机所有客户端中的 REA 注册信息，确认继续吗？')),
          h('ul', { className: 'rea-impact-list' },
            h('li', null,
              h('span', { className: 'rea-impact-tag rea-impact-remove' }, t('将移除')),
              h('span', null, removePackage
                ? t('REA 为 DSH 及其他客户端创建的注册和技能文件，以及本机全局 rea-agents 命令行包')
                : t('REA 为 DSH 及其他客户端创建的注册和技能文件')),
            ),
            h('li', null,
              h('span', { className: 'rea-impact-tag rea-impact-keep' }, t('将保留')),
              h('span', null, removePackage
                ? t('门控偏好与本地分析引擎')
                : t('REA 命令行软件包、门控偏好与本地分析引擎')),
            ),
          ),
          h('label', { className: 'rea-checkbox-row' },
            h('input', {
              type: 'checkbox',
              checked: removePackage,
              onChange: (event) => setRemovePackage(Boolean(event?.target?.checked)),
            }),
            h('span', null, t('同时卸载本机 rea-agents 命令行包（npm uninstall -g rea-agents）')),
          ),
        ),
        h('div', { className: 'rea-content rea-divider rea-actions rea-setting-actions' },
          h(Button, { variant: 'outline', size: 'sm', onClick: close }, t('取消')),
          h(Button, {
            variant: 'primary', size: 'sm', className: 'rea-danger-solid',
            onClick: () => { close(); return onConfirm(removePackage) },
          }, removePackage ? t('彻底卸载') : t('确认卸载')),
        ),
      )
    }

    function Feedback({ feedback, onDismiss }) {
      return h('div', { className: 'rea-feedback' },
        h('div', { className: 'rea-feedback-head' },
          h('div', {
            role: feedback.error ? 'alert' : 'status',
            className: feedback.error ? 'rea-error' : 'rea-muted',
          }, feedback.title),
          onDismiss && h('button', {
            type: 'button', className: 'rea-dismiss', 'aria-label': t('关闭提示'), onClick: onDismiss,
          }, '×'),
        ),
        feedback.output && h('pre', {
          className: 'rea-output rea-muted', dir: 'ltr', tabIndex: 0, 'aria-label': t('命令输出'),
        }, feedback.output),
      )
    }

    function Lifecycle({ state, updateLookup, pending, feedback, load, run, checkForUpdates, dismissFeedback, dismissUpdateError }) {
      const [confirmUninstall, setConfirmUninstall] = React.useState(false)
      const busy = Boolean(pending) || updateLookup.checking
      const registration = state.registration?.state
      const registered = registrationHealthy(state)
      const registrationTone = registered ? 'ready' : registration === 'missing' ? 'idle' : registration ? 'attention' : 'idle'
      const registrationLabel = registered ? t('DSH 已注册')
        : registration === 'missing' ? t('DSH 未注册')
          : registration ? t('DSH 注册异常') : t('DSH 注册待确认')
      const toolCount = state.registeredTools ?? 0
      const toolsNotice = toolCount > 0 && registration === 'missing'
        ? t('本机注册已移除，但宿主仍显示已加载工具，可重新检测确认。')
        : toolCount === 0 && state.installed
          ? t('工具尚未加载到当前宿主，重新检测后如仍未生效可重启 DSH。')
          : null

      const canMaintain = state.installed && !['missing', 'unavailable'].includes(state.cli)
      const isLifecycleOp = (op) => Boolean(op && !['load', 'preference'].includes(op) && !op.startsWith('engine-'))
      const localFeedback = isLifecycleOp(feedback?.operation) ? feedback : null
      const primary = versionAction(state, updateLookup.latest, Boolean(updateLookup.error))
      const lifecyclePending = isLifecycleOp(pending)
      const start = () => {
        if (primary.action === 'check-update') return checkForUpdates()
        return primary.action === 'reload' ? load(true) : run({ action: primary.action }, primary.operation)
      }
      const showReinstall = !state.installed && Boolean(state.version)

      return h(Section, { title: t('运行状态与更新') },
        h('div', { className: 'rea-group' },
          h('div', { className: 'rea-row rea-setting-row' },
            h('div', { className: 'rea-setting-info' },
              h('div', { className: 'rea-overview-title' },
                h('span', { className: 'rea-overview-name' }, 'REA'),
                h('span', { className: 'rea-version-pill', dir: state.version ? 'ltr' : undefined },
                  state.version ?? (state.cli === 'missing' ? t('未安装') : t('版本待确认')),
                ),
                h('span', { className: 'rea-badge', 'data-tone': registrationTone },
                  h(Status, { state: registered ? 'done' : 'idle' }, registrationLabel),
                ),
                (state.installed || toolCount > 0) && h('span', { className: 'rea-badge', 'data-tone': toolCount > 0 ? 'ready' : 'idle' },
                  toolCount > 0 ? tt`宿主已加载 ${toolCount} 个工具` : t('宿主未加载'),
                ),
              ),
              h('p', { className: 'rea-muted rea-overview-hint', role: 'status' },
                updateLookup.checking ? t('正在查询 npm 稳定版…') : primary.hint,
              ),
              toolsNotice && h('p', { className: 'rea-muted rea-overview-hint' }, toolsNotice),
            ),
            h('div', { className: 'rea-actions rea-setting-actions' },
              h(Button, { variant: primary.secondary ? 'outline' : 'primary', size: 'sm', disabled: busy, onClick: start },
                updateLookup.checking ? t('检查中…') : primary.label),
              showReinstall && h(Button, {
                variant: 'outline', size: 'sm', disabled: busy,
                onClick: () => run({ action: 'reinstall' }, 'reinstall'),
              }, t('重装最新版')),
              !canMaintain && h(DownloadLink, { href: 'https://rea.tools/get-started/', plain: true }, t('REA 安装指南')),
            ),
          ),
          canMaintain && h('div', { className: 'rea-row rea-setting-row rea-maintenance-bar rea-divider' },
            h('span', { className: 'rea-setting-info rea-muted' }, t('DSH 集成维护')),
            h('div', { className: 'rea-actions rea-setting-actions' },
              h(DownloadLink, { href: 'https://rea.tools/get-started/', plain: true }, t('REA 安装指南')),
              primary.operation !== 'repair' && h(Button, {
                variant: 'ghost', size: 'sm', disabled: busy,
                onClick: () => run({ action: 'install' }, 'repair'),
              }, t('重新注册')),
              h(Button, {
                variant: 'ghost', size: 'sm', className: 'rea-danger-ghost', disabled: busy, 'aria-haspopup': 'dialog',
                onClick: () => setConfirmUninstall(true),
              }, t('卸载集成')),
            ),
          ),
          lifecyclePending && h('div', { className: 'rea-content rea-divider', role: 'status' },
            h(Status, { state: 'ongoing' }, operationMeta(pending)?.pending),
          ),
          localFeedback && h('div', { className: 'rea-content rea-divider' },
            h(Feedback, { feedback: localFeedback, onDismiss: dismissFeedback }),
          ),
          updateLookup.error && primary.action === 'check-update' &&
            h('div', { className: 'rea-content rea-divider' },
              h(Feedback, { feedback: updateLookup.error, onDismiss: dismissUpdateError }),
            ),
        ),
        confirmUninstall && h(UninstallDialog, {
          onConfirm: (removePackage) => run(
            removePackage ? { action: 'uninstall', removePackage: true } : { action: 'uninstall' },
            removePackage ? 'uninstall-full' : 'uninstall',
          ),
          onDismiss: () => setConfirmUninstall(false),
        }),
      )
    }

    function SessionDefaults({ state, pending, feedback, run }) {
      const savingDefault = pending === 'preference'
      const defaultFeedback = feedback?.operation === 'preference' ? feedback : null

      return h(Section, { title: t('新会话默认设置') },
        h('div', { className: 'rea-group' },
          h('div', { className: 'rea-row rea-setting-row' },
            h('div', { className: 'rea-setting-info' },
              h('div', { className: 'rea-label' }, t('新会话默认启用 REA')),
              h('p', { className: 'rea-muted' }, t('仅对之后新建的会话生效；正在运行的会话可通过输入框左下角的 REA 下拉单独切换。')),
              defaultFeedback?.error && h('p', { className: 'rea-muted rea-error', role: 'alert' }, defaultFeedback.title),
            ),
            h('div', { className: 'rea-actions rea-setting-actions' },
              h('span', { role: 'status', className: 'rea-muted' },
                savingDefault ? operations.preference.pending : defaultFeedback?.error ? '' : defaultFeedback?.title,
              ),
              h(Switch, {
                checked: state.default ?? state.open ?? false,
                label: t('新会话默认启用 REA'),
                disabled: Boolean(pending),
                onChange: (open) => run({ open }, 'preference'),
              }),
            ),
          ),
        ),
      )
    }

    function parseDiagnosticText(raw) {
      const shaMatch = raw.match(/\b([a-f0-9]{64})\b/i)
      const sha256 = shaMatch ? shaMatch[1] : null
      const urlRegex = /https?:\/\/[^\s,)]+/g
      const segments = []
      let lastIndex = 0
      let match
      while ((match = urlRegex.exec(raw)) !== null) {
        const href = match[0].replace(/[.;:]+$/, '')
        if (match.index > lastIndex) segments.push({ type: 'text', value: raw.slice(lastIndex, match.index) })
        const fileName = href.split('/').pop() || href
        segments.push({ type: 'link', href, label: fileName.length > 42 ? `${fileName.slice(0, 39)}…` : fileName })
        lastIndex = match.index + href.length
      }
      if (lastIndex < raw.length) segments.push({ type: 'text', value: raw.slice(lastIndex) })
      return { segments, sha256 }
    }

    function renderDiagnosticSegments(segments) {
      return segments.map((seg, index) => {
        if (seg.type === 'link') {
          return h('a', {
            key: `link-${index}`,
            className: 'rea-inline-link',
            href: seg.href,
            target: '_blank',
            rel: 'noopener noreferrer',
            title: seg.href,
          }, `${seg.label} ↗`)
        }
        // Collapse long 64-char SHA-256 inline since we surface a dedicated copyable SHA-256 row below
        const compact = seg.value.replace(/\b([a-f0-9]{8})[a-f0-9]{48}([a-f0-9]{8})\b/gi, '$1…$2')
        return compact
      })
    }

    function engineMeta(engine) {
      const { id, available, checked, configured } = engine
      const needsCheck = Boolean(checked && configured && !available)
      const state = available ? 'ready' : needsCheck ? 'attention' : 'idle'
      const tone = available ? 'ready' : needsCheck ? 'attention' : configured ? 'info' : 'idle'
      const status = available ? t('可用')
        : needsCheck ? t('需检查')
          : configured ? t('已配置，待验证')
            : checked ? t('未配置')
              : t('待验证')
      return { id, state, tone, status, needsCheck }
    }

    function EnvVarEditor({ variable, busy, onSave }) {
      const { name: varName, set, value, fromHostEnv } = variable
      const savedValue = value ?? ''
      const [draft, setDraft] = React.useState(savedValue)
      React.useEffect(() => { setDraft(savedValue) }, [savedValue])
      const trimmed = draft.trim()
      const canSave = !busy && trimmed.length > 0 && trimmed !== savedValue
      const placeholder = fromHostEnv
        ? t('已由宿主环境变量设置（可填写绝对路径覆盖）')
        : (ENV_PLACEHOLDERS[varName] ?? tt`填写 ${varName} 的绝对路径`)

      const submit = (event) => {
        event?.preventDefault?.()
        if (canSave) return onSave(varName, trimmed)
      }

      return h('li', { className: 'rea-env-row' },
        h('div', { className: 'rea-env-head' },
          h('div', { className: 'rea-env-main' },
            h(StateDot, { state: set ? 'done' : 'idle', size: 7 }),
            h('code', { className: 'rea-env-code', dir: 'ltr' }, varName),
            h('span', { className: 'rea-env-state', 'data-set': String(Boolean(set)) }, set ? t('已设置') : t('未设置')),
          ),
          h(CopyButton, { text: varName, label: t('复制变量'), ariaLabel: tt`复制环境变量 ${varName}` }),
        ),
        h('form', { className: 'rea-env-edit', onSubmit: submit },
          h('input', {
            type: 'text',
            className: 'rea-path-input',
            dir: 'ltr',
            value: draft,
            placeholder,
            disabled: busy,
            'aria-label': tt`${varName} 路径`,
            onChange: (event) => setDraft(event?.target?.value ?? ''),
          }),
          h(Button, {
            type: 'button',
            variant: 'outline',
            size: 'sm',
            disabled: !canSave,
            'aria-label': tt`保存 ${varName}`,
            onClick: submit,
          }, t('保存并检测')),
          savedValue && h(Button, {
            type: 'button',
            variant: 'ghost',
            size: 'sm',
            disabled: busy,
            'aria-label': tt`清除 ${varName}`,
            onClick: () => { setDraft(''); return onSave(varName, '') },
          }, t('清除')),
        ),
      )
    }

    function EngineRow({ engine, expanded, onToggle, pending, feedback, run, dismissFeedback }) {
      const detailId = React.useId()
      const { id, available, variables, checks, version, canInstall, installCommand } = engine
      const provider = providers[id] ?? { name: id, description: t('可选分析引擎。') }
      const { state, tone, status } = engineMeta(engine)
      const mark = state === 'ready' ? '✓' : state === 'attention' ? '!' : '−'
      const busy = Boolean(pending)
      const installOp = `engine-install:${id}`
      const envOp = `engine-env:${id}`
      const installing = pending === installOp
      const savingEnv = pending === envOp
      const rowFeedback = feedback && (feedback.operation === installOp || feedback.operation === envOp) ? feedback : null

      const failedHints = [...new Set(
        (checks ?? [])
          .filter(({ ok }) => !ok)
          .map(({ detail, remediation }) => remediation || detail)
          .filter(Boolean),
      )]
      const passedDetails = [...new Set(
        (checks ?? [])
          .filter(({ ok, detail }) => ok && detail)
          .map(({ detail }) => detail),
      )]
      const parsedHints = failedHints.map(parseDiagnosticText)
      const hashes = [...new Set(parsedHints.map((item) => item.sha256).filter(Boolean))]

      const links = [
        provider.href && { key: 'download', href: provider.href, text: provider.label, label: provider.label },
        ...(provider.extraLinks ?? []),
      ].filter(Boolean)

      const saveEnv = (varName, nextValue) => run({ action: 'set-env', values: { [varName]: nextValue } }, envOp)
      const install = () => run({ action: 'install-engine', engine: id }, installOp)

      return h('li', { className: 'rea-engine-item' },
        h('button', {
          type: 'button',
          className: 'rea-engine-trigger',
          'aria-expanded': expanded,
          'aria-controls': detailId,
          onClick: onToggle,
        },
          h('div', { className: 'rea-engine-left' },
            h('span', { className: 'rea-engine-mark', 'data-state': state, 'aria-hidden': true }, mark),
            h('div', { className: 'rea-engine-text' },
              h('div', { className: 'rea-engine-title-row' },
                h('span', { className: 'rea-label' }, provider.name),
                version && h('span', { className: 'rea-version-pill', dir: 'ltr' }, version),
                provider.dep && h('span', { className: 'rea-engine-dep' }, provider.dep),
              ),
              provider.description && h('div', { className: 'rea-engine-desc' }, provider.description),
            ),
          ),
          h('div', { className: 'rea-engine-right' },
            h('span', { className: 'rea-badge', 'data-tone': tone }, status),
            h(Chevron, { open: expanded }),
          ),
        ),
        expanded && h('div', { id: detailId, className: 'rea-engine-detail' },
          provider.setup && h('div', { className: 'rea-detail-block' },
            h('div', { className: 'rea-detail-label' }, t('配置说明')),
            h('p', { className: 'rea-detail-guide' }, provider.setup),
          ),
          variables?.length > 0 && h('div', { className: 'rea-detail-block' },
            h('div', { className: 'rea-detail-label' }, t('环境变量与路径配置')),
            h('ul', { className: 'rea-list rea-env-list', 'aria-label': tt`${provider.name} 环境变量` },
              variables.map((variable) => h(EnvVarEditor, {
                key: variable.name,
                variable,
                busy,
                onSave: saveEnv,
              })),
            ),
          ),
          (installing || savingEnv) && h('div', { role: 'status', className: 'rea-muted' },
            h(Status, { state: 'ongoing' },
              installing
                ? tt`正在执行 ${installCommand || t('Homebrew 安装')}（可能需要几分钟）…`
                : operationMeta(envOp)?.pending,
            ),
          ),
          rowFeedback && h(Feedback, { feedback: rowFeedback, onDismiss: dismissFeedback }),
          available
            ? h('div', { className: 'rea-diag-box', 'data-tone': 'ready' },
              h('p', null, t('本机检测通过，在启用 REA 的会话中可直接调用此引擎。')),
              passedDetails.length > 0 && h('div', { className: 'rea-path-code', dir: 'ltr' }, passedDetails.join(' · ')),
            )
            : parsedHints.length > 0 && h('div', { className: 'rea-detail-block' },
              h('div', { className: 'rea-detail-label' }, state === 'attention' ? t('异常诊断（rea doctor）') : t('检测详情（rea doctor）')),
              h('div', { className: 'rea-diag-box', 'data-tone': state },
                parsedHints.map((item, idx) => h('p', { key: idx, dir: 'ltr' }, renderDiagnosticSegments(item.segments))),
                hashes.map((hash) => h('div', { key: hash, className: 'rea-hash-row' },
                  h('span', { className: 'rea-hash-val', dir: 'ltr', title: hash }, `SHA-256: ${hash}`),
                  h(CopyButton, { text: hash, label: t('复制 SHA-256'), ariaLabel: t('复制 SHA-256 校验值') }),
                )),
              ),
            ),
          (canInstall && !available || links.length > 0) && h('div', { className: 'rea-detail-actions' },
            canInstall && !available && h(Button, {
              variant: 'primary',
              size: 'sm',
              disabled: busy,
              title: installCommand || undefined,
              onClick: install,
            }, installing ? t('安装中…') : tt`一键安装 ${provider.name}`),
            links.map((link) => h(DownloadLink, { key: link.key, href: link.href, label: link.label }, link.text)),
          ),
        ),
      )
    }

    function Environment({ state, pending, feedback, load, run, dismissFeedback }) {
      const [toggled, setToggled] = React.useState({})
      const checking = pending === 'load'
      const settling = !checking && state.checks === 'pending'
      const checkFailure = feedback?.operation === 'load' ? feedback : null
      const checkedAt = state.checkedAt && new Date(state.checkedAt).toLocaleTimeString(LOCALE === 'zh' ? 'zh-CN' : undefined, { hour: '2-digit', minute: '2-digit' })

      const rawEngines = [...(state.engines ?? [])]
      const javaHome = rawEngines.flatMap(({ variables }) => variables ?? []).find(({ name }) => name === 'JAVA_HOME')
      if (!rawEngines.some(({ id }) => id === 'java')) {
        rawEngines.push({
          id: 'java',
          configured: javaHome?.set === true,
          variables: javaHome ? [javaHome] : [{ name: 'JAVA_HOME', set: false }],
        })
      }

      const engineMap = new Map(rawEngines.map((engine) => [engine.id, engine]))
      const knownIds = new Set(ENGINE_GROUPS.flatMap((g) => g.engines))
      const extraEngines = rawEngines.filter((engine) => !knownIds.has(engine.id))

      const counts = rawEngines.reduce((acc, engine) => {
        const meta = engineMeta(engine)
        acc.all += 1
        acc[meta.state] += 1
        return acc
      }, { all: 0, ready: 0, attention: 0, idle: 0 })

      const groups = [
        ...ENGINE_GROUPS.map((group) => ({
          id: group.id,
          title: group.title,
          items: group.engines.map((id) => engineMap.get(id)).filter(Boolean),
        })),
        ...(extraEngines.length > 0 ? [{
          id: 'other',
          title: t('其他引擎'),
          items: extraEngines,
        }] : []),
      ].filter((group) => group.items.length > 0)

      const isExpanded = (engine) => {
        if (Object.hasOwn(toggled, engine.id)) return toggled[engine.id]
        return engineMeta(engine).state === 'attention'
      }
      const toggleEngine = (engine) => {
        const current = isExpanded(engine)
        setToggled((prev) => ({ ...prev, [engine.id]: !current }))
      }

      const metaParts = [
        tt`可用 ${counts.ready} / ${counts.all}`,
        counts.attention > 0 ? tt`需检查 ${counts.attention}` : null,
        checkedAt ? tt`上次检测 ${checkedAt}` : null,
        t('点击条目展开配置与详情'),
      ].filter(Boolean)

      return h(Section, {
        title: t('分析引擎与依赖'),
        meta: h('span', { className: 'rea-muted' }, checking ? t('正在重新检测本机状态…') : settling ? t('体检仍在后台运行，完成后会自动更新…') : metaParts.join(' · ')),
        actions: h(Button, {
          variant: 'ghost', size: 'sm', icon: h(IconRefreshOutlineRegular, { size: 14 }),
          disabled: Boolean(pending), onClick: () => load(true),
        }, checking ? t('检测中…') : t('重新检测')),
      },
        h('div', { className: 'rea-group' },
          checkFailure && h('div', { className: 'rea-content' }, h(Feedback, { feedback: checkFailure })),
          groups.map((group, groupIndex) => h('div', { key: group.id },
            h('div', { className: groupIndex === 0 && !checkFailure ? 'rea-subhead' : 'rea-subhead rea-divider' },
              h('span', null, group.title),
              h('span', null, tt`${group.items.length} 项`),
            ),
            h('ul', { className: 'rea-list', 'aria-label': group.title },
              group.items.map((engine) => h(EngineRow, {
                key: engine.id,
                engine,
                expanded: isExpanded(engine),
                onToggle: () => toggleEngine(engine),
                pending,
                feedback,
                run,
                dismissFeedback,
              })),
            ),
          )),
        ),
      )
    }

    function UsageGuide() {
      const [open, setOpen] = React.useState(false)
      const bodyId = React.useId()
      const examples = [
        t('用 REA 查看 <应用路径> 的 Electron 入口模块和 preload 脚本。'),
        t('用 REA 列出 <文件路径> 中 .NET 程序集的公开类型和入口点。'),
      ]
      return h('section', null,
        h('div', { className: 'rea-group' },
          h('div', { className: 'rea-disclosure-bar' },
            h('button', {
              type: 'button',
              className: 'rea-disclosure-main',
              'aria-expanded': open,
              'aria-controls': bodyId,
              onClick: () => setOpen((v) => !v),
            },
              h('div', { className: 'rea-label' }, t('REA 会话示例')),
              h('p', { className: 'rea-muted' }, t('开启 REA 后可直接发给助手的逆向分析提示词模板')),
            ),
            h('div', { className: 'rea-disclosure-right' },
              h(DownloadLink, { href: 'https://github.com/morluto/rea', plain: true }, t('REA 文档')),
              h('button', {
                type: 'button',
                className: 'rea-disclosure-chevron-btn',
                'aria-hidden': true,
                tabIndex: -1,
                onClick: () => setOpen((v) => !v),
              }, h(Chevron, { open })),
            ),
          ),
          open && h('div', { id: bodyId, className: 'rea-content rea-divider rea-stack' },
            examples.map((prompt) => h('div', { key: prompt, className: 'rea-prompt-card' },
              h('div', { className: 'rea-prompt-text' },
                h('span', { className: 'rea-prompt-quote', 'aria-hidden': true }, '›'),
                h('span', null, prompt),
              ),
              h(CopyButton, { text: prompt, ariaLabel: tt`复制示例：${prompt}` }),
            )),
            h('p', { className: 'rea-muted' }, t('助手调用 rea_gate 的 on / off 只对本次会话生效，不会改动新会话的默认设置。')),
          ),
        ),
      )
    }

    function AdvancedDiagnostics({ state }) {
      const [open, setOpen] = React.useState(false)
      const [diagnostic, setDiagnostic] = React.useState(null)
      const bodyId = React.useId()
      const checkModule = async () => {
        setDiagnostic('checking')
        setDiagnostic((await call('diagnose'))?.graph ?? 'unavailable')
      }
      const configPath = state.registration?.path

      return h('section', null,
        h('div', { className: 'rea-group' },
          h('button', {
            type: 'button',
            className: 'rea-disclosure-trigger',
            'aria-expanded': open,
            'aria-controls': bodyId,
            onClick: () => setOpen((v) => !v),
          },
            h('div', null,
              h('div', { className: 'rea-label' }, t('高级诊断')),
              h('p', { className: 'rea-muted' }, t('查看 DSH 配置文件路径与宿主客户端模块图状态')),
            ),
            h(Chevron, { open }),
          ),
          open && h('div', { id: bodyId, className: 'rea-divider' },
            configPath && h('div', { className: 'rea-row rea-setting-row' },
              h('div', { className: 'rea-setting-info' },
                h('div', { className: 'rea-label' }, t('DSH 注册配置路径')),
                h('div', { className: 'rea-path-code', dir: 'ltr' }, configPath),
              ),
              h('div', { className: 'rea-actions rea-setting-actions' },
                h(CopyButton, { text: configPath, label: t('复制路径'), ariaLabel: t('复制 DSH 配置路径') }),
              ),
            ),
            h('div', { className: 'rea-row rea-setting-row' },
              h('div', { className: 'rea-setting-info' },
                h('div', { className: 'rea-label' }, t('插件诊断')),
                h('div', { role: 'status', className: 'rea-muted' },
                  !diagnostic ? t('检查宿主是否已发布面板模块。')
                    : diagnostic === 'checking' ? t('正在检查模块图…')
                      : diagnostic === 'unavailable' ? t('无法读取模块图，请重试。')
                        : diagnostic.selfPresent ? tt`模块已加入图（${diagnostic.rev}）` : t('模块尚未加入图。'),
                ),
              ),
              h('div', { className: 'rea-actions rea-setting-actions' },
                h(Button, {
                  variant: 'outline', size: 'sm', disabled: diagnostic === 'checking', onClick: checkModule,
                }, diagnostic === 'checking' ? t('检查中…') : t('检查模块图')),
              ),
            ),
          ),
        ),
      )
    }

    function GateControls() {
      const data = useGate()
      const { state, feedback, pending, load } = data
      return h('div', { className: 'rea-gate rea-gate-controls' },
        h('style', null, CSS),
        state ? [
          h(Lifecycle, { ...data, key: 'lifecycle' }),
          h(SessionDefaults, { ...data, key: 'session' }),
          h(Environment, { ...data, key: 'environment' }),
          h(UsageGuide, { key: 'usage' }),
          h(AdvancedDiagnostics, { state, key: 'diagnostics' }),
        ] : h(Section, { title: t('运行状态与更新') },
          h('div', { className: 'rea-group rea-row rea-setting-row' },
            pending ? h('div', { role: 'status' }, h(Status, { state: 'ongoing' }, t('正在读取本机状态…')))
              : h(Feedback, { feedback: feedback ?? { error: true, title: t('无法读取本机状态，请重试。') } }),
            !pending && h(Button, { variant: 'outline', size: 'sm', onClick: () => load(true) }, t('重试')),
          ),
        ),
      )
    }

    function ReaPanel() {
      return h('div', { className: 'rea-gate rea-gate-page' },
        h('div', { className: 'rea-gate-page-inner' },
          h('header', { className: 'rea-page-head' },
            h('div', { className: 'rea-logo' }, h(ReaIcon, { size: 18 })),
            h('div', null,
              h('h1', null, t('REA 管理')),
              h('p', { className: 'rea-muted rea-page-sub' }, t('管理本机 REA 集成、新会话默认设置与可选分析引擎')),
            ),
          ),
          h(GateControls),
        ),
      )
    }

    function ReaPluginConfig({ view }) {
      return view === 'page' ? h(GateControls) : null
    }

    function ReaChip(props) {
      const sessionId = props?.sessionId ?? props?.session?.id ?? props?.session?.sessionId ?? props?.binding?.sessionId
      if (!sessionId) return null
      return h(SessionGate, { key: sessionId, sessionId })
    }

    function SessionGate({ sessionId }) {
      const [state, setState] = React.useState(null)
      const [busy, setBusy] = React.useState(false)
      const [message, setMessage] = React.useState('')
      const [menuOpen, setMenuOpen] = React.useState(false)

      React.useEffect(() => {
        let current = true
        let stopped = false
        let inflight = false
        let timer = null
        const path = `state?session=${encodeURIComponent(sessionId)}`
        // The gate also changes from the panel and from the `rea_gate` tool. The
        // chip must not keep showing a decision another surface already reversed.
        const read = async (full = false) => {
          if (inflight) return null
          inflight = true
          const next = await call(full ? path : `${path}&checks=0`)
          inflight = false
          if (current && next && next.ok !== false) setState(next)
          return next
        }
        // A hidden page has nobody to show the chip to; skip the request and
        // catch up as soon as the page is visible again.
        const hidden = () => typeof document !== 'undefined' && document.hidden === true
        const schedule = () => {
          timer = setTimeout(async () => {
            if (stopped) return
            if (!hidden()) await read()
            if (!stopped) schedule()
          }, CHIP_POLL_MS)
          timer?.unref?.()
        }
        const onVisible = () => { if (!hidden() && !stopped) void read() }
        if (typeof document !== 'undefined') document.addEventListener?.('visibilitychange', onVisible)
        void read().then((next) => {
          if (current && next?.installed === false) void read(true)
          if (!stopped) schedule()
        })
        return () => {
          current = false
          stopped = true
          if (timer) clearTimeout(timer)
          if (typeof document !== 'undefined') document.removeEventListener?.('visibilitychange', onVisible)
        }
      }, [sessionId])

      if (!state) return null

      const installed = state.installed !== false
      const open = state.open === true
      const exposed = installed && !open && state.exposed === true
      const choose = async (id) => {
        setMenuOpen(false)
        if (busy || !installed || (id === 'on') === open) return
        setBusy(true)
        setMessage('')
        const next = await post({ session: sessionId, open: id === 'on' })
        if (typeof next?.installed === 'boolean') setState(next)
        if (!next || next.ok === false) setMessage(next?.message || t('无法切换 REA'))
        setBusy(false)
      }

      const label = installed ? (open ? t('REA 开') : exposed ? t('REA 关（未生效）') : t('REA 关')) : t('REA 未安装')
      const title = message
        || (!installed ? t('REA 未安装，请在侧栏的 REA 面板中安装') : null)
        || (exposed ? tt`门控已关闭，但本会话仍可见 ${state.tools} 个 REA 工具` : null)
        || (state.sessionKnown ? tt`本会话可见 ${state.tools} 个 REA 工具` : state.workspace)
        || 'REA'
      const trigger = h('button', {
        type: 'button',
        className: 'rea-composer-trigger',
        'aria-label': label,
        'aria-haspopup': 'listbox',
        'aria-expanded': menuOpen,
        title,
        disabled: busy || !installed,
        onClick: () => setMenuOpen(!menuOpen),
      },
      h('span', { className: 'rea-composer-label' }, label),
      IconChevronDownOutlineRegular
        ? h('span', { className: 'rea-composer-chevron' + (menuOpen ? ' rea-composer-chevron-open' : ''), 'aria-hidden': true },
          h(IconChevronDownOutlineRegular, null))
        : null)

      // A host without the shared Menu primitive still gets a working control.
      if (!Menu) {
        return h('span', { className: 'rea-composer-gate' },
          h('style', null, COMPOSER_CSS),
          h('select', {
            className: 'rea-composer-trigger',
            'aria-label': label,
            title,
            value: open ? 'on' : 'off',
            disabled: busy || !installed,
            onChange: (event) => { void choose(event.target.value) },
          },
          h('option', { value: 'on' }, t('开启 REA')),
          h('option', { value: 'off' }, t('关闭 REA'))))
      }

      return h('span', { className: 'rea-composer-gate' },
        h('style', null, COMPOSER_CSS),
        h(Menu, {
          open: menuOpen,
          items: [
            { id: 'on', label: t('开启 REA') },
            { id: 'off', label: t('关闭 REA') },
          ],
          selectedId: open ? 'on' : 'off',
          onSelect: choose,
          onClose: () => setMenuOpen(false),
          side: 'top',
          portal: true,
          anchor: trigger,
        }))
    }

    function ReaIcon(props) {
      const size = typeof props?.size === 'number' ? props.size : 16
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true, fill: 'none' },
        h('path', { d: 'M3.5 21V3h10c4.4 0 7 2.5 7 6.1s-2.6 6.1-7 6.1H9l3.4-3.5h1.1c1.9 0 3-.9 3-2.6s-1.1-2.6-3-2.6h-6V21Z', fill: 'currentColor' }),
        h('path', { d: 'M11.6 16.6h4.9l4.1 4.4h-5Z', fill: 'currentColor' }),
      )
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('main', () =>
          ctx.slots.register({ name: 'main', key: PANEL_ID }, ReaPanel),
        )
        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register(
            { name: 'sidebar.panellist', id: PANEL_ID, order: 20, label: () => 'REA' },
            ReaIcon,
          ),
        )
        ctx.slots.inject('plugins.bundle.config', () =>
          ctx.slots.register({ name: 'plugins.bundle.config', key: 'dsh-rea-gate' }, ReaPluginConfig),
        )
        // The switch sits in the composer tool row, right after the permission
        // control. `conversation.input.left` is a session-scoped list slot; its
        // registration's `inject` is how the session id reaches the component.
        ctx.slots.inject('conversation.input.left', () =>
          ctx.slots.register(
            {
              name: 'conversation.input.left',
              id: PANEL_ID,
              order: 0,
              label: () => 'REA',
              inject: (sessionId) => ({ sessionId }),
            },
            ReaChip,
          ),
        )
      },
    }
  },
})
