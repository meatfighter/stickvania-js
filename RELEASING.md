# Releasing

Releases are built and qualified locally from a clean Git checkout.

## Prerequisites

You need:

- a Node.js version supported by [package.json](package.json)
- Git
- JDK 21 for the Java desktop build
- the Playwright browsers used by the browser qualification scripts

Install the project dependencies from the lockfile:

```sh
npm ci
```

## 1. Start from a clean commit

Before building a release, make sure all intended changes are committed:

```sh
git status --short
```

The command should produce no output. The release scripts refuse to create a production release from a dirty checkout.

## 2. Build and qualify the release

Run:

```sh
npm run qualify
```

This runs the repository checks, dependency audit, production build, standard browser verification, offline verification, and clean-tree checks. If it succeeds, the complete deployable release is in `dist/`.

If you make any source change after qualification, commit it and run `npm run qualify` again.

## 3. Run extended browser qualification when needed

For changes involving the PWA, audio, input, lifecycle handling, fullscreen behavior, persistence, rumble, or other browser-sensitive code, also run:

```sh
npm run qualify:browsers
```

This command first builds a fresh temporary PWA and then runs the extended browser suite against `.release-components/pwa/pwa`. It does not replace the complete release in `dist/`.

For changes that depend on real browser or device behavior, test the staged release on the relevant hardware as well. Automated browser tests are not a substitute for real-device testing.

## 4. Preview the release

Preview the exact contents of `dist/`:

```sh
npm run preview:dist
```

Check the parts affected by the release, including the About page, browser game, saved-game behavior, input and rumble behavior, and Java desktop package when applicable.

## 5. Deploy

Deploy the **contents of `dist/`** as a unit. For browser-facing changes, deploy those files to the stage site first and perform a final smoke test there.

Once the staged build is accepted, deploy the same `dist/` contents to production. Do not rebuild between stage acceptance and production deployment. If anything changes, qualify the new commit and stage it again.

## Optional: archive a release

To keep a copy of a qualified release outside the repository, run:

```sh
node scripts/archive-release.mjs dist /absolute/path/outside/repository/release-artifacts
```

Use a new output directory for each archived release and keep the previous known-good release available for rollback.
