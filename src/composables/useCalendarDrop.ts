import { unref } from 'vue'
import { moveToDay } from '../model/calendar'
import { useBoardContext } from './useBoardContext'
import { useCardDrag, type DropTarget } from './useCardDrag'

/** Dragging cards onto days of the calendar, or onto the list of cards without a date. */
export function useCalendarDrop() {
  const board = useBoardContext()

  function onDrop(cardId: string, target: DropTarget) {
    const card = unref(board.document).cards.find(({ id }) => id === cardId)
    if (!card) {
      return
    }
    if (target.kind === 'day') {
      const publishDate = moveToDay(card.publishDate, target.day)
      if (publishDate !== card.publishDate) {
        board.change({ type: 'updateCard', cardId, patch: { publishDate } })
      }
    } else if (target.kind === 'undated' && card.publishDate) {
      board.change({ type: 'updateCard', cardId, patch: { publishDate: null } })
    }
  }

  return useCardDrag({ isEnabled: () => !unref(board.isReadOnly), onDrop })
}
