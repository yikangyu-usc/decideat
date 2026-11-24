/**
 * AiHostPanel — the DecidEat AI host, embedded.
 *
 * Wraps the ai-chat feature's ChatPanel with two product decisions:
 *  - the model picker only offers Anthropic models (DecidEat runs on
 *    DeepSpace's managed Anthropic AI only — and the server pins the model
 *    regardless of what a client sends);
 *  - when a table is passed, the empty-state prompts are about that table,
 *    so "ask the host to decide" is one click.
 */

import { listDeepSpaceAgentModels } from 'deepspace'
import { ChatPanel, type ModelOption } from './ChatPanel'

export const ANTHROPIC_MODEL_OPTIONS: ModelOption[] = listDeepSpaceAgentModels('application')
  .filter((m) => m.provider === 'anthropic')
  .map((m) => ({ id: m.id, label: m.label, provider: m.providerLabel }))

export function AiHostPanel({
  userId,
  tableId,
  tableTitle,
}: {
  userId: string
  tableId?: string
  tableTitle?: string
}) {
  const prompts =
    tableId && tableTitle
      ? [
          `Decide the table "${tableTitle}" (table id ${tableId}): review the candidates and votes, then lock in a winner.`,
          `What are the current standings at "${tableTitle}"?`,
          `Recommend a pick for "${tableTitle}" — weigh the votes against the table's budget, area, and cuisine hints.`,
          `Suggest a tiebreak for "${tableTitle}".`,
        ]
      : [
          'What are the standings at my tables?',
          'Recommend a pick for one of my open tables.',
          'Which of my tables is closest to a decision?',
        ]

  return (
    <ChatPanel
      chatId={null}
      userId={userId}
      models={ANTHROPIC_MODEL_OPTIONS}
      emptyStatePrompts={prompts}
      compact
      className="h-full"
    />
  )
}
