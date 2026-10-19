export type ListingSort = 'newest' | 'oldest' | 'views' | 'title' | 'featured' | 'status';

export interface ListingItem {
  title: string;
  date?: number;
  views?: number;
  featured?: boolean;
  status?: string;
}

const titles = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

function numbers(a: number | undefined, b: number | undefined, ascending = false) {
  // An unavailable value is different from zero; keep it last in either direction.
  if (a === undefined) return b === undefined ? 0 : 1;
  if (b === undefined) return -1;
  return ascending ? a - b : b - a;
}

export function compareListingItems(a: ListingItem, b: ListingItem, sort: ListingSort): number {
  const title = titles.compare(a.title, b.title);
  const recent = numbers(a.date, b.date);
  if (sort === 'title') return title;
  if (sort === 'oldest') return numbers(a.date, b.date, true) || title;
  if (sort === 'views') return numbers(a.views, b.views) || recent || title;
  if (sort === 'featured') return Number(!!b.featured) - Number(!!a.featured) || recent || title;
  if (sort === 'status') {
    const rank: Record<string, number> = { Active: 0, 'In progress': 1, Archived: 2 };
    return (rank[a.status ?? ''] ?? 3) - (rank[b.status ?? ''] ?? 3) || recent || title;
  }
  return recent || title;
}
