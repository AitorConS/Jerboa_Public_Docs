// SEO titles, breadcrumbs, image metadata and sitemap fields.
// Page titles here override the short nav title. A `seo_title` in jerboa/docs
// (passed through by scripts/sync-docs.mjs) wins over this map.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));

export const organization = {
  '@type': 'Organization',
  '@id': 'https://jerboa.dev/#organization',
  name: 'jerboa',
  url: 'https://jerboa.dev/',
  logo: { '@type': 'ImageObject', url: 'https://jerboa.dev/jerboa.webp', width: 618, height: 618 },
  sameAs: 'https://github.com/AitorConS/jerboa',
};

export const ogImage = {
  src: '/og.png',
  alt: 'jerboa — Less to run. Less to attack.',
  width: 1200,
  height: 630,
};

/** Descriptive document titles. The layout appends " — jerboa docs". */
export const seoTitles = {
  'getting-started': 'Install and run jerboa unikernels',
  'build-concepts': 'How jerboa build makes Nanos unikernels',
  architecture: 'jerboa architecture: CLI, daemon and VMs',
  benchmarks: 'jerboa unikernel benchmarks versus Docker',
  changelog: 'What changed in each jerboa unikernel release',
  'cli-reference': 'jerboa CLI commands for unikernel VMs',
  compose: 'Run multi-service jerboa unikernel stacks',
  'macos-distribution': 'jerboa macOS app bundle for Apple Silicon',
  'macos-guide': 'Install and run jerboa unikernels on macOS',
  'macos-shutdown': 'How jerboa stops Nanos guests on macOS',
  'macos-snapshots': 'Snapshot and restore Spark VMs on macOS',
  'macos-spark': "Spark, jerboa's Firecracker fork on macOS",
  'macos-stats': 'CPU and memory stats for jerboa VMs on macOS',
  macos: 'jerboa on Apple Silicon with Nanos unikernels',
  observability: 'Metrics and health for jerboa unikernels',
  'package-recipes': 'Write and publish jerboa package recipes',
  'packages-arm64': 'Build Linux ARM64 packages for jerboa on macOS',
  'postgres-arm64': 'PostgreSQL on ARM64 Nanos with jerboa',
  'registry-protocol': 'jerboa unikernel image registry protocol',
  registry: 'Push and pull jerboa unikernel images',
  'release-process': 'How jerboa releases are built and published',
  troubleshooting: 'Fix jerboa and Nanos unikernel errors',
};

export function seoTitleFor(slug, title, override) {
  const custom = typeof override === 'string' ? override.trim() : '';
  if (custom) return custom;
  return seoTitles[slug] || title;
}

/**
 * Every crumb has a URL, and the same URL is not repeated.
 * Nav groups are not pages, so they are not crumbs.
 * The docs home is only listed once (it is both "Documentation" and itself).
 */
export function breadcrumbItems({ pageUrl, pageTitle, docsHome }) {
  const crumbs = [];
  if (pageUrl !== docsHome) crumbs.push({ name: 'Documentation', item: docsHome });
  crumbs.push({ name: pageTitle, item: pageUrl });
  return crumbs.map((crumb, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: crumb.name,
    item: crumb.item,
  }));
}

const genericAlt = /^(image|img|diagram|screenshot|photo|picture|icon|untitled)$/i;

function stripNonContent(markdown) {
  return markdown.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
}

function attr(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'));
  return match ? (match[1] ?? match[2] ?? '') : '';
}

/** Markdown and HTML images outside code spans. Empty or generic alts are reported, not indexed. */
export function extractImages(markdown) {
  const images = [];
  const missingAlt = [];
  const seen = new Set();
  const body = stripNonContent(markdown);
  const add = (src, alt, width, height) => {
    if (!src || seen.has(src)) return;
    seen.add(src);
    const text = (alt || '').replace(/\s+/g, ' ').trim();
    if (!text || genericAlt.test(text)) {
      missingAlt.push(src);
      return;
    }
    images.push({
      src,
      alt: text,
      width: width ? Number(width) : undefined,
      height: height ? Number(height) : undefined,
    });
  };
  for (const match of body.matchAll(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g)) {
    add(match[2], match[1] || match[3] || '');
  }
  for (const match of body.matchAll(/<img\b([^>]*?)\/?>/gi)) {
    const tag = match[1];
    add(attr(tag, 'src'), attr(tag, 'alt'), attr(tag, 'width'), attr(tag, 'height'));
  }
  return { images, missingAlt };
}

