import { expect, test, type Page } from '@playwright/test'
import {
  Backend,
  center,
  drag,
  login,
  openBoard,
  sampleBoard,
  waitForSave,
  type Space,
  type User
} from './support'

let backend: Backend
let editor: User
let colleague: User
let space: Space

test.beforeAll(async () => {
  backend = await Backend.connect(test.info().project.use.baseURL as string)
  editor = await backend.createUser('editor')
  colleague = await backend.createUser('colleague')
  space = await backend.createSpace([editor, colleague])
})

test.beforeEach(async () => {
  await backend.upload(space, 'production.kanban', sampleBoard())
})

test.afterAll(async () => {
  await backend.dispose()
})

function card(page: Page, id: string) {
  return page.locator(`.kanban-board [data-card-id="${id}"]`)
}

test('a board opens from Files and shows its columns and cards', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await login(page, editor)
  await openBoard(page, space)

  await expect(page.locator('.kanban-column-title')).toHaveText(['Idea', 'Editing', 'Published'])
  await expect(card(page, 'teaser')).toContainText('Teaser episode 12')
  await expect(page.locator('#kanban-column-idea .kanban-column-count')).toHaveText('2')
  await expect(page.locator('.kanban-save-status')).toHaveAttribute('data-state', 'saved')
  expect(errors).toEqual([])
})

test('a new board created from the New menu has the default columns', async ({ page }) => {
  await login(page, editor)
  await page.goto('/files/spaces/projects')
  await page.getByText(space.name, { exact: true }).first().click()
  await page.locator('#new-file-menu-btn, .oc-app-floating-action-button').first().click()
  await page.locator('.new-file-btn-kanban').click()
  const created = page.waitForResponse(
    (r) => r.url().endsWith('.kanban') && r.request().method() === 'PUT' && r.status() === 201
  )
  await page.locator('.oc-modal-body-actions-confirm').click()
  await created
  await expect(page).toHaveURL(/\/kanban\//)
  await expect(page.locator('.kanban-column')).toHaveCount(7)
})

test('a card moves with the keyboard menu and with the mouse, and both are saved', async ({
  page
}) => {
  await login(page, editor)
  await openBoard(page, space)

  // "Move to…" menu, as keyboard users do
  await card(page, 'interview').locator('.kanban-menu-toggle').click()
  await page.locator('.oc-drop:visible').getByRole('menuitem', { name: 'Move to…' }).click()
  let saved = waitForSave(page)
  await page.locator('.oc-drop:visible').getByRole('menuitem', { name: 'Published' }).click()
  await saved
  expect((await backend.board(space)).cards.find(({ id }) => id === 'interview')?.columnId).toBe(
    'published'
  )

  // drag and drop, above the card already in "Editing"
  saved = waitForSave(page)
  await drag(
    page,
    await center(page, '.kanban-board [data-card-id="teaser"]'),
    await center(page, '.kanban-board [data-card-id="episode"]')
  )
  await saved
  const board = await backend.board(space)
  const editing = board.cards
    .filter(({ columnId }) => columnId === 'editing')
    .sort((a, b) => a.order - b.order)
    .map(({ id }) => id)
  expect(editing).toEqual(['teaser', 'episode'])
  // fields the app does not know are kept
  expect((board as unknown as { future: unknown }).future).toEqual({ kept: true })
})

test('dragging a card to another day of the calendar keeps its time', async ({ page }) => {
  await login(page, editor)
  await openBoard(page, space)
  await page.locator('.kanban-view-switch-calendar').click()
  // the calendar opens on today: go to November 2026, where the cards are planned
  const title = page.locator('.kanban-calendar-title')
  for (let i = 0; i < 24 && !(await title.textContent())?.includes('November 2026'); i++) {
    const [month, year] = ((await title.textContent()) ?? '').split(' ')
    const before = new Date(`${month} 1, ${year}`) < new Date('November 1, 2026')
    await page.locator(before ? '.kanban-calendar-next' : '.kanban-calendar-previous').click()
  }
  await expect(title).toHaveText('November 2026')

  const saved = waitForSave(page)
  await drag(
    page,
    await center(page, '.kanban-calendar-grid [data-card-id="teaser"]'),
    await center(page, '.kanban-calendar-grid [data-day="2026-11-20"]')
  )
  await saved
  const teaser = (await backend.board(space)).cards.find(({ id }) => id === 'teaser')
  expect(teaser?.publishDate).toBe('2026-11-20T18:00')

  // the view is remembered for the next visit
  await page.reload()
  await expect(page.locator('.kanban-calendar')).toBeVisible()
})

test('two people editing at the same time both keep their changes', async ({ browser }) => {
  const first = await (await browser.newContext({ ignoreHTTPSErrors: true })).newPage()
  const second = await (await browser.newContext({ ignoreHTTPSErrors: true })).newPage()
  // without server events the second browser does not hear about the first one's save, so its
  // own save conflicts (412) and has to replay its change on the newer version
  await second.route('**/notifications/sse**', (route) => route.abort())
  await login(first, editor)
  await login(second, colleague)
  await openBoard(first, space)
  await openBoard(second, space)

  const conflict = second.waitForResponse(
    (r) => r.request().method() === 'PUT' && r.status() === 412
  )
  await card(first, 'episode').locator('.kanban-card-title').click()
  await first
    .locator('#kanban-card-title input, input#kanban-card-title')
    .first()
    .fill('Episode 12 – final cut')
  await first.locator('#kanban-card-title input, input#kanban-card-title').first().press('Enter')
  await waitForSave(first)
  await card(second, 'interview').locator('.kanban-menu-toggle').click()
  await second.locator('.oc-drop:visible').getByRole('menuitem', { name: 'Move to…' }).click()
  await second.locator('.oc-drop:visible').getByRole('menuitem', { name: 'Editing' }).click()
  await conflict

  // both changes end up in the file and on both screens
  await expect
    .poll(async () => {
      const board = await backend.board(space)
      return [
        board.cards.find(({ id }) => id === 'episode')?.title,
        board.cards.find(({ id }) => id === 'interview')?.columnId
      ]
    })
    .toEqual(['Episode 12 – final cut', 'editing'])
  await expect(card(second, 'episode')).toContainText('Episode 12 – final cut', { timeout: 35_000 })
  await expect(first.locator('#kanban-column-editing [data-card-id="interview"]')).toBeVisible({
    timeout: 35_000
  })

  // a change to a card someone else deleted is given up, with a message
  await card(first, 'teaser').locator('.kanban-menu-toggle').click()
  const deleted = waitForSave(first)
  await first.locator('.oc-drop:visible').getByRole('menuitem', { name: 'Delete' }).click()
  await first.locator('.oc-modal-body-actions-confirm').click()
  await card(second, 'teaser').locator('.kanban-menu-toggle').click()
  await second.locator('.oc-drop:visible').getByRole('menuitem', { name: 'Move to…' }).click()
  await second.locator('.oc-drop:visible').getByRole('menuitem', { name: 'Published' }).click()
  await deleted
  await expect(second.getByText('A change could not be applied')).toBeVisible({ timeout: 35_000 })
  await expect(card(second, 'teaser')).toHaveCount(0)
  expect((await backend.board(space)).cards.map(({ id }) => id)).not.toContain('teaser')
})
