/**
 * Collection Schemas
 *
 * All collections with columns and RBAC permissions.
 * Single source of truth — imported by both worker and frontend.
 *
 * Add schemas by creating a file in src/schemas/ and importing it here.
 */

import type { CollectionSchema } from 'deepspace/schema'
import { usersSchema } from './schemas/users-schema'
import { settingsSchema } from './schemas/admin-schema'

import { aiChatSchemas } from './schemas/ai-chat-schema'

import { messagingSchemas } from './schemas/messaging-schema'

import { tablesSchema } from './schemas/tables-schema'
import { membersSchema } from './schemas/members-schema'
import { candidatesSchema } from './schemas/candidates-schema'
import { votesSchema } from './schemas/votes-schema'

export const schemas: CollectionSchema[] = [
  ...messagingSchemas,
  ...aiChatSchemas,
  tablesSchema,
  membersSchema,
  candidatesSchema,
  votesSchema,
  usersSchema,
  settingsSchema,
]
