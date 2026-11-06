# 牛马休息倒计时 · dsh-off-work-countdown

> 一个挂在 DeepSeek Harness 界面上的下班倒计时：右侧常驻一张可拖动、可调透明度的小卡片；点开左侧栏入口，还有一页完整的大卡片和设置。

![status](https://img.shields.io/badge/dsh-%E2%89%A50.2.0%20%3C0.3.0-2ea44f)
![license](https://img.shields.io/badge/license-MIT-blue)

[English](#english) · [安装](#安装) · [使用](#使用) · [开发](#本地开发)

---

## 功能

- **Harness 界面常驻卡片**：右下角实时显示距离下班还有多久，按秒跳动，不需要打开任何页面。
- **下班祝福**：到点后自动换成绿色卡片——`已下班 / 今天辛苦了。/ 明天 18:30 / 100%`；周五晚上自动指向 `周一 18:30`，周末显示休息日。
- **工作进度条**：按当天的工作时长（默认 09:30–18:30）显示已经过去的比例。
- **可拖动**：按住卡片任意空白处拖到任何位置，松手记住；窗口缩小时自动夹回可视区域；一个准星按钮可以一键复位。
- **可调透明度**：嫌挡住文字就把卡片调淡（100% / 85% / 70% / 55% / 40% 循环，或页面里用滑杆精细调 30%–100%）；鼠标悬停、拖动时自动恢复不透明。
- **可收起**：收成一个只显示倒计时的小胶囊，点一下展开；收起状态也会记住。
- **侧栏入口 + 完整页面**：侧栏时钟图标打开完整卡片，里面可以设置上下班时间、工作日、透明度。
- **中英双语、跟随主题**：文案走 DSH 的 locale 服务，样式只用 `--dsw-alias-*` 主题 token，亮色/暗色主题都适配。
- 设置存在浏览器 `localStorage`，不写 Host、不需要后端。

### 卡片状态

| 时刻 | 状态 | 大字 | 左下 / 右下 |
| --- | --- | --- | --- |
| 上班中 | 距离下班 | `8 小时 15 分 00 秒`（实时） | `今天 18:30` / `8%` |
| 已下班 | 已下班（绿色对勾） | **今天辛苦了。** | `明天 18:30` / `100%` |
| 周五晚上 | 已下班 | 今天辛苦了。 | `周一 18:30` / `100%` |
| 休息日 | 休息日（咖啡杯） | 今天休息，好好放松。 | `周一 18:30` / `100%` |
| 上班前 | 还没上班 | 今天 18:30 下班 | `今天 18:30` / `0%` |

## 安装

要求 **DeepSeek Harness ≥ 0.2.0 < 0.3.0**（在 0.2.2-rc.1 上测试过）。

### 方式一：npm（发布后）

在 DSH Desktop 的「设置 → 插件 → 添加插件」里填入：

```
dsh-off-work-countdown
```

或者用 CLI（`desktop` 是 Desktop 版本的 profile 名，其他版本换成你的 profile）：

```sh
dsh plugin --profile desktop add dsh-off-work-countdown
```

装好后重启 DSH（或在插件页刷新），右下角就会多出倒计时卡片。

### 方式二：直接从 GitHub 安装（不用发布 npm）

```sh
dsh plugin --profile desktop add github:zxy29/dsh-off-work-countdown
```

本插件是纯 JavaScript、没有构建步骤，所以 GitHub 安装不需要额外的构建许可。

### 方式三：本地 tarball

```sh
npm pack
dsh plugin --profile desktop add ./dsh-off-work-countdown-1.0.0.tgz
```

## 使用

- **卡片**：鼠标移上去，右上角出现三个小按钮——打开完整页面（滑块图标）、重置位置（准星，拖动过才有）、切换透明度（半圆）、收起胶囊（向下箭头）。
- **页面**（左侧栏时钟图标）：设置工作时间（上班/下班）、工作日（周一到周日）、透明度。改完立刻生效，卡片和页面共用同一份设置。
- **默认值**：09:30–18:30，周一到周五，100% 不透明。

设置保存在浏览器本地，键名：

| 键 | 含义 |
| --- | --- |
| `dsh.off-work-countdown.prefs` | 上班/下班时间、工作日 |
| `dsh.off-work-countdown.opacity` | 悬浮卡片透明度 |
| `dsh.off-work-countdown.position` | 悬浮卡片拖动位置 |
| `dsh.off-work-countdown.overlay` | 展开/收起状态 |

## 兼容性

- DSH：`engines.dsh` 声明为 `>=0.2.0 <0.3.0`。
- 浏览器端只依赖 Harness 提供的 `React`，不 import 任何 `@deepseek-ai/dsh-client-*` 包，跟随宿主升级的风险低。
- 没有 Host 逻辑、没有网络请求、没有构建产物。

## 项目结构

```
dsh-off-work-countdown/
├── package.json        # 插件清单：dsh.bundle + dsh.client
├── cordis.patch.yml    # 插入一行 off-work-countdown 插件
├── index.js            # Host 半：空实现（倒计时完全在浏览器里算）
├── client.js           # 浏览器半：侧栏入口 + 完整页面 + 悬浮卡片
├── locale/{zh,en}.json # 插件管理页里的显示名与描述
├── icon.svg            # 图标
├── LICENSE
└── README.md
```

## 本地开发

```sh
git clone https://github.com/zxy29/dsh-off-work-countdown.git
cd dsh-off-work-countdown
# 直接装进当前 profile（会以 link 方式链接，改完刷新页面即可热重载）
dsh plugin --profile desktop add ./
```

改 `client.js` 后浏览器端会通过 DSH 的客户端 HMR 自动重载；改 `package.json` 名字/版本这类元数据需要重启 DSH。发布前跑一遍自检：

```sh
npm run check
```

`npm run check` 会校验清单、patch 行名、client 模块 id、locale、图标和 JS 语法，防止包名/模块 id 不一致导致别人装不上。

### 发布到 npm

```sh
npm login
npm run check
npm publish
```

首次发布前记得把下面这些占位符换成你自己的 GitHub 用户名（用编辑器或脚本替换即可）：

- `package.json` 里的 `zxy29`（repository / homepage / bugs）
- 本 README 里的 `zxy29`（克隆地址）

也可以运行：

```sh
node scripts/set-owner.mjs <你的GitHub用户名>
```

## 许可

[MIT](./LICENSE)

---

<a id="english"></a>
## English

**dsh-off-work-countdown** is a [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin that keeps an off-work countdown visible on the Harness UI.

- A resident floating card (bottom-right, draggable, position remembered) shows the live time left until quitting time with a workday progress bar.
- After quitting time it turns into a green card: `Off work / Good work today. / Tomorrow 18:30 / 100%`; Friday evening points at Monday, weekends show a day-off state.
- Adjustable opacity (hover clears it up), collapsible pill form, and a full page behind a left-sidebar entry with working-hours settings.
- Chinese/English UI, host theme tokens (light and dark), no Host logic, no build step.

### Install

Requires DeepSeek Harness `>=0.2.0 <0.3.0`.

```sh
# npm (after it is published)
dsh plugin --profile desktop add dsh-off-work-countdown

# or straight from GitHub
dsh plugin --profile desktop add github:zxy29/dsh-off-work-countdown
```

Then restart DSH. Open the sidebar clock entry for settings; the floating card appears at the bottom-right corner.

### Development

```sh
dsh plugin --profile desktop add ./
npm run check     # manifest / module-id / locale / icon / syntax self-check
npm publish       # after npm login
```

MIT licensed.
