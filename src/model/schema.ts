/**
 * The `.kanban` file format: types, validation and (de)serialization.
 *
 * Everything here is pure. Fields the app does not know are kept in `extra` on the object
 * they were found on and written back on save, so files edited by a newer version (or by
 * hand) lose nothing.
 */
import { migrate, MigrationError } from './migrations'
import { SCHEMA_VERSION } from './version'

export { SCHEMA_VERSION }
export const FILE_EXTENSION = 'kanban'

export type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject
export interface JsonObject {
  [key: string]: JsonValue
}

/** Color roles of the design system a column can use, see `--oc-role-*`. */
export const COLUMN_COLORS = [
  'outline',
  'secondary',
  'tertiary',
  'primary',
  'chrome',
  'inverse-primary',
  'error'
] as const
export type ColumnColor = (typeof COLUMN_COLORS)[number]

export interface Assignee {
  id: string
  displayName: string
  extra: JsonObject
}

export interface CardLink {
  resourceId: string
  path: string
  name: string
  isFolder: boolean
  extra: JsonObject
}

export interface Column {
  id: string
  title: string
  /** A {@link ColumnColor}. Kept as written, so a role added by a newer version survives. */
  color: string
  extra: JsonObject
}

/** The color role to draw a column with, falling back to the neutral one. */
export function columnColor(column: Pick<Column, 'color'>): ColumnColor {
  return (COLUMN_COLORS as readonly string[]).includes(column.color)
    ? (column.color as ColumnColor)
    : 'outline'
}

export interface Card {
  id: string
  title: string
  description: string
  columnId: string
  order: number
  assignees: Assignee[]
  tags: string[]
  /** `YYYY-MM-DD` */
  dueDate: string | null
  /** `YYYY-MM-DDTHH:mm`, a wall-clock time without time zone */
  publishDate: string | null
  links: CardLink[]
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
  extra: JsonObject
}

export interface KanbanDocument {
  version: number
  columns: Column[]
  cards: Card[]
  extra: JsonObject
}

export type FormatErrorCode =
  'invalidJson' | 'notKanban' | 'tooNew' | 'unsupportedVersion' | 'invalid'

export class KanbanFormatError extends Error {
  constructor(
    public code: FormatErrorCode,
    /** Where in the file the problem is, e.g. `cards[2].publishDate` */
    public path = ''
  ) {
    super(path ? `${code} at ${path}` : code)
    this.name = 'KanbanFormatError'
  }
}

export const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
export const DATE_TIME_PATTERN =
  /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d$/

