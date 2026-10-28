import { createBoardSync, GatewayError, type BoardGateway } from '../../../src/sync/boardSync'
import { cardsOf } from '../../../src/model/order'
import {
  createDefaultDocument,
  parseDocument,
  serializeDocument,
  type KanbanDocument
} from '../../../src/model/schema'
import type { Operation } from '../../../src/model/operations'
import { board, card } from '../fixtures'

const parse = (content: string) =>
  parseDocument(content, () =>
    createDefaultDocument({
      idea: 'i',
      brief: 'b',
      shooting: 's',
      editing: 'e',
      review: 'r',
      scheduled: 's',
      published: 'p'
    })
  )

/** An in-memory WebDAV file with etags and If-Match */
class FakeServer {
  content: string
  version = 1
  writes: string[] = []
  failNext: GatewayError[] = []

  constructor(document: KanbanDocument) {
    this.content = serializeDocument(document)
  }

  get etag() {
    return `"v${this.version}"`
  }

  get document() {
    return parse(this.content)
  }

  /** A write by someone else */
  replace(document: KanbanDocument | string) {
    this.content = typeof document === 'string' ? document : serializeDocument(document)
    this.version++
  }

  gateway(): BoardGateway & { reads: number; etagChecks: number } {
    const gateway = {
      reads: 0,
      etagChecks: 0,
      read: () => {
        gateway.reads++
        return Promise.resolve({ content: this.content, etag: this.etag })
      },
      etag: () => {
        gateway.etagChecks++
        return Promise.resolve(this.etag)
      },
      write: (content: string, etag: string) => {
        const failure = this.failNext.shift()
        if (failure) {
          return Promise.reject(failure)
        }
        if (etag !== this.etag) {
          return Promise.reject(new GatewayError('conflict', 412))
        }
        this.content = content
        this.version++
        this.writes.push(content)
        return Promise.resolve(this.etag)
      }
    }
    return gateway
  }
}

function setup(server: FakeServer, userId = 'me', overrides = {}) {
  const gateway = server.gateway()
  const onDropped = vi.fn()
  const sync = createBoardSync({
    gateway,
    parse,
    serialize: serializeDocument,
    context: () => ({ userId, now: '2026-10-28T12:00:00.000Z' }),
    onDropped,
    ...overrides
  })
  sync.start({ content: server.content, etag: server.etag })
  return { sync, gateway, onDropped }
}

const rename = (cardId: string, title: string): Operation => ({
  type: 'updateCard',
  cardId,
  patch: { title }
})

