import { markRaw, reactive, unref, type Ref } from 'vue'
import { useGettext } from 'vue3-gettext'
import { useRouter } from 'vue-router'
import {
  FilePickerModal,
  LocationPickerModal,
  useClientService,
  useFileActions,
  useFolderLink,
  useMessages,
  useModals
} from '@opencloud-eu/web-pkg'
import type { Resource, SpaceResource } from '@opencloud-eu/web-client'
import type { CardLink } from '../model/schema'

export type LinkStatus =
  | { state: 'resolving' }
  | { state: 'ok'; path: string; name: string }
  /** Deleted, in the trash, or out of reach */
  | { state: 'broken' }

/** How many links are resolved at the same time */
const CONCURRENCY = 4

function basename(path: string) {
  return path.split('/').filter(Boolean).pop() ?? path
}

/**
 * Links from cards to files and folders of the space. They are stored by resource id, so
 * they survive renames and moves: on open, every id is resolved to its current path.
 */
export function useResourceLinks({
  space,
  resource
}: {
  space: Ref<SpaceResource>
  /** The board file, whose folder the pickers open in */
  resource: Ref<Resource>
}) {
  const { $gettext } = useGettext()
  const clientService = useClientService()
  const router = useRouter()
  const { dispatchModal } = useModals()
  const { showErrorMessage, showMessage } = useMessages()
  const { getFolderLink, getParentFolderLink } = useFolderLink()
  const { triggerDefaultAction } = useFileActions()

  const statuses = reactive(new Map<string, LinkStatus>())
  const queue: string[] = []
  let running = 0

  function isInSpace(resourceId: string) {
    const spaceId = unref(space).id
    return resourceId === spaceId || resourceId.startsWith(`${spaceId}!`)
  }

  async function resolveOne(resourceId: string) {
    if (!isInSpace(resourceId)) {
      statuses.set(resourceId, { state: 'broken' })
      return
    }
    try {
      // empty for a resource in the trash or one the user cannot reach
      const path = await clientService.webdav.getPathForFileId(resourceId)
      statuses.set(
        resourceId,
        path ? { state: 'ok', path, name: basename(path) } : { state: 'broken' }
      )
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode
      if (status === 404 || status === 400 || status === 403) {
        statuses.set(resourceId, { state: 'broken' })
      } else {
        // the server could not answer: try again next time instead of calling it broken
        statuses.delete(resourceId)
      }
    }
  }

  function pump() {
    while (running < CONCURRENCY && queue.length) {
      const id = queue.shift() as string
      running++
      void resolveOne(id).finally(() => {
        running--
        pump()
      })
    }
  }

  /** Starts resolving links not resolved yet */
  function resolve(links: readonly CardLink[]) {
    for (const { resourceId } of links) {
      if (!statuses.has(resourceId)) {
        statuses.set(resourceId, { state: 'resolving' })
        queue.push(resourceId)
      }
    }
    pump()
  }

  function statusOf(link: CardLink): LinkStatus {
    return statuses.get(link.resourceId) ?? { state: 'resolving' }
  }

  /** Forgets what is known about a resource, e.g. after it was relinked */
  function forget(resourceId: string) {
    statuses.delete(resourceId)
  }

  /** Opens a file in its default app, or a folder in Files */
  async function open(link: CardLink) {
    const status = statusOf(link)
    const path = status.state === 'ok' ? status.path : link.path
    try {
      const target = await clientService.webdav.getFileInfo(unref(space), { path })
      if (target.isFolder) {
        await router.push(getFolderLink(target))
        return
      }
      triggerDefaultAction({ space: unref(space), resources: [target] })
    } catch (e) {
      statuses.set(link.resourceId, { state: 'broken' })
      showErrorMessage({
        title: $gettext('»%{name}« could not be opened', { name: link.name }),
        errors: [e as Error]
      })
    }
  }

  function toLink(picked: Resource): CardLink | null {
    const resourceId = picked.fileId || picked.id
    if (!resourceId || !isInSpace(resourceId)) {
      showMessage({
        title: $gettext('Only files and folders of this space can be linked'),
        desc: $gettext('»%{name}« is in another space.', { name: picked.name ?? '' }),
        status: 'warning'
      })
      return null
    }
    const path = picked.path || `/${picked.name}`
    statuses.set(resourceId, { state: 'ok', path, name: picked.name || basename(path) })
    return {
      resourceId,
      path,
      name: picked.name || basename(path),
      isFolder: Boolean(picked.isFolder),
      extra: {}
    }
  }

  /** Lets the user pick a file of the space; calls `onPick` with the link to it */
  function pickFile(onPick: (link: CardLink) => void) {
    dispatchModal({
      elementClass: 'file-picker-modal',
      title: $gettext('Link a file'),
      customComponent: markRaw(FilePickerModal),
      hideActions: true,
      customComponentAttrs: () => ({
        parentFolderLink: getParentFolderLink(unref(resource)),
        allowedFileTypes: [],
        callbackFn: ({ resource: picked }: { resource: Resource }) => {
          const link = toLink(picked)
          if (link) {
            onPick(link)
          }
        }
      }),
      focusTrapInitial: false
    })
  }

  /** Lets the user pick a folder of the space; calls `onPick` with the link to it */
  function pickFolder(onPick: (link: CardLink) => void) {
    dispatchModal({
      elementClass: 'location-picker-modal',
      title: $gettext('Link a folder'),
      customComponent: markRaw(LocationPickerModal),
      hideActions: true,
      customComponentAttrs: () => ({
        submitButtonTitle: $gettext('Link this folder'),
        parentFolderLink: getParentFolderLink(unref(resource)),
        callbackFn: ([picked]: Resource[]) => {
          const link = picked && toLink({ ...picked, isFolder: true })
          if (link) {
            onPick(link)
          }
        }
      }),
      focusTrapInitial: false
    })
  }

  return { resolve, statusOf, forget, open, pickFile, pickFolder }
}

export type ResourceLinks = ReturnType<typeof useResourceLinks>
