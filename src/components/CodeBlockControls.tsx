import { createRoot, type Root } from 'react-dom/client';
import { CopyButton } from './animate-ui/components/buttons/copy';

const roots = new Set<Root>();

export function mountCodeCopyButton(container: HTMLElement, content: string) {
  const root = createRoot(container);
  roots.add(root);
  root.render(<CopyButton content={content} variant="ghost" size="sm" className="code-copy" aria-label="Copy code" />);
}

document.addEventListener('astro:before-swap', () => {
  roots.forEach(root => root.unmount());
  roots.clear();
});
