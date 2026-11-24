/**
 * DecidEat shared row types + tally helpers.
 *
 * Row types describe the `data` payload of each DecidEat collection (the
 * envelope — recordId / createdBy / createdAt — comes from RecordData<T>).
 */

export interface TableRow {
  title: string
  status: string // 'open' | 'decided'
  winnerId?: string
  budgetLevel?: string
  areaLabel?: string
  cuisineHints?: string[]
  note?: string
}

export interface MemberRow {
  tableId: string
  userId: string
  displayName?: string
}

export interface CandidateRow {
  tableId: string
  name: string
  cuisine?: string
  priceLevel?: string
  note?: string
}

export interface VoteRow {
  tableId: string
  candidateId: string
  voterId: string
  value: string // 'yes' | 'no'
}

export interface CandidateTally {
  yes: number
  no: number
  /** yes - no: the ranking score. */
  net: number
}

/** Tally votes per candidateId. */
export function tallyVotes(votes: Array<{ data: VoteRow }>): Map<string, CandidateTally> {
  const tallies = new Map<string, CandidateTally>()
  for (const vote of votes) {
    const t = tallies.get(vote.data.candidateId) ?? { yes: 0, no: 0, net: 0 }
    if (vote.data.value === 'yes') t.yes += 1
    else if (vote.data.value === 'no') t.no += 1
    t.net = t.yes - t.no
    tallies.set(vote.data.candidateId, t)
  }
  return tallies
}

/**
 * The current leader: highest net score, then most yes votes, then the
 * earliest-nominated candidate. Returns the candidate recordId or null
 * when there are no candidates (or nobody has a positive score yet —
 * a leader still exists as long as some candidate has any yes vote;
 * with zero votes everywhere the earliest candidate leads by default).
 */
export function leaderId(
  candidates: Array<{ recordId: string; createdAt: string }>,
  tallies: Map<string, CandidateTally>,
): string | null {
  let best: string | null = null
  let bestTally: CandidateTally = { yes: 0, no: 0, net: 0 }
  let bestCreatedAt = ''
  for (const c of candidates) {
    const t = tallies.get(c.recordId) ?? { yes: 0, no: 0, net: 0 }
    if (
      best === null ||
      t.net > bestTally.net ||
      (t.net === bestTally.net && t.yes > bestTally.yes) ||
      (t.net === bestTally.net && t.yes === bestTally.yes && c.createdAt < bestCreatedAt)
    ) {
      best = c.recordId
      bestTally = t
      bestCreatedAt = c.createdAt
    }
  }
  return best
}

/** '$' → 'Budget-friendly', etc. Empty string means "no preference". */
export const BUDGET_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Any budget' },
  { value: '$', label: '$ — cheap eats' },
  { value: '$$', label: '$$ — mid-range' },
  { value: '$$$', label: '$$$ — splurge' },
]

export const PRICE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Price unknown' },
  { value: '$', label: '$' },
  { value: '$$', label: '$$' },
  { value: '$$$', label: '$$$' },
]

export function budgetLabel(value?: string): string {
  return BUDGET_OPTIONS.find((o) => o.value === (value ?? ''))?.label ?? 'Any budget'
}

/** Parse a comma-separated cuisine-hints input into a clean string array. */
export function parseCuisineHints(input: string): string[] {
  return input
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8)
}