function title(document: KanbanDocument | null, id: string) {
  return document?.cards.find((item) => item.id === id)?.title
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('saving', () => {
  it('shows a change at once and saves it 800 ms after the last one', async () => {
    const server = new FakeServer(board())
    const { sync } = setup(server)

    expect(sync.apply(rename('a', 'one'))).toBeNull()
    expect(title(sync.document.value, 'a')).toBe('one')
    expect(sync.status.value).toBe('saving')

    await vi.advanceTimersByTimeAsync(500)
    sync.apply(rename('b', 'two'))
    await vi.advanceTimersByTimeAsync(700)
    expect(server.writes).toHaveLength(0)

    await vi.advanceTimersByTimeAsync(100)
    expect(server.writes).toHaveLength(1)
    expect(title(server.document, 'a')).toBe('one')
    expect(title(server.document, 'b')).toBe('two')
    expect(sync.status.value).toBe('saved')
    expect(sync.hasUnsavedChanges.value).toBe(false)
  })

  it('saves right away when asked', async () => {
    const server = new FakeServer(board())
    const { sync } = setup(server)
    sync.apply(rename('a', 'now'))
    await sync.save()
    expect(title(server.document, 'a')).toBe('now')
  })

  it('refuses a change that does not apply, and saves nothing', async () => {
    const server = new FakeServer(board())
    const { sync } = setup(server)
    expect(sync.apply(rename('missing', 'x'))).toBe('cardMissing')
    await vi.advanceTimersByTimeAsync(2000)
    expect(server.writes).toHaveLength(0)
    expect(sync.status.value).toBe('saved')
  })

  it('keeps changes made while a save is running and saves them next', async () => {
    const server = new FakeServer(board())
    const gateway = server.gateway()
    let release: () => void = () => undefined
    const write = gateway.write
    gateway.write = (content, etag) =>
      new Promise((resolve, reject) => {
        release = () => write(content, etag).then(resolve, reject)
      })
    const sync = createBoardSync({
      gateway,
      parse,
      serialize: serializeDocument,
      context: () => ({ userId: 'me', now: 'now' })
    })
    sync.start({ content: server.content, etag: server.etag })

    sync.apply(rename('a', 'first'))
    await vi.advanceTimersByTimeAsync(800)
    sync.apply(rename('b', 'during'))
    expect(title(sync.document.value, 'a')).toBe('first')
    expect(title(sync.document.value, 'b')).toBe('during')

    gateway.write = write
    release()
    await vi.advanceTimersByTimeAsync(800)
    expect(title(server.document, 'a')).toBe('first')
    expect(title(server.document, 'b')).toBe('during')
    expect(sync.hasUnsavedChanges.value).toBe(false)
  })
})

describe('conflicts', () => {
  it('replays local changes on the newer file after a 412 and saves both', async () => {
    const server = new FakeServer(board())
    const { sync, onDropped } = setup(server)

    sync.apply({ type: 'moveCard', cardId: 'a', columnId: 'done', placement: {} })
    // someone else renames b before our save
    const theirs = server.document
    theirs.cards = theirs.cards.map((item) =>
      item.id === 'b' ? { ...item, title: 'theirs' } : item
    )
    server.replace(theirs)

    await vi.advanceTimersByTimeAsync(800)
    const saved = server.document
    expect(title(saved, 'b')).toBe('theirs')
    expect(cardsOf(saved.cards, 'done').map(({ id }) => id)).toEqual(['d', 'a'])
    expect(title(sync.document.value, 'b')).toBe('theirs')
    expect(onDropped).not.toHaveBeenCalled()
    expect(sync.status.value).toBe('saved')
  })

  it('gives up changes to a card someone else deleted, tells, and saves the rest', async () => {
    const server = new FakeServer(board())
    const { sync, onDropped } = setup(server)

    sync.apply(rename('a', 'mine'))
    sync.apply(rename('b', 'kept'))
    const theirs = server.document
    theirs.cards = theirs.cards.filter(({ id }) => id !== 'a')
    server.replace(theirs)

    await vi.advanceTimersByTimeAsync(800)
    expect(onDropped).toHaveBeenCalledTimes(1)
    expect(onDropped.mock.calls[0][0]).toEqual([expect.objectContaining({ reason: 'cardMissing' })])
    expect(server.document.cards.map(({ id }) => id)).toEqual(['b', 'c', 'd'])
    expect(title(server.document, 'b')).toBe('kept')
  })

  it('lets two tabs edit at the same time without losing anything', async () => {
    const server = new FakeServer(board())
    const tab1 = setup(server, 'ada')
    const tab2 = setup(server, 'bob')

    tab1.sync.apply(rename('a', 'by ada'))
    tab1.sync.apply({ type: 'addCard', card: card('n1', 'todo', 0), placement: {} })
    tab2.sync.apply(rename('b', 'by bob'))
    tab2.sync.apply({ type: 'addCard', card: card('n2', 'todo', 0), placement: {} })
    tab2.sync.apply({ type: 'moveCard', cardId: 'c', columnId: 'done', placement: {} })

    await vi.advanceTimersByTimeAsync(800)
    await tab1.sync.checkForChanges()
    await tab2.sync.checkForChanges()

    const saved = server.document
    expect(title(saved, 'a')).toBe('by ada')
    expect(title(saved, 'b')).toBe('by bob')
    expect(saved.cards.map(({ id }) => id).sort()).toEqual(['a', 'b', 'c', 'd', 'n1', 'n2'])
    expect(cardsOf(saved.cards, 'done').map(({ id }) => id)).toContain('c')
    expect(serializeDocument(tab1.sync.document.value as KanbanDocument)).toBe(server.content)
    expect(serializeDocument(tab2.sync.document.value as KanbanDocument)).toBe(server.content)
  })

  it('stops retrying after too many conflicts in a row and tries again later', async () => {
    const server = new FakeServer(board())
    const gateway = server.gateway()
    const write = gateway.write
    let conflicts = 0
    gateway.write = (content, etag) => {
      if (conflicts++ < 10) {
        server.replace(server.content)
      }
      return write(content, etag)
    }
    const sync = createBoardSync({
      gateway,
      parse,
      serialize: serializeDocument,
      context: () => ({ userId: 'me', now: 'now' }),
      maxConflictRetries: 3
    })
    sync.start({ content: server.content, etag: server.etag })
    sync.apply(rename('a', 'eventually'))
    await vi.advanceTimersByTimeAsync(800)
    expect(sync.status.value).toBe('error')
    expect(title(sync.document.value, 'a')).toBe('eventually')
    await vi.advanceTimersByTimeAsync(60_000)
    expect(title(server.document, 'a')).toBe('eventually')
    expect(sync.status.value).toBe('saved')
  })
})

describe('failures', () => {
  it('keeps changes when saving fails, retries, and saves them later', async () => {
    const server = new FakeServer(board())
    const { sync } = setup(server)
    server.failNext.push(new GatewayError('network', 502), new Error('offline') as GatewayError)

    sync.apply(rename('a', 'safe'))
    await vi.advanceTimersByTimeAsync(800)
    expect(sync.status.value).toBe('error')
    expect(sync.error.value).toBe('network')
    expect(sync.hasUnsavedChanges.value).toBe(true)
    expect(title(sync.document.value, 'a')).toBe('safe')

    await vi.advanceTimersByTimeAsync(2000)
    expect(sync.status.value).toBe('error')
    await vi.advanceTimersByTimeAsync(5000)
    expect(sync.status.value).toBe('saved')
    expect(sync.error.value).toBeNull()
    expect(title(server.document, 'a')).toBe('safe')
  })

  it('switches to read-only when saving is no longer allowed, keeping the changes', async () => {
    const server = new FakeServer(board())
    const { sync } = setup(server)
    server.failNext.push(new GatewayError('forbidden', 403))
    sync.apply(rename('a', 'mine'))
    await vi.advanceTimersByTimeAsync(800)
    expect(sync.readOnly.value).toBe(true)
    expect(sync.error.value).toBe('forbidden')
    expect(sync.apply(rename('b', 'more'))).toBe('readOnly')
    expect(JSON.parse(sync.exportContent()).cards[0].title).toBe('mine')
  })

  it('never writes once the file stopped being a valid board', async () => {
    const server = new FakeServer(board())
    const { sync } = setup(server)
    sync.apply(rename('a', 'mine'))
    server.replace('this is not a board')

    await vi.advanceTimersByTimeAsync(800)
    expect(sync.formatError.value?.code).toBe('invalidJson')
    expect(server.content).toBe('this is not a board')
    expect(sync.apply(rename('b', 'x'))).toBe('readOnly')
    await vi.advanceTimersByTimeAsync(120_000)
    expect(server.content).toBe('this is not a board')
    expect(title(sync.document.value, 'a')).toBe('mine')
    expect(JSON.parse(sync.exportContent()).cards[0].title).toBe('mine')
  })

  it('stops when the file is gone', async () => {
    const server = new FakeServer(board())
    const { sync, gateway } = setup(server)
    gateway.etag = () => Promise.reject(new GatewayError('notFound', 404))
    await sync.checkForChanges()
    expect(sync.error.value).toBe('notFound')
    expect(sync.apply(rename('a', 'x'))).toBe('readOnly')
  })
})

describe('reading changes from others', () => {
  it('only fetches the etag when nothing changed', async () => {
    const server = new FakeServer(board())
    const { sync, gateway } = setup(server)
    await sync.checkForChanges()
    expect(gateway.etagChecks).toBe(1)
    expect(gateway.reads).toBe(0)
  })

  it('shows a newer version without saving anything when there are no local changes', async () => {
    const server = new FakeServer(board())
    const { sync } = setup(server)
    const theirs = server.document
    theirs.cards = theirs.cards.map((item) =>
      item.id === 'a' ? { ...item, title: 'theirs' } : item
    )
    server.replace(theirs)

    await sync.checkForChanges()
    expect(title(sync.document.value, 'a')).toBe('theirs')
    expect(sync.etag.value).toBe(server.etag)
    await vi.advanceTimersByTimeAsync(5000)
    expect(server.writes).toHaveLength(0)
  })

  it('uses an etag announced by the server without asking for it', async () => {
    const server = new FakeServer(board())
    const { sync, gateway } = setup(server)
    server.replace(server.document)
    await sync.checkForChanges(server.etag)
    expect(gateway.etagChecks).toBe(0)
    expect(gateway.reads).toBe(1)
  })

  it('puts local changes on top of a newer version and saves them', async () => {
    const server = new FakeServer(board())
    const { sync } = setup(server)
    sync.apply(rename('a', 'mine'))
    const theirs = server.document
    theirs.cards = theirs.cards.map((item) =>
      item.id === 'b' ? { ...item, title: 'theirs' } : item
    )
    server.replace(theirs)

    await sync.checkForChanges()
    expect(title(sync.document.value, 'a')).toBe('mine')
    expect(title(sync.document.value, 'b')).toBe('theirs')
    await vi.advanceTimersByTimeAsync(0)
    expect(title(server.document, 'a')).toBe('mine')
    expect(title(server.document, 'b')).toBe('theirs')
  })
})

describe('read-only', () => {
  it('applies and saves nothing', async () => {
    const server = new FakeServer(board())
    const { sync } = setup(server, 'me', { readOnly: true })
    expect(sync.apply(rename('a', 'x'))).toBe('readOnly')
    await vi.advanceTimersByTimeAsync(5000)
    expect(server.writes).toHaveLength(0)
    expect(title(sync.document.value, 'a')).toBe('a')
  })

  it('still shows changes from others', async () => {
    const server = new FakeServer(board())
    const { sync } = setup(server, 'me', { readOnly: true })
    const theirs = server.document
    theirs.cards = []
    server.replace(theirs)
    await sync.checkForChanges()
    expect(sync.document.value?.cards).toEqual([])
  })
})

describe('restoring changes saved aside', () => {
  it('replays them on the board as it is now and saves them', async () => {
    const server = new FakeServer(board())
    const first = setup(server)
    first.sync.apply(rename('a', 'unsaved'))
    first.sync.apply(rename('gone', 'x'))
    const aside = first.sync.unsavedOperations.value
    first.sync.dispose()
    expect(server.writes).toHaveLength(0)

    const theirs = server.document
    theirs.cards = theirs.cards.filter(({ id }) => id !== 'b')
    server.replace(theirs)

    const second = setup(server)
    const dropped = second.sync.restore([
      ...aside,
      { operation: rename('b', 'lost'), context: { userId: 'me', now: 'now' } }
    ])
    expect(dropped.map(({ reason }) => reason)).toEqual(['cardMissing'])
    await vi.advanceTimersByTimeAsync(0)
    expect(title(server.document, 'a')).toBe('unsaved')
    expect(second.sync.unsavedOperations.value).toEqual([])
  })
})
