/**
 * DecidEat — Votes
 *
 * One row per (candidate, voter): `uniqueOn` enforces it server-side, so
 * changing your mind is an update of `value` on the same row, never a
 * second row. `voterId` is userBound + immutable — a client cannot cast
 * or move someone else's vote.
 */

import type { CollectionSchema } from 'deepspace/schema'

export const votesSchema: CollectionSchema = {
  name: 'votes',
  columns: [
    { name: 'tableId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'candidateId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'voterId', storage: 'text', interpretation: 'plain', required: true, userBound: true, immutable: true },
    // 'yes' | 'no'
    { name: 'value', storage: 'text', interpretation: 'plain', required: true },
  ],
  uniqueOn: ['candidateId', 'voterId'],
  ownerField: 'voterId',
  permissions: {
    viewer: { read: false, create: false, update: false, delete: false },
    member: { read: true, create: true, update: 'own', delete: 'own' },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
