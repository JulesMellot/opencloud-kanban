import {
  applyOperation,
  rebase,
  type Operation,
  type PendingOperation
} from '../../../src/model/operations'
import { cardsOf } from '../../../src/model/order'
import type { KanbanDocument } from '../../../src/model/schema'
import { board, card, column, context, otherContext } from '../fixtures'

function apply(document: KanbanDocument, operation: Operation) {
  const result = applyOperation(document, operation, context)
  if (!result.ok) {
    throw new Error(`unexpected failure: ${result.reason}`)
  }
  return result.document
}

function failure(document: KanbanDocument, operation: Operation) {
  const result = applyOperation(document, operation, context)
  return result.ok ? null : result.reason
}

const ids = (document: KanbanDocument, columnId: string) =>
  cardsOf(document.cards, columnId).map(({ id }) => id)
const find = (document: KanbanDocument, id: string) => document.cards.find((item) => item.id === id)

describe('columns', () => {
  it('adds a column after another one, or first', () => {
    let document = apply(board(), {
      type: 'addColumn',
      column: column('doing'),
      afterColumnId: 'todo'
    })
    expect(document.columns.map(({ id }) => id)).toEqual(['todo', 'doing', 'done'])
    document = apply(document, { type: 'addColumn', column: column('ideas'), afterColumnId: null })
    expect(document.columns.map(({ id }) => id)).toEqual(['ideas', 'todo', 'doing', 'done'])
  })

  it('adds a column at the end when its anchor is gone', () => {
    const document = apply(board(), {
      type: 'addColumn',
      column: column('x'),
      afterColumnId: 'gone'
    })
    expect(document.columns.map(({ id }) => id)).toEqual(['todo', 'done', 'x'])
  })

  it('does not add the same column twice', () => {
    const operation: Operation = { type: 'addColumn', column: column('x'), afterColumnId: null }
    expect(apply(apply(board(), operation), operation).columns).toHaveLength(3)
  })

  it('renames and recolors a column', () => {
    const document = apply(board(), {
      type: 'updateColumn',
      columnId: 'todo',
      patch: { title: 'To do', color: 'primary' }
    })
    expect(document.columns[0]).toMatchObject({ title: 'To do', color: 'primary' })
  })

  it('reorders columns', () => {
    const document = apply(board(), { type: 'moveColumn', columnId: 'todo', afterColumnId: 'done' })
    expect(document.columns.map(({ id }) => id)).toEqual(['done', 'todo'])
    expect(
      apply(document, { type: 'moveColumn', columnId: 'todo', afterColumnId: null }).columns[0].id
    ).toBe('todo')
  })

  it('fails to change a column that is gone', () => {
    expect(failure(board(), { type: 'updateColumn', columnId: 'x', patch: { title: 'y' } })).toBe(
      'columnMissing'
    )
    expect(failure(board(), { type: 'moveColumn', columnId: 'x', afterColumnId: null })).toBe(
      'columnMissing'
    )
  })

  it('deletes a column and moves its cards to the end of another one', () => {
    const document = apply(board(), {
      type: 'deleteColumn',
      columnId: 'todo',
      moveCardsTo: 'done',
      cardIds: ['a', 'b', 'c']
    })
    expect(document.columns.map(({ id }) => id)).toEqual(['done'])
    expect(ids(document, 'done')).toEqual(['d', 'a', 'b', 'c'])
    expect(find(document, 'a')?.updatedBy).toBe(context.userId)
  })

  it('deletes a column together with its cards', () => {
    const document = apply(board(), {
      type: 'deleteColumn',
      columnId: 'todo',
      moveCardsTo: null,
      cardIds: ['a', 'b', 'c']
    })
    expect(document.cards.map(({ id }) => id)).toEqual(['d'])
  })

  it('refuses to delete cards the user did not see', () => {
    expect(
      failure(board(), {
        type: 'deleteColumn',
        columnId: 'todo',
        moveCardsTo: null,
        cardIds: ['a', 'b']
      })
    ).toBe('columnChanged')
  })

  it('fails when the column the cards should go to is gone', () => {
    expect(
      failure(board(), { type: 'deleteColumn', columnId: 'todo', moveCardsTo: 'x', cardIds: [] })
    ).toBe('targetColumnMissing')
  })

  it('accepts deleting a column that is already gone', () => {
    const document = board()
    expect(
      apply(document, { type: 'deleteColumn', columnId: 'x', moveCardsTo: null, cardIds: [] })
    ).toBe(document)
  })
})

