/**
 * Every change to a board is an operation: a pure function from one document to the next.
 *
 * Operations name what they change by id and place things relative to their neighbours, so
 * they still make sense when they are replayed on a version of the file someone else changed
 * in the meantime (see {@link rebase}). An operation that no longer applies reports why
 * instead of guessing.
 */
import { cardsOf, insertionIndex, orderAt, type Placement } from './order'
import type { Assignee, Card, CardLink, Column, KanbanDocument } from './schema'

export type CardPatch = Partial<Pick<Card, 'title' | 'description' | 'dueDate' | 'publishDate'>>
export type ColumnPatch = Partial<Pick<Column, 'title' | 'color'>>

export type Operation =
  | { type: 'addColumn'; column: Column; afterColumnId: string | null }
  | { type: 'updateColumn'; columnId: string; patch: ColumnPatch }
  | { type: 'moveColumn'; columnId: string; afterColumnId: string | null }
  | {
      type: 'deleteColumn'
      columnId: string
      /** Column the cards go to, or null to delete them along with the column */
      moveCardsTo: string | null
      /** The cards the user saw in the column when confirming */
      cardIds: string[]
    }
  | { type: 'addCard'; card: Card; placement: Placement }
  | { type: 'updateCard'; cardId: string; patch: CardPatch }
  | { type: 'moveCard'; cardId: string; columnId: string; placement: Placement }
  | { type: 'deleteCard'; cardId: string }
  | { type: 'addAssignee'; cardId: string; assignee: Assignee }
  | { type: 'removeAssignee'; cardId: string; assigneeId: string }
  | { type: 'addTag'; cardId: string; tag: string }
  | { type: 'removeTag'; cardId: string; tag: string }
  | { type: 'addLink'; cardId: string; link: CardLink }
  /**
   * Replaces the link to `resourceId`: a new target ("relink"), or the current path and name
   * of a resource that was moved or renamed (`refresh`, which is not a change by the user and
   * leaves "last changed by" alone).
   */
  | { type: 'updateLink'; cardId: string; resourceId: string; link: CardLink; refresh?: boolean }
  | { type: 'removeLink'; cardId: string; resourceId: string }

export type OperationType = Operation['type']

/** Who made a change and when, recorded on the cards it touches. */
export interface OperationContext {
  userId: string
  /** ISO timestamp */
  now: string
}

export type FailureReason =
  /** The card was deleted */
  | 'cardMissing'
  /** The column was deleted */
  | 'columnMissing'
  /** The column cards were meant to move to was deleted */
  | 'targetColumnMissing'
  /** Cards the user did not see when confirming were added to a column being deleted with its cards */
  | 'columnChanged'

export type ApplyResult =
  { ok: true; document: KanbanDocument } | { ok: false; reason: FailureReason }

function ok(document: KanbanDocument): ApplyResult {
  return { ok: true, document }
}

function fail(reason: FailureReason): ApplyResult {
  return { ok: false, reason }
}

function hasColumn(document: KanbanDocument, columnId: string) {
  return document.columns.some(({ id }) => id === columnId)
}

function columnIndexAfter(columns: readonly Column[], afterColumnId: string | null) {
  if (afterColumnId === null) {
    return 0
  }
  const index = columns.findIndex(({ id }) => id === afterColumnId)
  // the anchor is gone: keep the column, at the end
  return index === -1 ? columns.length : index + 1
}

function touch(card: Card, context: OperationContext): Card {
  return { ...card, updatedAt: context.now, updatedBy: context.userId }
}

/** Places `card` (not part of `cards`) into `columnId` and returns the new card list. */
function placeCard(
  cards: readonly Card[],
  card: Card,
  columnId: string,
  placement: Placement
): Card[] {
  const others = cards.filter(({ id }) => id !== card.id)
  const siblings = cardsOf(others, columnId)
  const { order, renumbered } = orderAt(siblings, insertionIndex(siblings, placement))
  const placed = { ...card, columnId, order }
  const renumber = (other: Card) =>
    renumbered?.has(other.id) ? { ...other, order: renumbered.get(other.id) as number } : other
  // a moved card keeps its place in the file, which keeps diffs between versions small
  const index = cards.findIndex(({ id }) => id === card.id)
  if (index === -1) {
    return [...others.map(renumber), placed]
  }
  return cards.map((other) => (other.id === card.id ? placed : renumber(other)))
}

function updateCard(
  document: KanbanDocument,
  cardId: string,
  context: OperationContext,
  change: (card: Card) => Card | null,
  { touches = true } = {}
): ApplyResult {
  const card = document.cards.find(({ id }) => id === cardId)
  if (!card) {
    return fail('cardMissing')
  }
  const changed = change(card)
  if (!changed) {
    // nothing to do, e.g. the tag was already there
    return ok(document)
  }
  return ok({
    ...document,
    cards: document.cards.map((other) =>
      other.id === cardId ? (touches ? touch(changed, context) : changed) : other
    )
  })
}

