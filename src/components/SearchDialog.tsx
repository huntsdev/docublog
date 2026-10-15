import { useCallback, useDeferredValue, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowDown, ArrowUp, Compass, CornerDownLeft, FileText, FolderCode, Search, UserRound, X } from 'lucide-react';
import MiniSearch from 'minisearch';

type Section = 'Blog Posts' | 'Projects' | 'About' | 'Explore';
type SearchEntry = {
  id: string;
  title: string;
  description: string;
  author?: string;
  body: string;
  tags: string[];
  section: Section;
  url: string;
  breadcrumb: string;
};
type IndexedEntry = Omit<SearchEntry, 'tags'> & { tags: string };
type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';
const filters = ['All', 'Blog Posts', 'Projects', 'About'] as const;
type Filter = (typeof filters)[number];
const sectionIcons = { 'Blog Posts': FileText, Projects: FolderCode, About: UserRound, Explore: Compass };

function isSearchEntry(value: unknown): value is SearchEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return ['id', 'title', 'description', 'body', 'url', 'breadcrumb'].every((key) => typeof entry[key] === 'string')
    && typeof entry.url === 'string' && entry.url.startsWith('/') && !entry.url.startsWith('//')
    && (entry.author === undefined || typeof entry.author === 'string')
    && ['Blog Posts', 'Projects', 'About', 'Explore'].includes(String(entry.section))
    && Array.isArray(entry.tags) && entry.tags.every((tag) => typeof tag === 'string');
}

function queryTerms(query: string) {
  return [...new Set(query.match(/[\p{L}\p{N}]+/gu) ?? [])].slice(0, 12);
}

function Highlight({ text, query }: { text: string; query: string }) {
  const terms = queryTerms(query);
  if (!terms.length) return <>{text}</>;
  const pattern = terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const parts = text.split(new RegExp(`(${pattern})`, 'gi'));
  return <>{parts.map((part, index) => index % 2 ? <mark key={index}>{part}</mark> : part)}</>;
}

function excerpt(entry: SearchEntry, query: string) {
  const terms = queryTerms(query).map((term) => term.toLocaleLowerCase());
  const description = entry.description.replace(/\s+/g, ' ').trim();
  const body = entry.body.replace(/\s+/g, ' ').trim();
  const descriptionMatches = terms.some((term) => description.toLocaleLowerCase().includes(term));
  const source = !terms.length || descriptionMatches ? description || body : body || description;
  const firstMatch = terms.length ? Math.min(...terms.map((term) => source.toLocaleLowerCase().indexOf(term)).filter((index) => index >= 0)) : 0;
  const start = Number.isFinite(firstMatch) ? Math.max(0, firstMatch - 45) : 0;
  const snippet = source.slice(start, start + 155);
  return `${start ? '…' : ''}${snippet}${start + 155 < source.length ? '…' : ''}`;
}

function isEditing(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || Boolean(target.closest('input, textarea, select, [role="textbox"]')));
}

