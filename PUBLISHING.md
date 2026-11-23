# 发布清单

目标：把 `dsh-rea-gate` 发到 npm，并让它出现在 DSH 的「发现」里。

已经补齐：`package.json` 元数据、`README.md`、`LICENSE`、`locale/zh.json` 的 `meta.detail`，以及 `market/` 下的提交材料。

## 0. 先修本机 npm 缓存

当前 `~/.npm` 里有 root 拥有的文件，`npm publish` 会报 `EPERM`：

```sh
sudo chown -R "$(id -u):$(id -g)" ~/.npm
```

不想动它也可以给这次发布单独指定缓存：

```sh
export npm_config_cache="$HOME/.npm-dsh"
```

## 1. 检查打包内容

```sh
npm pack --dry-run
```

应当只看到：`package.json`、`index.js`、`client.js`、`cordis.patch.yml`、`locale/*.json`、`docs/DETAIL.md`、`icon.svg`、`README.md`、`LICENSE`。`tests/`、`market/`、`HANDOFF.md` 不应出现。

## 2. 发布到 npm

```sh
npm login
npm publish
npm view dsh-rea-gate version   # 应为 0.3.0
```

`dsh-rea-gate` 这个不带 scope 的名字目前没有被占用。以后想改名必须在第一次 publish 前决定。

## 3. 建 GitHub 仓库

```sh
git init
git add -A
git commit -m "dsh-rea-gate 0.3.0"
gh repo create MistRipple/dsh-rea-gate --public --source=. --push
git tag v0.3.0 && git push --tags
gh repo edit MistRipple/dsh-rea-gate --add-topic dsh-plugin
```

`package.json` 里的 `repository` / `homepage` / `bugs` 已经指向这个地址。

## 4. 提交索引

### A. 开放插件市场 dshopen.org

按 [`market/dshopen-issue.md`](market/dshopen-issue.md) 填表：

<https://github.com/polang233/dsh-plugin-index/issues/new?template=plugin-add.yml>

要求公开源码、可安装的 npm 版本和明确许可证（MIT 已满足）。索引每 6 小时构建一次。

### B. awesome-dsh-plugin（喂 `dsh-plugin-catalog` 和 dshmarket）

把 [`market/awesome-entry.yml`](market/awesome-entry.yml) 复制成 fork 里的：

```text
data/plugins/MistRipple__dsh-rea-gate.yml
```

然后提 PR。CI 会检查 `dsh.bundle`、仓库创建满 1 天、`dsh-plugin` topic 和格式；所以先建仓库，隔天再提。

## 5. 可选：先自建索引验证

`market/index.json` 是一份可以直接用的 format 1 索引。把它放到任意 HTTPS 地址（或推到仓库后开 GitHub Pages），然后在 **插件 → 发现 → 索引源** 里添加该 URL，就能在公开收录前先走一遍完整的安装流程。

自建索引要注意：

- 改了版本或发布时间，要自己更新 `versions`。
- Git 索引里的 `icon` 必须是绝对 HTTPS 或 base64 data URL；HTTP 索引可以用相对路径。
- 索引不签名，安装什么以包自己的 `package.json` 为准。

## 6. 验证

在 **发现** 里搜索 `REA` 安装。Desktop 的 profile 由 Electron 管理，不能用 `dsh plugin --profile desktop`；也可以用 `plugin_manager` 的 `install_bundle`，target 填 `dsh-rea-gate@0.3.0`。

装完重启 DSH，确认侧栏出现 REA 面板、会话顶部有胶囊、`rea_gate status` 可调用。

## 以后发新版

1. 改 `version`，重新 `npm publish`。
2. dshopen 和 awesome 的索引会跟着 npm 自动更新，不用再提 PR。
3. 自建索引需要手动加一条 `versions`。
4. 如果新版本改了最低 DSH 要求，记得同步 `engines.dsh` 和索引里的 `engines.dsh`。
