import { ui, type Lang } from './ui';
import { VERSIONS } from '../config/versions';

export type { Lang };

/**
 * Get a translated string by dot-separated key.
 * Falls back to Spanish if the key is missing in the target language.
 */
export function t(key: string, lang: Lang = 'es'): string {
    const keys = key.split('.');
    let result: unknown = ui[lang];

    for (const k of keys) {
        if (result && typeof result === 'object' && k in result) {
            result = (result as Record<string, unknown>)[k];
        } else {
            // Fallback to Spanish
            let fallback: unknown = ui['es'];
            for (const fk of keys) {
                if (fallback && typeof fallback === 'object' && fk in fallback) {
                    fallback = (fallback as Record<string, unknown>)[fk];
                } else {
                    return key; // Return key if not found at all
                }
            }
            return typeof fallback === 'string' ? fallback : key;
        }
    }

    return typeof result === 'string' ? result : key;
}

/**
 * Get an array of translated strings by dot-separated key.
 */
export function tArray(key: string, lang: Lang = 'es'): string[] {
    const keys = key.split('.');
    let result: unknown = ui[lang];

    for (const k of keys) {
        if (result && typeof result === 'object' && k in result) {
            result = (result as Record<string, unknown>)[k];
        } else {
            // Fallback to Spanish
            let fallback: unknown = ui['es'];
            for (const fk of keys) {
                if (fallback && typeof fallback === 'object' && fk in fallback) {
                    fallback = (fallback as Record<string, unknown>)[fk];
                } else {
                    return [];
                }
            }
            return Array.isArray(fallback) ? fallback : [];
        }
    }

    return Array.isArray(result) ? result : [];
}

/**
 * Extract language from URL path.
 */
export function getLangFromUrl(url: URL): Lang {
    const base = import.meta.env.BASE_URL; // e.g. "/architect-docs/"
    const path = url.pathname.replace(base, '');
    if (path.startsWith('en/') || path === 'en') {
        return 'en';
    }
    return 'es';
}

/**
 * Generate a localized path. For 'es' (default), no prefix.
 * For 'en', adds /en/ after the base URL.
 */
export function getLocalizedPath(path: string, lang: Lang): string {
    const base = import.meta.env.BASE_URL; // "/architect-docs/"
    // Remove base prefix if present
    const cleanPath = path.startsWith(base) ? path.slice(base.length) : path;
    if (lang === 'en') {
        return `${base}en/${cleanPath}`;
    }
    return `${base}${cleanPath}`;
}

/**
 * Ensure a path ends with a trailing slash.
 */
function ensureTrailingSlash(path: string): string {
    return path.endsWith('/') ? path : path + '/';
}

/**
 * Page-level route mappings for paths that differ between languages.
 * Doc slugs are NOT mapped here — filenames are identical across languages.
 */
const PAGE_PATH_MAP: Record<string, string> = {
    'casos-de-uso': 'use-cases',
    'use-cases': 'casos-de-uso',
};

/**
 * Get the EN-available version IDs (only versions that have English translations).
 */
const EN_VERSION_IDS = new Set(VERSIONS.filter(v => v.isLatest).map(v => v.id));

/**
 * Get the alternate language path for the current URL (for language toggle).
 * For doc pages, filenames match between languages — only the /en/ prefix changes.
 * For doc versions without EN translations, redirects to the EN docs index.
 */
export function getAlternateLangPath(url: URL, targetLang: Lang): string {
    const base = import.meta.env.BASE_URL;
    let path = url.pathname.replace(base, '');

    // Remove existing 'en/' prefix if present
    if (path.startsWith('en/')) {
        path = path.slice(3);
    } else if (path === 'en') {
        path = '';
    }

    // Normalize: remove trailing slash for consistent matching
    const cleanPath = path.replace(/\/$/, '');

    // Check if this is a doc page: docs/{version}/{slug}
    const docMatch = cleanPath.match(/^docs\/(v[\d-]+)\/.+$/);

    if (docMatch && targetLang === 'en') {
        const versionId = docMatch[1];
        // If this version has no EN translation, redirect to EN docs index
        if (!EN_VERSION_IDS.has(versionId)) {
            return ensureTrailingSlash(`${base}en/docs/`);
        }
    }

    // Map page-level routes that differ between languages
    const firstSegment = cleanPath.split('/')[0];
    if (PAGE_PATH_MAP[firstSegment]) {
        path = cleanPath.replace(firstSegment, PAGE_PATH_MAP[firstSegment]);
    } else {
        path = cleanPath;
    }

    if (targetLang === 'en') {
        return ensureTrailingSlash(`${base}en/${path}`);
    }
    return ensureTrailingSlash(`${base}${path}`);
}
