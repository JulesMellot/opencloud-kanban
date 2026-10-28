import { markRaw, unref } from 'vue'
import { useGettext } from 'vue3-gettext'
import { useModals } from '@opencloud-eu/web-pkg'
import { cardsOf, placementAt, type Placement } from '../model/order'
import { newId, type Card, type Column, type ColumnColor } from '../model/schema'
import { useBoardContext } from './useBoardContext'
import DeleteColumnModal from '../components/board/DeleteColumnModal.vue'
import ColumnColorModal from '../components/board/ColumnColorModal.vue'

/** Changes to the board started from menus and buttons, with their dialogs. */
export function useBoardActions() {
  const { $gettext } = useGettext()
  const { dispatchModal } = useModals()
  const board = useBoardContext()

  function columnCards(columnId: string) {
    return cardsOf(unref(board.document).cards, columnId)
  }

  function newCard(columnId: string, title: string, fields: Partial<Card> = {}): Card {
    const now = new Date().toISOString()
    const userId = unref(board.userId)
    return {
      id: newId(),
      title,
      description: '',
      columnId,
      order: 0,
      assignees: [],
      tags: [],
      dueDate: null,
      publishDate: null,
      links: [],
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
      updatedBy: userId,
      extra: {},
      ...fields
    }
  }

  function addCard(columnId: string, title: string, placement: Placement = {}, fields = {}) {
    const card = newCard(columnId, title, fields)
    return board.change({ type: 'addCard', card, placement }) ? card : null
  }

  /** Moves a card to `index` of a column, `index` counted without the card itself. */
  function moveCard(cardId: string, columnId: string, index: number) {
    const siblings = columnCards(columnId).filter(({ id }) => id !== cardId)
    const current = columnCards(columnId).findIndex(({ id }) => id === cardId)
    if (current === index) {
      return
    }
    board.change({ type: 'moveCard', cardId, columnId, placement: placementAt(siblings, index) })
  }

  /** Moves a card up or down within its column */
  function shiftCard(card: Card, delta: -1 | 1) {
    const cards = columnCards(card.columnId)
    const index = cards.findIndex(({ id }) => id === card.id)
    const target = index + delta
    if (index === -1 || target < 0 || target >= cards.length) {
      return
    }
    moveCard(card.id, card.columnId, target)
  }

  function deleteCard(card: Card) {
    dispatchModal({
      title: $gettext('Delete »%{title}«?', { title: card.title || $gettext('Untitled card') }),
      message: $gettext('The card is deleted for everyone. Linked files and folders are kept.'),
      confirmText: $gettext('Delete'),
      showCancelAction: true,
      onConfirm: () => {
        board.change({ type: 'deleteCard', cardId: card.id })
        if (unref(board.openCardId) === card.id) {
          board.openCardId.value = null
        }
      }
    })
  }

  function promptColumnTitle({
    title,
    confirmText,
    initial = '',
    onTitle
  }: {
    title: string
    confirmText: string
    initial?: string
    onTitle: (value: string) => void
  }) {
    dispatchModal({
      title,
      confirmText,
      hasInput: true,
      inputValue: initial,
      inputLabel: $gettext('Column name'),
      inputSelectionRange: [0, initial.length],
      onInput: (value, setError) =>
        setError(value.trim() ? '' : $gettext('The column name cannot be empty')),
      onConfirm: (value: string) => {
        if (value.trim()) {
          onTitle(value.trim())
        }
      }
    })
  }

  function addColumn(afterColumnId: string | null) {
    promptColumnTitle({
      title: $gettext('New column'),
      confirmText: $gettext('Add'),
      onTitle: (title) =>
        board.change({
          type: 'addColumn',
          column: { id: newId(), title, color: 'outline', extra: {} },
          afterColumnId
        })
    })
  }

  function renameColumn(column: Column) {
    promptColumnTitle({
      title: $gettext('Rename column'),
      confirmText: $gettext('Rename'),
      initial: column.title,
      onTitle: (title) =>
        board.change({ type: 'updateColumn', columnId: column.id, patch: { title } })
    })
  }

  function recolorColumn(column: Column) {
    dispatchModal({
      title: $gettext('Color of »%{title}«', { title: column.title }),
      confirmText: $gettext('Apply'),
      customComponent: markRaw(ColumnColorModal),
      customComponentAttrs: () => ({
        column,
        onSelect: (color: ColumnColor) =>
          board.change({ type: 'updateColumn', columnId: column.id, patch: { color } })
      })
    })
  }

  /** Moves a column one place to the left or right */
  function shiftColumn(column: Column, delta: -1 | 1) {
    const columns = unref(board.document).columns
    const index = columns.findIndex(({ id }) => id === column.id)
    const target = index + delta
    if (index === -1 || target < 0 || target >= columns.length) {
      return
    }
    const others = columns.filter(({ id }) => id !== column.id)
    board.change({
      type: 'moveColumn',
      columnId: column.id,
      afterColumnId: target === 0 ? null : others[target - 1].id
    })
  }

  function deleteColumn(column: Column) {
    const cards = columnCards(column.id)
    if (!cards.length) {
      dispatchModal({
        title: $gettext('Delete the column »%{title}«?', { title: column.title }),
        message: $gettext('The column is empty.'),
        confirmText: $gettext('Delete'),
        showCancelAction: true,
        onConfirm: () => {
          board.change({
            type: 'deleteColumn',
            columnId: column.id,
            moveCardsTo: null,
            cardIds: []
          })
        }
      })
      return
    }
    dispatchModal({
      title: $gettext('Delete the column »%{title}«?', { title: column.title }),
      confirmText: $gettext('Delete column'),
      showCancelAction: true,
      customComponent: markRaw(DeleteColumnModal),
      customComponentAttrs: () => ({
        column,
        cardCount: cards.length,
        otherColumns: unref(board.document).columns.filter(({ id }) => id !== column.id),
        onDelete: (moveCardsTo: string | null) =>
          board.change({
            type: 'deleteColumn',
            columnId: column.id,
            moveCardsTo,
            cardIds: cards.map(({ id }) => id)
          })
      })
    })
  }

  return {
    addCard,
    moveCard,
    shiftCard,
    deleteCard,
    addColumn,
    renameColumn,
    recolorColumn,
    shiftColumn,
    deleteColumn,
    columnCards
  }
}
