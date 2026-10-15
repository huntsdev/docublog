const menuButton = document.querySelector<HTMLButtonElement>('[data-open-menu]');
const sidebar = document.querySelector<HTMLElement>('#site-sidebar');
const mobile = matchMedia('(max-width: 700px)');

function setMenu(open: boolean, restoreFocus = true) {
  document.body.classList.toggle('menu-open', open);
  menuButton?.setAttribute('aria-expanded', String(open));
  sidebar?.toggleAttribute('inert', mobile.matches && !open);
  if (open) sidebar?.querySelector<HTMLButtonElement>('[data-close-menu]')?.focus();
  else if (restoreFocus) menuButton?.focus();
}
menuButton?.addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
document.querySelectorAll('[data-close-menu]').forEach(button => button.addEventListener('click', () => setMenu(false)));
sidebar?.toggleAttribute('inert', mobile.matches);
mobile.addEventListener('change', () => setMenu(false, false));
document.addEventListener('keydown', event => {
  if (!document.body.classList.contains('menu-open')) return;
  if (event.key === 'Escape') { event.preventDefault(); setMenu(false); }
  if (event.key === 'Tab' && sidebar) {
    const items = [...sidebar.querySelectorAll<HTMLElement>('a, button, summary, [tabindex="0"]')].filter(item => item.getClientRects().length > 0);
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
});
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

document.querySelectorAll<HTMLElement>('[data-blog-listing]').forEach(listing => {
  const buttons = [...listing.querySelectorAll<HTMLButtonElement>('[data-tag]')];
  const list = listing.querySelector<HTMLElement>('[data-post-list]');
  const wrappers = [...listing.querySelectorAll<HTMLElement>('[data-post-wrapper]')];
  const sort = listing.querySelector<HTMLSelectElement>('[data-sort]');
  const params = new URLSearchParams(location.search);
  const requestedTag = params.get('tag') || listing.dataset.initialTag || '';
  let selected = buttons.some(button => button.dataset.tag === requestedTag) ? requestedTag : '';
  function update(updateUrl = true) {
    let total = 0;
    wrappers.sort((a, b) => {
      const dates = [a, b].map(wrapper => Number(wrapper.querySelector<HTMLElement>('[data-post]')?.dataset.date));
      return sort?.value === 'oldest' ? dates[0] - dates[1] : dates[1] - dates[0];
    }).forEach(wrapper => {
      const tags: string[] = JSON.parse(wrapper.querySelector<HTMLElement>('[data-post]')?.dataset.tags || '[]');
      wrapper.hidden = !!selected && !tags.includes(selected);
      if (!wrapper.hidden) total++;
      list?.append(wrapper);
    });
    buttons.forEach(button => { const active = button.dataset.tag === selected; button.classList.toggle('selected', active); button.setAttribute('aria-pressed', String(active)); });
    const count = listing.querySelector('[data-result-count]');
    if (count) count.textContent = `${total} ${total === 1 ? 'post' : 'posts'}${selected ? ` about ${selected}` : ''}`;
    const empty = listing.querySelector<HTMLElement>('[data-filter-empty]');
    if (empty) empty.hidden = total > 0;
    if (updateUrl) {
      const url = new URL('/blog/', location.origin);
      if (selected) url.searchParams.set('tag', selected);
      history.replaceState({}, '', url);
    }
  }
  buttons.forEach(button => button.addEventListener('click', () => { selected = button.dataset.tag || ''; update(); }));
  sort?.addEventListener('change', () => update(false));
  listing.querySelector('[data-clear-filters]')?.addEventListener('click', () => { selected = ''; update(); });
  update(false);
});
