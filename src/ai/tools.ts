/**
 * AI Tool Definitions — converts DeepSpace BUILT_IN_TOOLS to Vercel AI SDK tools.
 *
 * The assistant can read AND modify data. Per-collection RBAC at the DO
 * layer is the actual security boundary — the user's role determines what
 * each tool call is allowed to do, regardless of what's in this allowlist.
 * Trim entries below if you want a stricter assistant for your app.
 */

import { jsonSchema, tool } from 'ai'
import type { ToolSet } from 'ai'
import { z } from 'zod/v4'
import { BUILT_IN_TOOLS, applyAiToolDefaults } from 'deepspace/worker'
import type { ToolSchema, CollectionSchema } from 'deepspace/worker'

type ToolExecutor = (toolName: string, params: Record<string, unknown>) => Promise<unknown>

const ALLOWED_TOOL_NAMES = [
  'schema.list',
  'schema.describe',
  'records.query',
  'records.get',
  'records.create',
  'records.update',
  'records.delete',
  'user.current',
]

// ============================================================================
// System prompt
// ============================================================================

type Interpretation = CollectionSchema['columns'][number]['interpretation']

/**
 * Interpretation is `string | Record<string, unknown>`. When it's an object
 * the convention across the SDK's schemas is `{ kind: string, ... }`.
 * Narrow safely to a human-readable name.
 */
function interpretationLabel(interpretation: Interpretation): string {
  if (typeof interpretation === 'string') return interpretation
  const kind = interpretation.kind
  return typeof kind === 'string' ? kind : 'object'
}

export function buildSystemPrompt(appName: string, schemas: CollectionSchema[]): string {
  const schemaSummary = schemas
    .map((s) => {
      const cols = (s.columns ?? [])
        .map((c) => `${c.name}:${interpretationLabel(c.interpretation)}${c.required ? '!' : ''}`)
        .join(', ')
      return `- ${s.name}${cols ? ` (${cols})` : ''}`
    })
    .join('\n')

  return [
    `You are the AI host of "${appName}" — DecidEat, an app where groups of`,
    'friends decide where to eat. You are the friendly host at the table:',
    'you keep the decision moving, explain where things stand, and call the',
    'result when the group asks you to. Your tool calls run as the calling',
    "user, with their role and permissions — you can only do what they could.",
    '',
    'How a DecidEat table works:',
    '- A `tables` record is one decision room. `status` is "open" or',
    '  "decided"; when decided, `winnerId` holds the recordId of the winning',
    '  `candidates` record. `budgetLevel` ("$", "$$", "$$$" or empty),',
    '  `areaLabel`, `cuisineHints` (array of strings) and `note` are the',
    "  group's stated constraints.",
    '- `members` rows join a user to a table. `candidates` rows are the',
    '  nominated restaurants for a table. `votes` rows are one vote per',
    '  (candidateId, voterId) with `value` "yes" or "no".',
    '- To explain standings for a table: query its candidates and its votes,',
    '  tally yes/no per candidate, and rank by net score (yes − no), then by',
    '  yes count. Name the leader and call out close races and vetoes (a',
    '  candidate with many "no" votes is contentious even if it leads).',
    '- To recommend a pick: weigh the vote standings first, then how well',
    "  each candidate fits the table's constraints — its priceLevel against",
    '  the table budgetLevel, its cuisine against cuisineHints, and anything',
    '  in the table note. Say briefly why the pick fits.',
    '- To break a tie: compare the tied candidates on no-votes (fewer is',
    '  safer), constraint fit, and variety versus what the group has picked',
    '  before if you can see it. Propose one winner and the reason.',
    '',
    'Finding the table the user means:',
    '- Users refer to tables by name or as "this table" / "the table" —',
    '  they will never know a table record ID, so NEVER ask for one.',
    '- If no table is clearly identified, resolve it yourself with tools:',
    '  get the current user, query `members` for rows with their userId,',
    '  then load those `tables`. If exactly one is open, that is the',
    '  table. If several are open, list their titles and ask which one.',
    '  If the user named a title, query `tables` for a matching title',
    '  first.',
    '',
    'Deciding a table (the one consequential write you may make):',
    '- ONLY update a table when the user explicitly asks you to decide,',
    '  pick, or lock in the winner for that table. Never decide unprompted,',
    '  never decide "to be helpful", and never decide a table the user did',
    '  not name or clearly point at.',
    '- To decide: records.update on `tables` with status "decided" and',
    '  winnerId set to the winning candidate\'s recordId. Then confirm the',
    '  winner by name in your reply.',
    '- Table updates are restricted to the table\'s creator. If the update',
    '  is denied, say so plainly: the host who created the table has to lock',
    '  it in (or ask you from their account). Do not retry blindly.',
    '',
    'Be careful with other mutations:',
    '- Confirm intent before destructive actions (delete, bulk update).',
    '- Operate only on collections the user explicitly mentioned.',
    '- After a successful write, briefly confirm what changed.',
    '- If a write is denied (RBAC), tell the user plainly — do not retry blindly.',
    '',
    'Use tools to look up facts before answering. Do not invent restaurants,',
    'votes, or standings. If data is missing, say so plainly. Keep answers',
    'concise and warm — you are hosting a dinner decision, not filing a report.',
    '',
    'Available collections:',
    schemaSummary || '(none)',
  ].join('\n')
}

// ============================================================================
// Tool definitions
// ============================================================================

export function buildTools(executor: ToolExecutor): ToolSet {
  const tools: ToolSet = {}

  for (const def of BUILT_IN_TOOLS) {
    if (!ALLOWED_TOOL_NAMES.includes(def.name)) continue
    const safeName = def.name.replace('.', '_')
    tools[safeName] = tool({
      description: def.description,
      inputSchema: buildInputSchema(def),
      // Apply assistant-only param defaults (e.g. records.query page size) here
      // in the AI tool layer, so internal record readers that hit the tools
      // dispatch directly stay unbounded.
      execute: async (params: Record<string, unknown>) =>
        executor(def.name, applyAiToolDefaults(def.name, params)),
    })
  }

  return tools
}

// ============================================================================
// Convert ToolSchema params → Zod validator + derived provider JSON Schema
// ============================================================================

/**
 * The Zod validator is the single source; the provider-facing JSON Schema is
 * derived from it with Zod's native conversion, which keeps z.record()
 * objects open (`additionalProperties: {}`). The AI SDK's own Zod conversion
 * closes every object, which would incorrectly advertise the free-form
 * `data` and `where` objects as empty — so the conversion happens here.
 */
function buildInputSchema(def: ToolSchema) {
  const shape: Record<string, z.ZodTypeAny> = {}

  for (const [name, param] of Object.entries(def.params)) {
    let s: z.ZodTypeAny
    switch (param.type) {
      case 'string':
        s = z.string()
        break
      case 'number':
        s = z.number()
        break
      case 'boolean':
        s = z.boolean()
        break
      case 'object':
        s = z.record(z.string(), z.unknown())
        break
      case 'array':
        s = z.array(z.unknown())
        break
    }
    if (param.description) s = s.describe(param.description)
    if (!param.required) s = s.optional()
    shape[name] = s
  }

  const validator = z.object(shape)
  return jsonSchema<Record<string, unknown>>(
    z.toJSONSchema(validator) as Parameters<typeof jsonSchema>[0],
    {
      validate: async (value) => {
        const result = await validator.safeParseAsync(value)
        return result.success
          ? { success: true, value: result.data }
          : { success: false, error: result.error }
      },
    },
  )
}
