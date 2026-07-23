const dns = require('node:dns').promises
const fs = require('node:fs/promises')
const net = require('node:net')
const path = require('node:path')
const { execFile } = require('node:child_process')
const { promisify } = require('node:util')

const { chromium } = require('playwright')
const yaml = require('js-yaml')

const execFileAsync = promisify(execFile)
const root = process.env.GITHUB_WORKSPACE || process.cwd()
const configPath = path.join(root, '.github/friend-link.config.json')

const FIELD_ALIASES = {
  name: ['网站名称', '站点名称', '名称', '网站名称 / Site name', 'Site name'],
  url: ['网站链接', '站点链接', '链接', '网址', '网站链接 / Site URL', 'Site URL'],
  friendPage: [
    '友链页面 URL',
    '友链页面',
    '友链地址',
    '友链页面 URL / Friend-links page URL',
    'Friend-links page URL'
  ],
  description: [
    '网站描述',
    '站点描述',
    '描述',
    '简介',
    '网站描述 / Site description',
    'Site description'
  ],
  avatar: [
    '网站头像 URL',
    '网站头像',
    '头像 URL',
    '头像',
    '网站头像 URL / Site avatar URL',
    'Site avatar URL'
  ]
}

const LABEL_COLORS = {
  request: 'bfdadc',
  checking: 'fbca04',
  needsUpdate: 'd93f0b',
  review: '5319e7',
  approved: '0e8a16'
}

function parseIssueBody(body) {
  const sections = new Map()
  const pattern = /^###\s+(.+?)\s*\n+([\s\S]*?)(?=^###\s+|\s*$)/gm

  for (const match of body.matchAll(pattern)) {
    const value = match[2].trim()
    if (value && value !== '_No response_') sections.set(match[1].trim(), value)
  }

  const getField = (key) => {
    for (const alias of FIELD_ALIASES[key]) {
      const value = sections.get(alias)
      if (value) return value
    }
    return ''
  }

  return {
    name: getField('name'),
    url: getField('url'),
    friendPage: getField('friendPage'),
    description: getField('description'),
    avatar: getField('avatar')
  }
}

function normalizeHttpUrl(value) {
  try {
    const url = new URL(value.trim())
    if (!['http:', 'https:'].includes(url.protocol)) return ''
    url.hash = ''
    return url.toString()
  } catch {
    return ''
  }
}

function normalizeComparableUrl(value) {
  const url = new URL(value)
  return `${url.hostname.toLowerCase()}${url.pathname.replace(/\/+$/, '') || '/'}`
}

function isPrivateIp(address) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number)
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    )
  }

  if (net.isIPv6(address)) {
    const normalized = address.toLowerCase()
    return (
      normalized === '::' ||
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe8') ||
      normalized.startsWith('fe9') ||
      normalized.startsWith('fea') ||
      normalized.startsWith('feb')
    )
  }

  return true
}

async function assertPublicUrl(value) {
  const url = new URL(value)
  const hostname = url.hostname.toLowerCase()
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new Error('不允许使用 localhost 地址')
  }

  const addresses = net.isIP(hostname)
    ? [{ address: hostname }]
    : await dns.lookup(hostname, { all: true, verbatim: true })

  if (!addresses.length || addresses.some(({ address }) => isPrivateIp(address))) {
    throw new Error('地址解析到了私网、环回或保留 IP')
  }
}

