import { calloutVariants } from './callouts.mjs';

const element = (tagName, properties, children = []) => ({ type: 'element', tagName, properties, children });
const text = value => ({ type: 'text', value });

/** Sätteri HAST plugin: transform marked blockquotes without changing their Markdown body. */
export default {
  name: 'hunts-callouts',
  element: {
    filter: ['blockquote'],
    visit(node) {
      const children = node.children;
      const first = children.find(child => child.type === 'element');
      const marker = first?.tagName === 'p' && first.children[0];
      if (marker?.type !== 'text') return;
      const match = /^\[!(INFO|WARNING|DANGER|NOTE|TIP)\][ \t]*(?:\r?\n|$)/i.exec(marker.value);
      if (!match) return;
      const variant = match[1].toLowerCase();
      const { label, shapes } = calloutVariants[variant];
      const paragraph = { ...first, children: [{ ...marker, value: marker.value.slice(match[0].length) }, ...first.children.slice(1)] };
      const hasBody = paragraph.children.some(child => child.type !== 'text' || child.value.trim());
      const body = children.flatMap(child => child === first ? (hasBody ? [paragraph] : []) : [child]);
      const icon = element('svg', {
        className: ['callout-icon'], xmlns: 'http://www.w3.org/2000/svg', width: 19, height: 19,
        viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75,
        strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true',
      }, shapes.map(({ tag, attrs }) => element(tag, attrs)));
      return element('aside', { className: ['callout'], 'data-variant': variant, role: 'note', 'aria-label': label }, [
        element('p', { className: ['callout-title'] }, [icon, element('span', {}, [text(label)])]),
        element('div', { className: ['callout-body'] }, body),
      ]);
    },
  },
};
