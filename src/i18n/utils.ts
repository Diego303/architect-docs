import { ui, type Lang } from './ui';

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
 * Get the alternate language path for the current URL (for language toggle).
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

    // Map known ES-only paths to EN equivalents and vice versa
    const pathMap: Record<string, string> = {
        'casos-de-uso/': 'use-cases/',
        'use-cases/': 'casos-de-uso/',
    };

    if (targetLang === 'en') {
        // ES -> EN: translate known paths
        if (pathMap[path]) {
            path = pathMap[path];
        }
        return `${base}en/${path}`;
    } else {
        // EN -> ES: translate known paths back
        if (pathMap[path]) {
            path = pathMap[path];
        }
        return `${base}${path}`;
    }
}
