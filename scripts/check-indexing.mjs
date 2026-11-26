// Redirects and the two macOS search snippets.
// `trailingSlash: true` on Vercel 308s every extension-less path before the
// file lookup, so a missing URL never gets to answer 404. Redirects are
// listed only for real pages and for renamed URLs. This matches path-to-regexp
// with strict: true, which is how Vercel compiles a redirect source.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { seoDescriptionFor, seoTitleFor } from '../src/lib/seo.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const failures = [];
const fail = (message) => failures.push(message);

const docs = JSON.parse(readFileSync(path.join(root, 'src/data/docs.json'), 'utf8'));
const vercel = JSON.parse(readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const slugs = docs.pages.map((page) => page.slug);
const slugSet = new Set(slugs);
if (slugSet.size !== slugs.length) fail('docs.json has duplicate slugs');
for (const slug of slugs) {
  if (!/^[a-z0-9-]+$/.test(slug)) fail(`slug is not a single path segment: ${slug}`);
}

if ('trailingSlash' in vercel) {
  fail('Omit trailingSlash. true redirects every missing path to a slash URL (308) before a 404 can be returned.');
}

const legacy = new Map([
  ['/', '/getting-started/'],
  ['/index.html', '/getting-started/'],
  ['/docs', '/getting-started/'],
  ['/docs/', '/getting-started/'],
  ['/docs/index.html', '/getting-started/'],
  ['/macos-firecracker', '/macos-spark/'],
  ['/macos-firecracker/', '/macos-spark/'],
  ['/macos-firecracker.html', '/macos-spark/'],
  ['/docs/macos-firecracker', '/macos-spark/'],
  ['/docs/macos-firecracker/', '/macos-spark/'],
  ['/docs/macos-firecracker.html', '/macos-spark/'],
]);

function escapeReg(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const rules = [];
for (const rule of vercel.redirects ?? []) {
  if (rule.permanent !== true) fail(`${rule.source} is not a permanent redirect`);
  if (rule.source.includes('*') || rule.source.includes(':path') || rule.source.includes(':page')) {
    fail(`Redirect source can match a URL that does not exist: ${rule.source}`);
  }
  const parametric = rule.source.match(/^(.*):slug\(([^)]+)\)(.*)$/);
  let match;
  if (!parametric) {
    if (rule.source.includes(':')) fail(`Unsupported redirect source: ${rule.source}`);
    match = (pathname) => (pathname === rule.source ? {} : null);
  } else {
    const [, prefix, body, suffix] = parametric;
    const alts = body.split('|');
    const altSet = new Set(alts);
    if (altSet.size !== slugs.length || slugs.some((slug) => !altSet.has(slug))) {
      fail(`Redirect ${rule.source} must list exactly the docs.json slugs`);
    }
    const re = new RegExp(`^${escapeReg(prefix)}(${alts.map(escapeReg).join('|')})${escapeReg(suffix)}$`);
    match = (pathname) => {
      const hit = re.exec(pathname);
      return hit ? { slug: hit[1] } : null;
    };
  }
  rules.push({ ...rule, match });
}

function follow(pathname) {
  for (const rule of rules) {
    const params = rule.match(pathname);
    if (!params) continue;
    const location = rule.destination.replaceAll(':slug', params.slug ?? '');
    return { location, source: rule.source };
  }
  return null;
}

const canonical = new Set(slugs.map((slug) => `/${slug}/`));
const seen = new Set();
for (const rule of rules) {
  if (seen.has(rule.source)) fail(`Duplicate redirect source: ${rule.source}`);
  seen.add(rule.source);
  if (rule.source.includes(':slug(')) continue;
  const expected = legacy.get(rule.source);
  if (!expected) fail(`Unexpected redirect: ${rule.source} → ${rule.destination}`);
  else if (rule.destination !== expected) fail(`${rule.source} goes to ${rule.destination}, expected ${expected}`);
}
for (const source of legacy.keys()) {
  if (!seen.has(source)) fail(`Missing legacy redirect: ${source}`);
}

const parametricSources = rules.filter((rule) => rule.source.includes(':slug(')).map((rule) => rule.source.replace(/:slug\([^)]+\)/, ':slug'));
const expectedShapes = ['/:slug', '/:slug.html', '/docs/:slug', '/docs/:slug/'];
for (const shape of expectedShapes) {
  if (!parametricSources.includes(shape)) fail(`Missing redirect shape ${shape}`);
}
if (parametricSources.length !== expectedShapes.length) fail(`Unexpected parametric redirects: ${parametricSources.join(', ')}`);

