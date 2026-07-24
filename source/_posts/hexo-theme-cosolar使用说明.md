---
title: hexo-theme-cosolar 使用说明
description: Cosolar Hexo 主题从安装、配置、多级菜单、友链、评论到点赞与回到顶部的完整使用指南，对应当前 1.0.19。
tags:
  - Hexo
  - 主题
  - Cosolar
categories:
  - 开发笔记
cover: https://cdn.luoyuanxiang.top/hexo-theme-cosolar-cover.webp
recommend: true
sticky: 1
abbrlink: b90c2365
date: 2026-07-24 10:00:00
---

清风徐来，码迹自留。**hexo-theme-cosolar** 是由 [Halo Cosolar](https://github.com/cosolar/halo-theme-cosolar) 移植而来的 Hexo 主题，本站当前使用 **1.0.19**。

- 仓库：[luoyuanxiang/hexo-theme-cosolar](https://github.com/luoyuanxiang/hexo-theme-cosolar)
- npm：`hexo-theme-cosolar`
- Demo：[luoyuanxiang.top](https://luoyuanxiang.top)

本文按「装好就能用 → 常用配置 → 页面与功能 → 排错」整理，适合新装主题或从其他主题迁移。

## 功能一览

| 能力 | 说明 |
|------|------|
| 首页 | 精选轮播、文章列表、侧栏、分页、最新/最热/推荐 |
| 归档 | Hero + 年/月时间线 |
| 分类 / 标签 | 总览卡片 + 详情列表（主题自动生成） |
| 友链 | 分组筛选、搜索、申请面板、自助 Issue / PR |
| 关于 | 内置 `/about/`，可被博客覆盖 |
| 文章 | TOC、阅读进度、点赞/分享、灯箱、上下篇、评论 |
| 全局 | 亮暗色、本地搜索（Ctrl+K）、回到顶部、不蒜子 |

> 预留未实现：`feeds` 资讯页；首页 `home_load_mode: scroll` 无限滚动暂不生效。

## 安装与升级

在博客根目录：

```bash
npm install hexo-theme-cosolar
# 或锁定版本
npm install hexo-theme-cosolar@1.0.19
```

博客 `_config.yml`：

```yaml
theme: cosolar
```

推荐用根目录 **`_config.cosolar.yml`** 覆盖主题配置，不要改 `node_modules` 里的文件。

升级：

```bash
npm update hexo-theme-cosolar
# 或指定版本
npm install hexo-theme-cosolar@latest
hexo clean && hexo g
```

可选插件（不装也能用主题内置能力）：

```bash
# 可选：官方搜索索引（主题已内置 search.json）
# npm install hexo-generator-search --save
# 可选：官方订阅（装了后主题内置 atom 会自动让位）
# npm install hexo-generator-feed --save
```

## 配置入口

| 文件 | 作用 |
|------|------|
| 主题包 `_config.yml` | 全量默认值 + 中文注释 |
| 博客 `_config.cosolar.yml` | **日常只改这里** |
| 主题 `examples/_config.cosolar.yml` | 可复制起步的示例 |

主题从 Halo 分组落地的键：`basic` / `footer` / `style` / `social` / `featured` / `sidebar` / `links` / `background_light` / `background_dark` 等。

Hexo 扩展键：`menu`、`search`、`seo`、`feed`、`comment`、`code`、`lazyload`、`visit`、`upvote`、`busuanzi`、`back_to_top`、`about`。

最小可跑示例：

```yaml
basic:
  logo_text: 墨韵云阁
  tagline: 热爱技术，乐于分享

style:
  primary_color: "#10B981"
  color_scheme: auto   # auto | light | dark

social:
  author_name: 墨韵云阁
  author_bio: 热爱技术，乐于分享
```

修改配置后请执行 `hexo clean && hexo g`（或重启 `hexo s`）再验收。

## 导航菜单

主题默认 `menu: []`，请在 `_config.cosolar.yml` **完整写出**导航。支持 `children` 多级；桌面端下拉/飞出，移动端手风琴。

```yaml
menu:
  - name: 首页
    url: /
    icon: icon-shouye
  - name: 分类
    url: /categories/
    icon: icon-fengfuduoyuan
    children:
      - name: 开发笔记
        url: /categories/开发笔记/
  - name: 文档
    url: '#'          # 仅作分组时必须写 '#'
    icon: icon-blog
    children:
      - name: Hexo
        url: https://hexo.io
        target: _blank
  - name: 关于
    url: /about/
    icon: icon-bokeyuan
```

**重要：** 父级只做分组、没有独立页面时，务必写 `url: '#'`，不要省略。

原因：Hexo 用 `deepMerge` **按数组下标**合并主题与站点配置。若省略 `url`，可能继承同下标项的链接（例如误带上 `/about/`），出现多个菜单同时高亮。

## 页面怎么开

### 关于页

主题内置 `/about/`。若博客有 `source/about/`（或 `source/about/index.md`），以博客为准。

封面与副标题可在配置里写：

```yaml
about:
  subtitle: 你的副标题
  cover: https://example.com/cover.webp
```

### 友链页

1. 新建 `source/links/index.md`：

```markdown
---
title: 友情链接
layout: links
---
```

2. 创建 `source/_data/links.yml`：

```yaml
groups:
  - name: friends
    display_name: 好友
links:
  - name: 示例站点
    url: https://example.com
    logo: https://example.com/favicon.ico
    description: 简介
    group: friends
```

3. 申请面板写在 `links.apply`（本站信息、步骤、须知、自助 Issue / PR 按钮等）。本站示例：

```yaml
links:
  apply:
    enable: true
    button_enable: true
    button_text: 自助申请友链
    issue_url: https://github.com/你的仓库/issues/new?template=friend-link.yml
    pr_enable: true
    pr_url: https://github.com/你的仓库/edit/main/source/_data/links.yml
```

### 分类 / 标签 / 归档

- `/categories/`、`/tags/`：主题 generator 自动生成，无需手写 md
- `/archives/`：Hexo 默认归档，主题提供时间线样式

分类列表默认只展示**顶级分类**。一篇文章挂多个**平级**分类时请写成：

```yaml
categories:
  - [开发笔记]
  - [生活随笔]
```

不要写成两行普通字符串，否则 Hexo 会解析成父子层级。

## 文章 front-matter

常用字段：

```yaml
---
title: 文章标题
description: 摘要，用于 SEO 与分享卡片
tags:
  - Hexo
categories:
  - - 开发笔记
cover: https://cdn.example.com/cover.webp
date: 2026-07-24 10:00:00
sticky: 1          # 置顶权重，首页「推荐」优先
recommend: true
views: 128         # 可选，影响「最热」弱排序
upvote: 12         # 可选
---
```

首页 Tab 规则简述：

| Tab | 规则 |
|-----|------|
| 最新 | 发布时间 |
| 最热 | 优先 `views` / visit，否则弱按篇幅再按时间 |
| 推荐 | 置顶 → 点赞 → 时间 |

## 搜索、评论、代码块

### 本地搜索

```yaml
search:
  enable: true
  path: search.json
  placeholder: 搜索文章
```

主题默认生成 `/search.json`。顶栏搜索框或 **Ctrl+K** 打开浮层。

### 评论

```yaml
comment:
  provider: twikoo   # twikoo | waline | none
  twikoo:
    envId: "https://你的-twikoo-地址"
    region: ""
  waline:
    serverURL: ""
```

### Mac 风格代码块

博客 `_config.yml` 需开启 Hexo 高亮，例如：

```yaml
highlight:
  enable: true
  line_number: true
  wrap: true
prismjs:
  enable: false
```

主题侧：

```yaml
code:
  enable: true
  style: mac
  fold: true
  fold_height: 320
  copy: true
```

## 点赞、阅读量、回到顶部

```yaml
upvote:
  enable: true
  provider: local      # local | leancloud

busuanzi:
  enable: true         # 站点 PV 等

visit:
  enable: true         # 文章阅读量（可回填首页卡片）

back_to_top:
  enable: true
  position: right      # left | right
  show_height: 400     # 像素，或 "20%"
```

- `upvote.provider: local`：浏览器 localStorage
- `leancloud`：需填 `appId` / `appKey` / `serverURL`
- 回到顶部为全站悬浮按钮；文章页可与点赞/评论/分享同一侧栏叠放

## 首页精选与侧栏

```yaml
featured:
  show_featured: true
  autoplay: true
  interval: 5000
  featured_max_count: 5
  fallback: latest       # latest | pinned | none
  featured_posts: []     # 填 path / slug / 标题
  home_load_mode: pagination

sidebar:
  show_sidebar: true
  show_author: true
  show_announcement: true
  announcement_content: "欢迎来到我的博客"
  show_tag_cloud: true
  show_categories: true
  show_recent: true
  show_sidebar_links: true
```

`featured_posts` 为空时，按 `fallback` 自动取文。侧栏友链来自 `source/_data/links.yml` 的抽样展示。

## SEO 与订阅

主题默认可生成：

- `/sitemap.xml`、`/robots.txt`（`seo.enable: true`）
- `/atom.xml`（未安装 `hexo-generator-feed` 时）

请在博客 `_config.yml` 填写 `url`、`description`、`keywords`、`author`；文章写好 `description` / `cover` 有利于摘要与分享图。

## 常见问题

**1. 改了 `_config.cosolar.yml` 没变化？**  
先 `hexo clean && hexo g`，确认改的是博客根目录文件，不是 `node_modules` 内主题配置。

**2. 分组菜单和别的菜单一起高亮？**  
给分组项显式写 `url: '#'`，并在站点侧完整配置 `menu`（主题默认已是空数组）。

**3. 分类页出现重复同名卡片？**  
检查文章 `categories` 是否被写成父子层级；平级分类用 `- [分类名]` 写法。

**4. 搜索没结果？**  
确认 `search.enable: true`，生成产物里有 `search.json`，且浏览器能访问到该文件。

**5. Twikoo 测通但收不到邮件？**  
若评论服务部署在 Vercel，检查 Deployment Protection / 鉴权是否拦住了服务端回调。

## 改完自检

- [ ] 首页：轮播、列表、侧栏、分页、亮暗色
- [ ] 归档 / 分类 / 标签样式正常
- [ ] 友链筛选、搜索、申请按钮
- [ ] 文章：TOC、进度、点赞、评论、Ctrl+K 搜索
- [ ] 分组菜单不会误高亮
- [ ] `hexo clean && hexo g` 后配置生效

## 参考链接

- 主题仓库：https://github.com/luoyuanxiang/hexo-theme-cosolar
- npm：https://www.npmjs.com/package/hexo-theme-cosolar
- 完整字段注释：主题包内 `_config.yml`
- 配置示例：主题包 `examples/`
- 视觉参考：[blog.luoyuanxiang.top](https://blog.luoyuanxiang.top/)
- 友链交互参考：[楠枝小笺](https://www.nannax.top/)、[灵的梦境](https://lemonadorable.github.io/)

有问题欢迎在本页评论，或到主题仓库提 Issue。
