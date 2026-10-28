import { useGettext } from 'vue3-gettext'
import { createDefaultDocument } from '../model/schema'

/** Builds the board a new or empty `.kanban` file starts with, in the user's language. */
export function useDefaultBoard() {
  const { $gettext } = useGettext()
  return function createDefaultBoard() {
    return createDefaultDocument({
      idea: $gettext('Idea'),
      brief: $gettext('Brief'),
      shooting: $gettext('Shooting'),
      editing: $gettext('Editing'),
      review: $gettext('Review'),
      scheduled: $gettext('Scheduled'),
      published: $gettext('Published')
    })
  }
}
