import type { Card, Column, KanbanDocument } from '../../src/model/schema'
import type { OperationContext } from '../../src/model/operations'

export const context: OperationContext = { userId: 'user-1', now: '2026-10-28T10:00:00.000Z' }
export const otherContext: OperationContext = { userId: 'user-2', now: '2026-10-28T10:05:00.000Z' }

export function column(id: string, title = id): Column {
  return { id, title, color: 'outline', extra: {} }
}

export function card(
  id: string,
  columnId: string,
  order: number,
  fields: Partial<Card> = {}
): Card {
  return {
    id,
    title: id,
    description: '',
    columnId,
    order,
    assignees: [],
    tags: [],
    dueDate: null,
    publishDate: null,
    links: [],
    createdAt: '2026-10-01T08:00:00.000Z',
    createdBy: 'user-0',
    updatedAt: '2026-10-01T08:00:00.000Z',
    updatedBy: 'user-0',
    extra: {},
    ...fields
  }
}

/** Two columns `todo` and `done`; `a`, `b`, `c` in `todo`, `d` in `done`. */
export function board(): KanbanDocument {
  return {
    version: 1,
    columns: [column('todo'), column('done')],
    cards: [card('a', 'todo', 1), card('b', 'todo', 2), card('c', 'todo', 3), card('d', 'done', 1)],
    extra: {}
  }
}
