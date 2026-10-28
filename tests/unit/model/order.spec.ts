import { byOrder, insertionIndex, orderAt, placementAt } from '../../../src/model/order'

const siblings = [
  { id: 'a', order: 1 },
  { id: 'b', order: 2 },
  { id: 'c', order: 3 }
]

describe('insertionIndex', () => {
  it('places after the first anchor, else before the second, else last', () => {
    expect(insertionIndex(siblings, { afterId: 'a', beforeId: 'c' })).toBe(1)
    expect(insertionIndex(siblings, { afterId: 'gone', beforeId: 'c' })).toBe(2)
    expect(insertionIndex(siblings, { afterId: null, beforeId: 'a' })).toBe(0)
    expect(insertionIndex(siblings, { afterId: 'gone', beforeId: 'gone' })).toBe(3)
    expect(insertionIndex(siblings, {})).toBe(3)
  })
})

describe('orderAt', () => {
  it('goes between, before or after the neighbours', () => {
    expect(orderAt(siblings, 1).order).toBe(1.5)
    expect(orderAt(siblings, 0).order).toBe(0)
    expect(orderAt(siblings, 3).order).toBe(4)
    expect(orderAt([], 0).order).toBe(1)
  })
})

describe('placementAt', () => {
  it('names both neighbours', () => {
    expect(placementAt(siblings, 0)).toEqual({ afterId: null, beforeId: 'a' })
    expect(placementAt(siblings, 2)).toEqual({ afterId: 'b', beforeId: 'c' })
    expect(placementAt(siblings, 3)).toEqual({ afterId: 'c', beforeId: null })
  })
})

describe('byOrder', () => {
  it('breaks ties by id, the same everywhere', () => {
    const tied = [
      { id: 'y', order: 1 },
      { id: 'x', order: 1 }
    ]
    expect([...tied].sort(byOrder).map(({ id }) => id)).toEqual(['x', 'y'])
  })
})
