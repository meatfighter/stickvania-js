# Stickvania

**[Project page: meatfighter.com/stickvania/](https://meatfighter.com/stickvania/)** — background, gameplay, controls, and downloads.

This repository contains the maintained Java desktop implementation and TypeScript browser port.

## Development

Use the Node.js version supported by [package.json](package.json), Git, and JDK 21 with `java`, `javac`, and `jar` on `PATH`.

```sh
npm ci
npm run dev
```

Run commands from the repository root. On Windows PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`.

## Repository layout

| Path                                  | Purpose                                               |
| ------------------------------------- | ----------------------------------------------------- |
| `about/content.md`, `about/footer.md` | Project-page article and attribution                  |
| `about/index.html`, `about/assets/`   | Page template and artwork                             |
| `desktop/src/`, `desktop/`            | Java gameplay, resources, and desktop packaging       |
| `pwa/src/stickvania/`                 | Browser gameplay and persistence                      |
| `pwa/src/app/`, `pwa/src/rumble/`     | Browser lifecycle, preferences, and vibration support |
| `pwa/public/`                         | Static resources and service worker                   |
| `scripts/`, `version.json`            | Build, test, metadata, and version tooling            |

## Build and check

| Task                                            | Command                                         |
| ----------------------------------------------- | ----------------------------------------------- |
| Format / lint                                   | `npm run format` / `npm run lint`               |
| Build browser component                         | `npm run build:pwa`                             |
| Build project-page component                    | `npm run build:about`                           |
| Build / run Java                                | `npm run build:desktop` / `npm run run:desktop` |
| Qualify a clean commit and assemble the release | `npm run qualify`                               |
| Run the extended browser matrix                 | `npm run qualify:browsers`                      |
| Preview the assembled release                   | `npm run preview:dist`                          |

The complete release is assembled in `dist/`. Component builds use `.release-components/` and do not refresh the complete distribution. Edit source files, not generated HTML, bundles, archives, or release metadata.

Standard browser checks use a local Chrome, Chromium, or Edge; set `CHROMIUM_PATH` if discovery fails. Install the extended matrix with `npx playwright install chromium firefox webkit`. Linux may also require browser system dependencies and a display or Xvfb.

See [RELEASING.md](RELEASING.md) for the clean-commit workflow and the distinction between assembled-release and component browser checks. Do not run `verify` or `release` separately as prerequisites to `qualify`; qualification already invokes them.

## Maintenance

Keep Java and TypeScript gameplay changes aligned, including fixed-step timing, numeric semantics, and random-call ordering. Keep browser lifecycle and storage concerns separate from gameplay, and avoid allocations or unnecessary work in update/render paths.

Simon uses gameplay physics throughout a normal game. Recorded attract demos and ending gameplay clips use the legacy profile. Difficulty is an independent stable selection; Hard modifiers are suppressed during recorded playback without changing the selected setting.

Saved games support the current schema. Unsupported or corrupt saves are ignored without rewriting the slot during load; a later authorized save overwrites the slot. No migration layer for older schemas is maintained.

Regenerate affected resource and parity metadata through the repository scripts. The `slick2d-ts` dependency is pinned to an immutable commit archive; update the dependency and lockfile together only when intentionally adopting a new engine revision.

Edit the project-page prose in `about/content.md` and `about/footer.md`; layout and metadata are maintained in `about/index.html` and `scripts/build-about.mjs`.

## Documentation and licensing

- [desktop/README.md](desktop/README.md): Java build and runtime requirements.
- [releases/README.md](releases/README.md): local release artifacts.
- [LICENSE](LICENSE), [COPYRIGHT.md](COPYRIGHT.md), and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md): source licensing, attribution, and third-party scope.

## Persistence fuzzing

See [PERSISTENCE_FUZZING.md](PERSISTENCE_FUZZING.md) for the deterministic qualification campaign, overnight discovery, replay/minimization, evidence isolation and required complete-game resources.
