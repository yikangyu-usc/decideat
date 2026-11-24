/**
 * DecidEat — Candidate restaurants
 *
 * Anyone at a table can nominate a restaurant. The nominator owns the row
 * (they can edit or withdraw it); everyone at the table can read it.
 */

import type { CollectionSchema } from 'deepspace/schema'

export const candidatesSchema: CollectionSchema = {
  name: 'candidates',
  columns: [
    { name: 'tableId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'name', storage: 'text', interpretation: 'plain', required: true },
    { name: 'cuisine', storage: 'text', interpretation: 'plain' },
    // '$' | '$$' | '$$$' | '' (unknown)
    { name: 'priceLevel', storage: 'text', interpretation: 'plain' },
    { name: 'note', storage: 'text', interpretation: 'plain' },
  ],
  permissions: {
    viewer: { read: false, create: false, update: false, delete: false },
    member: { read: true, create: true, update: 'own', delete: 'own' },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
