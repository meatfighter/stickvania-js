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

## Save validation and rejected-save evidence

Falling ordinary enemies and dropped items retire below the stage in both desktop and browser gameplay, including recorded presentations. Pit retirement does not award points or create combat drops. Save validation accepts the published intro-to-loop and pending Song replacement boundaries without advancing the game during capture.

The browser retains the latest rejected outgoing snapshot in a separate deployment-scoped `debug-invalid-save` slot. It records the first failed validation gate and distinguishes a false result from an exception. This is diagnostic evidence, never a Continue source. Successful saves and loads leave it untouched. Invalid saves preserve the previous canonical save; old development schemas remain non-destructive load misses.

To retrieve evidence without changing it, use DevTools on the affected deployment:

```js
Object.keys(localStorage).filter((key) => key.startsWith("stickvania:") && key.endsWith(":debug-invalid-save"));
// Then copy the value for the exact returned deployment key:
// copy(localStorage.getItem('the-returned-key'));
```

The full record is bounded to 262,144 JavaScript string code units. Oversized or unsupported JSON data uses a compact omission record, bounded to 16,384 code units. Storage denial or quota exhaustion can prevent retention; no other storage is evicted.

During a Door transition, rendering follows the source region's moving platforms while collision and save roots already identify the destination. Active Whip pickup counts are recounted only when a region is installed. Schema 27 persists `timeFrozen` and requires it to equal the sole active StopWatch lifetime; restore verifies that reconstruction agrees. Shared constructor-free policies reject duplicate dispatch, invalid object roles, stalled controlling Doors, and conflicting audio owners while retaining legitimate historical aliases and completion gaps. Previous schemas are nonwriting load misses; an authorized current save replaces the same stable slot.

Raven and BridgeBat use a local emergency arc limit of 32 vertical pixels per fixed tick, with acceleration saturated at 64 after computing the original launch velocity. Singular or nonfinite arc calculations fall back to horizontal flight without extra random draws. Shared Thing/Simon physics are unchanged. Title entry discards both weapon stacks after stopping the old Song, including any active StopWatch.

Save validation accepts finite unclassified numeric fields, safe integral generic counters, and nonnegative safe-integer scores. Named gameplay domains, coordinate/velocity/collision work limits, reference ownership, and structural budgets still apply. Music positions follow the pinned engine contract without an extra 24-hour limit.

The browser defaults to Dark on a fresh installation and after Reset. Explicit stored themes, including Light, remain authoritative. Reading a missing or invalid preference does not write a replacement. If Reset cannot remove a preference, Dark applies to the current session and the existing partial-reset warning remains visible.

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