async function validateFriendPage(pageUrl, site) {
  await assertPublicUrl(pageUrl)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent: 'CosolarFriendLinkChecker/1.0',
    ignoreHTTPSErrors: false
  })
  const page = await context.newPage()
  let blockedNavigation = ''

  await page.route('**/*', async (route) => {
    const request = route.request()
    try {
      await assertPublicUrl(request.url())
      await route.continue()
    } catch {
      if (request.isNavigationRequest()) blockedNavigation = request.url()
      await route.abort('blockedbyclient')
    }
  })

  try {
    const response = await page.goto(pageUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 20_000
    })
    await page.waitForTimeout(2_000)

    if (blockedNavigation) throw new Error(`页面跳转到了不允许访问的地址：${blockedNavigation}`)
    if (!response) throw new Error('页面没有返回有效响应')
    if (response.status() >= 400) throw new Error(`页面返回 HTTP ${response.status()}`)

    const finalUrl = page.url()
    await assertPublicUrl(finalUrl)

    const target = new URL(site.url)
    const targetHost = target.hostname.toLowerCase()
    const targetUrl = normalizeComparableUrl(site.url)
    const links = await page
      .locator('a[href]')
      .evaluateAll((elements) => elements.map((element) => element.href))
    const hasBacklink = links.some((href) => {
      try {
        const candidate = new URL(href)
        return (
          candidate.hostname.toLowerCase() === targetHost ||
          normalizeComparableUrl(candidate.toString()) === targetUrl
        )
      } catch {
        return false
      }
    })

    if (!hasBacklink) {
      throw new Error(`页面中没有找到指向 ${site.url} 的链接`)
    }

    return finalUrl
  } finally {
    await browser.close()
  }
}

async function validateAvatarUrl(avatarUrl, site) {
  await assertPublicUrl(avatarUrl)

  const siteOrigin = new URL(site.friendPage || site.url)
  const checkUrl = new URL('/__friend-link-avatar-check__', siteOrigin)
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent: 'CosolarFriendLinkChecker/1.0',
    ignoreHTTPSErrors: false
  })
  const page = await context.newPage()

  await page.route('**/*', async (route) => {
    const request = route.request()
    if (request.url() === checkUrl.toString()) {
      await route.fulfill({
        contentType: 'text/html; charset=utf-8',
        body: `<!doctype html><img id="avatar" src="${avatarUrl.replace(/"/g, '&quot;')}">`
      })
      return
    }

    try {
      await assertPublicUrl(request.url())
      await route.continue()
    } catch {
      await route.abort('blockedbyclient')
    }
  })

  try {
    await page.goto(checkUrl.toString(), {
      waitUntil: 'domcontentloaded',
      timeout: 20_000
    })

    const loaded = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const image = document.getElementById('avatar')
          if (!(image instanceof HTMLImageElement)) {
            resolve(false)
            return
          }
          if (image.complete) {
            resolve(image.naturalWidth > 0 && image.naturalHeight > 0)
            return
          }
          const timer = window.setTimeout(() => resolve(false), 10_000)
          image.addEventListener(
            'load',
            () => {
              window.clearTimeout(timer)
              resolve(image.naturalWidth > 0 && image.naturalHeight > 0)
            },
            { once: true }
          )
          image.addEventListener(
            'error',
            () => {
              window.clearTimeout(timer)
              resolve(false)
            },
            { once: true }
          )
        })
    )

    if (!loaded) {
      throw new Error('头像地址无法作为第三方页面图片加载，可能存在防盗链或访问限制')
    }
  } finally {
    await browser.close()
  }
}

async function ensureLabel(github, owner, repo, name, color) {
  try {
    await github.rest.issues.getLabel({ owner, repo, name })
  } catch (error) {
    if (error.status !== 404) throw error
    await github.rest.issues.createLabel({ owner, repo, name, color })
  }
}

async function setStatusLabels(github, owner, repo, issueNumber, config, status) {
  for (const [key, name] of Object.entries(config.labels)) {
    await ensureLabel(github, owner, repo, name, LABEL_COLORS[key] || 'ededed')
  }

  const remove = Object.entries(config.labels)
    .filter(([key]) => key !== 'request' && key !== status)
    .map(([, name]) => name)

  for (const name of remove) {
    try {
      await github.rest.issues.removeLabel({ owner, repo, issue_number: issueNumber, name })
    } catch (error) {
      if (error.status !== 404) throw error
    }
  }

  await github.rest.issues.addLabels({
    owner,
    repo,
    issue_number: issueNumber,
    labels: [config.labels.request, config.labels[status]]
  })
}

async function comment(github, owner, repo, issueNumber, body) {
  await github.rest.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body
  })
}

async function hasWritePermission(github, owner, repo, username) {
  try {
    const { data } = await github.rest.repos.getCollaboratorPermissionLevel({
      owner,
      repo,
      username
    })
    return ['admin', 'maintain', 'write'].includes(data.permission)
  } catch {
    return false
  }
}

