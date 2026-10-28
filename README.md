# Kanban for OpenCloud

Production boards and a publishing calendar for [OpenCloud](https://github.com/opencloud-eu/opencloud),
as a native file type: put a `.kanban` file in a space, click it, and the whole team follows
its productions on a board and its publications on a calendar. Cards point to the files and
folders already in the space.

_[Version française](README.fr.md)_

![Board](docs/screenshots/board.png)

- **Board**: columns side by side, card counts, quick add, drag and drop (mouse, touch, pen) and
  a **Move to…** menu for the keyboard. Columns can be added, renamed, recolored, reordered and
  deleted (their cards are moved or deleted, after confirmation).
- **Calendar**: month and week, cards on their publication date, drag a card to another day
  (the time is kept), drag a card without a date from the list next to the calendar. Weeks start
  on Monday, today is marked, names follow the language of the user.
- **Card details** in the OpenCloud side bar: title, column, publication date and time, due date,
  assignees (members of the space), tags, description, linked files and folders, history.
- **Links** to files and folders of the space, picked with the OpenCloud pickers. A renamed or
  moved file stays linked; a deleted one shows as broken, with **Relink** and **Remove**. A file
  opens in its default app, a folder in Files.
- **Filters** by assignee, tag and text, shared by both views.
- **Several people at once**: autosave, conflict handling, changes from others within a second
  or two, unsaved changes never lost. With the Yjs server of OpenCloud: who has the board open,
  and which card they are looking at.
- Light and dark themes, keyboard navigation, English and French, tablets and phones.

> **Tested with OpenCloud 9.0.0** (OpenCloud Web 8.2.1). It uses only public APIs of
> `@opencloud-eu/web-pkg` 8, so other 8.x versions of OpenCloud Web should work, untested.

| Light                                      | Dark                                                  |
| ------------------------------------------ | ----------------------------------------------------- |
| ![Card details](docs/screenshots/card.png) | ![Calendar, dark](docs/screenshots/calendar-dark.png) |

## Contents

1. [Installation](#installation)
2. [Presence (optional)](#presence-optional)
3. [Usage](#usage)
4. [Working together](#working-together)
5. [File format](#file-format)
6. [Known limitations](#known-limitations)
7. [Development](#development)

## Installation

### From a release

Download `kanban-<version>.zip` and unzip it into the web apps directory of OpenCloud. The
archive contains a `kanban/` folder, like the official extensions:

```bash
unzip kanban-0.1.0.zip -d "$OC_DATA_DIR/web/assets/apps/"
```

| Setup                                                                  | Web apps directory                                                                                          |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Binary / package                                                       | `$OC_DATA_DIR/web/assets/apps/` (create it if needed)                                                       |
| [opencloud-compose](https://github.com/opencloud-eu/opencloud-compose) | `opencloud-compose/config/opencloud/apps/`                                                                  |
| Any Docker setup                                                       | `<host path mounted on OC_BASE_DATA_PATH>/web/assets/apps/`, or mount the folder with `WEB_ASSET_APPS_PATH` |

With Docker, a volume works as well, e.g. in the `opencloud` service of a compose file:

```yaml
environment:
  WEB_ASSET_APPS_PATH: /web/apps
volumes:
  - ./apps/kanban:/web/apps/kanban:ro
```

Restart OpenCloud. No `apps.yaml` entry and no other configuration are needed. Nothing is loaded
from outside OpenCloud: icons come from the Remix Icon set it serves, dates are formatted with
the Luxon library it already ships.

Check the archive with the published checksum:

```bash
sha256sum -c sha256sum.txt
```

### From source

Requirements: Node.js 22.18+ and pnpm 11.

```bash
git clone https://github.com/JulesMellot/opencloud-kanban.git
```

```bash
cd opencloud-kanban && pnpm install --frozen-lockfile && pnpm build
```

Copy the contents of `dist/` into a `kanban/` folder of the web apps directory, or build the
release archive with `pnpm package`.

## Presence (optional)

Boards sync through their file and work without any additional service. To also see **who has
the board open** (avatars in the toolbar) and **which card they look at** (avatar on the card),
run the Yjs server of OpenCloud next to it, as for collaborative editing in the text editor:

1. Run the `opencloudeu/yjs` container (it stores nothing, it only relays messages between
   browsers) with `OPENCLOUD_URL` set to the URL of OpenCloud.
2. Route `/yjs` to it through the OpenCloud proxy, unprotected (the token travels inside the
   WebSocket and the Yjs server checks it itself), in `proxy.yaml`:

   ```yaml
   additional_policies:
     - name: default
       routes:
         - endpoint: /yjs
           backend: http://yjs:1234
           unprotected: true
   ```

3. Set `WEB_OPTION_YJS_SERVER_URL=wss://<your OpenCloud host>/yjs` on the OpenCloud service and
   restart it.

[`docker-compose.yml`](docker-compose.yml) and [`dev/docker`](dev/docker) show a complete setup.
This only enables presence: the room holds no board data.

## Usage

- **Create a board**: in Files, **New** → **Kanban board**. It starts with the columns Idea,
  Brief, Shooting, Editing, Review, Scheduled and Published (in the language of the user).
- **Open a board**: click the `.kanban` file.
- **Add a card**: **Add a card** at the bottom of a column (Enter adds it and keeps the field
  open for the next one), or **+** on a day of the calendar.
- **Move a card**: drag it (on touch screens, press and hold it first), or open its **⋯** menu →
  **Move to…**, **Move up**, **Move down**. Escape cancels a drag.
- **Plan a card**: drag it onto a day of the calendar, or set its publication date in its
  details. Cards dropped on a day for the first time get 09:00.
- **Edit a card**: click it. Changes are saved on their own; the indicator in the toolbar shows
  **Saved**, **Saving…** or **Not saved**.
- **Columns**: their **⋯** menu renames, recolors, moves and deletes them.
- **Switch views** with the buttons on the right of the toolbar. The last view is remembered
  per user, in the browser.
- **Filter** with the search field and the **Assignee** and **Tag** chips. The chip filters are
  part of the URL, like the filters of the file search.

Users with read-only access to the file see the board with a **Read-only** banner, without
drag and drop or editing.

## Working together

The `.kanban` file is the only shared state: no server component, no database.

- **Every change is an operation** (add a card, move it, change a field, delete a column…)
  applied to the board. It names what it changes by id and places cards relative to their
  neighbours, so it still makes sense on a newer version of the file.
- **Autosave** about 800 ms after the last change, with `If-Match` on the etag of the version the
  changes were made on. The etag of the new version is taken from the response of the write
  itself.
- **Conflicts**: when someone else saved in between (412), the newer version is loaded, the
  local operations are replayed on it and the result is saved. Changes to different cards or
  different fields of a card all survive; for the same field, the last save wins. An operation
  that no longer applies (its card was deleted, …) is given up and a message tells which.
- **Changes from others** show up without reloading: the server announces writes to the file
  (server-sent events), the etag is also checked every 30 seconds and when the tab is shown
  again. With nothing unsaved locally, the board is simply refreshed; scroll position, open card
  and filters stay.
- **Nothing is lost**: unsaved operations are also kept in the browser (`localStorage`) and
  replayed the next time the board is opened, after a crash or a closed tab. When saving
  fails, the board keeps the changes, retries (2 s, 5 s, 10 s, 30 s, then every minute) and
  offers to copy the board with the changes. Leaving the app with unsaved changes asks first.
- **Never overwritten**: a file that is not a valid board, or that was written by a newer
  version, is shown as an error and never written. If the file is replaced by something
  invalid while the board is open, saving stops and the changes can be copied.

## File format

JSON, versioned:

```json
{
  "version": 1,
  "columns": [{ "id": "…", "title": "Editing", "color": "primary" }],
  "cards": [
    {
      "id": "…",
      "title": "Episode 12",
      "description": "",
      "columnId": "…",
      "order": 1,
      "assignees": [{ "id": "<user id>", "displayName": "Ada Lovelace" }],
      "tags": ["YouTube"],
      "dueDate": "2026-11-05",
      "publishDate": "2026-11-12T17:30",
      "links": [
        { "resourceId": "<file id>", "path": "/Rushes", "name": "Rushes", "isFolder": true }
      ],
      "createdAt": "2026-10-20T09:00:00.000Z",
      "createdBy": "<user id>",
      "updatedAt": "2026-10-27T16:00:00.000Z",
      "updatedBy": "<user id>"
    }
  ]
}
```

- **`color`** is the name of a color role of the OpenCloud design system, never a color code:
  `outline`, `tertiary`, `secondary`, `primary`, `inverse-primary`, `error` or `on-surface`. Each
  theme defines them for light and dark mode. An unknown value is kept in the file and drawn as
  `outline`. (`chrome` is not offered: the OpenCloud theme does not define it.)
- **`order`** sorts the cards of a column (ties are broken by id). Values are fractional, so a
  move changes one card only; a column is renumbered when two values get too close.
- **`dueDate`** is a day (`YYYY-MM-DD`), **`publishDate`** a wall-clock time without time zone
  (`YYYY-MM-DDTHH:mm`): 17:30 means 17:30 for everyone, also on the days clocks change.
- **`links`** are identified by `resourceId`; `path` (relative to the space) and `name` are
  updated when the resource was moved or renamed.
- **Unknown fields** are kept at every level when saving.
- **Validation** on open: invalid JSON, a missing or newer `version`, or a field of the wrong
  type is reported with its location (e.g. `cards[3].publishDate`) and the file is not changed.
  A card whose column does not exist shows in the first column. An empty file opens as a new
  board with the default columns.
- **Migrations**: `src/model/migrations.ts` holds one function per past version, turning a
  version `n` document into version `n + 1`. Version 1 is the first one, so there is none yet.

## Known limitations

- **Text is not merged character by character**: if two people edit the same field of the same
  card at the same time, the last save wins. Others see a change once it is saved, about a
  second after the last keystroke, not while it is typed.
- **Presence** needs the Yjs server (see above); without it, nobody sees who else is there,
  everything else works the same.
- **Public links**: the app opens boards for signed-in users only.
- **The pickers** of OpenCloud cannot be limited to one space: a file or folder picked from
  another space is refused with a message.
- **Assignees** are the members of the project space, groups included when the user may list
  the members of a group (to verify for non-admin users on your setup); in other spaces, every
  user of the instance can be searched. Names are stored on the card when assigned.
- **History**: there is no undo; earlier versions of the file are in its **Versions** in Files.
- **The time field** is the time input of the browser, through the text input of the design
  system (which only declares a few input types).
- **Large boards**: the whole file is written on every save, which is fine for hundreds of
  cards, not for tens of thousands.
- **Console**: avatars of users without a photo make the browser log a 404, as everywhere in
  OpenCloud Web.

## Development

```bash
pnpm install
```

```bash
pnpm build:w
```

```bash
docker compose up -d
```

Then open <https://host.docker.internal:9200> (`admin` / `admin`, demo users with `demo`). The
compose file runs OpenCloud 9 with `dist/` mounted as the app, the Yjs server and Traefik.
OpenCloud reads the entry point of the app when it starts: restart it
(`docker compose restart opencloud`) after a build that changed file names.

| Command                                                | What it does                                                      |
| ------------------------------------------------------ | ----------------------------------------------------------------- |
| `pnpm test:unit`                                       | unit tests (format, migrations, operations, sync, calendar dates) |
| `pnpm test:e2e`                                        | end-to-end tests against a running OpenCloud with the app         |
| `pnpm lint` / `pnpm check:types` / `pnpm format:check` | static checks                                                     |
| `pnpm check`                                           | all of the above but e2e, and a build                             |
| `pnpm package`                                         | `kanban-<version>.zip` and `sha256sum.txt`                        |

The end-to-end tests create users and a space through the API, so basic auth must be enabled
(`PROXY_ENABLE_BASIC_AUTH=true`, as in the compose file). `OPENCLOUD_URL`, `ADMIN_USERNAME` and
`ADMIN_PASSWORD` override the defaults; `PW_CHROMIUM_PATH` points to another Chromium.

### Layout

```
src/model/        the file format, operations, ordering, calendar dates and filters (pure)
src/sync/         saving with If-Match, conflict replay, reading changes from others
src/composables/  board state, links, members, presence, drag and drop, preferences
src/components/   board, calendar, card side bar, toolbar, states
tests/unit/       Vitest
tests/e2e/        Playwright
```

## License

AGPL-3.0, see [LICENSE](LICENSE).
