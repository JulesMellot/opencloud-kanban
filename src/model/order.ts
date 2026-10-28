import type { Card } from './schema'

/** Smallest gap between two neighbours before a column gets renumbered. */
const MIN_GAP = 1e-6

export function byOrder(a: Pick<Card, 'order' | 'id'>, b: Pick<Card, 'order' | 'id'>) {
  // ties (e.g. two people adding a card at the same spot) are broken the same way everywhere
  return a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
}

/** The cards of a column, in display order. */
export function cardsOf(cards: readonly Card[], columnId: string) {
  return cards.filter((card) => card.columnId === columnId).sort(byOrder)
}

/** Where a card goes in a column: after `afterId`, else before `beforeId`, else last. */
export interface Placement {
  afterId?: string | null
  beforeId?: string | null
}

/**
 * Index in `siblings` (sorted, without the card being placed) the card is inserted at.
 * The anchors may be gone when an operation is replayed on a newer version; the other
 * anchor, then the end of the column, are the fallbacks.
 */
export function insertionIndex(siblings: readonly Pick<Card, 'id'>[], placement: Placement) {
  if (placement.afterId) {
    const index = siblings.findIndex(({ id }) => id === placement.afterId)
    if (index > -1) {
      return index + 1
    }
  }
  if (placement.beforeId) {
    const index = siblings.findIndex(({ id }) => id === placement.beforeId)
    if (index > -1) {
      return index
    }
  }
  return siblings.length
}

/**
 * Order values for placing a card at `index` among `siblings`. Usually only the placed card
 * gets a new value between its neighbours; when they are too close, the whole column is
 * renumbered and `renumbered` holds the new value of every sibling.
 */
export function orderAt(
  siblings: readonly Pick<Card, 'id' | 'order'>[],
  index: number
): { order: number; renumbered: Map<string, number> | null } {
  const previous = siblings[index - 1]
  const next = siblings[index]
  if (!previous && !next) {
    return { order: 1, renumbered: null }
  }
  if (!previous) {
    return { order: next.order - 1, renumbered: null }
  }
  if (!next) {
    return { order: previous.order + 1, renumbered: null }
  }
  if (next.order - previous.order > MIN_GAP * 2) {
    return { order: (previous.order + next.order) / 2, renumbered: null }
  }
  const renumbered = new Map<string, number>()
  siblings.forEach(({ id }, position) => {
    renumbered.set(id, position < index ? position + 1 : position + 2)
  })
  return { order: index + 1, renumbered }
}

/** Placement that puts a card at `index` of `siblings` (sorted, without the card). */
export function placementAt(siblings: readonly Pick<Card, 'id'>[], index: number): Placement {
  return {
    afterId: siblings[index - 1]?.id ?? null,
    beforeId: siblings[index]?.id ?? null
  }
}
