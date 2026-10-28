import { computed, shallowRef, unref, type Ref } from 'vue'
import { useClientService, useSharesStore } from '@opencloud-eu/web-pkg'
import {
  isProjectSpaceResource,
  ShareTypes,
  type CollaboratorShare,
  type SpaceResource
} from '@opencloud-eu/web-client'
import { normalizeText } from '../model/filters'

export interface Member {
  id: string
  displayName: string
  mail?: string
}

/** Search results are limited to this many people */
const MAX_RESULTS = 20

/**
 * The people who can be assigned to cards: the members of the project space the board lives
 * in, groups included, as listed by its sharing settings. Where the members cannot be listed
 * (not a project space, or not allowed), every user of the instance can be searched instead,
 * as when sharing.
 */
export function useMembers(space: Ref<SpaceResource>) {
  const clientService = useClientService()
  const sharesStore = useSharesStore()

  const members = shallowRef<Member[] | null>(null)
  let loading: Promise<void> | null = null

  async function loadGroupMembers(groupId: string): Promise<Member[]> {
    try {
      const group = await clientService.graphAuthenticated.groups.getGroup(groupId)
      return (group.members ?? []).map(({ id, displayName, mail }) => ({
        id: id as string,
        displayName: displayName ?? (id as string),
        mail: mail ?? undefined
      }))
    } catch {
      // not allowed to see the members of that group
      return []
    }
  }

  async function load() {
    const current = unref(space)
    if (!current || !isProjectSpaceResource(current)) {
      members.value = null
      return
    }
    try {
      const { shares } = await clientService.graphAuthenticated.permissions.listPermissions(
        current.id,
        current.id,
        sharesStore.graphRoles
      )
      const byId = new Map<string, Member>()
      const collaborators = shares.filter(
        (share): share is CollaboratorShare => 'sharedWith' in share
      )
      for (const share of collaborators) {
        const id = share.sharedWith?.id
        if (!id) {
          continue
        }
        if (share.shareType === ShareTypes.group.value) {
          for (const member of await loadGroupMembers(id)) {
            byId.set(member.id, member)
          }
        } else if (share.shareType === ShareTypes.user.value) {
          byId.set(id, { id, displayName: share.sharedWith.displayName ?? id })
        }
      }
      members.value = [...byId.values()].sort((a, b) => a.displayName.localeCompare(b.displayName))
    } catch {
      members.value = null
    }
  }

  function ensureLoaded() {
    loading ??= load()
    return loading
  }

  function matches(member: Member, query: string) {
    const term = normalizeText(query.trim())
    return (
      !term ||
      normalizeText(member.displayName).includes(term) ||
      normalizeText(member.mail ?? '').includes(term)
    )
  }

  /** People matching `query`, members of the space first */
  async function search(query: string, signal?: AbortSignal): Promise<Member[]> {
    await ensureLoaded()
    const known = unref(members)
    if (known) {
      return known.filter((member) => matches(member, query)).slice(0, MAX_RESULTS)
    }
    if (query.trim().length < 2) {
      return []
    }
    const users = await clientService.graphAuthenticated.users.listUsers(
      { orderBy: ['displayName'], search: `"${query.trim()}"` },
      { signal }
    )
    return (users ?? []).slice(0, MAX_RESULTS).map(({ id, displayName, mail }) => ({
      id: id as string,
      displayName: displayName ?? (id as string),
      mail: mail ?? undefined
    }))
  }

  /** Display name of a user id, for "created by" and the like */
  function nameOf(userId: string) {
    return unref(members)?.find(({ id }) => id === userId)?.displayName
  }

  return {
    members,
    isLimitedToSpace: computed(() => unref(members) !== null),
    ensureLoaded,
    search,
    nameOf
  }
}
