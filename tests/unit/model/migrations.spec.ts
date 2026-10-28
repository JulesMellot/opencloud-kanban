import { migrate, MigrationError, migrations } from '../../../src/model/migrations'

describe('migrate', () => {
  it('leaves a current document as it is', () => {
    const data = { version: 1, columns: [], cards: [] }
    expect(migrate(data)).toEqual(data)
  })

  it('has no migration yet, version 1 being the first', () => {
    expect(migrations).toEqual({})
  })

  it('runs every step from the file version to the target, in order', () => {
    const steps = {
      1: (data: Record<string, unknown>) => ({
        ...data,
        version: 2,
        renamed: data.old,
        old: undefined
      }),
      2: (data: Record<string, unknown>) => ({ ...data, version: 3, added: true })
    }
    const result = migrate({ version: 1, old: 'x', keep: { me: 1 } }, 3, steps as never)
    expect(result).toMatchObject({ version: 3, renamed: 'x', added: true, keep: { me: 1 } })
  })

  it('does not change the data it was given', () => {
    const data = { version: 1, list: [1] }
    migrate(data, 2, {
      1: (copy) => ({ ...copy, version: 2, list: [...(copy.list as number[]), 2] })
    })
    expect(data).toEqual({ version: 1, list: [1] })
  })

  it('fails on a missing step', () => {
    expect(() => migrate({ version: 1 }, 3, { 1: (data) => ({ ...data, version: 2 }) })).toThrow(
      MigrationError
    )
  })

  it('fails on a step that does not bump the version by one', () => {
    expect(() => migrate({ version: 1 }, 2, { 1: (data) => ({ ...data, version: 3 }) })).toThrow(
      MigrationError
    )
  })
})
