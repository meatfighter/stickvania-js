# Stickvania

**[Project page: meatfighter.com/stickvania/](https://meatfighter.com/stickvania/)** â€” background, gameplay, controls, and downloads.

This README covers development and maintenance of the Java and TypeScript implementations.

## Repository layout

| Path                                | Purpose                                                            |
| ----------------------------------- | ------------------------------------------------------------------ |
| `about/content.md`                  | Project-page article prose                                         |
| `about/footer.md`                   | Project-page copyright and licensing footer prose                  |
| `about/index.html`, `about/assets/` | Page template, SEO metadata placeholders, and artwork              |
| `desktop/src/`                      | Maintained Java gameplay reference and resources                   |
| `desktop/`                          | Desktop build, runtime libraries, and platform-specific packaging  |
| `pwa/src/stickvania/`               | TypeScript gameplay port                                           |
| `pwa/src/stickvania/persistence/`   | Save schema, validation, serialization, and restoration            |
| `pwa/src/app/`                      | Browser shell, preferences, session ownership, and lifecycle       |
| `pwa/src/rumble/`                   | Browser gamepad-vibration support                                  |
| `pwa/public/`                       | Static game resources and service worker                           |
| `scripts/`                          | Build tools, local checks, generated metadata, and release tooling |
| `version.json`                      | Version and build-stamp source                                     |

Generated output belongs in `dist/`, `.release-components/`, and desktop build directories. Do not edit generated bundles or release metadata by hand.

## Getting started

Use Node.js 24 or newer and Git; see [package.json](package.json) for the supported baseline. Desktop builds and checks that compile Java require JDK 21, with `javac` and `jar` on `PATH`.

Run commands from the repository root:

```sh
npm ci
npm run dev
```

The commands also work in Windows PowerShell; use `npm.cmd` if PowerShell blocks `npm.ps1`.

## Common tasks

| Task                               | Command                                         | Output / notes                                                       |
| ---------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------- |
| Run browser development server     | `npm run dev`                                   | Local URL printed by Vite                                            |
| Build PWA                          | `npm run build:pwa`                             | `.release-components/pwa/`                                           |
| Build about page                   | `npm run build:about`                           | `.release-components/about/`                                         |
| Build web distribution             | `npm run build:web`                             | `.release-components/web/`; includes desktop download                |
| Build / run desktop client         | `npm run build:desktop` / `npm run run:desktop` | See [desktop/README.md](desktop/README.md)                           |
| Check TypeScript                   | `npm run typecheck`                             | Browser source                                                       |
| Verify source and components       | `npm run verify`                                | Includes formatting, lint, parity, persistence, and component builds |
| Check browser and offline behavior | `npm run verify:browser`                        | See browser prerequisites below                                      |
| Audit dependencies                 | `npm run verify:dependencies`                   | Queries current npm advisories                                       |
| Build complete distribution        | `npm run build`                                 | `dist/`; clean-source release build                                  |
| Verify, audit, and build release   | `npm run release`                               | `dist/`                                                              |
| Qualify local commit               | `npm run qualify`                               | Full local pre-push qualification                                    |
| Preview complete distribution      | `npm run preview:dist`                          | Run after building `dist/`                                           |

Component builds use isolated output directories; building a component does not refresh the complete `dist/` distribution. Use the public scripts above rather than invoking internal `_build:*` steps directly.

Browser fixtures use a locally installed Chrome, Chromium, or Edge. Set `CHROMIUM_PATH` to the executable if automatic discovery fails. Offline verification also needs a built PWA; consult [scripts/run-offline-verification.mjs](scripts/run-offline-verification.mjs) for its output-directory selection.

For the separate Chromium/Firefox/WebKit qualification, install the browser engines locally with `npx playwright install chromium firefox webkit`, then run `npm run qualify:browsers`, which builds its own PWA before testing. For checks against a final packaged PWA without rebuilding, set `PWA_ROOT` to its absolute path and invoke the leaf checks listed in `scripts/run-browser-qualification-suite.mjs`; see [RELEASING.md](RELEASING.md). Linux also needs the Playwright system dependencies and a graphical display or Xvfb. Run `npm run qualify` before pushing release-affecting changes; use the extended browser matrix and appropriate real-device acceptance for material browser-facing changes. GitHub Actions is an optional manual Linux check.

## Maintenance principles

- Compare gameplay changes with the corresponding Java source. Preserve useful structural correspondence, fixed-step timing, Java numeric behavior, and random-state behavior.
- Keep browser storage, networking, presentation, and lifecycle concerns in the browser-support layer where practical.
- Avoid unnecessary temporary objects and repeated computation in update and render loops. Use the focused tests and available benchmarks in [package.json](package.json).
- The `v1.0.0` release establishes the public save-state compatibility baseline. Future schema changes require an explicit compatibility decision; unfamiliar public saves must not be silently discarded, and schema validation/restoration must be updated together.
- Regenerate affected resource or parity metadata through the repository scripts and check it before committing.
- The [slick2d-ts](https://github.com/meatfighter/slick2d-ts) dependency is pinned to an immutable HTTPS commit archive. Update `package.json` and `package-lock.json` together, then verify gameplay and browser behavior against that engine revision.

## Project page and deployment

Edit the article in [about/content.md](about/content.md) and the copyright/licensing footer in [about/footer.md](about/footer.md); layout and SEO wiring live in [about/index.html](about/index.html) and [scripts/build-about.mjs](scripts/build-about.mjs).

The canonical URL and Open Graph page URL identify `https://meatfighter.com/stickvania/`. Play, download, and page-asset links are relative so the assembled site can be tested beneath a staging directory. Keep production canonical URLs during staging and configure a staging-only `X-Robots-Tag: noindex` response header at the host. That header is a hosting requirement, not something the current build adds.

## Further documentation

- [RELEASING.md](RELEASING.md): exact-commit qualification, archive/checksum, and tagging procedure.
- [desktop/README.md](desktop/README.md): Java build and runtime details.
- [releases/README.md](releases/README.md): release tooling and local release state.
- [LICENSE](LICENSE): GPL-3.0-or-later license text for original project source code.
- [COPYRIGHT.md](COPYRIGHT.md): copyright, licensing, trademark, and third-party-content scope.
- [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md): third-party software licenses and redistributed components.
