import {
  columnColor,
  createDefaultDocument,
  isValidDate,
  isValidDateTime,
  KanbanFormatError,
  parseDocument,
  serializeDocument
} from '../../../src/model/schema'
import { board } from '../fixtures'

const titles = {
  idea: 'Idée',
  brief: 'Brief',
  shooting: 'Tournage',
  editing: 'Montage',
  review: 'Validation',
  scheduled: 'Planifié',
  published: 'Publié'
}
const empty = () => createDefaultDocument(titles)

function parse(data: unknown) {
  return parseDocument(typeof data === 'string' ? data : JSON.stringify(data), empty)
}

function formatError(data: unknown) {
  try {
    parse(data)
  } catch (e) {
    expect(e).toBeInstanceOf(KanbanFormatError)
    return e as KanbanFormatError
  }
  throw new Error('expected a format error')
}

describe('parseDocument', () => {
  it('treats an empty file as a new board with the default columns', () => {
    const document = parse('  \n')
    expect(document.columns.map(({ title }) => title)).toEqual(Object.values(titles))
    expect(document.cards).toEqual([])
  })

  it('round-trips a board without changes', () => {
    const content = serializeDocument(board())
    expect(serializeDocument(parse(content))).toBe(content)
  })

  it('keeps unknown fields at every level', () => {
    const data = JSON.parse(serializeDocument(board()))
    data.theme = { dense: true }
    data.columns[0].wipLimit = 3
    data.cards[0].priority = 'high'
    data.cards[0].assignees = [{ id: 'u1', displayName: 'Ada', role: 'lead' }]
    data.cards[0].links = [{ resourceId: 'r1', path: '/a', name: 'a', isFolder: false, thumb: 1 }]
    const saved = JSON.parse(serializeDocument(parse(data)))
    expect(saved.theme).toEqual({ dense: true })
    expect(saved.columns[0].wipLimit).toBe(3)
    expect(saved.cards[0].priority).toBe('high')
    expect(saved.cards[0].assignees[0].role).toBe('lead')
    expect(saved.cards[0].links[0].thumb).toBe(1)
  })

  it('fills in optional card fields', () => {
    const document = parse({
      version: 1,
      columns: [{ id: 'c', title: 'C', color: 'primary' }],
      cards: [{ id: 'x', title: 'X', columnId: 'c' }]
    })
    expect(document.cards[0]).toMatchObject({
      description: '',
      order: 0,
      assignees: [],
      tags: [],
      dueDate: null,
      publishDate: null,
      links: []
    })
  })

  it.each([
    ['not json', 'invalidJson'],
    ['[]', 'notKanban'],
    [{ columns: [] }, 'notKanban'],
    [{ version: '1', columns: [], cards: [] }, 'notKanban'],
    [{ version: 0, columns: [], cards: [] }, 'notKanban'],
    [{ version: 99, columns: [], cards: [] }, 'tooNew']
  ])('rejects %j with %s', (data, code) => {
    expect(formatError(data).code).toBe(code)
  })

  it.each([
    [{ version: 1, cards: [] }, 'columns'],
    [{ version: 1, columns: [{ id: '', title: 'x' }], cards: [] }, 'columns[0].id'],
    [{ version: 1, columns: [{ id: 'a', title: 1 }], cards: [] }, 'columns[0].title'],
    [
      {
        version: 1,
        columns: [
          { id: 'a', title: 'A' },
          { id: 'a', title: 'B' }
        ],
        cards: []
      },
      'columns[1].id'
    ],
    [
      { version: 1, columns: [], cards: [{ id: 'x', title: 'X', columnId: 'a', order: 'first' }] },
      'cards[0].order'
    ],
    [
      { version: 1, columns: [], cards: [{ id: 'x', title: 'X', columnId: 'a', tags: [1] }] },
      'cards[0].tags[0]'
    ],
    [
      {
        version: 1,
        columns: [],
        cards: [{ id: 'x', title: 'X', columnId: 'a', dueDate: '2026-02-30' }]
      },
      'cards[0].dueDate'
    ],
    [
      {
        version: 1,
        columns: [],
        cards: [{ id: 'x', title: 'X', columnId: 'a', publishDate: '2026-10-28 10:00' }]
      },
      'cards[0].publishDate'
    ],
    [
      { version: 1, columns: [], cards: [{ id: 'x', title: 'X', columnId: 'a', links: [{}] }] },
      'cards[0].links[0].resourceId'
    ]
  ])('names the invalid field of %j', (data, path) => {
    const error = formatError(data)
    expect(error.code).toBe('invalid')
    expect(error.path).toBe(path)
  })

  it('keeps a column color it does not know, but draws it neutral', () => {
    const document = parse({
      version: 1,
      columns: [{ id: 'a', title: 'A', color: '#ff0000' }],
      cards: []
    })
    expect(document.columns[0].color).toBe('#ff0000')
    expect(columnColor(document.columns[0])).toBe('outline')
    expect(columnColor({ color: 'tertiary' })).toBe('tertiary')
  })
})

describe('createDefaultDocument', () => {
  it('uses design system color roles only', () => {
    for (const column of empty().columns) {
      expect(columnColor(column)).toBe(column.color)
    }
  })

  it('gives every column its own id', () => {
    const ids = empty().columns.map(({ id }) => id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('date validation', () => {
  it.each(['2026-01-31', '2024-02-29', '2026-12-01'])('accepts %s', (value) => {
    expect(isValidDate(value)).toBe(true)
  })

  it.each(['2026-02-29', '2026-13-01', '2026-1-1', '2026-04-31', ''])('rejects %s', (value) => {
    expect(isValidDate(value)).toBe(false)
  })

  it('checks publish dates to the minute', () => {
    expect(isValidDateTime('2026-03-29T02:30')).toBe(true)
    expect(isValidDateTime('2026-03-29T24:00')).toBe(false)
    expect(isValidDateTime('2026-03-29T02:30:00')).toBe(false)
  })
})
