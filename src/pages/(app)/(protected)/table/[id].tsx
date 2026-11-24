/**
 * Table room — one DecidEat decision, live.
 *
 * Route: /table/:id (Generouted `[id]` segment). Opening the link is what
 * joins you: the page writes your members row on first open. Everything
 * else — candidates, votes, tallies, the winner — is live-synced records.
 *
 * The Decide flow has two doors: the host (the table's creator) can lock
 * in the current leader directly, and anyone can ask the AI host (panel on
 * the right) to call it — its decide prompt is one click in the panel.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  useAuthProfileReady,
  useMutations,
  usePresenceRoom,
  useQuery,
} from 'deepspace'
import {
  ArrowLeft,
  Link2,
  MessageSquare,
  Plus,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Trophy,
  Users,
} from 'lucide-react'
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  EmptyState,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useToast,
} from '@/components/ui'
import { AiHostPanel } from '../../../../components/AiHostPanel'
import { TableChat } from '../../../../components/TableChat'
import {
  PRICE_OPTIONS,
  budgetLabel,
  leaderId,
  tallyVotes,
  type CandidateRow,
  type MemberRow,
  type TableRow,
  type VoteRow,
} from '../../../../lib/decideat'

export default function TableRoomPage() {
  const { id: tableId } = useParams<{ id: string }>()
  const { isLoaded, user, userId } = useAuthProfileReady({ requireUser: true })

  if (!isLoaded || !userId || !tableId) {
    return (
      <div className="flex min-h-full items-center justify-center text-muted-foreground">
        Loading…
      </div>
    )
  }

  return (
    <Room
      tableId={tableId}
      userId={userId}
      displayName={user?.name ?? user?.email ?? 'Guest'}
    />
  )
}

function Room({
  tableId,
  userId,
  displayName,
}: {
  tableId: string
  userId: string
  displayName: string
}) {
  const { success } = useToast()

  const { records: tables, status: tablesStatus } = useQuery<TableRow>('tables', { limit: 200 })
  const table = tables.find((t) => t.recordId === tableId) ?? null

  const { records: members, status: membersStatus } = useQuery<MemberRow>('members', {
    where: { tableId },
    limit: 200,
  })
  const { records: candidates } = useQuery<CandidateRow>('candidates', {
    where: { tableId },
    orderBy: 'createdAt',
    orderDir: 'asc',
    limit: 200,
  })
  const { records: votes } = useQuery<VoteRow>('votes', {
    where: { tableId },
    limit: 1000,
  })

  const { createConfirmed: createMember } = useMutations<MemberRow>('members')
  const { put: putTable } = useMutations<TableRow>('tables')

  const { peers } = usePresenceRoom(`table:${tableId}`)

  // Auto-join: opening the link makes you a member. Guarded per (table,
  // user) so re-renders don't re-fire; the members schema's uniqueOn makes
  // a duplicate join impossible server-side anyway.
  const joinAttemptedFor = useRef<string | null>(null)
  useEffect(() => {
    if (!table || membersStatus !== 'ready') return
    const key = `${tableId}:${userId}`
    if (joinAttemptedFor.current === key) return
    if (members.some((m) => m.data.userId === userId)) return
    joinAttemptedFor.current = key
    void createMember({ tableId, userId, displayName }).catch(() => {
      // A duplicate-join refusal lands here; the row exists either way.
      joinAttemptedFor.current = null
    })
  }, [table, membersStatus, members, tableId, userId, displayName, createMember])

  const tallies = useMemo(() => tallyVotes(votes), [votes])
  const myVotes = useMemo(() => {
    const map = new Map<string, { recordId: string; data: VoteRow }>()
    for (const v of votes) {
      if (v.data.voterId === userId) map.set(v.data.candidateId, v)
    }
    return map
  }, [votes, userId])

  const rankedCandidates = useMemo(() => {
    return [...candidates].sort((a, b) => {
      const ta = tallies.get(a.recordId) ?? { yes: 0, no: 0, net: 0 }
      const tb = tallies.get(b.recordId) ?? { yes: 0, no: 0, net: 0 }
      if (tb.net !== ta.net) return tb.net - ta.net
      if (tb.yes !== ta.yes) return tb.yes - ta.yes
      return a.createdAt.localeCompare(b.createdAt)
    })
  }, [candidates, tallies])

  const leader = leaderId(candidates, tallies)
  const leaderRecord = candidates.find((c) => c.recordId === leader) ?? null
  const leaderTally = leader ? (tallies.get(leader) ?? { yes: 0, no: 0, net: 0 }) : null

  if (tablesStatus === 'loading') {
    return (
      <div className="flex min-h-full items-center justify-center text-muted-foreground">
        Loading the table…
      </div>
    )
  }

  if (!table) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-foreground">Table not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This link doesn&apos;t point at a table — it may have been deleted.
        </p>
        <Link
          to="/home"
          className="mt-6 inline-block rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Back to the lobby
        </Link>
      </div>
    )
  }

  const decided = table.data.status === 'decided'
  const winner = candidates.find((c) => c.recordId === table.data.winnerId) ?? null
  const isHost = table.createdBy === userId
  const hints = table.data.cuisineHints ?? []
  const liveIds = new Set([userId, ...peers.map((p) => p.userId)])
  const memberName = new Map(members.map((m) => [m.data.userId, m.data.displayName ?? 'Guest']))

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      success('Invite link copied', 'Anyone who opens it joins this table.')
    } catch {
      success('Copy this page’s URL', 'Share it with your group to invite them.')
    }
  }

  function lockInLeader() {
    if (!leader || decided) return
    void putTable(tableId, { status: 'decided', winnerId: leader })
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <Link
        to="/home"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Lobby
      </Link>

      <header className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {table.data.title}
            </h1>
            <Badge variant={decided ? 'secondary' : 'default'}>
              {decided ? 'Decided' : 'Open'}
            </Badge>
            {isHost && <Badge variant="outline">You’re the host</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {[table.data.areaLabel, budgetLabel(table.data.budgetLevel), hints.join(', ')]
              .filter(Boolean)
              .join(' · ') || 'No constraints — anything goes'}
          </p>
          {table.data.note && <p className="mt-1 text-sm text-foreground/80">{table.data.note}</p>}
        </div>
        <Button variant="outline" onClick={copyInvite} className="shrink-0">
          <Link2 className="h-4 w-4" aria-hidden /> Copy invite link
        </Button>
      </header>

      {/* Who's here — members, with a live dot for anyone in the room now. */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <Users className="h-4 w-4" aria-hidden />
          {members.length} at the table · {liveIds.size} here now
        </span>
        {members.map((m) => (
          <span
            key={m.recordId}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card py-0.5 pl-0.5 pr-2.5 text-xs text-foreground"
          >
            <Avatar className="h-5 w-5">
              <AvatarFallback className="text-[10px]">
                {(m.data.displayName ?? '?').charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {m.data.displayName ?? 'Guest'}
            {m.data.userId === table.createdBy && (
              <span className="text-muted-foreground">(host)</span>
            )}
            <span
              className={`h-1.5 w-1.5 rounded-full ${liveIds.has(m.data.userId) ? 'bg-success' : 'bg-muted-foreground/40'}`}
              aria-label={liveIds.has(m.data.userId) ? 'online now' : 'not here right now'}
            />
          </span>
        ))}
      </div>

      {decided && (
        <div className="mt-6 rounded-2xl border border-primary/40 bg-accent/50 p-5 text-center">
          <Trophy className="mx-auto h-8 w-8 text-primary" aria-hidden />
          <p className="mt-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            You&apos;re eating at
          </p>
          <p className="text-2xl font-bold text-foreground">
            {winner ? winner.data.name : 'the winning pick'}
          </p>
          {winner && (
            <p className="mt-1 text-sm text-muted-foreground">
              {[winner.data.cuisine, winner.data.priceLevel].filter(Boolean).join(' · ')}
              {winner.data.note ? ` — ${winner.data.note}` : ''}
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Voting is closed for this table. Open a new table from the lobby for the next meal.
          </p>
        </div>
      )}

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            Candidates{' '}
            <span className="text-sm font-normal text-muted-foreground">
              ranked by votes, live
            </span>
          </h2>

          {candidates.length === 0 ? (
            <EmptyState
              icon={<Plus aria-hidden />}
              title="No candidates yet"
              description={
                decided
                  ? 'This table was decided without any candidates on record.'
                  : 'Nominate the first restaurant below — then get everyone voting.'
              }
            />
          ) : (
            <div className="space-y-3">
              {rankedCandidates.map((c) => (
                <CandidateCard
                  key={c.recordId}
                  candidate={c}
                  tally={tallies.get(c.recordId) ?? { yes: 0, no: 0, net: 0 }}
                  myVote={myVotes.get(c.recordId)?.data.value}
                  myVoteRecordId={myVotes.get(c.recordId)?.recordId}
                  tableId={tableId}
                  userId={userId}
                  decided={decided}
                  isLeader={!decided && c.recordId === leader}
                  isWinner={decided && c.recordId === table.data.winnerId}
                  suggestedBy={memberName.get(c.createdBy) ?? 'Someone'}
                  canDelete={c.createdBy === userId}
                />
              ))}
            </div>
          )}

          {!decided && (
            <>
              <AddCandidateForm tableId={tableId} />
              <div className="mt-4 rounded-2xl border border-border bg-card p-4">
                <p className="text-sm text-foreground">
                  {leaderRecord && leaderTally && leaderTally.yes > 0 ? (
                    <>
                      Current leader: <strong>{leaderRecord.data.name}</strong> (net{' '}
                      {leaderTally.net > 0 ? `+${leaderTally.net}` : leaderTally.net},{' '}
                      {leaderTally.yes} yes / {leaderTally.no} no)
                    </>
                  ) : (
                    'No votes yet — the first yes vote takes the lead.'
                  )}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {isHost ? (
                    <Button onClick={lockInLeader} disabled={!leader}>
                      <Trophy className="h-4 w-4" aria-hidden /> Lock in{' '}
                      {leaderRecord ? leaderRecord.data.name : 'the leader'}
                    </Button>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Only the host can lock in a winner directly — or ask the AI host to call it.
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </section>

        <div className="space-y-6">
          <section>
            <h2 className="mb-2 flex items-center gap-2 text-base font-semibold text-foreground">
              <Sparkles className="h-5 w-5 text-primary" aria-hidden /> AI host
            </h2>
            <p className="mb-2 text-sm text-muted-foreground">
              Standings, recommendations, tiebreaks — or tell it to decide this table.
            </p>
            <div className="h-[460px] overflow-hidden rounded-2xl border border-border bg-card">
              <AiHostPanel userId={userId} tableId={tableId} tableTitle={table.data.title} />
            </div>
          </section>

          <section>
            <h2 className="mb-2 flex items-center gap-2 text-base font-semibold text-foreground">
              <MessageSquare className="h-5 w-5 text-primary" aria-hidden /> Table chat
            </h2>
            <div className="h-[360px] rounded-2xl border border-border bg-card p-3">
              <TableChat tableId={tableId} />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function CandidateCard({
  candidate,
  tally,
  myVote,
  myVoteRecordId,
  tableId,
  userId,
  decided,
  isLeader,
  isWinner,
  suggestedBy,
  canDelete,
}: {
  candidate: { recordId: string; data: CandidateRow; createdBy: string }
  tally: { yes: number; no: number; net: number }
  myVote?: string
  myVoteRecordId?: string
  tableId: string
  userId: string
  decided: boolean
  isLeader: boolean
  isWinner: boolean
  suggestedBy: string
  canDelete: boolean
}) {
  const { create, put, remove } = useMutations<VoteRow>('votes')
  const { remove: removeCandidate } = useMutations<CandidateRow>('candidates')

  function vote(value: 'yes' | 'no') {
    if (decided) return
    if (myVoteRecordId) {
      // Clicking my current vote again withdraws it; the other button flips it.
      if (myVote === value) void remove(myVoteRecordId)
      else void put(myVoteRecordId, { value })
    } else {
      void create({ tableId, candidateId: candidate.recordId, voterId: userId, value })
    }
  }

  return (
    <div
      className={`rounded-2xl border bg-card p-4 shadow-sm ${
        isWinner ? 'border-primary/60' : 'border-border'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-base font-semibold text-foreground">
            {candidate.data.name}
            {isLeader && <Badge>Leading</Badge>}
            {isWinner && (
              <Badge>
                <Trophy className="h-3 w-3" aria-hidden /> Winner
              </Badge>
            )}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {[candidate.data.cuisine, candidate.data.priceLevel, `suggested by ${suggestedBy}`]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {candidate.data.note && (
            <p className="mt-1 text-sm text-foreground/80">{candidate.data.note}</p>
          )}
        </div>
        {canDelete && !decided && (
          <button
            type="button"
            onClick={() => void removeCandidate(candidate.recordId)}
            aria-label={`Remove ${candidate.data.name}`}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={myVote === 'yes' ? 'default' : 'outline'}
          onClick={() => vote('yes')}
          disabled={decided}
          aria-pressed={myVote === 'yes'}
        >
          <ThumbsUp className="h-4 w-4" aria-hidden /> Yes · {tally.yes}
        </Button>
        <Button
          size="sm"
          variant={myVote === 'no' ? 'destructive' : 'outline'}
          onClick={() => vote('no')}
          disabled={decided}
          aria-pressed={myVote === 'no'}
        >
          <ThumbsDown className="h-4 w-4" aria-hidden /> No · {tally.no}
        </Button>
        <span className="text-sm text-muted-foreground">
          net {tally.net > 0 ? `+${tally.net}` : tally.net}
        </span>
        {decided && <span className="text-xs text-muted-foreground">Voting closed</span>}
      </div>
    </div>
  )
}

function AddCandidateForm({ tableId }: { tableId: string }) {
  const { create } = useMutations<CandidateRow>('candidates')
  const [name, setName] = useState('')
  const [cuisine, setCuisine] = useState('')
  const [price, setPrice] = useState('unknown')
  const [note, setNote] = useState('')

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    void create({
      tableId,
      name: trimmed,
      cuisine: cuisine.trim(),
      priceLevel: price === 'unknown' ? '' : price,
      note: note.trim(),
    })
    setName('')
    setCuisine('')
    setPrice('unknown')
    setNote('')
  }

  return (
    <form onSubmit={handleAdd} className="mt-4 rounded-2xl border border-border bg-card p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Plus className="h-4 w-4 text-primary" aria-hidden /> Nominate a restaurant
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="cand-name">Restaurant name</Label>
          <Input
            id="cand-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="That hand-pulled noodle place"
            maxLength={80}
            required
          />
        </div>
        <div>
          <Label htmlFor="cand-cuisine">Cuisine</Label>
          <Input
            id="cand-cuisine"
            value={cuisine}
            onChange={(e) => setCuisine(e.target.value)}
            placeholder="Sichuan, sushi, tacos…"
            maxLength={40}
          />
        </div>
        <div>
          <Label htmlFor="cand-price">Price</Label>
          <Select value={price} onValueChange={setPrice}>
            <SelectTrigger id="cand-price" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRICE_OPTIONS.map((o) => (
                <SelectItem key={o.label} value={o.value === '' ? 'unknown' : o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="cand-note">Why this place? (optional)</Label>
          <Input
            id="cand-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Great for groups, takes reservations…"
            maxLength={140}
          />
        </div>
      </div>
      <Button type="submit" className="mt-3" disabled={!name.trim()}>
        Add candidate
      </Button>
    </form>
  )
}