function formatLinkEntry(entry) {
  const dumped = yaml
    .dump(entry, { lineWidth: 120, noRefs: true, quotingType: '"' })
    .trimEnd()
    .split('\n')
    .map((line, index) => (index === 0 ? `  - ${line}` : `    ${line}`))
    .join('\n')
  return `\n${dumped}\n`
}

async function updateLinksFile(config, request) {
  const linksPath = path.join(root, config.linksFile)
  const raw = await fs.readFile(linksPath, 'utf8')
  const data = yaml.load(raw) || {}

  if (!Array.isArray(data.groups)) data.groups = []
  if (!Array.isArray(data.links)) data.links = []

  const targetGroup = config.targetGroup || 'friends'
  const hasGroup = data.groups.some((group) => group && group.name === targetGroup)
  if (!hasGroup) {
    throw new Error(`找不到友链分组 ${targetGroup}`)
  }

  const normalizedUrl = normalizeComparableUrl(request.url)
  const duplicate = data.links.find((friend) => {
    try {
      return friend?.url && normalizeComparableUrl(friend.url) === normalizedUrl
    } catch {
      return false
    }
  })

  if (duplicate) return { duplicate }

  const entry = {
    name: request.name,
    url: request.url,
    logo: request.avatar,
    description: request.description,
    group: targetGroup
  }

  // Append to preserve existing comments and formatting in links.yml
  const trimmed = raw.replace(/\s*$/, '')
  await fs.writeFile(linksPath, `${trimmed}${formatLinkEntry(entry)}`, 'utf8')
  return { duplicate: null }
}

async function commitAndPush(config, request, issueNumber) {
  await execFileAsync('git', ['config', 'user.name', 'github-actions[bot]'], { cwd: root })
  await execFileAsync(
    'git',
    ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com'],
    { cwd: root }
  )
  await execFileAsync('git', ['add', config.linksFile], { cwd: root })
  await execFileAsync(
    'git',
    ['commit', '-m', `chore(links): add ${request.name} (#${issueNumber})`],
    {
      cwd: root
    }
  )
  await execFileAsync('git', ['push'], { cwd: root })
}

