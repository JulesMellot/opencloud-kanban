import { onBeforeUnmount, shallowRef, watch } from 'vue'

/**
 * A text field bound to a value of the board. Typing changes a local draft that is committed
 * after a short pause and when the field loses the focus; changes made by others replace the
 * draft only while the field is not being edited.
 */
export function useDraft(source: () => string, commit: (value: string) => void, delayMs = 600) {
  const draft = shallowRef(source())
  let editing = false
  let timer: ReturnType<typeof setTimeout> | null = null

  watch(source, (value) => {
    if (!editing) {
      draft.value = value
    }
  })

  function flush() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    if (draft.value !== source()) {
      commit(draft.value)
    }
  }

  function update(value: string) {
    editing = true
    draft.value = value ?? ''
    if (timer) {
      clearTimeout(timer)
    }
    timer = setTimeout(flush, delayMs)
  }

  function blur() {
    flush()
    editing = false
    draft.value = source()
  }

  onBeforeUnmount(flush)

  return { draft, update, blur, flush }
}
