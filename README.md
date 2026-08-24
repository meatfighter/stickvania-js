## Development

The repository contains two maintained forms of the game:

- A TypeScript browser version in `pwa/`, built as a Progressive Web App (PWA).
- A buildable archival Java desktop version in `desktop/`.

The browser version depends on the public `slick2d-ts` package and is the primary public release target. The Java desktop tree remains buildable for archival use, parity checks, and downloadable desktop builds.

### Repository Structure

- `about/` - Source template for the public-root about page. Production builds render this to `dist/index.html`.
- `desktop/` - Legacy Java Stickvania source, resources, runtime jars, native libraries, Maven build files, and launcher scripts.
- `pwa/` - TypeScript browser source. Vite builds this to `dist/pwa/`.
- `pwa/public/` - Browser static assets, manifest, service worker source, images, audio, and game resources.
- `pwa/src/` - TypeScript game port and browser shell code.
- `scripts/` - Build, verification, release-stamping, desktop packaging, and release helper scripts.
- `releases/` - Local staging folder for desktop release ZIPs. Generated ZIPs are ignored.
- `dist/` - Generated production output. This is the deployable public web folder and is ignored.
- `.release-components/` - Temporary component-build and production-candidate output. This is ignored.
- `version.json` - Public version and build stamp metadata used by the browser version, service worker, about page, and release filenames.
- `THIRD_PARTY_NOTICES.md` - Third-party notices for redistributed code and assets.

### Requirements

- Node.js and npm.
- Git.
- Java for desktop builds.
- Maven is optional. If Maven is available on Windows or in WSL2, `build:desktop` will prefer it; otherwise the Node build helper uses a local `javac` fallback.

On Windows, the examples below use `npm.cmd`. On non-Windows shells, use `npm` for the same scripts.

Install dependencies:

```text
npm.cmd ci
```

The browser version uses:

- TypeScript
- Vite
- ESLint
- Prettier
- `slick2d-ts` from the public GitHub repository

### Common Commands

Start the browser development server:

```text
npm.cmd run dev
```

Run type checking:

```text
npm.cmd run typecheck
```

Run lint:

```text
npm.cmd run lint
```

Check formatting:

```text
npm.cmd run format:check
```

Apply formatting:

```text
npm.cmd run format
```

Run the main verification suite:

```text
npm.cmd run verify
```

`verify` runs formatting checks, lint, release-tooling checks, browser release tests, and the desktop build.

### Building

Build only the browser release bundle:

```text
npm.cmd run build:pwa
```

Build only the public-root about page:

```text
npm.cmd run build:about
```

Build the about page and browser version together into a temporary component output:

```text
npm.cmd run build:web
```

Build the Java desktop jar and ZIP:

```text
npm.cmd run build:desktop
```

Build the full production release:

```text
npm.cmd run release
```

The full production release runs the verification suite, runs a high-severity dependency audit, creates a verified candidate under `.release-components/production-candidate`, verifies the browser and desktop release artifacts, then promotes the candidate to `dist/`. If the build fails before promotion, the existing `dist/` is preserved.

### Production Output

After `npm.cmd run release`, `dist/` is the deployable web folder:

- `dist/index.html` - Public about page with the Play link and desktop download link.
- `dist/pwa/` - Playable browser version.
- `dist/downloads/stickvania-desktop.zip` - Stable desktop ZIP download.
- `dist/downloads/stickvania-desktop-<version>.zip` - Versioned desktop ZIP download.
- `dist/assets/` - About-page images and icons.

The public URL does not need to include `/pwa/`; users can land on the about page at the deployed root and choose **Play**.

Preview the generated browser version:

```text
npm.cmd run preview:pwa
```

Preview the generated `dist/` folder:

```text
npm.cmd run preview:dist
```

### Release Mechanics

Release builds temporarily update `version.json` with a fresh `buildStamp`, run the requested build or verification scripts, then restore the original file bytes. The version stays stable in source control while generated artifacts receive cache-busting version metadata.

Important release details:

- `build:pwa`, `build:about`, `build:web`, and `test:pwa-release` build into `.release-components/` by default, not `dist/`.
- `npm.cmd run release` is the production path that verifies, audits dependencies, and atomically promotes a verified candidate to `dist/`.
- `npm.cmd run build` is the lower-level production build step used by `release` after verification and dependency auditing.
- Production release promotion requires a clean Git working tree after any interrupted promotion has been recovered.
- The service worker embeds its own version and precache list during the build.
- Browser storage keys are scoped by deployed path so multiple deployments do not collide.
- Desktop ZIPs are verified for expected entries, stable/versioned byte identity, launcher permissions, and accidental outer manifest entries.
- The Unix launcher scripts inside the desktop ZIP are written with executable mode bits.

Do not use internal underscore scripts directly for normal work. Scripts such as `_build:pwa:release`, `_build:about`, `_assemble`, and `_verify:pwa-release` are building blocks used by the public scripts.

### Desktop Releases

Build and locally stage the desktop release ZIP:

```text
npm.cmd run release:desktop
```

This runs the verification suite and copies `desktop/target/stickvania-desktop-<version>.zip` into `releases/`.

Launch the built desktop version on Windows:

```text
npm.cmd run run:desktop
```

More desktop-specific notes are in `desktop/README.md` and `desktop/RUNTIME_DEPENDENCIES.md`.

### Generated and Ignored Files

These directories are generated or local-only and should not be committed:

- `dist/`
- `.release-components/`
- `.release-secrets/`
- `.release-candidates/`
- `.dist-pending-*/`
- `.dist-previous-*/`
- `.dist-active-before-*/`
- `desktop/target/`
- Generated ZIPs, logs, and temporary files under `releases/`

Use `npm.cmd run clean` to remove and recreate `dist/`.

### Notes for New Contributors

The TypeScript browser version intentionally stays structurally close to the Java version, with one class per file where practical. Some browser behavior intentionally differs from the Java original to support a modern web release, including the browser menu, saved-state continuation, path-scoped storage, fullscreen and focus handling, dark display mode, and optional gamepad rumble.

Keep source edits focused and run at least:

```text
npm.cmd run verify
```

Before a public release, also run:

```text
npm.cmd run release
```

Then inspect the generated `dist/` bundle in a browser.

## License

Project code is licensed under GPL-3.0-or-later unless a file says otherwise. Third-party notices are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
