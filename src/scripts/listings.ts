import { compareListingItems, type ListingItem, type ListingSort } from '../lib/listing-sort';

function numeric(value?: string) {
  if (value === undefined || value === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function metadata(element: HTMLElement): ListingItem {
  return {
    title: element.dataset.title || '',
    date: numeric(element.dataset.date),
    views: numeric(element.querySelector<HTMLElement>('[data-view-slug]')?.dataset.views),
    featured: element.dataset.featured === 'true',
    status: element.dataset.status,
  };
}

document.querySelectorAll<HTMLElement>('[data-listing]').forEach(listing => {
  const projects = listing.dataset.listing === 'projects';
  const buttons = [...listing.querySelectorAll<HTMLButtonElement>('[data-tag]')];
  const topicButtons = buttons.filter(button => button.dataset.tag);
  const topicLimit = Number(listing.dataset.topicLimit) || 5;
  const topicToggle = listing.querySelector<HTMLButtonElement>('[data-topic-toggle]');
  let topicsExpanded = false;
  const list = listing.querySelector<HTMLElement>('[data-list]');
  const items = [...listing.querySelectorAll<HTMLElement>('[data-listing-item]')];
  const sort = listing.querySelector<HTMLSelectElement>('[data-sort]');
  const params = new URLSearchParams(location.search);
  const requestedTag = params.get('tag') || listing.dataset.initialTag || '';
  let selected = buttons.some(button => button.dataset.tag === requestedTag) ? requestedTag : '';
  const requestedSort = params.get('sort');
  if (sort && requestedSort && [...sort.options].some(option => option.value === requestedSort)) sort.value = requestedSort;

  function updateTopics() {
    const visibleTopics = topicButtons.slice(0, topicLimit);
    const activeTopic = topicButtons.find(button => button.dataset.tag === selected);
    if (activeTopic && !visibleTopics.includes(activeTopic)) visibleTopics.splice(topicLimit - 1, 1, activeTopic);
    topicButtons.forEach(button => { button.hidden = !topicsExpanded && !visibleTopics.includes(button); });
    topicToggle?.setAttribute('aria-expanded', String(topicsExpanded));
    const label = topicToggle?.querySelector('[data-topic-toggle-label]');
    if (label) label.textContent = topicsExpanded ? 'Show fewer topics' : 'Show all topics';
    const extraCount = topicToggle?.querySelector<HTMLElement>('[data-topic-extra-count]');
    if (extraCount) extraCount.hidden = topicsExpanded;
  }

  function update(updateUrl = true) {
    const order = (sort?.value || 'newest') as ListingSort;
    let total = 0;
    items.sort((a, b) => compareListingItems(metadata(a), metadata(b), order)).forEach(item => {
      const tags: string[] = JSON.parse(item.querySelector<HTMLElement>('[data-post]')?.dataset.tags || '[]');
      item.hidden = !!selected && !tags.includes(selected);
      if (!item.hidden) total++;
      list?.append(item);
    });
    buttons.forEach(button => { const active = button.dataset.tag === selected; button.classList.toggle('selected', active); button.setAttribute('aria-pressed', String(active)); });
    updateTopics();
    const count = listing.querySelector('[data-result-count]');
    const noun = projects ? 'project' : 'post';
    if (count) count.textContent = `${total} ${noun}${total === 1 ? '' : 's'}${selected ? ` about ${selected}` : ''}`;
    const empty = listing.querySelector<HTMLElement>('[data-filter-empty]');
    if (empty) empty.hidden = total > 0;
    const status = listing.querySelector<HTMLElement>('[data-sort-status]');
    if (status) {
      const counters = items.filter(item => !item.hidden).map(item => item.querySelector<HTMLElement>('[data-view-slug]'));
      const loading = counters.some(counter => counter?.dataset.viewState === 'loading');
      const unavailable = counters.some(counter => counter?.dataset.views === undefined);
      status.hidden = order !== 'views' || !unavailable;
      status.textContent = loading ? 'Loading view counts…' : counters.every(counter => counter?.dataset.views === undefined)
        ? 'View counts are unavailable. Showing newest first.'
        : 'Some view counts are unavailable. Showing available counts first.';
    }
    if (updateUrl) {
      const url = new URL(projects ? location.pathname : '/blog/', location.origin);
      if (selected) url.searchParams.set('tag', selected);
      if (order !== 'newest') url.searchParams.set('sort', order);
      history.replaceState({}, '', url);
    }
  }

  buttons.forEach(button => button.addEventListener('click', () => { selected = button.dataset.tag || ''; update(); }));
  topicToggle?.addEventListener('click', () => { topicsExpanded = !topicsExpanded; updateTopics(); });
  sort?.addEventListener('change', () => update());
  listing.querySelector('[data-clear-filters]')?.addEventListener('click', () => { selected = ''; update(); });
  let pending = false;
  listing.addEventListener('views:updated', () => {
    if (sort?.value !== 'views' || pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; update(false); });
  });
  update(false);
});
