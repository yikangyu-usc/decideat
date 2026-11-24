/**
 * Lobby — the DecidEat home.
 *
 * Lists every table the signed-in user belongs to (open ones first, then
 * past decisions) and hosts the create-a-table form. Creating a table also
 * writes the creator's members row, then routes to the room.
 */

import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthOverlay, useAuthProfileReady, useMutations, useQuery } from 'deepspace'
import { Plus, Trophy, Users, UtensilsCrossed } from 'lucide-react'
import { Badge, Button, EmptyState, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui'
import {
  BUDGET_OPTIONS,
  parseCuisineHints,
  type CandidateRow,
  type MemberRow,
  type TableRow,
} from '../../lib/decideat'

export default function HomePage() {
  const { isLoaded, isSignedIn, user, userId } = useAuthProfileReady({ requireUser: true })
  const [showAuth, setShowAuth] = useState(false)

  if (!isLoaded) {
    return (
      <div className="flex min-h-full items-center justify-center text-muted-foreground">
        Loading…
      </div>
    )
  }

  if (!isSignedIn || !userId) {
    return (
      <>
        <div className="flex min-h-full items-center justify-center px-4 py-16">
          <div className="max-w-md space-y-4 text-center">
            <UtensilsCrossed className="mx-auto h-10 w-10 text-primary" aria-hidden />
            <h1 className="text-2xl font-semibold text-foreground">Welcome to DecidEat</h1>
            <p className="text-sm text-muted-foreground">
              Sign in to open a table, invite your friends, and finally settle
              where you&apos;re all eating.
            </p>
            <Button onClick={() => setShowAuth(true)}>Sign in</Button>
          </div>
        </div>
        {showAuth && <AuthOverlay onClose={() => setShowAuth(false)} />}
      </>
    )
  }

  return (
    <Lobby
      userId={userId}
      displayName={user?.name ?? user?.email ?? 'Guest'}
    />
  )
}

function Lobby({ userId, displayName }: { userId: string; displayName: string }) {
  const navigate = useNavigate()

  const { records: myMemberships, status: membersStatus } = useQuery<MemberRow>('members', {
    where: { userId },
    limit: 200,
  })
  const { records: allTables, status: tablesStatus } = useQuery<TableRow>('tables', {
    orderBy: 'createdAt',
    orderDir: 'desc',
    limit: 200,
  })
  const { records: allCandidates } = useQuery<CandidateRow>('candidates', { limit: 500 })

  const myTableIds = useMemo(
    () => new Set(myMemberships.map((m) => m.data.tableId)),
    [myMemberships],
  )
  const myTables = useMemo(
    () => allTables.filter((t) => myTableIds.has(t.recordId)),
    [allTables, myTableIds],
  )
  const openTables = myTables.filter((t) => t.data.status !== 'decided')
  const decidedTables = myTables.filter((t) => t.data.status === 'decided')

  const candidateName = useMemo(() => {
    const map = new Map(allCandidates.map((c) => [c.recordId, c.data.name]))
    return (id?: string) => (id ? (map.get(id) ?? 'a place that was removed') : '')
  }, [allCandidates])

  const loading = membersStatus === 'loading' || tablesStatus === 'loading'

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Where are we eating?
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Open a table, share the link, and let the group (plus your AI host) decide.
        </p>
      </header>

      <CreateTableForm
        userId={userId}
        displayName={displayName}
        onCreated={(tableId) => navigate(`/table/${tableId}`)}
      />

      <section className="mt-10">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
          <Users className="h-5 w-5 text-primary" aria-hidden /> Your tables
        </h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading your tables…</p>
        ) : myTables.length === 0 ? (
          <EmptyState
            icon={<UtensilsCrossed aria-hidden />}
            title="No tables yet"
            description="Start your first table above — name the occasion, share the link, and watch the votes roll in."
          />
        ) : (
          <div className="space-y-6">
            {openTables.length > 0 && (
              <div className="space-y-3">
                {openTables.map((t) => (
                  <TableCard key={t.recordId} table={t} winnerName="" />
                ))}
              </div>
            )}
            {decidedTables.length > 0 && (
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  <Trophy className="h-4 w-4" aria-hidden /> Past decisions
                </h3>
                <div className="space-y-3">
                  {decidedTables.map((t) => (
                    <TableCard
                      key={t.recordId}
                      table={t}
                      winnerName={candidateName(t.data.winnerId)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

function TableCard({
  table,
  winnerName,
}: {
  table: { recordId: string; data: TableRow; createdAt: string }
  winnerName: string
}) {
  const decided = table.data.status === 'decided'
  const hints = table.data.cuisineHints ?? []
  return (
    <Link
      to={`/table/${table.recordId}`}
      className="block rounded-2xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-foreground">{table.data.title}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {[table.data.areaLabel, table.data.budgetLevel, hints.join(', ')]
              .filter(Boolean)
              .join(' · ') || 'No constraints — anything goes'}
          </p>
          {decided && winnerName && (
            <p className="mt-1.5 text-sm font-medium text-primary">
              Decided: {winnerName}
            </p>
          )}
        </div>
        <Badge variant={decided ? 'secondary' : 'default'} className="shrink-0">
          {decided ? 'Decided' : 'Open'}
        </Badge>
      </div>
    </Link>
  )
}

function CreateTableForm({
  userId,
  displayName,
  onCreated,
}: {
  userId: string
  displayName: string
  onCreated: (tableId: string) => void
}) {
  const { createConfirmed: createTable } = useMutations<TableRow>('tables')
  const { createConfirmed: createMember } = useMutations<MemberRow>('members')

  const [title, setTitle] = useState('')
  const [budget, setBudget] = useState('any')
  const [area, setArea] = useState('')
  const [cuisines, setCuisines] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const name = title.trim()
    if (!name || creating) return
    setCreating(true)
    setError(null)
    try {
      const tableId = await createTable({
        title: name,
        status: 'open',
        budgetLevel: budget === 'any' ? '' : budget,
        areaLabel: area.trim(),
        cuisineHints: parseCuisineHints(cuisines),
        note: '',
      })
      await createMember({ tableId, userId, displayName })
      onCreated(tableId)
    } catch (err) {
      console.error('[decideat] create table failed:', err)
      setError(err instanceof Error ? err.message : 'Could not create the table. Try again.')
      setCreating(false)
    }
  }

  return (
    <form
      onSubmit={handleCreate}
      className="rounded-2xl border border-border bg-card p-5 shadow-sm"
    >
      <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-foreground">
        <Plus className="h-5 w-5 text-primary" aria-hidden /> Start a new table
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="table-title">What&apos;s the occasion?</Label>
          <Input
            id="table-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Friday dinner with the crew"
            maxLength={80}
            required
          />
        </div>
        <div>
          <Label htmlFor="table-budget">Budget</Label>
          <Select value={budget} onValueChange={setBudget}>
            <SelectTrigger id="table-budget" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BUDGET_OPTIONS.map((o) => (
                <SelectItem key={o.label} value={o.value === '' ? 'any' : o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="table-area">Area</Label>
          <Input
            id="table-area"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="Downtown, near campus…"
            maxLength={60}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="table-cuisines">Cuisine hints (optional, comma-separated)</Label>
          <Input
            id="table-cuisines"
            value={cuisines}
            onChange={(e) => setCuisines(e.target.value)}
            placeholder="sushi, tacos, nothing too spicy"
            maxLength={120}
          />
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" className="mt-4" loading={creating} disabled={!title.trim()}>
        Open table
      </Button>
    </form>
  )
}
