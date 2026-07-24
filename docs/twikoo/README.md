# Twikoo 邮件模板（墨韵云阁）

适配站点主色 `#10B981`，用于 Twikoo 管理面板 → **配置管理 → 邮件通知**。

| 文件 | 粘贴到 | 用途 |
|------|--------|------|
| [`MAIL_TEMPLATE.html`](./MAIL_TEMPLATE.html) | `MAIL_TEMPLATE` | 访客收到评论回复时的通知 |
| [`MAIL_TEMPLATE_ADMIN.html`](./MAIL_TEMPLATE_ADMIN.html) | `MAIL_TEMPLATE_ADMIN` | 站长收到新评论时的通知 |

## 使用步骤

1. 打开对应 HTML，全选复制（含 `<!DOCTYPE html>` 整段）。
2. 登录 Twikoo 管理面板（博客任一评论区右下角管理入口）。
3. **配置管理 → 邮件通知**，粘贴到对应字段并保存。
4. 用非博主邮箱发一条测试评论 / 回复验证。

## 变量说明

| 变量 | 含义 | 回复模板 | 新评论模板 |
|------|------|:--------:|:----------:|
| `${SITE_NAME}` | 网站名称 | ✓ | ✓ |
| `${SITE_URL}` | 网站地址 | ✓ | ✓ |
| `${POST_URL}` | 文章评论链接 | ✓ | ✓ |
| `${NICK}` | 评论 / 回复者昵称 | ✓ | ✓ |
| `${COMMENT}` | 评论 / 回复内容 | ✓ | ✓ |
| `${IMG}` | 评论 / 回复者头像 | ✓ | ✓ |
| `${PARENT_NICK}` | 被回复者昵称 | ✓ | |
| `${PARENT_COMMENT}` | 被回复内容 | ✓ | |
| `${PARENT_IMG}` | 被回复者头像 | ✓ | |
| `${MAIL}` | 评论者邮箱 | | ✓ |
| `${IP}` | 评论者 IP | | ✓ |

Logo 默认使用：`https://luoyuanxiang.top/images/logo.png`（可按需替换）。
