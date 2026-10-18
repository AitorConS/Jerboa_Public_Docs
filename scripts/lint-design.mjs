// Fails when site code uses a value that is not a design token, or a pattern
// banned in DESIGN_RULES.md. Tokens live only in src/styles/tokens.css.
//
//   node scripts/lint-design.mjs        (pnpm run lint:design)
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const tokens = path.join(root, 'src/styles/tokens.css');

// [pattern, message, appliesTo(file)]; `all` checks every source file.
const all = () => true;
const styles = (f) => /\.(css|astro)$/.test(f);
const rules = [
  // Ban 3: arbitrary values. 1px is the hairline width and 0 needs no unit.
  [/(?<![\w-])(?!1px\b)\d*\.?\d+(px|rem)\b/g, 'literal length: use a --space/--text/--radius/size token', styles],
  [/#[0-9a-fA-F]{3,8}\b(?![\w-])/g, 'literal colour: use a colour role token', styles],
  [/\b(rgba?|hsla?|oklch)\(/g, 'literal colour function: use a colour role token', styles],
  [/\d+m?s\b(?=[^;{}]*(transition|animation)|\s*(ease|linear|cubic))/g, 'literal duration: use a --duration token', styles],
  // Ban 1 and the anchor: no gradients at all.
  [/gradient\(/g, 'gradient: the anchor allows none', styles],
  // Anchor: elevation is a border, never a shadow or blur.
  [/box-shadow:\s*(?!none|var\(--shadow\))/g, 'shadow: use a --border hairline', styles],
  [/backdrop-filter|filter:\s*blur/g, 'blur: not allowed by the anchor', styles],
  [/transition:\s*all\b/g, 'transition: all: list properties', styles],
  [/outline:\s*(none|0)\b/g, 'outline removed without replacement', styles],
  // Ban 4: default font tells.
  [/\b(Inter|Roboto|Open Sans|Poppins|Lato|Montserrat|Newsreader)\b/g, 'font outside the token set', all],
  // Ban 2: filler copy and generic CTAs.
  [/Lorem ipsum|Lightning fast|Blazing fast|Powered by AI|Built for the modern|Unleash the power|Get started in seconds|The future of|Beautiful and intuitive|Seamlessly integrate|Take your \w+ to the next level|Effortlessly|Reimagined/gi, 'filler copy', all],
  [/>\s*(Get Started|Learn More|Click Here|Submit)\s*(→)?\s*</g, 'generic CTA label', all],
  // Buzzwords in code, comments or copy.
  [/\b(clean|modern|professional|sleek|premium|beautiful|elegant)\b/gi, 'buzzword', all],
];

const files = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(p);
    else if (/\.(astro|css|ts|mjs)$/.test(entry.name)) files.push(p);
  }
}
await walk(path.join(root, 'src'));

let problems = 0;
for (const file of files) {
  if (file === tokens) continue;
  const text = await readFile(file, 'utf8');
  const lines = text.split('\n');
  for (const [pattern, message, applies] of rules) {
    if (!applies(file)) continue;
    lines.forEach((line, i) => {
      // HTML attributes cannot read CSS variables; this one must equal --bg.
      if (line.includes('name="theme-color"')) return;
      for (const m of line.matchAll(pattern)) {
        problems++;
        console.log(`${path.relative(root, file)}:${i + 1}:${m.index + 1}  ${message}  (${m[0].trim()})`);
      }
    });
  }
}
console.log(problems ? `\n${problems} design problems.` : 'lint:design: 0 problems.');
process.exitCode = problems ? 1 : 0;
