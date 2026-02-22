export interface VersionConfig {
  id: string;
  label: string;
  isLatest: boolean;
}

export const VERSIONS: VersionConfig[] = [
  { id: 'v0-16-1', label: 'v0.16.1', isLatest: true },
  { id: 'v0-15-3', label: 'v0.15.3', isLatest: false },
];

export const LATEST_VERSION = VERSIONS.find(v => v.isLatest)!;
export const DEFAULT_VERSION_ID = LATEST_VERSION.id;

export function getVersionFromSlug(slug: string): string | null {
  const match = slug.match(/^(v[\d-]+)\//);
  return match ? match[1] : null;
}

export function getDocSlug(slug: string): string {
  return slug.replace(/^v[\d-]+\//, '');
}
