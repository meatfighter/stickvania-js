# Desktop Runtime Dependencies

This directory includes a conservative legacy Slick2D/LWJGL runtime set to improve the chance that the archived Java game can be built and launched on modern machines without upgrading Slick2D to a different rendering/audio stack.

## Java Jars

Bundled into the desktop ZIP from `desktop/lib/`:

| Target              | Source                           | Notes                                           |
| ------------------- | -------------------------------- | ----------------------------------------------- |
| `slick.jar`         | Legacy Slick2D/LWJGL runtime set | Slick2D jar paired with the desktop runtime.    |
| `lwjgl.jar`         | Legacy Slick2D/LWJGL runtime set | LWJGL 2.8.5-era jar with 64-bit native pairing. |
| `lwjgl_util.jar`    | Legacy Slick2D/LWJGL runtime set | LWJGL utility classes.                          |
| `jinput.jar`        | Legacy Slick2D/LWJGL runtime set | JInput jar paired with the LWJGL runtime set.   |
| `jogg-0.0.7.jar`    | Legacy Slick2D/LWJGL runtime set | OGG dependency.                                 |
| `jorbis-0.0.17.jar` | Legacy Slick2D/LWJGL runtime set | OGG dependency.                                 |

The source repository may retain legacy applet-only jars such as `lwjgl_util_applet.jar` and `natives-*.jar` for copied NetBeans metadata. Release tooling excludes those files from the downloadable desktop ZIP.

## Native Libraries

Bundled from the LWJGL 2.8.5 native runtime set. The OpenAL native libraries identify themselves as OpenAL Soft 1.14 in binary strings and are documented separately from the LWJGL BSD notice.

| Target                     | Contents                                                                                                                                 |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `desktop/natives/windows/` | `lwjgl.dll`, `lwjgl64.dll`, `OpenAL32.dll`, `OpenAL64.dll`, `jinput-dx8.dll`, `jinput-dx8_64.dll`, `jinput-raw.dll`, `jinput-raw_64.dll` |
| `desktop/natives/linux/`   | `liblwjgl.so`, `liblwjgl64.so`, `libopenal.so`, `libopenal64.so`, `libjinput-linux.so`, `libjinput-linux64.so`                           |
| `desktop/natives/macosx/`  | `liblwjgl.jnilib`, `libjinput-osx.jnilib`, `openal.dylib`                                                                                |

## Compatibility Notes

The original Stickvania project included `natives-win32.jar`, which is unlikely to run on a normal modern 64-bit Windows JVM. The copied runtime layout includes unpacked 64-bit Windows native libraries and launch scripts that set the native library paths explicitly.

The Windows launcher passes:

```text
-Dorg.lwjgl.librarypath=desktop\natives\windows
-Dnet.java.games.input.librarypath=desktop\natives\windows
-Djava.library.path=desktop\natives\windows
-Djinput.useDefaultPlugin=false
-Dnet.java.games.input.plugins=net.java.games.input.DirectAndRawInputEnvironmentPlugin
```

The launchers also add modern-JDK compatibility flags only when the installed JVM supports them. The macOS launcher additionally requests `-XstartOnFirstThread` when the JVM supports it, which is required by the LWJGL windowing stack on macOS. This dependency copy does not modernize Slick2D itself and does not upgrade the game code. It only vendors a better-matched legacy runtime set for desktop build work.

The desktop ZIP includes `licenses/` and `third-party-sources/`:

| Source artifact                               | Component covered                  | SHA-256                                                            |
| --------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------ |
| `jogg-0.0.7-jcraft-jorbis-28592f3-source.zip` | JCraft Jogg source material        | `0c814790741d14debc4a88214bdf8d0369a521a652e4d9a375b0cdfdbc21597a` |
| `jorbis-0.0.17-sources.jar`                   | `org.jcraft:jorbis:0.0.17` sources | `1643dd368b9c160276caf8d1f6a8c0aae43ca5bf49b53348a2a01623641708e5` |
| `openal-soft-1.14.tar.bz2`                    | OpenAL Soft 1.14 sources           | `87bd8d61d5943387898c92b6a2bbbb26118e745dec57550c817526a70fad0914` |

If a bundled jar or native library changes, update `desktop/licenses/README.md`, the source artifacts above, and the root `THIRD_PARTY_NOTICES.md` before publishing a new release.