for (const slug of slugs) {
  for (const [source, destination] of [
    [`/${slug}`, `/${slug}/`],
    [`/${slug}.html`, `/${slug}/`],
    [`/docs/${slug}`, `/${slug}/`],
    [`/docs/${slug}/`, `/${slug}/`],
  ]) {
    const hit = follow(source);
    if (!hit || hit.location !== destination) fail(`${source} → ${hit?.location ?? 'no redirect'}, expected ${destination}`);
  }
  if (follow(`/${slug}/`)) fail(`/${slug}/ redirects, so the canonical page would not answer 200`);
}

for (const [source, destination] of legacy) {
  const hit = follow(source);
  if (!hit || hit.location !== destination) fail(`${source} → ${hit?.location ?? 'no redirect'}, expected ${destination}`);
}

for (const rule of rules) {
  const sample = rule.source.includes(':slug(') ? rule.source.replace(/:slug\([^)]+\)/, 'getting-started') : rule.source;
  const hit = follow(sample);
  if (!hit) fail(`Could not resolve ${rule.source}`);
  else if (follow(hit.location)) fail(`${sample} redirects to ${hit.location}, which redirects again`);
  else if (!canonical.has(hit.location)) fail(`${sample} lands on ${hit.location}, which is not a docs page`);
}

for (const pathname of [
  '/no-existe',
  '/no-existe/',
  '/404',
  '/404/',
  '/404.html',
  '/foo.html',
  '/docs/no-existe',
  '/docs/no-existe/',
  '/og.png',
  '/sitemap.xml',
  '/fonts/geist-latin.woff2',
]) {
  const hit = follow(pathname);
  if (hit) fail(`${pathname} should 404, but redirects to ${hit.location}`);
}

function frontValue(file, key) {
  const raw = readFileSync(path.join(root, 'src/pages', file), 'utf8');
  const frontmatter = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const line = frontmatter?.[1].match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  return line ? JSON.parse(line[1]) : undefined;
}

function assertSnippet(label, text) {
  if (!text) fail(`${label} is empty`);
  if (!/\bjerboa\b/i.test(text)) fail(`${label} does not name jerboa`);
  if (!/unikernel/i.test(text)) fail(`${label} does not say unikernel`);
  if (text.length > 160) fail(`${label} is ${text.length} characters`);
}

const guideTitle = seoTitleFor('macos-guide', 'Using Jerboa on macOS', frontValue('macos-guide.md', 'seoTitle'));
const portTitle = seoTitleFor('macos', 'macOS Apple Silicon', frontValue('macos.md', 'seoTitle'));
assertSnippet('macos-guide title', guideTitle);
assertSnippet('macos title', portTitle);
if (guideTitle === portTitle) fail('macOS titles are identical');
if (guideTitle === 'Install and run jerboa unikernels on macOS') fail('macos-guide title still competes with the port page');
if (portTitle === 'jerboa on Apple Silicon with Nanos unikernels') fail('macos title is still the broad Apple Silicon query');
if (!guideTitle.startsWith('Install and use ')) fail(`macos-guide title does not lead with the install guide: ${guideTitle}`);
if (!portTitle.startsWith('Build the native ')) fail(`macos title does not lead with the port: ${portTitle}`);

const guideDescription = seoDescriptionFor('macos-guide', frontValue('macos-guide.md', 'description'));
const portDescription = seoDescriptionFor('macos', frontValue('macos.md', 'description'));
assertSnippet('macos-guide description', guideDescription);
assertSnippet('macos description', portDescription);
if (guideDescription === portDescription) fail('macOS descriptions are identical');
if (guideDescription === frontValue('macos-guide.md', 'description')) {
  fail('macos-guide still publishes the synced description, which does not separate it from the port page');
}
if (!/Desktop/.test(guideDescription) || /QEMU/.test(guideDescription)) {
  fail('macos-guide description should be the install guide, not the QEMU port');
}
if (!/QEMU/.test(portDescription) || !/HVF/.test(portDescription) || /Desktop/.test(portDescription)) {
  fail('macos description should be the native port, not the install guide');
}

if (failures.length) {
  for (const message of failures) console.error(message);
  process.exit(1);
}
console.log(`Indexing checks passed (${slugs.length} canonical pages, ${rules.length} redirects).`);