export function readImageSize(filePath) {
  let buf;
  try {
    buf = readFileSync(filePath);
  } catch {
    return null;
  }
  if (buf.length > 24 && buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.toString('ascii', 0, 6) === 'GIF87a' || buf.toString('ascii', 0, 6) === 'GIF89a') {
    return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = buf.toString('ascii', 12, 16);
    if (chunk === 'VP8X' && buf.length >= 30) {
      return {
        width: 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16)),
        height: 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16)),
      };
    }
    if (chunk === 'VP8 ' && buf.length >= 30) {
      return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    }
    if (chunk === 'VP8L' && buf.length >= 25) {
      const b0 = buf[21];
      const b1 = buf[22];
      const b2 = buf[23];
      const b3 = buf[24];
      return {
        width: 1 + (((b1 & 0x3f) << 8) | b0),
        height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
      };
    }
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 8) {
      if (buf[i] !== 0xff) {
        i += 1;
        continue;
      }
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      i += 2 + len;
    }
  }
  return null;
}

function localImagePath(src, fromDir) {
  if (!src || /^(https?:|data:)/i.test(src)) return null;
  const decoded = decodeURIComponent(src.split(/[?#]/)[0]);
  if (decoded.startsWith('/')) {
    const file = path.join(root, 'public', decoded.slice(1));
    return existsSync(file) ? file : null;
  }
  if (!fromDir) return null;
  const file = path.resolve(fromDir, decoded);
  return existsSync(file) ? file : null;
}

export function absoluteImageUrl(src, pageUrl) {
  if (/^https?:\/\//i.test(src)) return src;
  if (src.startsWith('/')) return new URL(src, pageUrl).href;
  return new URL(src, pageUrl).href;
}

export function resolveImages(images, pageUrl, sourceFile) {
  const fromDir = sourceFile
    ? path.dirname(path.isAbsolute(sourceFile) ? sourceFile : path.join(root, 'src/pages', sourceFile))
    : null;
  return images.map((image) => {
    const size = image.width && image.height ? null : readImageSize(localImagePath(image.src, fromDir));
    return {
      ...image,
      url: absoluteImageUrl(image.src, pageUrl),
      width: image.width || size?.width,
      height: image.height || size?.height,
    };
  });
}

function imageObject(image) {
  const node = { '@type': 'ImageObject', url: image.url, caption: image.alt };
  if (image.width) node.width = image.width;
  if (image.height) node.height = image.height;
  return node;
}

function representativeImage(pageUrl) {
  return imageObject({
    url: new URL(ogImage.src, pageUrl).href,
    alt: ogImage.alt,
    width: ogImage.width,
    height: ogImage.height,
  });
}

/** In-page figures when the doc has them; otherwise the Open Graph card. */
export function articleImages({ markdown, pageUrl, sourceFile }) {
  const { images } = extractImages(markdown);
  const resolved = resolveImages(images, pageUrl, sourceFile);
  if (resolved.length) return resolved.map(imageObject);
  return [representativeImage(pageUrl)];
}

let pageCache;
/** Slug metadata for the sitemap: lastmod from src/data/lastmod.json, figures from the markdown snapshot. */
export function pageIndex(site = 'https://docs.jerboa.dev') {
  if (pageCache) return pageCache;
  const lastmod = JSON.parse(readFileSync(path.join(root, 'src/data/lastmod.json'), 'utf8'));
  const byUrl = new Map();
  const missingAlt = [];
  for (const file of readdirSync(path.join(root, 'src/pages'))) {
    if (!file.endsWith('.md')) continue;
    const slug = file.slice(0, -3);
    const url = new URL(`${slug}/`, site.endsWith('/') ? site : `${site}/`).href;
    const markdown = readFileSync(path.join(root, 'src/pages', file), 'utf8');
    const extracted = extractImages(markdown);
    for (const src of extracted.missingAlt) missingAlt.push(`${file} (${src})`);
    byUrl.set(url, {
      slug,
      lastmod: lastmod[slug],
      images: resolveImages(extracted.images, url, file),
    });
  }
  pageCache = { byUrl, missingAlt };
  return pageCache;
}

/** Sitemap <url> extras. The Open Graph card is listed on the docs home, the one page it represents. */
export function sitemapFields(url, meta) {
  const fields = {};
  if (meta?.lastmod) fields.lastmod = meta.lastmod;
  let images = meta?.images ?? [];
  if (!images.length && /\/getting-started\/$/.test(url)) {
    images = [{ url: new URL(ogImage.src, url).href, alt: ogImage.alt }];
  }
  if (images.length) {
    fields.img = images.map((image) => ({ url: image.url, title: image.alt, caption: image.alt }));
  }
  return fields;
}
