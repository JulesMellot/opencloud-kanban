import { computed, unref, type Ref } from 'vue'
import { useLocalStorage } from '@opencloud-eu/web-pkg'

export type BoardView = 'board' | 'calendar'
export type CalendarRange = 'month' | 'week'

/** The last view a user chose, remembered in this browser, per user. */
export function useViewPreferences(userId: Ref<string>) {
  const stored = useLocalStorage<Record<string, { view?: BoardView; range?: CalendarRange }>>(
    'kanban:views',
    {}
  )

  function preference<K extends 'view' | 'range'>(key: K, fallback: BoardView | CalendarRange) {
    return computed({
      get: () => unref(stored)?.[unref(userId)]?.[key] ?? fallback,
      set: (value) => {
        const all = { ...(unref(stored) ?? {}) }
        all[unref(userId)] = { ...all[unref(userId)], [key]: value }
        stored.value = all
      }
    })
  }

  return {
    view: preference('view', 'board') as Ref<BoardView>,
    calendarRange: preference('range', 'month') as Ref<CalendarRange>
  }
}
