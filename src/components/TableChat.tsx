/**
 * TableChat — per-table chat built on the messaging feature.
 *
 * Each table gets its own public channel named `table-<tableId>`, found or
 * created by useChatChannel (the same hook the /chat page uses for its
 * default channel). Messages render with the messaging schemas' useMessages
 * hook; author names resolve through the users roster.
 */

import { useEffect, useRef, useState } from 'react'
import { useMessages, useUserLookup } from 'deepspace'
import { Send } from 'lucide-react'
import { Button, Input } from '@/components/ui'
import { useChatChannel } from './messaging/hooks/useChatChannel'

export function TableChat({ tableId }: { tableId: string }) {
  const { channelId, status } = useChatChannel(`table-${tableId}`)
  const { messages, send } = useMessages(channelId)
  const { getUser } = useUserLookup()
  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const sorted = [...messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [sorted.length])

  function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    void send(text)
    setDraft('')
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-1 py-2">
        {status !== 'ready' || !channelId ? (
          <p className="text-sm text-muted-foreground">Loading chat…</p>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No messages yet. Lobby for your pick — or talk someone out of theirs.
          </p>
        ) : (
          sorted.map((m) => (
            <div key={m.recordId} className="text-sm">
              <span className="font-semibold text-foreground">
                {getUser(m.data.authorId)?.name ?? 'Someone'}
              </span>{' '}
              <span className="text-xs text-muted-foreground">
                {new Date(m.createdAt).toLocaleTimeString([], {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </span>
              <p className="whitespace-pre-wrap text-foreground/90">
                {m.data.deleted ? '[message deleted]' : m.data.content}
              </p>
            </div>
          ))
        )}
      </div>
      <form onSubmit={handleSend} className="flex shrink-0 gap-2 pt-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message the table…"
          maxLength={2000}
          aria-label="Message the table"
        />
        <Button type="submit" size="icon" disabled={!draft.trim() || !channelId} aria-label="Send message">
          <Send className="h-4 w-4" aria-hidden />
        </Button>
      </form>
    </div>
  )
}
