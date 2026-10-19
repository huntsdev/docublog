const initialized = new WeakSet<HTMLElement>();
const numberFormat = new Intl.NumberFormat('en-US');

function showCount(element: HTMLElement, views: number) {
  if (!Number.isSafeInteger(views) || views < 0) return showUnavailable(element);
  const label = `${numberFormat.format(views)} ${views === 1 ? 'view' : 'views'}`;
  const count = element.querySelector('[data-view-count]');
  if (count) count.textContent = label;
  element.setAttribute('aria-label', label);
  element.dataset.views = String(views);
  element.dataset.viewState = 'ready';
  element.dispatchEvent(new CustomEvent('views:updated', { bubbles: true }));
}

function showUnavailable(element: HTMLElement) {
  element.setAttribute('aria-label', 'Page views unavailable');
  element.title = 'Page views are temporarily unavailable.';
  const count = element.querySelector('[data-view-count]');
  if (count) count.textContent = '— views';
  delete element.dataset.views;
  element.dataset.viewState = 'unavailable';
  element.dispatchEvent(new CustomEvent('views:updated', { bubbles: true }));
}

async function readCounts(elements: HTMLElement[], collection: string) {
  const slugs = [...new Set(elements.map((element) => element.dataset.viewSlug!))];
  // Keep requests within the API limit as the blog archive grows.
  await Promise.all(Array.from({ length: Math.ceil(slugs.length / 100) }, async (_, index) => {
    const batch = slugs.slice(index * 100, (index + 1) * 100);
    const targets = elements.filter((element) => batch.includes(element.dataset.viewSlug!));
    try {
      const params = new URLSearchParams({ slugs: batch.join(',') });
      if (collection === 'projects') params.set('collection', collection);
      const response = await fetch(`/api/views/?${params}`, { credentials: 'same-origin' });
      if (!response.ok) throw new Error('Views unavailable');
      const data = await response.json();
      for (const element of targets) showCount(element, data.views?.[element.dataset.viewSlug!]);
    } catch {
      targets.forEach(showUnavailable);
    }
  }));
}

async function recordView(element: HTMLElement) {
  try {
    const collection = element.dataset.viewCollection === 'projects' ? '?collection=projects' : '';
    const response = await fetch(`/api/views/${encodeURIComponent(element.dataset.viewSlug!)}/${collection}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!response.ok) throw new Error('Views unavailable');
    const data = await response.json();
    showCount(element, data.views);
  } catch {
    showUnavailable(element);
  }
}

function initializeViews() {
  const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-view-slug]')).filter((element) => !initialized.has(element));
  elements.forEach((element) => initialized.add(element));
  for (const collection of ['blog', 'projects']) {
    void readCounts(elements.filter(element => element.dataset.trackView !== 'true' && (element.dataset.viewCollection || 'blog') === collection), collection);
  }
  for (const element of elements.filter((element) => element.dataset.trackView === 'true')) {
    if (document.visibilityState === 'visible') {
      void recordView(element);
    } else {
      const onVisible = () => {
        if (document.visibilityState !== 'visible') return;
        document.removeEventListener('visibilitychange', onVisible);
        if (element.isConnected) void recordView(element);
      };
      document.addEventListener('visibilitychange', onVisible);
    }
  }
}

initializeViews();
document.addEventListener('astro:page-load', initializeViews);