/** Whether `value` is an existing calendar day, `2026-02-30` is not. */
export function isValidDate(value: string) {
  if (!DATE_PATTERN.test(value)) {
    return false
  }
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export function isValidDateTime(value: string) {
  return DATE_TIME_PATTERN.test(value) && isValidDate(value.slice(0, 10))
}

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function pickExtra(source: JsonObject, known: readonly string[]): JsonObject {
  const extra: JsonObject = {}
  for (const [key, value] of Object.entries(source)) {
    if (!known.includes(key)) {
      extra[key] = value
    }
  }
  return extra
}

/** Reads the fields of one JSON object, recording the path of the first invalid one. */
class Reader {
  constructor(
    private source: JsonObject,
    private path: string
  ) {}

  private fail(key: string): never {
    throw new KanbanFormatError('invalid', `${this.path}.${key}`.replace(/^\./, ''))
  }

  string(key: string, { optional = false } = {}): string {
    const value = this.source[key]
    if (value === undefined && optional) {
      return ''
    }
    if (typeof value !== 'string') {
      this.fail(key)
    }
    return value
  }

  id(key: string): string {
    const value = this.string(key)
    if (!value.trim()) {
      this.fail(key)
    }
    return value
  }

  number(key: string, { optional = false } = {}): number {
    const value = this.source[key]
    if (value === undefined && optional) {
      return 0
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      this.fail(key)
    }
    return value
  }

  boolean(key: string, { optional = false } = {}): boolean {
    const value = this.source[key]
    if (value === undefined && optional) {
      return false
    }
    if (typeof value !== 'boolean') {
      this.fail(key)
    }
    return value
  }

  nullableDate(key: string, isValid: (value: string) => boolean): string | null {
    const value = this.source[key]
    if (value === undefined || value === null || value === '') {
      return null
    }
    if (typeof value !== 'string' || !isValid(value)) {
      this.fail(key)
    }
    return value
  }

  array(key: string, { optional = false } = {}): JsonValue[] {
    const value = this.source[key]
    if (value === undefined && optional) {
      return []
    }
    if (!Array.isArray(value)) {
      this.fail(key)
    }
    return value
  }

  objects(key: string, { optional = false } = {}): Reader[] {
    return this.array(key, { optional }).map((item, index) => {
      if (!isJsonObject(item)) {
        this.fail(`${key}[${index}]`)
      }
      return new Reader(item, `${this.path}.${key}[${index}]`)
    })
  }

  extra(known: readonly string[]) {
    return pickExtra(this.source, known)
  }
}

const DOCUMENT_KEYS = ['version', 'columns', 'cards'] as const
const COLUMN_KEYS = ['id', 'title', 'color'] as const
const ASSIGNEE_KEYS = ['id', 'displayName'] as const
const LINK_KEYS = ['resourceId', 'path', 'name', 'isFolder'] as const
const CARD_KEYS = [
  'id',
  'title',
  'description',
  'columnId',
  'order',
  'assignees',
  'tags',
  'dueDate',
  'publishDate',
  'links',
  'createdAt',
  'createdBy',
  'updatedAt',
  'updatedBy'
] as const

function readColumn(reader: Reader): Column {
  return {
    id: reader.id('id'),
    title: reader.string('title'),
    color: reader.string('color', { optional: true }),
    extra: reader.extra(COLUMN_KEYS)
  }
}

function readCard(reader: Reader, path: string): Card {
  const tags = reader.array('tags', { optional: true })
  tags.forEach((tag, index) => {
    if (typeof tag !== 'string') {
      throw new KanbanFormatError('invalid', `${path}.tags[${index}]`)
    }
  })
  return {
    id: reader.id('id'),
    title: reader.string('title'),
    description: reader.string('description', { optional: true }),
    columnId: reader.id('columnId'),
    order: reader.number('order', { optional: true }),
    assignees: reader.objects('assignees', { optional: true }).map((assignee) => ({
      id: assignee.id('id'),
      displayName: assignee.string('displayName', { optional: true }),
      extra: assignee.extra(ASSIGNEE_KEYS)
    })),
    tags: tags as string[],
    dueDate: reader.nullableDate('dueDate', isValidDate),
    publishDate: reader.nullableDate('publishDate', isValidDateTime),
    links: reader.objects('links', { optional: true }).map((link) => ({
      resourceId: link.id('resourceId'),
      path: link.string('path', { optional: true }),
      name: link.string('name', { optional: true }),
      isFolder: link.boolean('isFolder', { optional: true }),
      extra: link.extra(LINK_KEYS)
    })),
    createdAt: reader.string('createdAt', { optional: true }),
    createdBy: reader.string('createdBy', { optional: true }),
    updatedAt: reader.string('updatedAt', { optional: true }),
    updatedBy: reader.string('updatedBy', { optional: true }),
    extra: reader.extra(CARD_KEYS)
  }
}

function assertUniqueIds(items: { id: string }[], path: string) {
  const seen = new Set<string>()
  items.forEach((item, index) => {
    if (seen.has(item.id)) {
      throw new KanbanFormatError('invalid', `${path}[${index}].id`)
    }
    seen.add(item.id)
  })
}

/** Validates data already migrated to the current version. */
export function readDocument(data: JsonObject): KanbanDocument {
  const reader = new Reader(data, '')
  const columns = reader.objects('columns').map(readColumn)
  const cards = reader.objects('cards').map((card, index) => readCard(card, `cards[${index}]`))
  assertUniqueIds(columns, 'columns')
  assertUniqueIds(cards, 'cards')
  return { version: SCHEMA_VERSION, columns, cards, extra: reader.extra(DOCUMENT_KEYS) }
}

/**
 * Parses the content of a `.kanban` file. An empty file is a new, empty board.
 * Throws a {@link KanbanFormatError} for anything else that is not a valid board.
 */
export function parseDocument(content: string, emptyBoard: () => KanbanDocument): KanbanDocument {
  if (!content.trim()) {
    return emptyBoard()
  }
  let data: unknown
  try {
    data = JSON.parse(content)
  } catch {
    throw new KanbanFormatError('invalidJson')
  }
  if (!isJsonObject(data) || !Number.isInteger(data.version) || (data.version as number) < 1) {
    throw new KanbanFormatError('notKanban')
  }
  if ((data.version as number) > SCHEMA_VERSION) {
    throw new KanbanFormatError('tooNew')
  }
  let migrated: JsonObject
  try {
    migrated = migrate(data)
  } catch (e) {
    if (e instanceof MigrationError) {
      throw new KanbanFormatError('unsupportedVersion')
    }
    throw e
  }
  return readDocument(migrated)
}

function withExtra<T extends object>(extra: JsonObject, known: T): JsonObject {
  return { ...extra, ...(known as JsonObject) }
}

export function toJson(document: KanbanDocument): JsonObject {
  return withExtra(document.extra, {
    version: SCHEMA_VERSION,
    columns: document.columns.map(({ extra, ...column }) => withExtra(extra, column)),
    cards: document.cards.map(({ extra, assignees, links, ...card }) =>
      withExtra(extra, {
        ...card,
        assignees: assignees.map(({ extra: assigneeExtra, ...assignee }) =>
          withExtra(assigneeExtra, assignee)
        ),
        links: links.map(({ extra: linkExtra, ...link }) => withExtra(linkExtra, link))
      })
    )
  })
}

export function serializeDocument(document: KanbanDocument) {
  return `${JSON.stringify(toJson(document), null, 2)}\n`
}

export function newId() {
  return crypto.randomUUID()
}

export interface DefaultColumnTitles {
  idea: string
  brief: string
  shooting: string
  editing: string
  review: string
  scheduled: string
  published: string
}

export function createDefaultDocument(titles: DefaultColumnTitles): KanbanDocument {
  const columns: [keyof DefaultColumnTitles, ColumnColor][] = [
    ['idea', 'outline'],
    ['brief', 'secondary'],
    ['shooting', 'tertiary'],
    ['editing', 'primary'],
    ['review', 'error'],
    ['scheduled', 'chrome'],
    ['published', 'inverse-primary']
  ]
  return {
    version: SCHEMA_VERSION,
    columns: columns.map(([key, color]) => ({ id: newId(), title: titles[key], color, extra: {} })),
    cards: [],
    extra: {}
  }
}
