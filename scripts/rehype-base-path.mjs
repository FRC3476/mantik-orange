import { visit } from 'unist-util-visit';

/**
 * Rewrites internal links (starting with "/") so they include the
 * site's base path when deployed to a subfolder (e.g. GitHub Pages
 * project sites like /mantik-orange/). External links, anchors,
 * and already-prefixed links are left untouched.
 */
export function rehypeBasePath(base) {
  const prefix = base.endsWith('/') ? base.slice(0, -1) : base;

  return function transformer(tree) {
    visit(tree, 'element', (node) => {
      if (node.tagName !== 'a' && node.tagName !== 'link') return;
      const href = node.properties?.href;
      if (typeof href !== 'string') return;

      const isInternal = href.startsWith('/') && !href.startsWith('//');
      const alreadyPrefixed = prefix === '' || href === prefix || href.startsWith(prefix + '/');
      if (isInternal && !alreadyPrefixed) {
        node.properties.href = prefix + href;
      }
    });
  };
}