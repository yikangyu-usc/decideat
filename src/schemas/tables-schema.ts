/**
 * DecidEat — Tables (decision rooms)
 *
 * A table is one group decision: friends join, add candidate restaurants,
 * vote, and the table ends `decided` with a `winnerId` pointing at the
 * winning candidates record. The host is the record's `createdBy`.
 */

import type { CollectionSchema } from 'deepspace/schema'

export const tablesSchema: CollectionSchema = {
  name: 'tables',
  columns: [
    { name: 'title', storage: 'text', interpretation: 'plain', required: true },
    // 'open' | 'decided'
    { name: 'status', storage: 'text', interpretation: 'plain', required: true },
    // recordId of the winning candidates row; empty while the table is open.
    { name: 'winnerId', storage: 'text', interpretation: 'plain' },
    // '$' | '$$' | '$$$' | '' (no preference)
    { name: 'budgetLevel', storage: 'text', interpretation: 'plain' },
    { name: 'areaLabel', storage: 'text', interpretation: 'plain' },
    // Free-form cuisine hints, e.g. ["sushi", "no spicy"].
    { name: 'cuisineHints', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'note', storage: 'text', interpretation: 'plain' },
  ],
  permissions: {
    viewer: { read: false, create: false, update: false, delete: false },
    member: { read: true, create: true, update: 'own', delete: 'own' },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
