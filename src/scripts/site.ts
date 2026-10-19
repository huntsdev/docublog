import './image-viewer';
import './sidebar';
import './listings';
document.querySelectorAll('[data-open-search]').forEach(button => button.addEventListener('click', () => {
  document.querySelector<HTMLButtonElement>('.search-trigger')?.click();
}));

const outlineLinks = [...document.querySelectorAll<HTMLAnchorElement>('.outline-nav a')];
const outlineObserver = new IntersectionObserver(entries => {
  const entry = entries.find(item => item.isIntersecting);
  if (!entry) return;
  outlineLinks.forEach(link => link.classList.toggle('is-active', link.hash === `#${entry.target.id}`));
}, { rootMargin: '-90px 0px -65% 0px', threshold: 0 });
outlineLinks.forEach(link => {
  const heading = document.getElementById(decodeURIComponent(link.hash.slice(1)));
  if (heading) outlineObserver.observe(heading);
  link.addEventListener('click', () => outlineLinks.forEach(other => other.classList.toggle('is-active', other === link)));
});
document.querySelectorAll<HTMLElement>('.prose h2[id], .prose h3[id]').forEach(heading => {
  const anchor = document.createElement('a');
  anchor.href = `#${heading.id}`;
  anchor.className = 'heading-anchor';
  anchor.setAttribute('aria-label', `Link to ${heading.textContent}`);
  anchor.textContent = '#';
  heading.prepend(anchor);
});
document.querySelectorAll<HTMLTableElement>('.prose table').forEach(table => {
  const wrapper = document.createElement('div');
  wrapper.className = 'table-scroll';
  wrapper.tabIndex = 0;
  wrapper.setAttribute('role', 'region');
  wrapper.setAttribute('aria-label', 'Scrollable table');
  table.before(wrapper);
  wrapper.append(table);
});

async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}
const languageNames: Record<string, string> = {
  powershell: 'PowerShell', ps1: 'PowerShell', ps: 'PowerShell', pwsh: 'PowerShell',
  javascript: 'JavaScript', js: 'JavaScript', jsx: 'JSX', typescript: 'TypeScript', ts: 'TypeScript', tsx: 'TSX',
  bash: 'Bash', sh: 'Shell', shell: 'Shell', shellscript: 'Shell', shellsession: 'Terminal', console: 'Terminal',
  python: 'Python', py: 'Python', json: 'JSON', jsonc: 'JSONC', yaml: 'YAML', yml: 'YAML', toml: 'TOML',
  html: 'HTML', css: 'CSS', scss: 'SCSS', sql: 'SQL', md: 'Markdown', markdown: 'Markdown', mdx: 'MDX',
  csharp: 'C#', cs: 'C#', cpp: 'C++', c: 'C', go: 'Go', rust: 'Rust', rs: 'Rust', java: 'Java',
  dockerfile: 'Dockerfile', docker: 'Dockerfile', hcl: 'HCL', terraform: 'Terraform', diff: 'Diff',
  text: 'Plain text', txt: 'Plain text', plaintext: 'Plain text',
};
const codeControls: { mount: HTMLElement; content: string }[] = [];
document.querySelectorAll<HTMLElement>('.prose pre').forEach(pre => {
  const code = pre.querySelector('code');
  if (!code || pre.parentElement?.classList.contains('code-block')) return;
  const identifier = (pre.dataset.language || [...code.classList].find(value => value.startsWith('language-'))?.slice(9) || '').trim();
  const block = document.createElement('div');
  block.className = 'code-block';
  const toolbar = document.createElement('div');
  toolbar.className = 'code-toolbar';
  const language = document.createElement('span');
  language.className = 'code-language';
  const languageIcon = document.createElement('span');
  languageIcon.className = 'code-language-icon';
  languageIcon.setAttribute('aria-hidden', 'true');
  languageIcon.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m4 7 5 5-5 5M12 18h8" /></svg>';
  const label = document.createElement('span');
  label.textContent = languageNames[identifier.toLowerCase()] || identifier || 'Code';
  language.append(languageIcon, label);
  const mount = document.createElement('div');
  mount.className = 'code-copy-mount';
  toolbar.append(language, mount);
  pre.before(block);
  block.append(toolbar, pre);
  codeControls.push({ mount, content: code.textContent || '' });
});
if (codeControls.length) {
  void import('../components/CodeBlockControls').then(({ mountCodeCopyButton }) => {
    codeControls.forEach(({ mount, content }) => mountCodeCopyButton(mount, content));
  });
}
document.querySelectorAll<HTMLButtonElement>('[data-copy-link]').forEach(button => button.addEventListener('click', async () => {
  const success = await copyText(location.href);
  const label = button.querySelector('span');
  if (label) label.textContent = success ? 'Link copied!' : 'Copy failed';
  setTimeout(() => { if (label) label.textContent = 'Copy page link'; }, 2000);
}));

