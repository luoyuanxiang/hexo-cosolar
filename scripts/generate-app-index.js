'use strict';

/**
 * 生成 App 用结构化索引：public/api/app-index.json
 * 放入 Hexo 根目录 scripts/ 后，执行 hexo g 自动生成。
 */
const fs = require('fs');
const path = require('path');

hexo.extend.generator.register('app_index', function (locals) {
  const config = this.config;
  const theme = this.theme;
  const siteUrl = (config.url || '').replace(/\/$/, '');

  const posts = locals.posts
    .sort('-date')
    .filter((p) => p.published !== false)
    .map((post) => {
      const pathName = post.path.startsWith('/') ? post.path : `/${post.path}`;
      return {
        id: pathName.replace(/^\/posts\//, '').replace(/\/$/, '') || post.slug,
        title: post.title,
        url: siteUrl + pathName,
        path: pathName.endsWith('/') ? pathName : `${pathName}/`,
        excerpt: (post.description || post.excerpt || '').replace(/<[^>]+>/g, '').trim(),
        cover: post.cover || post.photos?.[0] || '',
        date: post.date ? post.date.format('YYYYMMDDHHmmss') : '',
        dateLabel: post.date ? post.date.format('YYYY-MM-DD') : '',
        tags: (post.tags || []).map((t) => t.name),
        categories: (post.categories || []).map((c) => c.name),
        sticky: !!(post.sticky || post.top),
        wordCount: (post.content || '').replace(/<[^>]+>/g, '').length
      };
    });

  const featuredCfg = (theme.featured || {});
  const featuredMax = featuredCfg.featured_max_count || 5;
  let featured = [];
  if (featuredCfg.show_featured !== false) {
    const pinned = posts.filter((p) => p.sticky).slice(0, featuredMax);
    featured = (pinned.length ? pinned : posts.slice(0, featuredMax)).map((p) => ({
      title: p.title,
      url: p.url,
      path: p.path,
      desc: p.excerpt,
      cover: p.cover || `${siteUrl}/images/featured-default.png`,
      badge: p.sticky ? '置顶' : '最新发布'
    }));
  }

  const categories = locals.categories.map((c) => ({
    name: c.name,
    url: siteUrl + '/' + c.path,
    path: '/' + c.path,
    count: c.length
  }));

  const tags = locals.tags.map((t) => ({
    name: t.name,
    url: siteUrl + '/' + t.path,
    path: '/' + t.path,
    count: t.length
  }));

  // archives by year/month
  const archiveMap = {};
  posts.forEach((p) => {
    if (!p.dateLabel || p.dateLabel.length < 7) return;
    const year = p.dateLabel.slice(0, 4);
    const month = `${p.dateLabel.slice(5, 7)} 月`;
    if (!archiveMap[year]) archiveMap[year] = {};
    if (!archiveMap[year][month]) archiveMap[year][month] = [];
    archiveMap[year][month].push({
      title: p.title,
      url: p.url,
      path: p.path,
      dateLabel: p.dateLabel.slice(5)
    });
  });
  const archives = Object.keys(archiveMap)
    .sort((a, b) => b.localeCompare(a))
    .map((year) => ({
      year,
      months: Object.keys(archiveMap[year]).map((label) => ({
        label,
        posts: archiveMap[year][label]
      }))
    }));

  // links from data file
  const linksData = locals.data && locals.data.links ? locals.data.links : null;
  const linkGroups = [];
  if (linksData && linksData.groups && linksData.links) {
    linksData.groups.forEach((g) => {
      linkGroups.push({
        name: g.name,
        displayName: g.display_name || g.name,
        links: (linksData.links || [])
          .filter((l) => l.group === g.name)
          .map((l) => ({
            name: l.name,
            url: l.url,
            logo: l.logo || '',
            description: l.description || '',
            group: g.name
          }))
      });
    });
  }

  const menu = (theme.menu || []).map((m) => ({
    name: m.name,
    url: m.url || '#',
    external: !!(m.url && /^https?:\/\//.test(m.url))
  }));

  const payload = {
    updatedAt: Date.now(),
    siteName: (theme.basic && theme.basic.logo_text) || config.title || '墨韵云阁',
    tagline: (theme.basic && theme.basic.tagline) || config.subtitle || '',
    posts,
    featured,
    categories,
    tags,
    archives,
    links: linkGroups,
    aboutHtml: '',
    menus: menu,
    homePage: 1,
    homeTotalPages: Math.max(1, Math.ceil(posts.length / (config.index_generator?.per_page || 10)))
  };

  return {
    path: 'api/app-index.json',
    data: JSON.stringify(payload)
  };
});
