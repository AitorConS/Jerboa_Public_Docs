// Fails when a link in the built site points at an anchor that is not on the
// page it names. The pages are generated from jerboa/docs, where a heading can
// be renamed without anyone seeing the links that pointed at it.
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const pages = new Map();
for (const entry of await readdir(dist, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const html = await readFile(path.join(dist, entry.name, 'index.html'), 'utf8').catch(() => null);
  if (html !== null) pages.set(`/${entry.name}/`, html);
}
const ids = new Map([...pages].map(([url, html]) => [url, new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]))]));
const broken = [];
for (const [url, html] of pages) {
  for (const [, href] of html.matchAll(/\shref="([^"]+)"/g)) {
    const hash = href.indexOf('#');
    if (hash < 0 || hash === href.length - 1) continue;
    const page = hash === 0 ? url : href.slice(0, hash);
    const anchor = decodeURIComponent(href.slice(hash + 1));
    if (ids.has(page) && !ids.get(page).has(anchor)) broken.push(`${url} -> ${href}`);
  }
}
for (const link of [...new Set(broken)].sort()) console.error(`Broken anchor: ${link}`);
console.log(`${pages.size} pages checked; ${new Set(broken).size} broken anchors.`);
if (broken.length) process.exitCode = 1;
