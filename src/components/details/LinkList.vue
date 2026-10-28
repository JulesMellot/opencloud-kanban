<template>
  <div class="kanban-links kb:flex kb:flex-col kb:gap-2">
    <span
      :id="labelId"
      class="kb:font-semibold kb:text-sm"
      v-text="$gettext('Files and folders')"
    />
    <ul
      v-if="card.links.length"
      class="kb:m-0 kb:flex kb:list-none kb:flex-col kb:gap-1 kb:p-0"
      :aria-labelledby="labelId"
    >
      <li
        v-for="link in card.links"
        :key="link.resourceId"
        class="kanban-link kb:flex kb:items-center kb:gap-2 kb:rounded-md kb:p-1 kb:hover:bg-role-surface-container-highest"
        :data-state="statusOf(link).state"
      >
        <template v-if="statusOf(link).state === 'broken'">
          <oc-icon name="link-unlink" fill-type="none" class="kb:shrink-0 kb:fill-role-error" />
          <span class="kb:flex kb:min-w-0 kb:flex-1 kb:flex-col">
            <span class="kb:truncate kb:line-through" v-text="link.name" />
            <span
              class="kb:text-sm kb:text-role-error"
              v-text="$gettext('Deleted, moved to another space, or out of your reach')"
            />
          </span>
          <template v-if="!isReadOnly">
            <oc-button
              appearance="raw"
              size="small"
              class="kb:p-1"
              :aria-label="$gettext('Relink »%{name}«', { name: link.name })"
              @click="relink(link)"
            >
              <span v-text="$gettext('Relink')" />
            </oc-button>
            <oc-button
              appearance="raw"
              size="small"
              class="kb:p-1"
              :aria-label="$gettext('Remove the link to »%{name}«', { name: link.name })"
              @click="remove(link)"
            >
              <span v-text="$gettext('Remove')" />
            </oc-button>
          </template>
        </template>
        <template v-else>
          <oc-button
            appearance="raw"
            justify-content="left"
            gap-size="small"
            class="kanban-link-open kb:min-w-0 kb:flex-1 kb:p-0 kb:text-left"
            :aria-label="
              link.isFolder
                ? $gettext('Open the folder »%{name}«', { name: displayName(link) })
                : $gettext('Open »%{name}«', { name: displayName(link) })
            "
            @click="links.open(link)"
          >
            <resource-icon
              :resource="iconResource(link)"
              size-class="kb:size-6"
              class="kb:shrink-0"
            />
            <span class="kb:flex kb:min-w-0 kb:flex-col">
              <span class="kb:truncate" v-text="displayName(link)" />
              <span
                class="kb:truncate kb:text-sm kb:text-role-on-surface-variant"
                v-text="parentOf(link)"
              />
            </span>
          </oc-button>
          <oc-spinner
            v-if="statusOf(link).state === 'resolving'"
            size="xsmall"
            :aria-label="$gettext('Checking the link')"
          />
          <oc-button
            v-if="!isReadOnly"
            v-oc-tooltip="$gettext('Remove the link')"
            appearance="raw"
            class="kb:p-1"
            :aria-label="$gettext('Remove the link to »%{name}«', { name: displayName(link) })"
            @click="remove(link)"
          >
            <oc-icon name="close" fill-type="line" size="small" />
          </oc-button>
        </template>
      </li>
    </ul>
    <p
      v-else-if="isReadOnly"
      class="kb:m-0 kb:text-sm kb:text-role-on-surface-variant"
      v-text="$gettext('Nothing linked')"
    />
    <div v-if="!isReadOnly" class="kb:flex kb:flex-wrap kb:gap-2">
      <oc-button size="small" appearance="outline" @click="links.pickFile(add)">
        <oc-icon name="file-text" fill-type="line" size="small" />
        <span v-text="$gettext('Link a file')" />
      </oc-button>
      <oc-button size="small" appearance="outline" @click="links.pickFolder(add)">
        <oc-icon name="folder" fill-type="line" size="small" />
        <span v-text="$gettext('Link a folder')" />
      </oc-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useId } from 'vue'
import { useGettext } from 'vue3-gettext'
import { ResourceIcon } from '@opencloud-eu/web-pkg'
import type { Resource } from '@opencloud-eu/web-client'
import type { Card, CardLink } from '../../model/schema'
import { useBoardContext } from '../../composables/useBoardContext'

const { card } = defineProps<{ card: Card }>()

const { $gettext } = useGettext()
const board = useBoardContext()
const { isReadOnly, links } = board
const labelId = `kanban-links-${useId()}`

function statusOf(link: CardLink) {
  return links.statusOf(link)
}

function displayName(link: CardLink) {
  const status = statusOf(link)
  return status.state === 'ok' ? status.name : link.name
}

function parentOf(link: CardLink) {
  const status = statusOf(link)
  const path = status.state === 'ok' ? status.path : link.path
  const parent = path.split('/').filter(Boolean).slice(0, -1).join('/')
  return parent ? `/${parent}` : $gettext('Top of the space')
}

/** What the file icon of OpenCloud needs to pick the right icon */
function iconResource(link: CardLink) {
  const name = displayName(link)
  const extension = link.isFolder || !name.includes('.') ? '' : (name.split('.').pop() as string)
  return {
    id: link.resourceId,
    name,
    isFolder: link.isFolder,
    type: link.isFolder ? 'folder' : 'file',
    extension
  } as Resource
}

function add(link: CardLink) {
  board.change({ type: 'addLink', cardId: card.id, link })
}

function remove(link: CardLink) {
  board.change({ type: 'removeLink', cardId: card.id, resourceId: link.resourceId })
}

function relink(link: CardLink) {
  const pick = link.isFolder ? links.pickFolder : links.pickFile
  pick((replacement) => {
    board.change({
      type: 'updateLink',
      cardId: card.id,
      resourceId: link.resourceId,
      link: replacement
    })
    links.forget(link.resourceId)
  })
}
</script>
