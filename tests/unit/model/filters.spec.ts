import {
  allAssignees,
  allTags,
  emptyFilters,
  hasActiveFilters,
  matchesFilters
} from '../../../src/model/filters'
import { card } from '../fixtures'

const ada = { id: 'ada', displayName: 'Ada', extra: {} }
const bob = { id: 'bob', displayName: 'Bob', extra: {} }
const teaser = card('a', 'c', 1, {
  title: 'Teaser épisode 3',
  description: 'Montage rapide',
  tags: ['YouTube'],
  assignees: [ada]
})

describe('matchesFilters', () => {
  it('matches everything without filters', () => {
    expect(matchesFilters(teaser, emptyFilters())).toBe(true)
    expect(hasActiveFilters(emptyFilters())).toBe(false)
  })

  it('matches text in title, description and tags, ignoring case and accents', () => {
    expect(matchesFilters(teaser, { ...emptyFilters(), text: 'EPISODE' })).toBe(true)
    expect(matchesFilters(teaser, { ...emptyFilters(), text: 'rapide teaser' })).toBe(true)
    expect(matchesFilters(teaser, { ...emptyFilters(), text: 'youtube' })).toBe(true)
    expect(matchesFilters(teaser, { ...emptyFilters(), text: 'podcast' })).toBe(false)
  })

  it('matches any of the chosen assignees and tags, and all filters together', () => {
    expect(matchesFilters(teaser, { ...emptyFilters(), assignees: ['bob', 'ada'] })).toBe(true)
    expect(matchesFilters(teaser, { ...emptyFilters(), assignees: ['bob'] })).toBe(false)
    expect(matchesFilters(teaser, { ...emptyFilters(), tags: ['YouTube'] })).toBe(true)
    expect(matchesFilters(teaser, { assignees: ['ada'], tags: ['Instagram'], text: '' })).toBe(
      false
    )
  })
})

describe('board facets', () => {
  it('lists tags and assignees once, sorted', () => {
    const cards = [
      teaser,
      card('b', 'c', 2, { tags: ['Instagram', 'YouTube'], assignees: [bob, ada] })
    ]
    expect(allTags(cards)).toEqual(['Instagram', 'YouTube'])
    expect(allAssignees(cards).map(({ id }) => id)).toEqual(['ada', 'bob'])
  })
})
