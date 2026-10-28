<template>
  <li
    :id="`kanban-card-${card.id}`"
    :data-card-id="card.id"
    class="kanban-card kb:relative kb:list-none kb:rounded-md kb:outline kb:select-none kb:[-webkit-touch-callout:none]"
    :class="[
      isOpen
        ? 'kanban-card-open kb:bg-role-secondary-container kb:outline-2 kb:outline-role-outline'
        : 'kb:bg-role-surface-container kb:outline-role-surface-container-highest kb:hover:bg-role-surface-container-highest',
      { 'kb:opacity-40': isDragged, 'kb:cursor-grab': !isReadOnly }
    ]"
    @pointerdown="$emit('dragStart', $event)"
  >
    <div class="kb:flex kb:items-start kb:gap-1 kb:p-2">
      <div class="kb:flex kb:min-w-0 kb:flex-1 kb:flex-col kb:gap-1.5">
        <ul
          v-if="card.tags.length"
          class="kb:m-0 kb:flex kb:list-none kb:flex-wrap kb:gap-1 kb:p-0"
          :aria-label="$gettext('Tags')"
        >
          <li v-for="tag in card.tags" :key="tag">
            <oc-tag size="small" class="kanban-card-tag">{{ tag }}</oc-tag>
          </li>
        </ul>
        <button
          type="button"
          class="kanban-card-title kb:cursor-[inherit] kb:border-0 kb:bg-transparent kb:p-0 kb:text-left kb:text-role-on-surface kb:break-words kb:after:absolute kb:after:inset-0 kb:after:rounded-md kb:after:content-['']"
          :aria-label="$gettext('Open »%{title}«', { title: displayTitle })"
          @click="openCard(card.id)"
        >
          <span class="kb:line-clamp-4" v-text="displayTitle" />
        </button>
        <div
          v-if="hasMeta"
          class="kb:flex kb:flex-wrap kb:items-center kb:gap-x-3 kb:gap-y-1 kb:text-sm kb:text-role-on-surface-variant"
        >
          <span
            v-if="card.publishDate"
            class="kanban-card-publish kb:inline-flex kb:items-center kb:gap-1"
            :title="$gettext('Publication')"
          >
            <oc-icon name="calendar-event" fill-type="line" size="small" />
            <span class="kb:sr-only" v-text="$gettext('Publication:')" />
            <span v-text="publishLabel" />
          </span>
          <span
            v-if="card.links.length"
            class="kanban-card-links kb:inline-flex kb:items-center kb:gap-1"
            :title="linksLabel"
          >
            <oc-icon name="links" fill-type="line" size="small" />
            <span class="kb:sr-only" v-text="linksLabel" />
            <span aria-hidden="true" v-text="card.links.length" />
          </span>
          <span class="kb:ml-auto kb:inline-flex kb:items-center kb:gap-2">
            <viewer-badges :viewers="viewers" />
            <card-avatars v-if="card.assignees.length" :assignees="card.assignees" />
          </span>
        </div>
      </div>
      <kanban-menu
        v-if="!isReadOnly"
        class="kb:relative kb:z-10 kb:-mr-1 kb:-mt-1"
        :label="$gettext('Actions for »%{title}«', { title: displayTitle })"
        :title="displayTitle"
        :sections="menuSections"
      />
    </div>
  </li>
</template>

<script setup lang="ts">
import { computed, unref } from 'vue'
import { useGettext } from 'vue3-gettext'
import type { Action, MenuSection } from '@opencloud-eu/web-pkg'
import { formatPublishDate } from '../../model/calendar'
import type { Card } from '../../model/schema'
import { useBoardContext } from '../../composables/useBoardContext'
import { useBoardActions } from '../../composables/useBoardActions'
import KanbanMenu from '../KanbanMenu.vue'
import CardAvatars from '../CardAvatars.vue'
import ViewerBadges from '../ViewerBadges.vue'

const { card, isDragged = false } = defineProps<{
  card: Card
  isDragged?: boolean
}>()
defineEmits<{ dragStart: [event: PointerEvent] }>()

const { $gettext, $ngettext, current } = useGettext()
const { document, isReadOnly, openCardId, openCard, presence } = useBoardContext()
const actions = useBoardActions()

const displayTitle = computed(() => card.title || $gettext('Untitled card'))
const isOpen = computed(() => unref(openCardId) === card.id)
const publishLabel = computed(() =>
  card.publishDate ? formatPublishDate(card.publishDate, current) : ''
)
const linksLabel = computed(() =>
  $ngettext('%{count} linked item', '%{count} linked items', card.links.length, {
    count: String(card.links.length)
  })
)
const viewers = computed(() => presence.viewersOf(card.id))
const hasMeta = computed(
  () =>
    Boolean(card.publishDate) ||
    card.links.length > 0 ||
    card.assignees.length > 0 ||
    unref(viewers).length > 0
)

function action(
  name: string,
  icon: string,
  label: string,
  handler: () => void,
  isVisible = () => true
): Action {
  return { name, icon, label: () => label, handler, isVisible }
}

const menuSections = computed<MenuSection[]>(() => {
  const open = action('kanban-open-card', 'eye', $gettext('Open'), () => openCard(card.id))
  if (unref(isReadOnly)) {
    return [{ name: 'primary', items: [open] }]
  }
  const siblings = actions.columnCards(card.columnId)
  const index = siblings.findIndex(({ id }) => id === card.id)
  const moveTo: Action = {
    name: 'kanban-move-card',
    icon: 'arrow-right',
    label: () => $gettext('Move to…'),
    isVisible: () => unref(document).columns.length > 1,
    children: unref(document)
      .columns.filter(({ id }) => id !== card.columnId)
      .map((column) =>
        action(`kanban-move-card-${column.id}`, 'arrow-right', column.title, () =>
          actions.moveCard(card.id, column.id, actions.columnCards(column.id).length)
        )
      )
  }
  return [
    { name: 'primary', items: [open] },
    {
      name: 'secondary',
      items: [
        moveTo,
        action(
          'kanban-move-card-up',
          'arrow-up',
          $gettext('Move up'),
          () => actions.shiftCard(card, -1),
          () => index > 0
        ),
        action(
          'kanban-move-card-down',
          'arrow-down',
          $gettext('Move down'),
          () => actions.shiftCard(card, 1),
          () => index > -1 && index < siblings.length - 1
        )
      ].filter((item) => item.isVisible())
    },
    {
      name: 'tertiary',
      items: [
        action('kanban-delete-card', 'delete-bin', $gettext('Delete'), () =>
          actions.deleteCard(card)
        )
      ]
    }
  ]
})
</script>