export function applyOperation(
  document: KanbanDocument,
  operation: Operation,
  context: OperationContext
): ApplyResult {
  switch (operation.type) {
    case 'addColumn': {
      if (hasColumn(document, operation.column.id)) {
        // replayed after it already landed
        return ok(document)
      }
      const columns = [...document.columns]
      columns.splice(columnIndexAfter(columns, operation.afterColumnId), 0, operation.column)
      return ok({ ...document, columns })
    }

    case 'updateColumn': {
      if (!hasColumn(document, operation.columnId)) {
        return fail('columnMissing')
      }
      return ok({
        ...document,
        columns: document.columns.map((column) =>
          column.id === operation.columnId ? { ...column, ...operation.patch } : column
        )
      })
    }

    case 'moveColumn': {
      const column = document.columns.find(({ id }) => id === operation.columnId)
      if (!column) {
        return fail('columnMissing')
      }
      const columns = document.columns.filter(({ id }) => id !== operation.columnId)
      columns.splice(columnIndexAfter(columns, operation.afterColumnId), 0, column)
      return ok({ ...document, columns })
    }

    case 'deleteColumn': {
      if (!hasColumn(document, operation.columnId)) {
        // someone else deleted it already: their choice about its cards stands
        return ok(document)
      }
      const inColumn = cardsOf(document.cards, operation.columnId)
      const columns = document.columns.filter(({ id }) => id !== operation.columnId)
      if (operation.moveCardsTo === null) {
        if (inColumn.some(({ id }) => !operation.cardIds.includes(id))) {
          return fail('columnChanged')
        }
        return ok({
          ...document,
          columns,
          cards: document.cards.filter(({ columnId }) => columnId !== operation.columnId)
        })
      }
      if (!columns.some(({ id }) => id === operation.moveCardsTo)) {
        return fail('targetColumnMissing')
      }
      let cards = [...document.cards]
      for (const card of inColumn) {
        cards = placeCard(cards, touch(card, context), operation.moveCardsTo, {})
      }
      return ok({ ...document, columns, cards })
    }

    case 'addCard': {
      if (document.cards.some(({ id }) => id === operation.card.id)) {
        return ok(document)
      }
      if (!hasColumn(document, operation.card.columnId)) {
        return fail('columnMissing')
      }
      return ok({
        ...document,
        cards: placeCard(
          document.cards,
          operation.card,
          operation.card.columnId,
          operation.placement
        )
      })
    }

    case 'updateCard':
      return updateCard(document, operation.cardId, context, (card) => ({
        ...card,
        ...operation.patch
      }))

    case 'moveCard': {
      const card = document.cards.find(({ id }) => id === operation.cardId)
      if (!card) {
        return fail('cardMissing')
      }
      if (!hasColumn(document, operation.columnId)) {
        return fail('columnMissing')
      }
      return ok({
        ...document,
        cards: placeCard(
          document.cards,
          touch(card, context),
          operation.columnId,
          operation.placement
        )
      })
    }

    case 'deleteCard':
      // a card someone else deleted already is as deleted as it gets
      return ok({ ...document, cards: document.cards.filter(({ id }) => id !== operation.cardId) })

    case 'addAssignee':
      return updateCard(document, operation.cardId, context, (card) =>
        card.assignees.some(({ id }) => id === operation.assignee.id)
          ? null
          : { ...card, assignees: [...card.assignees, operation.assignee] }
      )

    case 'removeAssignee':
      return updateCard(document, operation.cardId, context, (card) =>
        card.assignees.some(({ id }) => id === operation.assigneeId)
          ? { ...card, assignees: card.assignees.filter(({ id }) => id !== operation.assigneeId) }
          : null
      )

    case 'addTag':
      return updateCard(document, operation.cardId, context, (card) =>
        card.tags.includes(operation.tag) ? null : { ...card, tags: [...card.tags, operation.tag] }
      )

    case 'removeTag':
      return updateCard(document, operation.cardId, context, (card) =>
        card.tags.includes(operation.tag)
          ? { ...card, tags: card.tags.filter((tag) => tag !== operation.tag) }
          : null
      )

    case 'addLink':
      return updateCard(document, operation.cardId, context, (card) =>
        card.links.some(({ resourceId }) => resourceId === operation.link.resourceId)
          ? null
          : { ...card, links: [...card.links, operation.link] }
      )

    case 'updateLink':
      return updateCard(
        document,
        operation.cardId,
        context,
        (card) => {
          if (!card.links.some(({ resourceId }) => resourceId === operation.resourceId)) {
            return null
          }
          const links = card.links
            .map((link) => (link.resourceId === operation.resourceId ? operation.link : link))
            // relinking to a resource the card already links to merges the two
            .filter(
              (link, index, all) =>
                all.findIndex(({ resourceId }) => resourceId === link.resourceId) === index
            )
          return { ...card, links }
        },
        { touches: !operation.refresh }
      )

    case 'removeLink':
      return updateCard(document, operation.cardId, context, (card) =>
        card.links.some(({ resourceId }) => resourceId === operation.resourceId)
          ? {
              ...card,
              links: card.links.filter(({ resourceId }) => resourceId !== operation.resourceId)
            }
          : null
      )
  }
}

/** A local change not yet known to be in the file. */
export interface PendingOperation {
  operation: Operation
  context: OperationContext
}

export interface RebaseResult {
  document: KanbanDocument
  /** Still pending, now on top of the new base */
  kept: PendingOperation[]
  /** Could not be applied to the new base, with the reason */
  dropped: { pending: PendingOperation; reason: FailureReason }[]
}

/**
 * Replays local changes on top of a newer version of the file. Each operation sees the result
 * of the ones before it; those that no longer apply are dropped and reported.
 */
export function rebase(base: KanbanDocument, pending: readonly PendingOperation[]): RebaseResult {
  let document = base
  const kept: PendingOperation[] = []
  const dropped: RebaseResult['dropped'] = []
  for (const item of pending) {
    const result = applyOperation(document, item.operation, item.context)
    if (result.ok) {
      document = result.document
      kept.push(item)
    } else {
      dropped.push({ pending: item, reason: result.reason })
    }
  }
  return { document, kept, dropped }
}

/** The card an operation is about, if any: used to name it when it had to be dropped. */
export function operationCardId(operation: Operation): string | null {
  switch (operation.type) {
    case 'addCard':
      return operation.card.id
    case 'addColumn':
    case 'updateColumn':
    case 'moveColumn':
    case 'deleteColumn':
      return null
    default:
      return operation.cardId
  }
}
