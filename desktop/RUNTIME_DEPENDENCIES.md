# Desktop Runtime Dependencies

This directory includes a conservative legacy Slick2D/LWJGL runtime set to improve the chance that the archived Java game can be built and launched on modern machines without upgrading Slick2D to a different rendering/audio stack.

## Java Jars

Copied into `desktop/lib/`:

| Target                  | Source                                      | Notes                                                                                              |
| ----------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `slick.jar`             | Legacy Slick2D/LWJGL runtime set            | Slick2D jar paired with the desktop runtime.                                                       |
| `lwjgl.jar`             | Legacy Slick2D/LWJGL runtime set            | LWJGL 2.8.5-era jar with 64-bit native pairing.                                                    |
| `lwjgl_util.jar`        | Legacy Slick2D/LWJGL runtime set            | LWJGL utility classes.                                                                             |
| `jinput.jar`            | Legacy Slick2D/LWJGL runtime set            | JInput jar paired with the LWJGL runtime set.                                                      |
| `jogg-0.0.7.jar`        | Legacy Slick2D/LWJGL runtime set            | OGG dependency.                                                                                    |
| `jorbis-0.0.17.jar`     | Legacy Slick2D/LWJGL runtime set            | OGG dependency.                                                                                    |
| `lwjgl_util_applet.jar` | Original Stickvania Java project dependency | Preserved for the copied NetBeans/app Applet metadata; not required by the desktop Maven launcher. |
| `natives-*.jar`         | Original Stickvania Java project dependency | Preserved for legacy project completeness; the desktop launcher uses unpacked natives instead.     |

## Native Libraries

Copied from the working Ms. Pac-Man desktop archive runtime layout:

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

The launchers also add modern-JDK compatibility flags only when the installed JVM supports them. This dependency copy does not modernize Slick2D itself and does not upgrade the game code. It only vendors a better-matched legacy runtime set for desktop build work.
