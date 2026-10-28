import { expect, request, type APIRequestContext, type Page } from '@playwright/test'

export const ADMIN = {
  username: process.env.ADMIN_USERNAME ?? 'admin',
  password: process.env.ADMIN_PASSWORD ?? 'admin'
}
// OpenCloud's built-in space roles
const SPACE_EDITOR_ROLE = '58c63c02-1d89-4572-916a-870abc5a1b7d'

export interface User {
  id: string
  username: string
  password: string
  displayName: string
}

export interface Space {
  id: string
  name: string
  webDavUrl: string
}

const basic = ({ username, password }: { username: string; password: string }) =>
  `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`

export class Backend {
  private users: User[] = []
  private spaces: Space[] = []

  private constructor(private admin: APIRequestContext) {}

  static async connect(baseURL: string) {
    const admin = await request.newContext({
      baseURL,
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: { Authorization: basic(ADMIN) }
    })
    return new Backend(admin)
  }

  async createUser(name: string): Promise<User> {
    const username = `kanban-${name}-${Math.random().toString(36).slice(2, 8)}`
    const password = `Kanban-${name}-Pass-2026!`
    const displayName = `Kanban ${name}`
    const response = await this.admin.post('/graph/v1.0/users', {
      data: {
        onPremisesSamAccountName: username,
        displayName,
        mail: `${username}@example.org`,
        passwordProfile: { password },
        preferredLanguage: 'en'
      }
    })
    expect(response.ok(), await response.text()).toBeTruthy()
    const user = { id: (await response.json()).id, username, password, displayName }
    this.users.push(user)
    return user
  }

  /** A project space the given users can edit */
  async createSpace(members: User[]): Promise<Space> {
    const response = await this.admin.post('/graph/v1.0/drives', {
      data: { name: `Production ${Date.now()}`, driveType: 'project' }
    })
    expect(response.ok(), await response.text()).toBeTruthy()
    const drive = await response.json()
    const space = { id: drive.id, name: drive.name, webDavUrl: drive.root.webDavUrl }
    this.spaces.push(space)
    for (const member of members) {
      const invite = await this.admin.post(`/graph/v1beta1/drives/${drive.id}/root/invite`, {
        data: {
          recipients: [{ objectId: member.id, '@libre.graph.recipient.type': 'user' }],
          roles: [SPACE_EDITOR_ROLE]
        }
      })
      expect(invite.ok(), await invite.text()).toBeTruthy()
    }
    return space
  }

  private url(space: Space, path: string) {
    return `${space.webDavUrl}/${path.split('/').map(encodeURIComponent).join('/')}`
  }

  async upload(space: Space, path: string, content: string) {
    const response = await this.admin.put(this.url(space, path), { data: content })
    expect(response.status()).toBeLessThan(300)
  }

  async mkdir(space: Space, path: string) {
    const response = await this.admin.fetch(this.url(space, path), { method: 'MKCOL' })
    expect(response.status()).toBe(201)
  }

  async read(space: Space, path: string) {
    const response = await this.admin.get(this.url(space, path))
    expect(response.ok()).toBeTruthy()
    return response.text()
  }

  async board(space: Space, path = 'production.kanban') {
    return JSON.parse(await this.read(space, path)) as {
      columns: { id: string; title: string }[]
      cards: {
        id: string
        title: string
        columnId: string
        order: number
        publishDate: string | null
      }[]
    }
  }

  async dispose() {
    for (const space of this.spaces) {
      await this.admin.delete(`/graph/v1.0/drives/${space.id}`)
      await this.admin.delete(`/graph/v1.0/drives/${space.id}`, { headers: { Purge: 'T' } })
    }
    for (const user of this.users) {
      await this.admin.delete(`/graph/v1.0/users/${user.id}`)
    }
    await this.admin.dispose()
  }
}

export function sampleBoard() {
  const card = (
    id: string,
    title: string,
    columnId: string,
    order: number,
    publishDate: string | null = null
  ) => ({
    id,
    title,
    description: '',
    columnId,
    order,
    assignees: [],
    tags: [],
    dueDate: null,
    publishDate,
    links: [],
    createdAt: '2026-10-20T09:00:00.000Z',
    createdBy: '',
    updatedAt: '2026-10-20T09:00:00.000Z',
    updatedBy: ''
  })
  return JSON.stringify({
    version: 1,
    columns: [
      { id: 'idea', title: 'Idea', color: 'outline' },
      { id: 'editing', title: 'Editing', color: 'primary' },
      { id: 'published', title: 'Published', color: 'on-surface' }
    ],
    cards: [
      card('teaser', 'Teaser episode 12', 'idea', 1, '2026-11-06T18:00'),
      card('interview', 'Interview with Lucie', 'idea', 2),
      card('episode', 'Episode 12', 'editing', 1, '2026-11-12T17:30')
    ],
    // a field of a future version, which must survive saving
    future: { kept: true }
  })
}

export async function login(page: Page, user: User) {
  await page.goto('/')
  await page.locator('input[autocomplete="username"]').fill(user.username)
  await page.locator('input[type="password"]').fill(user.password)
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(/\/files\//, { timeout: 30_000 })
}

/** Opens a space in Files and the board in it with a click, as a user would */
export async function openBoard(page: Page, space: Space, fileName = 'production.kanban') {
  await page.goto('/files/spaces/projects')
  await page.getByText(space.name, { exact: true }).first().click()
  await page.locator(`[data-test-resource-name="${fileName}"]`).first().click()
  await expect(page).toHaveURL(/\/kanban\//)
  await expect(page.locator('.kanban-board')).toBeVisible()
}

export function waitForSave(page: Page, status = 204) {
  return page.waitForResponse(
    (r) =>
      r.request().method() === 'PUT' && r.url().includes('/dav/spaces/') && r.status() === status
  )
}

/** Drags with the mouse, in small steps like a person would */
export async function drag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number }
) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + 10, from.y + 10, { steps: 4 })
  await page.mouse.move(to.x, to.y, { steps: 15 })
  await page.mouse.up()
}

export async function center(page: Page, selector: string) {
  const box = await page.locator(selector).first().boundingBox()
  if (!box) {
    throw new Error(`${selector} is not visible`)
  }
  return { x: box.x + box.width / 2, y: box.y + Math.min(box.height / 2, 20) }
}
