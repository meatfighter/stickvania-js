# Stickvania Java Reference Implementation

This directory contains the maintained Java/Slick2D reference implementation of Stickvania. The Java gameplay code is the behavioral and structural reference for the TypeScript browser port and is also built into the downloadable desktop distribution.

The source and resources remain under `desktop/src` in a layout close to the original game. Obsolete project/IDE build metadata is intentionally not retained in the maintained tree; Git history preserves it, while current builds use one supported JDK-based path.

## Build

Use JDK 21 LTS for current development and release validation. The build requires `javac` and `jar` on `PATH` and emits Java 8-compatible bytecode for the legacy Slick2D/LWJGL runtime.

From the repository root:

```sh
npm run build:desktop
```

On Windows, `npm.cmd run build:desktop` is equivalent. The repository build script owns the compile classpath, exact vendored-runtime verification, resource copying, manifest generation, runtime/native packaging, license/corresponding-source checks, and final ZIP construction.

Public desktop releases should be produced through the root release tooling so the desktop artifact is verified together with the PWA and release candidate.

## Run

From the repository root:

```sh
npm run run:desktop
```

The generated distribution contains the platform launchers and the vendored runtime/native files they require. See `RUNTIME_DEPENDENCIES.md` for the runtime contract and provenance details.
