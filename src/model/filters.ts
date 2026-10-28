import type { Card } from './schema'

export interface CardFilters {
  /** Ids of assignees; a card matches if it has any of them */
  assignees: string[]
  /** A card matches if it has any of these tags */
  tags: string[]
  /** Matched against title, description and tags, ignoring case and accents */
  text: string
}

export function emptyFilters(): CardFilters {
  return { assignees: [], tags: [], text: '' }
}

export function hasActiveFilters(filters: CardFilters) {
  return filters.assignees.length > 0 || filters.tags.length > 0 || filters.text.trim() !== ''
}

export function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase()
}

export function matchesFilters(card: Card, filters: CardFilters) {
  if (
    filters.assignees.length &&
    !card.assignees.some(({ id }) => filters.assignees.includes(id))
  ) {
    return false
  }
  if (filters.tags.length && !card.tags.some((tag) => filters.tags.includes(tag))) {
    return false
  }
  const words = normalizeText(filters.text).split(/\s+/).filter(Boolean)
  if (!words.length) {
    return true
  }
  const haystack = normalizeText([card.title, card.description, ...card.tags].join(' '))
  return words.every((word) => haystack.includes(word))
}

/** All tags used on the board, sorted */
export function allTags(cards: readonly Card[]) {
  return [...new Set(cards.flatMap(({ tags }) => tags))].sort((a, b) => a.localeCompare(b))
}

/** Everyone assigned to a card on the board, by id, sorted by name */
export function allAssignees(cards: readonly Card[]) {
  const byId = new Map<string, Card['assignees'][number]>()
  for (const card of cards) {
    for (const assignee of card.assignees) {
      byId.set(assignee.id, assignee)
    }
  }
  return [...byId.values()].sort((a, b) => a.displayName.localeCompare(b.displayName))
}
