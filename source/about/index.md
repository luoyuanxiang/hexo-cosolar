---
title: 关于 · Cosolar 移植纪实
layout: about
comments: false
description: 清风徐来，码迹自留 — 从 Halo Cosolar 到 Hexo 主题的一比一移植全过程
date: 2026-07-22
---

## 写在前面

本页记录 **hexo-theme-cosolar** 的诞生过程：如何把运行在 [Halo](https://halo.run) 上的 [Cosolar](https://github.com/cosolar/halo-theme-cosolar) 主题，像素级移植为可 `npm` 安装的 Hexo 主题，并对照线上参考站 [blog.luoyuanxiang.top](https://blog.luoyuanxiang.top/) 完成主要页面与交互。

主题口号不变：**清风徐来，码迹自留**。

---

## 一、缘起与目标

| 项 | 内容 |
|----|------|
| 源码 | `Desktop/halo/halo-theme-cosolar`（Thymeleaf + Vite + 自定义 CSS） |
| 目标 | `Desktop/hexo-theme-cosolar`（EJS + 静态资源，npm 包名 `hexo-theme-cosolar`） |
| 保真度 | **C 档：像素级**（DOM class / CSS / 关键交互对齐） |
| 交付形态 | **仅主题包**（不含演示站），站点用 `_config.cosolar.yml` 覆盖配置 |
| 范围 | 首页、归档、友链、分类、标签、文章详情等主流程 |

当时 Hexo 工作区几乎是空壳（仅有 Cursor skill 文档），因此按**绿地重建**推进，而不是在残缺代码上修补。

---

## 二、需求澄清（决策锁定）

移植前用「顾问式提问」把模糊需求钉死，避免边做边改方向：

1. **一比一标准** → 选定 **C：像素级复刻**
2. **交付物** → 只要主题包，自行挂到现有 Hexo 博客验收
3. **友链** → `source/_data/links.yml`
4. **评论** → Twikoo / Waline **双接入**，`comment.provider` 切换
5. **搜索** → 本地（`hexo-generator-search` + 主题浮层）
6. **首页加载** → **仅分页**（无限滚动配置保留但不实现）
7. **交互保留** → 亮暗色、Canvas/动态背景、精选轮播、文章 TOC/进度/底栏、友链筛选、侧栏模块
8. **配置要求** → Halo `settings.yaml` **全字段**可在 Hexo 配置，且**逐项中文注释**；站点 `_config.cosolar.yml` 生效，便于 `npm update`

后续明确砍掉：**登录页与 login 配置项**（Hexo 博客无此场景）。

---

## 三、资产盘点

### Halo 侧（完整）

- 模板：`index` / `archives` / `categories` / `category` / `tags` / `tag` / `links` / `post` + `partials`
- 样式：约 7k 行 `main.css`（青绿主色 `#10B981`、玻璃拟态、明暗双模）
- 脚本：`main` / `index` / `post` / `links`（主题切换、Canvas、轮播、TOC、友链筛选等）
- 配置：`settings.yaml` 十余个分组（basic、footer、style、featured、sidebar、背景……）

### Hexo 侧（起步为 0）

- 需从零搭建：`package.json`、`_config.yml`、`layout/`、`source/`、`scripts/`、`README.md`

### 对照站

- [https://blog.luoyuanxiang.top/](https://blog.luoyuanxiang.top/)（墨韵云阁 · Cosolar 观感）

---

## 四、实施过程（按阶段）

### 阶段 1 · 脚手架

- 建立 npm 主题结构，`name: hexo-theme-cosolar`，`theme: cosolar`
- 复制 GPL-3.0 `LICENSE`
- 目录：`layout/`、`source/css|js|fonts|images`、`scripts/`、`languages/`、`examples/`

### 阶段 2 · 全量注释配置

- 以 Halo `settings.yaml` 为唯一对照，生成主题 `_config.yml`
- 每个分组分隔标题 + 每字段中文注释（对齐 label / help）
- 附件 → URL 字符串；精选文章 → path/slug/标题列表
- 扩展块：`menu` / `search` / `comment` / `busuanzi` / `upvote` / 后续 `code`
- `feeds` 配置预留（页面未移植）；`login` 后来整组删除

### 阶段 3 · 资产迁移

- `main.css`、iconfont、默认封面/Logo 原样迁入 `source/`
- TypeScript 行为改为浏览器 JS：`main.js` / `index.js` / `post.js` / `links.js`
- Halo SearchWidget → `CosolarSearch` + `search.js` / `search.css`
- 点赞 API → `localStorage`（可选 LeanCloud）

### 阶段 4 · EJS 布局一比一

| Halo | Hexo |
|------|------|
| `layout.html` | `layout.ejs` + `_partial/head|header|footer` |
| `index.html` | `index.ejs` + `featured` + 分页 |
| `archives.html` | `archive.ejs` 年/月时间线 |
| `categories` / `category` | `category.ejs` + generator 总览 |
| `tags` / `tag` | `tag.ejs` + generator 总览 |
| `links.html` | `links.ejs` + `site.data.links` |
| `post.html` | `post.ejs` TOC / 进度 / 底栏 / 评论 |

原则：**优先保留原 CSS class 与 DOM 结构**，避免「重写一版 UI」。

### 阶段 5 · Helpers / Generators

- `post_cover` / `featured_posts` / `post_excerpt` / `sidebar_links` / `links_grouped`
- `menu_url` / `menu_is_active`（多级菜单）
- 自动生成 `/categories/`、`/tags/` 总览页

### 阶段 6 · 文档交付

- 完整 `README.md`（安装、配置对照、友链/评论/搜索、验收清单）
- `examples/_config.cosolar.yml`、`examples/links.yml`

---

## 五、后续迭代记录

移植主线完成后，又按使用反馈做了这些增强：

### 1. 代码高亮（Mac 窗）

- 新增 `code-highlight.css` + `code-block.js`
- 三色圆点标题栏、语言标签、复制、超高折叠
- 配色跟随 `primary_color` 与亮/暗主题
- 配置项：`code.enable` / `fold` / `fold_height` / `copy`

### 2. 首页「最新 / 最热 / 推荐」

- 根因：卡片 `data-visit` / `data-upvote` 写死为 0
- 修复：写入 `views`/`visit`、`upvote`/`likes`、`sticky`、字数、路径
- 排序：最新按时间；最热优先阅读数字段；推荐置顶 + 点赞优先

### 3. 移除登录

- 删除 `login` 配置组、顶栏登录入口、相关 CSS 与 `login_default.png`
- README 同步去掉登录说明

### 4. 多级菜单

- `menu[].children`（或 `submenu`）递归渲染
- 桌面：悬停下拉，三级起向右飞出
- 移动：手风琴；点箭头可只展开不跳转
- 子页激活时父级同步高亮

### 5. 本 About 页

- 主题内置 `layout/about.ejs` + `pages/about.md`，由 generator 生成 `/about/`
- （不可放在主题 `source/`：会被当成静态资源，不解析 front-matter、不套布局）
- 博客侧若自备 `source/about/`，则优先使用站点页面覆盖

---

## 六、能力对照（Halo → Hexo）

| Halo | Hexo |
|------|------|
| Thymeleaf + Vite | EJS + `source/` 静态资源 |
| `settings.yaml` | `_config.yml` + `_config.cosolar.yml` |
| PluginSearchWidget | 本地搜索浮层 + `search.json` |
| `halo:comment` | Twikoo / Waline |
| 点赞 API | localStorage / LeanCloud |
| 访问统计 | busuanzi（可选） |
| plugin-links | `_data/links.yml` |
| Shiki | 站点 highlight.js + 主题 Mac 样式层 |

---

## 七、刻意不做

- 仓库内 demo Hexo 站（由使用者自行挂载验收）
- Feeds（RSS 资讯）页面 UI（配置键仍保留）
- 首页无限滚动实现
- 登录 / 注册 / 网关页
- 强制 `npm publish`（结构已按可发布准备）

---

## 八、如何使用本主题（速查）

```bash
npm install hexo-theme-cosolar
# 或：npm install git+https://github.com/luoyuanxiang/hexo-theme-cosolar.git
npm install hexo-generator-search --save
```

仓库：[https://github.com/luoyuanxiang/hexo-theme-cosolar](https://github.com/luoyuanxiang/hexo-theme-cosolar)

```yaml
# 博客 _config.yml
theme: cosolar
```

推荐复制 `examples/_config.cosolar.yml` → 博客根目录 `_config.cosolar.yml`。

友链：`source/links/index.md`（`layout: links`）+ `source/_data/links.yml`。

更细的说明见主题根目录 [README.md](/README.md)（若你从 Git 阅读）或包内 README。

---

## 九、致谢

- 本仓库：[luoyuanxiang/hexo-theme-cosolar](https://github.com/luoyuanxiang/hexo-theme-cosolar)
- 上游主题：**Cosolar**（Halo）作者与社区
- 设计参照站：[blog.luoyuanxiang.top](https://blog.luoyuanxiang.top/)
- 其他参考站：[楠枝小笺](https://www.nannax.top/),[灵的梦境](https://lemonadorable.github.io/)
- 静态博客框架：[Hexo](https://hexo.io)

---

*本页随主题版本演进可持续增补。记录日期：2026-07-22。*
