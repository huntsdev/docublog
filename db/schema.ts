import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Only aggregate page views are stored. No visitor identifiers or IP addresses.
export const postViews = sqliteTable('post_views', {
  slug: text('slug').primaryKey(),
  views: integer('views').notNull().default(0),
});
