const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/**
 * Rewrites href="/..." and src="/..." attributes inside a raw HTML string
 * so they include the site's base path (e.g. "/mantik-orange" on GitHub
 * Pages). Content components that use `set:html` render raw strings
 * directly and bypass Astro's markdown/rehype pipeline, so links written
 * as plain `<a href="/...">` inside MDX props need this explicit pass.
 *
 * Root-relative paths only ("/java/...") are rewritten. Protocol-relative
 * ("//...") and absolute URLs ("https://...") are left untouched.
 */
export function withBase(html: string | undefined | null): string {
  if (!html || !BASE) return html ?? '';
  return html.replace(/(href|src)="\/(?!\/)/g, (_match, attr: string) => `${attr}="${BASE}/`);
}