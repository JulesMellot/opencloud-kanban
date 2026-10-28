import './styles.css'
import {
  AppWrapperRoute,
  defineWebApplication,
  useClientService,
  type ApplicationInformation
} from '@opencloud-eu/web-pkg'
import { urlJoin } from '@opencloud-eu/web-client'
import { useGettext } from 'vue3-gettext'
import translations from '../l10n/translations.json'
import App from './App.vue'
import { useDefaultBoard } from './composables/useDefaultBoard'
import { FILE_EXTENSION, serializeDocument } from './model/schema'

export const applicationId = 'kanban'

export default defineWebApplication({
  setup() {
    const { $gettext } = useGettext()
    const clientService = useClientService()
    const createDefaultBoard = useDefaultBoard()

    const appInfo: ApplicationInformation = {
      name: $gettext('Kanban'),
      id: applicationId,
      icon: { name: 'kanban-view', fillType: 'none' },
      color: 'var(--oc-role-tertiary)',
      defaultExtension: FILE_EXTENSION,
      extensions: [
        {
          extension: FILE_EXTENSION,
          routeName: `${applicationId}-board`,
          newFileMenu: {
            menuTitle: () => $gettext('Kanban board'),
            defaultName: () => $gettext('New board')
          },
          // a new board is a valid board from the start, with the default columns
          createFileHandler: ({ fileName, space, currentFolder }) =>
            clientService.webdav.putFileContents(space, {
              path: urlJoin(currentFolder.path, fileName),
              content: serializeDocument(createDefaultBoard())
            })
        }
      ]
    }

    const routes = [
      {
        name: `${applicationId}-board`,
        path: '/:driveAliasAndItem(.*)?',
        component: AppWrapperRoute(App, { applicationId }),
        meta: {
          authContext: 'user',
          title: $gettext('Kanban'),
          patchCleanPath: true
        }
      }
    ]

    return {
      appInfo,
      routes,
      translations
    }
  }
})
