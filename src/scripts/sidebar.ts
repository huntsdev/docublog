const root = document.documentElement;
const sidebar = document.querySelector<HTMLElement>('#site-sidebar');
const menuButton = document.querySelector<HTMLButtonElement>('[data-open-menu]');
const toggle = document.querySelector<HTMLButtonElement>('[data-toggle-sidebar]');
const mobile = matchMedia('(max-width: 700px)');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const sections = [...document.querySelectorAll<HTMLDetailsElement>('[data-sidebar-section]')].map(details => ({
  details,
  summary: details.querySelector<HTMLElement>('summary')!,
  content: details.querySelector<HTMLElement>('.nav-section-content')!,
  open: details.open,
  animation: undefined as Animation | undefined,
}));

function save(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch {}
}

function compact() {
  return !mobile.matches && root.dataset.sidebarCollapsed === 'true';
}

function finishSection(section: typeof sections[number]) {
  section.animation?.cancel();
  section.animation = undefined;
  section.details.open = section.open;
  section.summary.setAttribute('aria-expanded', String(!compact() && section.open));
  section.content.inert = compact() || !section.open;
}

function synchronize() {
  const collapsed = compact();
  const label = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
  toggle?.setAttribute('aria-label', label);
  toggle?.setAttribute('title', label);
  toggle?.setAttribute('aria-expanded', String(!collapsed));
  sections.forEach(section => {
    finishSection(section);
    section.summary.title = collapsed ? `Expand ${section.summary.getAttribute('aria-label')}` : section.summary.getAttribute('aria-label') || '';
  });
}

function setCollapsed(collapsed: boolean) {
  root.dataset.sidebarCollapsed = String(collapsed);
  save('hunts-sidebar-collapsed', String(collapsed));
  synchronize();
}

function setSection(section: typeof sections[number], open: boolean, animate = true) {
  const height = section.content.getBoundingClientRect().height;
  const opacity = getComputedStyle(section.content).opacity;
  section.animation?.cancel();
  section.animation = undefined;
  section.open = open;
  section.summary.setAttribute('aria-expanded', String(!compact() && open));
  section.content.inert = !open || compact();
  save('hunts-sidebar-sections', JSON.stringify(Object.fromEntries(sections.map(item => [item.details.dataset.sidebarSection, item.open]))));
  if (!animate || reducedMotion.matches || compact()) {
    finishSection(section);
    return;
  }
  section.details.open = true;
  const animation = section.content.animate([
    { height: `${height}px`, opacity },
    { height: `${open ? section.content.scrollHeight : 0}px`, opacity: open ? 1 : 0 },
  ], { duration: 220, easing: 'cubic-bezier(.2, .7, .2, 1)' });
  section.animation = animation;
  animation.onfinish = () => finishSection(section);
}

toggle?.addEventListener('click', () => setCollapsed(!compact()));
sections.forEach(section => section.summary.addEventListener('click', event => {
  event.preventDefault();
  if (compact()) {
    setCollapsed(false);
    setSection(section, true, false);
  } else setSection(section, !section.open);
}));

function setMenu(open: boolean, restoreFocus = true) {
  document.body.classList.toggle('menu-open', open);
  menuButton?.setAttribute('aria-expanded', String(open));
  if (sidebar) sidebar.inert = mobile.matches && !open;
  if (open) sidebar?.querySelector<HTMLButtonElement>('[data-close-menu]')?.focus();
  else if (restoreFocus) menuButton?.focus();
}

menuButton?.addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
document.querySelectorAll('[data-close-menu]').forEach(button => button.addEventListener('click', () => setMenu(false)));
if (sidebar) sidebar.inert = mobile.matches;
mobile.addEventListener('change', () => { setMenu(false, false); synchronize(); });
reducedMotion.addEventListener('change', () => sections.forEach(finishSection));

document.addEventListener('keydown', event => {
  if (!mobile.matches || !document.body.classList.contains('menu-open')) return;
  if (event.key === 'Escape') { event.preventDefault(); setMenu(false); }
  if (event.key === 'Tab' && sidebar) {
    const items = [...sidebar.querySelectorAll<HTMLElement>('a, button, summary, [tabindex="0"]')]
      .filter(item => item.getClientRects().length > 0 && !item.closest('[inert]'));
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
});

synchronize();
