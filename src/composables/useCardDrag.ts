import { onBeforeUnmount, shallowRef } from 'vue'

/** Where a dragged card would land */
export type DropTarget =
  | { kind: 'column'; columnId: string; index: number }
  | { kind: 'day'; day: string }
  | { kind: 'undated' }

/** Mouse movement before a press becomes a drag */
const MOUSE_THRESHOLD_PX = 5
/** Finger movement that means scrolling rather than a long press */
const TOUCH_SLOP_PX = 8
const LONG_PRESS_MS = 300
/** Distance to the edge of a scroll area that scrolls it */
const EDGE_PX = 48
const MAX_SCROLL_STEP_PX = 16

function sameTarget(a: DropTarget | null, b: DropTarget | null) {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** The drop target under a point, from the `data-drop-*` attributes of the views */
export function dropTargetAt(x: number, y: number, draggedId: string): DropTarget | null {
  const element = document.elementFromPoint(x, y)
  const zone = element?.closest<HTMLElement>('[data-drop-zone]')
  if (!zone) {
    return null
  }
  switch (zone.dataset.dropZone) {
    case 'column': {
      const cards = [...zone.querySelectorAll<HTMLElement>('[data-card-id]')].filter(
        (card) => card.dataset.cardId !== draggedId
      )
      const index = cards.filter((card) => {
        const rect = card.getBoundingClientRect()
        return rect.top + rect.height / 2 < y
      }).length
      return { kind: 'column', columnId: zone.dataset.columnId as string, index }
    }
    case 'day':
      return { kind: 'day', day: zone.dataset.day as string }
    case 'undated':
      return { kind: 'undated' }
  }
  return null
}

/**
 * Drag and drop of cards with pointer events, so mouse, touch and pen work the same way.
 * A mouse drag starts after a small movement, a touch drag after a long press (a quick swipe
 * still scrolls). The dragged card follows the pointer as a floating copy; areas marked with
 * `data-drag-scroll` scroll when it gets close to their edges. Escape cancels.
 */
export function useCardDrag({
  isEnabled,
  onDrop
}: {
  isEnabled: () => boolean
  onDrop: (cardId: string, target: DropTarget) => void
}) {
  const draggedId = shallowRef<string | null>(null)
  const draggedHeight = shallowRef(0)
  const dropTarget = shallowRef<DropTarget | null>(null)

  let press: {
    cardId: string
    element: HTMLElement
    pointerId: number
    pointerType: string
    startX: number
    startY: number
    offsetX: number
    offsetY: number
    timer: ReturnType<typeof setTimeout> | null
  } | null = null
  let ghost: HTMLElement | null = null
  let pointer = { x: 0, y: 0 }
  let frame = 0

  function preventTouchScroll(event: TouchEvent) {
    event.preventDefault()
  }

  function suppressNextClick() {
    const stop = (event: Event) => {
      event.stopPropagation()
      event.preventDefault()
    }
    window.addEventListener('click', stop, { capture: true, once: true })
    // a drop outside the card fires no click: forget it
    setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 0)
  }

  function moveGhost() {
    if (ghost && press) {
      ghost.style.transform = `translate(${pointer.x - press.offsetX}px, ${pointer.y - press.offsetY}px) rotate(2deg)`
    }
  }

  function autoScroll() {
    if (!draggedId.value) {
      return
    }
    const element = document.elementFromPoint(pointer.x, pointer.y)
    for (
      let area = element?.closest<HTMLElement>('[data-drag-scroll]');
      area;
      area = area.parentElement?.closest<HTMLElement>('[data-drag-scroll]')
    ) {
      const rect = area.getBoundingClientRect()
      const step = (distance: number) =>
        Math.ceil(((EDGE_PX - Math.max(distance, 0)) / EDGE_PX) * MAX_SCROLL_STEP_PX)
      if (area.scrollWidth > area.clientWidth) {
        if (pointer.x - rect.left < EDGE_PX) area.scrollLeft -= step(pointer.x - rect.left)
        else if (rect.right - pointer.x < EDGE_PX) area.scrollLeft += step(rect.right - pointer.x)
      }
      if (area.scrollHeight > area.clientHeight) {
        if (pointer.y - rect.top < EDGE_PX) area.scrollTop -= step(pointer.y - rect.top)
        else if (rect.bottom - pointer.y < EDGE_PX) area.scrollTop += step(rect.bottom - pointer.y)
      }
    }
    updateTarget()
    frame = requestAnimationFrame(autoScroll)
  }

  function updateTarget() {
    if (!draggedId.value) {
      return
    }
    const target = dropTargetAt(pointer.x, pointer.y, draggedId.value)
    if (!sameTarget(target, dropTarget.value)) {
      dropTarget.value = target
    }
  }

  function startDrag() {
    if (!press) {
      return
    }
    const rect = press.element.getBoundingClientRect()
    ghost = press.element.cloneNode(true) as HTMLElement
    ghost.removeAttribute('data-card-id')
    ghost.removeAttribute('id')
    ghost.setAttribute('aria-hidden', 'true')
    ghost.classList.add(
      'kanban-drag-ghost',
      'ext:shadow-lg',
      'ext:bg-role-surface-container-highest'
    )
    Object.assign(ghost.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: `${rect.width}px`,
      pointerEvents: 'none',
      zIndex: '10000'
    })
    document.body.appendChild(ghost)
    draggedHeight.value = rect.height
    draggedId.value = press.cardId
    moveGhost()
    updateTarget()
    if (press.pointerType === 'touch') {
      window.addEventListener('touchmove', preventTouchScroll, { passive: false })
      navigator.vibrate?.(10)
    }
    frame = requestAnimationFrame(autoScroll)
  }

  function cleanUp() {
    if (press?.timer) {
      clearTimeout(press.timer)
    }
    cancelAnimationFrame(frame)
    ghost?.remove()
    ghost = null
    press = null
    draggedId.value = null
    dropTarget.value = null
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', cleanUp)
    window.removeEventListener('keydown', onKeyDown, { capture: true })
    window.removeEventListener('touchmove', preventTouchScroll)
  }

  function onPointerMove(event: PointerEvent) {
    if (!press || event.pointerId !== press.pointerId) {
      return
    }
    pointer = { x: event.clientX, y: event.clientY }
    const distance = Math.hypot(event.clientX - press.startX, event.clientY - press.startY)
    if (!draggedId.value) {
      if (press.pointerType === 'touch') {
        if (distance > TOUCH_SLOP_PX) {
          // the finger is scrolling, not holding
          cleanUp()
        }
        return
      }
      if (distance < MOUSE_THRESHOLD_PX) {
        return
      }
      startDrag()
      return
    }
    moveGhost()
    updateTarget()
  }

  function onPointerUp(event: PointerEvent) {
    if (!press || event.pointerId !== press.pointerId) {
      return
    }
    const cardId = draggedId.value
    const target = dropTarget.value
    if (cardId) {
      suppressNextClick()
    }
    cleanUp()
    if (cardId && target) {
      onDrop(cardId, target)
    }
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && draggedId.value) {
      event.stopPropagation()
      event.preventDefault()
      suppressNextClick()
      cleanUp()
    }
  }

  /** Bind to `pointerdown` of a card */
  function onPointerDown(event: PointerEvent, cardId: string) {
    if (!isEnabled() || press || (event.pointerType === 'mouse' && event.button !== 0)) {
      return
    }
    if ((event.target as HTMLElement).closest('[data-no-drag], input, textarea, select')) {
      return
    }
    const element = event.currentTarget as HTMLElement
    const rect = element.getBoundingClientRect()
    press = {
      cardId,
      element,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      timer: null
    }
    pointer = { x: event.clientX, y: event.clientY }
    if (event.pointerType === 'touch') {
      press.timer = setTimeout(startDrag, LONG_PRESS_MS)
    }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', cleanUp)
    window.addEventListener('keydown', onKeyDown, { capture: true })
  }

  onBeforeUnmount(cleanUp)

  return { draggedId, draggedHeight, dropTarget, onPointerDown }
}
