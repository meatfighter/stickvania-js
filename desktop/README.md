# Stickvania Legacy Java Source

This directory is an archival copy of the original Java Stickvania project.

Copied into this repository:

- `src/`
- `build.xml`
- `manifest.mf`
- `nbproject/`, except machine-local `nbproject/private/`

Also included:

- `pom.xml`
- `assembly.xml`
- `lib/`
- `natives/`
- native-path launch scripts

Intentionally not copied:

- generated `build/`
- generated `dist/`
- machine-local `nbproject/private/`
- crash logs

The project has a conservative Maven build plus a local Node fallback build. The Java source layout remains legacy-style: Java files and resources both live under `src/`, matching the original NetBeans project.

The desktop build emits Java 8-compatible bytecode to improve the odds of running the legacy Slick2D/LWJGL stack across older and newer Java installations. Modern compiler warnings about obsolete targets are suppressed, but real compilation errors still fail the build.

Build from the repository root:

```text
npm.cmd run build:desktop
```

If Maven is installed on Windows or available in WSL2, the Node build helper will prefer Maven. This should also be buildable directly from this directory:

```text
mvn package
```

Launch after building on Windows:

```text
npm.cmd run run:desktop
```

See `RUNTIME_DEPENDENCIES.md` for the vendored legacy Slick2D/LWJGL jars and native libraries copied in to improve future desktop compatibility.
