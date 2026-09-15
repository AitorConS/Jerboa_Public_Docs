import rawMetadata from '../../metadata.json';

export type Release = {
  version: string;
  date: string;
  downloadUrl: string;
  tag?: string | null;
  notes: string[];
};

function requiredText(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} must be a non-empty string.`);
}

function downloadUrl(value: unknown, field: string): asserts value is string {
  requiredText(value, field);
  let url: URL;
  try { url = new URL(value); } catch { throw new Error(`${field} must be an absolute HTTP(S) URL.`); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`${field} must use HTTP(S).`);
}

requiredText(rawMetadata.version, 'metadata.json: version');
downloadUrl(rawMetadata.downloadUrl, 'metadata.json: downloadUrl');
downloadUrl(rawMetadata.linuxInstallUrl, 'metadata.json: linuxInstallUrl');
export const metadata = rawMetadata;
// Quote the URL as a shell argument, including URLs containing query strings or apostrophes.
const shellQuote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
export const linuxInstallCommand = `curl -fsSL ${shellQuote(metadata.linuxInstallUrl)} | sudo bash`;

const files = import.meta.glob('../../releases/*.json', { eager: true, import: 'default' });
const versions = new Set<string>();
export const releases = Object.entries(files).map(([file, value]) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${file} must contain a release object.`);
  const release = value as Release;
  requiredText(release.version, `${file}: version`);
  requiredText(release.date, `${file}: date`);
  const parsedDate = new Date(release.date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(release.date) || !Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== release.date) {
    throw new Error(`${file}: date must be a valid YYYY-MM-DD date.`);
  }
  downloadUrl(release.downloadUrl, `${file}: downloadUrl`);
  if (!Array.isArray(release.notes) || release.notes.some(note => typeof note !== 'string' || !note.trim())) {
    throw new Error(`${file}: notes must be an array of non-empty strings.`);
  }
  if (release.tag != null) requiredText(release.tag, `${file}: tag`);
  if (versions.has(release.version)) throw new Error(`${file}: duplicate version ${release.version}.`);
  versions.add(release.version);
  return release;
}).sort((a, b) => b.date.localeCompare(a.date) || b.version.localeCompare(a.version, 'en', { numeric: true }));
