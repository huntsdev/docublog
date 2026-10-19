const info = [
  { tag: 'circle', attrs: { cx: 12, cy: 12, r: 9 } },
  { tag: 'path', attrs: { d: 'M12 11v6m0-10h.01' } },
];

export const calloutVariants = {
  info: { label: 'Info', color: '#1d4ed8', background: '#eff6ff', shapes: info },
  note: { label: 'Note', color: '#1d4ed8', background: '#eff6ff', shapes: info },
  warning: {
    label: 'Warning', color: '#92400e', background: '#fffbeb',
    shapes: [
      { tag: 'path', attrs: { d: 'm10.3 3.9-8 14a2 2 0 0 0 1.7 3h16a2 2 0 0 0 1.7-3l-8-14a2 2 0 0 0-3.4 0Z' } },
      { tag: 'path', attrs: { d: 'M12 9v4m0 4h.01' } },
    ],
  },
  danger: {
    label: 'Danger', color: '#b91c1c', background: '#fef2f2',
    shapes: [
      { tag: 'path', attrs: { d: 'M8 3h8l5 5v8l-5 5H8l-5-5V8Z' } },
      { tag: 'path', attrs: { d: 'm9 9 6 6m0-6-6 6' } },
    ],
  },
  tip: {
    label: 'Tip', color: '#166534', background: '#f0fdf4',
    shapes: [{ tag: 'path', attrs: { d: 'M9 18h6m-5 3h4M8 14a6 6 0 1 1 8 0c-.8.7-1 1.5-1 2H9c0-.5-.2-1.3-1-2Z' } }],
  },
};

/** Shared trusted vector artwork for Markdown, MDX, and PDF exports. */
export function calloutIcon(variant, color = 'currentColor') {
  const shapes = calloutVariants[variant].shapes.map(({ tag, attrs }) =>
    `<${tag} ${Object.entries(attrs).map(([key, value]) => `${key}="${value}"`).join(' ')} />`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" class="callout-icon" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes}</svg>`;
}