module.exports = async ({ github, context, core }) => {
  const issue = context.payload.issue
  if (!issue) return

  const config = JSON.parse(await fs.readFile(configPath, 'utf8'))
  const { owner, repo } = context.repo
  const issueNumber = issue.number
  const request = parseIssueBody(issue.body || '')
  const commentBody = context.payload.comment?.body?.trim() || ''
  const commenter = context.payload.comment?.user?.login || ''
  const command = commentBody.match(/^\/(approve|reject)\b(?:\s+([\s\S]*))?/i)
  const issueLabels = new Set((issue.labels || []).map((label) => label.name || label))

  if (!request.name || !request.url || !request.friendPage) {
    core.info('Issue does not match the friend-link form; skipping.')
    return
  }

  if (context.eventName === 'issue_comment') {
    if (command) {
      const canReview = await hasWritePermission(github, owner, repo, commenter)
      if (!canReview) {
        core.info('Review command ignored because the commenter has no write permission.')
        return
      }

      if (command[1].toLowerCase() === 'reject') {
        const reason = command[2]?.trim() || '未提供具体原因'
        await setStatusLabels(github, owner, repo, issueNumber, config, 'needsUpdate')
        await comment(
          github,
          owner,
          repo,
          issueNumber,
          [
            `人工审核未通过：${reason}`,
            `Manual review rejected: ${reason}`,
            '',
            '申请者修正后可重新打开此 Issue，再次触发技术校验。',
            'After fixing the issue, reopen this Issue to run validation again.'
          ].join('\n')
        )
        await github.rest.issues.update({
          owner,
          repo,
          issue_number: issueNumber,
          state: 'closed',
          state_reason: 'not_planned'
        })
        return
      }
    } else if (commenter !== issue.user.login) {
      core.info('Only the issue author can trigger revalidation without a review command.')
      return
    } else if (!issueLabels.has(config.labels.needsUpdate)) {
      core.info('Issue author comments only trigger revalidation while needs-update is set.')
      return
    }
  }

  await setStatusLabels(github, owner, repo, issueNumber, config, 'checking')

  try {
    for (const [label, value] of [
      ['网站链接', request.url],
      ['友链页面 URL', request.friendPage],
      ['网站头像 URL', request.avatar]
    ]) {
      const normalized = normalizeHttpUrl(value)
      if (!normalized) throw new Error(`${label}不是有效的 HTTP(S) 地址`)
      if (label === '网站链接') request.url = normalized
      if (label === '友链页面 URL') request.friendPage = normalized
      if (label === '网站头像 URL') request.avatar = normalized
    }

    if (request.name.length > 80 || request.description.length > 200) {
      throw new Error('网站名称或描述过长')
    }

    await assertPublicUrl(request.url)
    await validateAvatarUrl(request.avatar, config.site)
    const finalFriendPage = await validateFriendPage(request.friendPage, config.site)
    const isApproval = command?.[1]?.toLowerCase() === 'approve'

    if (!isApproval) {
      await setStatusLabels(github, owner, repo, issueNumber, config, 'review')
      await comment(
        github,
        owner,
        repo,
        issueNumber,
        [
          '自动技术校验通过，正在等待维护者人工审核站点内容。',
          'Automated validation passed. The site is awaiting manual review.',
          '',
          `申请者友链页面 / Applicant friend-links page: ${finalFriendPage}`,
          '',
          '维护者可评论 / Maintainer commands:',
          '- `/approve`：重新校验并添加友链 / Revalidate and add the friend link',
          '- `/reject 原因`：拒绝申请并说明原因 / Reject with a reason'
        ].join('\n')
      )
      return
    }

    const { duplicate } = await updateLinksFile(config, request)
    if (duplicate) {
      await setStatusLabels(github, owner, repo, issueNumber, config, 'approved')
      await comment(
        github,
        owner,
        repo,
        issueNumber,
        [
          `该站点已存在于友链列表中：${duplicate.name} (${duplicate.url})。`,
          `This site is already in the friend-links list: ${duplicate.name} (${duplicate.url}).`,
          '',
          `本站友链页面 / Friend-links page: ${config.site.friendPage}`
        ].join('\n')
      )
      await github.rest.issues.update({ owner, repo, issue_number: issueNumber, state: 'closed' })
      return
    }

    await commitAndPush(config, request, issueNumber)
    await setStatusLabels(github, owner, repo, issueNumber, config, 'approved')
    await comment(
      github,
      owner,
      repo,
      issueNumber,
      [
        `自动校验通过，已添加友链 **${request.name}**。`,
        `Automated validation passed and **${request.name}** has been added.`,
        '',
        `申请者友链页面 / Applicant friend-links page: ${finalFriendPage}`,
        `本站友链页面 / Friend-links page: ${config.site.friendPage}`,
        '',
        '友链已写入仓库 `source/_data/links.yml`。请按现有流程重新构建并部署站点后生效。',
        'The friend link was written to `source/_data/links.yml`. Rebuild and deploy the site with your usual process.'
      ].join('\n')
    )
    await github.rest.issues.update({ owner, repo, issue_number: issueNumber, state: 'closed' })
  } catch (error) {
    core.warning(error)
    await setStatusLabels(github, owner, repo, issueNumber, config, 'needsUpdate')
    await comment(
      github,
      owner,
      repo,
      issueNumber,
      [
        `自动校验未通过：${error.message}`,
        `Automated validation failed: ${error.message}`,
        '',
        '请修正后由 Issue 作者回复任意内容，机器人会重新校验。',
        'After fixing the issue, the Issue author can reply to trigger validation again.',
        '',
        '本站友链信息 / Friend-link information:',
        `- 名称 / Name: ${config.site.name}`,
        `- 链接 / URL: ${config.site.url}`,
        `- 友链页面 / Friend-links page: ${config.site.friendPage}`,
        `- 头像 / Avatar: ${config.site.avatar}`,
        `- 描述 / Description: ${config.site.description}`
      ].join('\n')
    )
    core.setFailed(error.message)
  }
}
