import { readViewers } from '../../../src/composables/usePresence'

function awareness(clientID: number, states: [number, Record<string, unknown>][]) {
  return { clientID, getStates: () => new Map(states) } as Parameters<typeof readViewers>[0]
}

const ada = { id: 'ada', name: 'Ada', color: '#123456' }
const bob = { id: 'bob', name: 'Bob', color: '#654321' }

describe('readViewers', () => {
  it('lists everyone once, this user first, with the card they look at', () => {
    const viewers = readViewers(
      awareness(1, [
        [2, { user: bob, kanban: { cardId: 'c1' } }],
        [1, { user: ada, kanban: { cardId: null } }],
        [3, { user: bob, kanban: { cardId: null } }]
      ])
    )
    expect(viewers).toEqual([
      { ...ada, isSelf: true, cardId: null },
      { ...bob, isSelf: false, cardId: 'c1' }
    ])
  })

  it('skips states the server has not stamped with a user yet', () => {
    expect(readViewers(awareness(1, [[2, { kanban: { cardId: 'c1' } }]]))).toEqual([])
  })

  it('counts a user with the board open in several tabs as this user', () => {
    const viewers = readViewers(
      awareness(2, [
        [1, { user: ada, kanban: { cardId: 'c1' } }],
        [2, { user: ada }]
      ])
    )
    expect(viewers).toEqual([{ ...ada, isSelf: true, cardId: 'c1' }])
  })
})
