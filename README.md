# RunDownRec client index

Static site for the RunDownRec localhost revival: a list of your current clients and a
**Special Clients** tab for the builds you made yourself, styled after
[archive.recagain.site](https://archive.recagain.site).

No framework, no build step, no dependencies — plain HTML/CSS/JS that reads JSON, so GitHub
pushes straight to Cloudflare Pages.

## Layout

```
index.html                  the whole page (both tabs live here)
404.html                    served for unknown paths
favicon.svg
css/styles.css              design tokens + table layout ported from archive.recagain.site
js/app.js                   tabs, search, sort, filters, copy, theme
data/clients.json           CLIENTS tab content
data/special-clients.json   SPECIAL CLIENTS tab content
data/settings.json          site name, tagline, footer links
downloads/                  the files people download
scripts/add-file.ps1        turns a build into a paste-ready JSON entry
scripts/serve.ps1           local preview server
_headers                    Cloudflare Pages cache/security headers
```

## Preview locally

```powershell
.\scripts\serve.ps1
# then open http://localhost:8787/
```

Stop with `Ctrl+C`. Use `-Port 8080` if 8787 is taken.

## Add a client build

1. Drop the file in `downloads/` (or run step 2 with `-Move` and it copies for you):

   ```powershell
   .\scripts\add-file.ps1 C:\Users\benne\Downloads\my-build.zip -Move
   ```

   The helper prints a JSON entry with the real byte size and SHA-256 already filled in.
   Add `-Clip` to put it on the clipboard too.

2. Paste that object into the `entries` array of `data/clients.json`, or
   `data/special-clients.json` for the Special tab. Rename `name`, `version`, `notes`.

3. Commit and push:

   ```powershell
   git add .
   git commit -m "Add my-build client"
   git push
   ```

Cloudflare Pages republishes on push. The new row shows up as soon as the deploy finishes.

## Entry fields

| Field | Required | Shown as | Notes |
| --- | --- | --- | --- |
| `name` | yes | Client column | |
| `version` | no | Version column | Feeds the version dropdown filter |
| `date` | no | Release date column | `YYYY-MM-DD`, also the default sort |
| `manifestId` | no | Manifest ID column | Rendered with a click-to-copy button |
| `status` | no | Coloured dot | `ready`, `partial`, `broken`, `archived`; defaults to `ready` |
| `notes` | no | Line under the name | Developer notes for whoever downloads it |
| `uploadedAt` | no | Uploaded column | ISO timestamp, e.g. `2026-11-03T20:26:00Z` |
| `files[]` | no | Files column | `label`, `path`, `size` (bytes), `sha256` |

`files[].path` is relative to the site root (`downloads/whatever.zip`) or a full `https://`
URL if you host the binary elsewhere. Search covers name, version, manifest ID, status and
notes.

## Deploy to Cloudflare Pages

1. Push this folder to a GitHub repository.
2. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
3. Pick the repo. Framework preset: **None**. Build command: **leave empty**.
   Build output directory: **`/`** (the repo root is already the site).
4. **Save and Deploy**. Every later push auto-deploys; every PR gets a preview URL.

Or with the CLI, from this folder: `npx wrangler pages deploy . --project-name rundownrec`

## Things to know

- **File size caps.** Cloudflare Pages allows 20,000 files per deployment (free tier) and
  **25 MiB per file**. Rec Room client builds are usually far bigger, so host those on GitHub
  Releases and paste the `https://github.com/you/repo/releases/download/tag/build.zip` URL
  into `files[].path` — the site links to it the same way, and the checksum column still
  verifies what people downloaded. Cloudflare's own suggestion for large assets at the same
  origin is an [R2 bucket](https://developers.cloudflare.com/pages/platform/limits/).
- **Cache busting.** Give each build a new filename (put the version in it). `downloads/*`
  caches for a day, so reusing a name can serve the old binary.
- **Clipboard.** Copy buttons need the tab to be focused and an https or localhost origin —
  that is a browser rule, not a site one.
- **The example entries are placeholders.** Every seed row is marked
  `PLACEHOLDER ENTRY` in its notes and points at `downloads/rundownrec-placeholder.zip`.
  Replace `data/clients.json` and `data/special-clients.json` with your real clients, and
  update the Discord/GitHub URLs in `data/settings.json`.
