// Adds width and height to local content images that do not already declare them.
import { readImageSize } from './seo.mjs';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));

function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  visit(node);
  for (const child of node.children || []) walk(child, visit);
}

function localFile(src, fromFile) {
  if (!src || /^(https?:|data:)/i.test(src)) return null;
  const decoded = decodeURIComponent(src.split(/[?#]/)[0]);
  const candidate = decoded.startsWith('/')
    ? path.join(root, 'public', decoded.slice(1))
    : fromFile
      ? path.resolve(path.dirname(fromFile), decoded)
      : null;
  return candidate && existsSync(candidate) ? candidate : null;
}

export function rehypeImgDimensions() {
  return (tree, file) => {
    const fromFile = file?.path || file?.history?.[0];
    walk(tree, (node) => {
      if (node.type !== 'element' || node.tagName !== 'img') return;
      const props = node.properties ?? {};
      if (props.width && props.height) return;
      const src = typeof props.src === 'string' ? props.src : '';
      const size = readImageSize(localFile(src, fromFile) ?? '');
      if (!size) return;
      props.width = size.width;
      props.height = size.height;
      node.properties = props;
    });
  };
}
