# Changelog

## [0.1.1](https://github.com/JulesMellot/opencloud-kanban/releases/tag/v0.1.1) - 2026-10-28

### 🐛 Bug Fixes

- The board no longer switches to its phone layout on a wide screen when other extensions built
  with the extension SDK (Folder icons, Forms, …) are installed: the app uses its own CSS class
  prefix, so the stylesheets of other extensions cannot override it, nor it theirs.

## [0.1.0](https://github.com/JulesMellot/opencloud-kanban/releases/tag/v0.1.0) - 2026-10-28

### ✨ Features

- Open `.kanban` files from Files, create one from the New menu with default columns.
- Board view: columns with card counts, quick add, drag and drop with mouse, touch and pen, and
  a “Move to…” menu for the keyboard. Add, rename, recolor, reorder and delete columns.
- Calendar view: month and week, publication dates, drag to another day keeping the time,
  list of cards without a date.
- Card details in the OpenCloud side bar: every field, links to files and folders of the space,
  assignees among the space members, tags.
- Filters by assignee, tag and text, shared by both views.
- Autosave with conflict handling (`If-Match`, replay of local changes after a 412), changes
  from others pushed by the server, unsaved changes kept in the browser.
- Presence through the Yjs server of OpenCloud, when configured.
- English and French.