describe('cards', () => {
  it('adds a card at a given place', () => {
    const document = apply(board(), {
      type: 'addCard',
      card: card('n', 'todo', 0),
      placement: { afterId: 'a', beforeId: 'b' }
    })
    expect(ids(document, 'todo')).toEqual(['a', 'n', 'b', 'c'])
  })

  it('adds a card at the end by default, also to an empty column', () => {
    let document = apply(board(), { type: 'addCard', card: card('n', 'todo', 0), placement: {} })
    expect(ids(document, 'todo')).toEqual(['a', 'b', 'c', 'n'])
    document = apply(
      { ...document, columns: [...document.columns, column('empty')] },
      { type: 'addCard', card: card('m', 'empty', 0), placement: {} }
    )
    expect(ids(document, 'empty')).toEqual(['m'])
  })

  it('does not add the same card twice', () => {
    const operation: Operation = { type: 'addCard', card: card('n', 'todo', 0), placement: {} }
    expect(apply(apply(board(), operation), operation).cards).toHaveLength(5)
  })

  it('fails to add a card to a column that is gone', () => {
    expect(failure(board(), { type: 'addCard', card: card('n', 'x', 0), placement: {} })).toBe(
      'columnMissing'
    )
  })

  it('updates fields of a card and records who did it', () => {
    const document = apply(board(), {
      type: 'updateCard',
      cardId: 'a',
      patch: { title: 'Teaser', publishDate: '2026-11-02T18:00' }
    })
    expect(find(document, 'a')).toMatchObject({
      title: 'Teaser',
      publishDate: '2026-11-02T18:00',
      updatedAt: context.now,
      updatedBy: context.userId,
      createdBy: 'user-0'
    })
  })

  it('moves a card within its column', () => {
    const document = apply(board(), {
      type: 'moveCard',
      cardId: 'c',
      columnId: 'todo',
      placement: { afterId: null, beforeId: 'a' }
    })
    expect(ids(document, 'todo')).toEqual(['c', 'a', 'b'])
  })

  it('moves a card to another column', () => {
    const document = apply(board(), {
      type: 'moveCard',
      cardId: 'a',
      columnId: 'done',
      placement: { afterId: 'd' }
    })
    expect(ids(document, 'todo')).toEqual(['b', 'c'])
    expect(ids(document, 'done')).toEqual(['d', 'a'])
  })

  it('keeps a moved card at its place in the file', () => {
    const document = apply(board(), {
      type: 'moveCard',
      cardId: 'a',
      columnId: 'done',
      placement: {}
    })
    expect(document.cards.map(({ id }) => id)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('renumbers a column when there is no room left between two cards', () => {
    let document: KanbanDocument = {
      ...board(),
      cards: [card('a', 'todo', 1), card('b', 'todo', 1 + 1e-7)]
    }
    document = apply(document, {
      type: 'addCard',
      card: card('n', 'todo', 0),
      placement: { afterId: 'a', beforeId: 'b' }
    })
    expect(ids(document, 'todo')).toEqual(['a', 'n', 'b'])
    expect(cardsOf(document.cards, 'todo').map(({ order }) => order)).toEqual([1, 2, 3])
  })

  it('keeps cards apart over many moves to the same spot', () => {
    let document = board()
    for (let i = 0; i < 200; i++) {
      document = apply(document, {
        type: 'addCard',
        card: card(`n${i}`, 'todo', 0),
        placement: { afterId: 'a', beforeId: cardsOf(document.cards, 'todo')[1].id }
      })
    }
    const orders = cardsOf(document.cards, 'todo').map(({ order }) => order)
    expect(new Set(orders).size).toBe(orders.length)
    expect(ids(document, 'todo')[0]).toBe('a')
    expect(ids(document, 'todo').slice(-2)).toEqual(['b', 'c'])
  })

  it('fails to move a card that is gone, or to a column that is gone', () => {
    expect(
      failure(board(), { type: 'moveCard', cardId: 'x', columnId: 'done', placement: {} })
    ).toBe('cardMissing')
    expect(failure(board(), { type: 'moveCard', cardId: 'a', columnId: 'x', placement: {} })).toBe(
      'columnMissing'
    )
  })

  it('deletes a card, and accepts deleting it twice', () => {
    const once = apply(board(), { type: 'deleteCard', cardId: 'a' })
    expect(once.cards.map(({ id }) => id)).toEqual(['b', 'c', 'd'])
    expect(apply(once, { type: 'deleteCard', cardId: 'a' }).cards).toHaveLength(3)
  })

  it('fails to update a card that is gone', () => {
    expect(failure(board(), { type: 'updateCard', cardId: 'x', patch: { title: 'y' } })).toBe(
      'cardMissing'
    )
  })
})

describe('assignees, tags and links', () => {
  const ada = { id: 'ada', displayName: 'Ada', extra: {} }
  const link = { resourceId: 'r1', path: '/Rushes', name: 'Rushes', isFolder: true, extra: {} }

  it('adds and removes assignees once', () => {
    let document = apply(board(), { type: 'addAssignee', cardId: 'a', assignee: ada })
    document = apply(document, { type: 'addAssignee', cardId: 'a', assignee: ada })
    expect(find(document, 'a')?.assignees).toEqual([ada])
    document = apply(document, { type: 'removeAssignee', cardId: 'a', assigneeId: 'ada' })
    expect(find(document, 'a')?.assignees).toEqual([])
  })

  it('adds and removes tags once', () => {
    let document = apply(board(), { type: 'addTag', cardId: 'a', tag: 'YouTube' })
    document = apply(document, { type: 'addTag', cardId: 'a', tag: 'YouTube' })
    document = apply(document, { type: 'addTag', cardId: 'a', tag: 'Short' })
    expect(find(document, 'a')?.tags).toEqual(['YouTube', 'Short'])
    document = apply(document, { type: 'removeTag', cardId: 'a', tag: 'YouTube' })
    expect(find(document, 'a')?.tags).toEqual(['Short'])
  })

  it('does not touch a card when nothing changes', () => {
    const document = board()
    expect(apply(document, { type: 'removeTag', cardId: 'a', tag: 'none' })).toBe(document)
  })

  it('adds, refreshes, relinks and removes links', () => {
    let document = apply(board(), { type: 'addLink', cardId: 'a', link })
    document = apply(document, { type: 'addLink', cardId: 'a', link })
    expect(find(document, 'a')?.links).toEqual([link])

    const moved = { ...link, path: '/2026/Rushes' }
    document = apply(document, { type: 'updateLink', cardId: 'a', resourceId: 'r1', link: moved })
    expect(find(document, 'a')?.links).toEqual([moved])

    const relinked = { ...link, resourceId: 'r2', path: '/Montage', name: 'Montage' }
    document = apply(document, {
      type: 'updateLink',
      cardId: 'a',
      resourceId: 'r1',
      link: relinked
    })
    expect(find(document, 'a')?.links).toEqual([relinked])

    document = apply(document, { type: 'removeLink', cardId: 'a', resourceId: 'r2' })
    expect(find(document, 'a')?.links).toEqual([])
  })

  it('merges two links when one is relinked to the target of the other', () => {
    let document = apply(board(), { type: 'addLink', cardId: 'a', link })
    const other = { ...link, resourceId: 'r2' }
    document = apply(document, { type: 'addLink', cardId: 'a', link: other })
    document = apply(document, { type: 'updateLink', cardId: 'a', resourceId: 'r1', link: other })
    expect(find(document, 'a')?.links).toEqual([other])
  })
})

describe('applying operations', () => {
  it('never changes the document it was given', () => {
    const document = board()
    const snapshot = structuredClone(document)
    const operations: Operation[] = [
      { type: 'addColumn', column: column('x'), afterColumnId: null },
      { type: 'moveCard', cardId: 'a', columnId: 'done', placement: {} },
      { type: 'updateCard', cardId: 'b', patch: { title: 'z' } },
      { type: 'addTag', cardId: 'c', tag: 't' },
      { type: 'deleteColumn', columnId: 'todo', moveCardsTo: 'done', cardIds: ['a', 'b', 'c'] }
    ]
    for (const operation of operations) {
      apply(document, operation)
    }
    expect(document).toEqual(snapshot)
  })
})

describe('rebase', () => {
  const pending = (operation: Operation): PendingOperation => ({ operation, context })

  it('replays local changes on top of the newer file', () => {
    // someone else renamed b and added e in the meantime
    let server = apply(board(), { type: 'updateCard', cardId: 'b', patch: { title: 'B!' } })
    server = apply(server, { type: 'addCard', card: card('e', 'done', 0), placement: {} })

    const result = rebase(server, [
      pending({ type: 'moveCard', cardId: 'a', columnId: 'done', placement: { afterId: 'd' } }),
      pending({ type: 'updateCard', cardId: 'b', patch: { description: 'local' } })
    ])

    expect(result.dropped).toEqual([])
    expect(result.kept).toHaveLength(2)
    expect(ids(result.document, 'done')).toEqual(['d', 'a', 'e'])
    expect(find(result.document, 'b')).toMatchObject({ title: 'B!', description: 'local' })
  })

  it('drops changes to a card someone else deleted, and reports them', () => {
    const server = apply(board(), { type: 'deleteCard', cardId: 'a' })
    const move = pending({ type: 'moveCard', cardId: 'a', columnId: 'done', placement: {} })
    const rename = pending({ type: 'updateCard', cardId: 'b', patch: { title: 'kept' } })
    const result = rebase(server, [move, rename])
    expect(result.dropped).toEqual([{ pending: move, reason: 'cardMissing' }])
    expect(result.kept).toEqual([rename])
    expect(find(result.document, 'b')?.title).toBe('kept')
  })

  it('lets later local changes build on earlier ones', () => {
    const add = pending({ type: 'addCard', card: card('n', 'todo', 0), placement: {} })
    const tag = pending({ type: 'addTag', cardId: 'n', tag: 'urgent' })
    const result = rebase(board(), [add, tag])
    expect(find(result.document, 'n')?.tags).toEqual(['urgent'])
  })

  it('keeps a move whose neighbours were moved away', () => {
    const server = apply(board(), {
      type: 'moveCard',
      cardId: 'b',
      columnId: 'done',
      placement: {}
    })
    const result = rebase(server, [
      pending({ type: 'moveCard', cardId: 'c', columnId: 'todo', placement: { afterId: 'b' } })
    ])
    expect(result.dropped).toEqual([])
    expect(ids(result.document, 'todo')).toEqual(['a', 'c'])
  })

  it('wins over the other change on the same field, keeps the others', () => {
    const server = applyOperation(
      board(),
      { type: 'updateCard', cardId: 'a', patch: { title: 'theirs', description: 'theirs' } },
      otherContext
    )
    if (!server.ok) throw new Error()
    const result = rebase(server.document, [
      pending({ type: 'updateCard', cardId: 'a', patch: { title: 'mine' } })
    ])
    expect(find(result.document, 'a')).toMatchObject({ title: 'mine', description: 'theirs' })
  })

  it('is a no-op for a change that already landed', () => {
    const add = pending({ type: 'addCard', card: card('n', 'todo', 0), placement: {} })
    const once = rebase(board(), [add]).document
    const twice = rebase(once, [add])
    expect(twice.document.cards.filter(({ id }) => id === 'n')).toHaveLength(1)
    expect(twice.dropped).toEqual([])
  })
})
