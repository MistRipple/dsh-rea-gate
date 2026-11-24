# 发布清单

`dsh-rea-gate` 已发布到 npm（`dsh-rea-gate@0.3.0`），仓库是 <https://github.com/MistRipple/dsh-rea-gate>。这份清单只保留发新版和维护索引所需的步骤。

## 发新版前

```sh
npm test                 # 全部套件必须通过
npm pack --dry-run       # 检查打包内容
```

打包应当只有：`package.json`、`index.js`、`client.js`、`lib/*.js`、`cordis.patch.yml`、`locale/*.json`、`docs/DETAIL.md`、`icon.svg`、`README.md`、`LICENSE`。`tests/`、`market/`、`HANDOFF.md`、`PUBLISHING.md` 不应出现。新增源码目录时记得加进 `package.json` 的 `files`，否则发布出去的包会缺文件。

如果 `npm publish` 报 `EPERM`，是 `~/.npm` 里有 root 拥有的文件：

```sh
sudo chown -R "$(id -u):$(id -g)" ~/.npm
# 或者只给这次发布单独指定缓存
export npm_config_cache="$HOME/.npm-dsh"
```

## 发布

改 `package.json` 的 `version`，然后 `npm publish`，再提交并打 tag：

```sh
npm publish
npm view dsh-rea-gate version
git tag vX.Y.Z && git push --follow-tags
```

如果新版本改了最低 DSH 要求，同步 `engines.dsh` 和索引里的 `engines.dsh`。

## 索引

dshopen 和 awesome-dsh-plugin 都从 npm 与仓库自动更新，发新版不用再提 PR。首次收录用到的材料在 `market/`：

- dshopen：按 [`market/dshopen-issue.md`](market/dshopen-issue.md) 填 <https://github.com/polang233/dsh-plugin-index/issues/new?template=plugin-add.yml>。要求公开源码、可安装的 npm 版本和明确许可证。
- awesome-dsh-plugin：把 [`market/awesome-entry.yml`](market/awesome-entry.yml) 复制成 fork 里的 `data/plugins/MistRipple__dsh-rea-gate.yml` 再提 PR；CI 检查 `dsh.bundle`、仓库创建满 1 天、`dsh-plugin` topic 和格式。

`market/dshopen-issue.md` 里的「副作用」描述要和 README 的 *Permissions and side effects* 保持一致，行为变了就一起改。

## 自建索引（可选）

`market/index.json` 是一份 format 1 索引，放到任意 HTTPS 地址后在 **插件 → 发现 → 索引源** 里添加，就能在公开收录前走一遍完整的安装流程。

- 改了版本或发布时间，要自己更新 `versions`。
- Git 索引里的 `icon` 必须是绝对 HTTPS 或 base64 data URL；HTTP 索引可以用相对路径。
- 索引不签名，安装什么以包自己的 `package.json` 为准。

## 验证

在 **发现** 里搜索 `REA` 安装。Desktop 的 profile 由 Electron 管理，不能用 `dsh plugin --profile desktop`；也可以用 `plugin_manager` 的 `install_bundle`，target 填 `dsh-rea-gate@<版本>`。

装完重启 DSH，确认侧栏出现 REA 面板、会话顶部有胶囊、`rea_gate status` 可调用。
