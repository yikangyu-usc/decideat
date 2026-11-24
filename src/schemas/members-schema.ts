/**
 * DecidEat — Table members
 *
 * One row per (table, user): created automatically when a signed-in user
 * opens a table link. `uniqueOn` makes a second join row for the same
 * table impossible server-side.
 */

import type { CollectionSchema } from 'deepspace/schema'

export const membersSchema: CollectionSchema = {
  name: 'members',
  columns: [
    { name: 'tableId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'userId', storage: 'text', interpretation: 'plain', required: true, userBound: true, immutable: true },
    { name: 'displayName', storage: 'text', interpretation: 'plain' },
  ],
  uniqueOn: ['tableId', 'userId'],
  ownerField: 'userId',
  permissions: {
    viewer: { read: false, create: false, update: false, delete: false },
    member: { read: true, create: true, update: 'own', delete: 'own' },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
