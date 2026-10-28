import { computed } from 'vue'
import { useGettext } from 'vue3-gettext'
import type { ColumnColor } from '../model/schema'

/**
 * The colors a column can take, with names that do not depend on the theme: each one is a
 * color role of the design system, which every theme defines in its own way.
 */
export function useColumnColors() {
  const { $gettext } = useGettext()
  return computed<{ color: ColumnColor; label: string }[]>(() => [
    { color: 'outline', label: $gettext('Neutral') },
    { color: 'tertiary', label: $gettext('Tertiary') },
    { color: 'secondary', label: $gettext('Secondary') },
    { color: 'primary', label: $gettext('Primary') },
    { color: 'inverse-primary', label: $gettext('Highlight') },
    { color: 'error', label: $gettext('Alert') },
    { color: 'on-surface', label: $gettext('Contrast') }
  ])
}