export default function SearchDialog() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [filter, setFilter] = useState<Filter>('All');
  const [status, setStatus] = useState<LoadStatus>('idle');
  const [entries, setEntries] = useState<SearchEntry[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [shortcut, setShortcut] = useState('Ctrl K');
  const inputRef = useRef<HTMLInputElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);
  const engineRef = useRef<MiniSearch<IndexedEntry> | null>(null);
  const pendingRef = useRef<Promise<void> | null>(null);
  const listId = useId();

  const loadIndex = useCallback(() => {
    if (engineRef.current) return Promise.resolve();
    if (pendingRef.current) return pendingRef.current;
    setStatus('loading');
    pendingRef.current = (async () => {
      try {
        const response = await fetch('/search-index.json');
        if (!response.ok) throw new Error('Search index unavailable');
        const data: unknown = await response.json();
        if (!Array.isArray(data) || !data.every(isSearchEntry)) throw new Error('Invalid search index');
        const uniqueEntries = [...new Map(data.map((entry) => [entry.id, entry])).values()];
        const engine = new MiniSearch<IndexedEntry>({
          fields: ['title', 'description', 'author', 'body', 'tags', 'section'],
          searchOptions: { boost: { title: 8, tags: 5, author: 3, description: 2, section: 1.5 }, prefix: true, fuzzy: 0.2 },
        });
        engine.addAll(uniqueEntries.map((entry) => ({ ...entry, tags: entry.tags.join(' ') })));
        engineRef.current = engine;
        setEntries(uniqueEntries);
        setStatus('ready');
      } catch {
        setStatus('error');
      } finally {
        pendingRef.current = null;
      }
    })();
    return pendingRef.current;
  }, []);

  useEffect(() => {
    if (open) void loadIndex();
  }, [open, loadIndex]);

  useEffect(() => {
    setShortcut(/Mac|iPhone|iPad|iPod/.test(navigator.platform) ? '⌘ K' : 'Ctrl K');
    const onKeyDown = (event: KeyboardEvent) => {
      const command = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && (!isEditing(event.target) || event.target === inputRef.current);
      const slash = event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey && !isEditing(event.target);
      if (command || slash) {
        event.preventDefault();
        setOpen((current) => command ? !current : true);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const results = useMemo(() => {
    const allowed = (entry: SearchEntry) => filter === 'All' || entry.section === filter;
    if (!deferredQuery.trim()) return entries.filter(allowed).slice(0, 8);
    if (!engineRef.current) return [];
    const entryMap = new Map(entries.map((entry) => [entry.id, entry]));
    const find = (combineWith: 'AND' | 'OR') => engineRef.current!.search(deferredQuery, { combineWith })
      .flatMap((result) => {
        const entry = entryMap.get(String(result.id));
        return entry && allowed(entry) ? [entry] : [];
      });
    const matches = find('AND');
    return matches.length ? matches : find('OR');
  }, [deferredQuery, entries, filter]);

  useEffect(() => setActiveIndex(0), [deferredQuery, filter, entries]);
  useEffect(() => {
    if (open) activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  const selectWithKeyboard = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (!results.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((current) => (current + direction + results.length) % results.length);
    } else if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault();
      const result = results[Math.min(activeIndex, results.length - 1)];
      if (result) window.location.assign(result.url);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="search-trigger" type="button" aria-label="Search all posts, projects, and pages">
          <Search size={16} aria-hidden="true" />
          <span>Search anything...</span>
          <kbd>{shortcut}</kbd>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="search-overlay" />
        <Dialog.Content className="search-dialog" onOpenAutoFocus={(event) => { event.preventDefault(); inputRef.current?.focus(); }}>
          <Dialog.Title className="search-sr-only">Search hunts.dev</Dialog.Title>
          <Dialog.Description className="search-sr-only">Find words, topics, posts, projects, and pages. Use the arrow keys to choose a result and Enter to open it.</Dialog.Description>
          <div className="search-input-row">
            <Search size={20} aria-hidden="true" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={selectWithKeyboard}
              placeholder="Search posts, projects, and topics…"
              aria-label="Search the site"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={results.length && status === 'ready' ? `${listId}-${Math.min(activeIndex, results.length - 1)}` : undefined}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <Dialog.Close className="search-close" aria-label="Close search"><X size={17} aria-hidden="true" /></Dialog.Close>
          </div>
          <div className="search-filters" aria-label="Filter search results">
            {filters.map((item) => <button key={item} className="search-filter" type="button" aria-pressed={filter === item} onClick={() => { setFilter(item); inputRef.current?.focus(); }}>{item}</button>)}
          </div>
          <div className="search-body">
            {(status === 'idle' || status === 'loading') && <div className="search-loading" role="status" aria-label="Loading search"><span className="search-sr-only">Loading search…</span>{[0, 1, 2].map((item) => <div className="search-skeleton" key={item}><span /><div><span /><span /></div></div>)}</div>}
            {status === 'error' && <div className="search-empty" role="status"><Search size={26} aria-hidden="true" /><strong>Search couldn’t load</strong><p>Check your connection and try again.</p><button className="search-retry" type="button" onClick={() => void loadIndex()}>Try again</button></div>}
            {status === 'ready' && <>
              <div className="search-results-label"><span>{deferredQuery.trim() ? 'Search results' : 'Start exploring'}</span><span aria-live="polite">{results.length} {results.length === 1 ? 'result' : 'results'}</span></div>
              {!results.length && <div className="search-empty" role="status"><Search size={26} aria-hidden="true" /><strong>No results found</strong><p>Try another word or choose a different section.</p>{filter !== 'All' && <button className="search-retry" type="button" onClick={() => setFilter('All')}>Search all sections</button>}</div>}
              <div className="search-results" id={listId} role="listbox" aria-label="Search results">
                {results.map((entry, index) => {
                  const Icon = sectionIcons[entry.section];
                  return <a key={entry.id} ref={index === activeIndex ? activeRef : undefined} id={`${listId}-${index}`} className={`search-result${index === activeIndex ? ' is-active' : ''}`} href={entry.url} role="option" aria-selected={index === activeIndex} tabIndex={-1} onMouseMove={() => setActiveIndex(index)} onClick={() => setOpen(false)}>
                    <span className="search-result-icon"><Icon size={18} aria-hidden="true" /></span>
                    <span className="search-result-copy"><span className="search-breadcrumb">{entry.breadcrumb}</span><strong><Highlight text={entry.title} query={deferredQuery} /></strong><span className="search-excerpt"><Highlight text={excerpt(entry, deferredQuery)} query={deferredQuery} /></span>{entry.tags.length > 0 && <span className="search-result-tags">{entry.tags.slice(0, 3).map((tag) => <span key={tag}>#<Highlight text={tag} query={deferredQuery} /></span>)}</span>}</span>
                    <CornerDownLeft className="search-result-enter" size={16} aria-hidden="true" />
                  </a>;
                })}
              </div>
            </>}
          </div>
          <div className="search-footer"><span><kbd><ArrowUp size={11} /></kbd><kbd><ArrowDown size={11} /></kbd> to navigate</span><span><kbd><CornerDownLeft size={11} /></kbd> to open</span><span className="search-footer-escape"><kbd>esc</kbd> to close</span></div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
