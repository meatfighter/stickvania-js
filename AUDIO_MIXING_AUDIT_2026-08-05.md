# Audio Mixing Audit - 2026-08-05

## Scope

Audited the browser port in `C:\js-projects\stickvania-js`, the converted Stickvania game classes in `src\stickvania`, the Java original in `C:\NetBeansProjects\stickvania`, the TypeScript Slick2D port in `C:\js-projects\slick2d-ts`, and the Java Slick2D source in `C:\java-projects\slick2d\Slick`.

The user-visible report was that sound effects are too low. The likely area was any pathway that combines the PWA menu volume slider, Stickvania `Sound`/`Music` calls, and `slick2d-ts` Web Audio gains.

## Stickvania Project Pathways

### PWA menu volume

File: `src\main.ts`

Before this audit, `setAudioVolume(value)` did this:

```ts
volume = Math.max(0, Math.min(1, value));
SoundStore.get().setSoundVolume(volume);
SoundStore.get().setMusicVolume(volume);
```

The default menu volume is `0.6`, so the app set both Slick global volumes to `0.6`.

This was the project-side mixing bug. Slick's normal sound-effect route applies `soundVolume` twice, while music applies `musicVolume` once. Feeding the same scalar into both does not produce a neutral master volume.

Fixed in `src\main.ts`:

```ts
volume = Math.max(0, Math.min(1, value));
SoundStore.get().setSoundVolume(Math.sqrt(volume));
SoundStore.get().setMusicVolume(volume);
```

With that mapping, the final normal Stickvania effect gain is:

```text
perSoundVolume * sqrt(masterVolume) * sqrt(masterVolume)
= perSoundVolume * masterVolume
```

Music remains:

```text
perMusicVolume * masterVolume
```

At the default `0.6`, sound effects now land at `0.6` instead of `0.36`, while music stays at `0.6`.

### Stickvania sound effects

Java source: `C:\NetBeansProjects\stickvania\src\stickvania\Main.java`

TS port: `src\stickvania\Main.ts`

All Stickvania sound effects are constructed as `new Sound("soundfx/...ogg")`.

The game plays effects through:

```java
public void playSound(Sound sound) {
  if (mode == MODE_PLAYING || mode == MODE_DEMO
      || mode == MODE_TITLE_SCREEN) {
    sound.play();
  }
}
```

The TS port matches that structure:

```ts
public playSound(sound: Sound): void {
    if (this.mode == Main.MODE_PLAYING || this.mode == Main.MODE_DEMO
        || this.mode == Main.MODE_TITLE_SCREEN) {
        sound.play();
    }
}
```

Search result: the converted Stickvania game does not call `Sound.play(pitch, volume)`, `Sound.playAt(...)`, `Sound.loop(...)`, `SoundStore.playSound(...)`, `setSoundVolume(...)`, or `setMusicVolume(...)` from generated game logic. It only uses no-argument `Sound.play()` through `Main.playSound(...)`.

Therefore the PWA slider compensation is exact for all Stickvania sound-effect call sites.

### Stickvania music

Java source: `C:\NetBeansProjects\stickvania\src\stickvania\Song.java`

TS port: `src\stickvania\Song.ts`

Music is loaded as `new Music("music/...ogg")` or as `Song` objects containing `Music` intro/loop tracks.

The game starts music with no explicit per-track volume:

```java
music.play();
loop.loop();
intro.play();
```

The TS port follows the same pattern:

```ts
music.play();
this.loop.loop();
this.intro.play();
```

Search result: the converted Stickvania game does not call `Music.play(pitch, volume)`, `Music.loop(pitch, volume)`, or `Music.setVolume(...)`. All Stickvania music uses the default per-track volume `1`.

## slick2d-ts Sound-Effect Gain Path

Files:

- `C:\js-projects\slick2d-ts\src\slick\Sound.ts`
- `C:\js-projects\slick2d-ts\src\slick\openal\SoundStore.ts`

Normal `Sound.play()` in TS:

```ts
const effectiveVolume = volume * SoundStore.get().getSoundVolume();
const handle = SoundStore.get().playSound(this.ref, pitch, effectiveVolume, false, ...);
```

`SoundStore.playSound(...)` then assigns source gain as:

```ts
sourceGain = Math.max(0, volume * this.soundVolume);
gain.gain.value = sourceGain;
```

Final normal `Sound.play(1, V)` gain in `slick2d-ts`:

```text
V * soundVolume * soundVolume
```

This looks surprising, but it is Java Slick2D parity, not a `slick2d-ts` bug for Stickvania.

## Java Slick2D Sound-Effect Gain Path

Files:

- `C:\java-projects\slick2d\Slick\src\org\newdawn\slick\Sound.java`
- `C:\java-projects\slick2d\Slick\src\org\newdawn\slick\openal\SoundStore.java`
- `C:\java-projects\slick2d\Slick\src\org\newdawn\slick\openal\AudioImpl.java`

Java `Sound.play(float pitch, float volume)` passes:

```java
sound.playAsSoundEffect(pitch, volume * SoundStore.get().getSoundVolume(), false);
```

Java `AudioImpl.playAsSoundEffect(...)` passes that gain to `SoundStore.playAsSound(...)`.

Java `SoundStore.playAsSoundAt(...)` then does:

```java
gain *= soundVolume;
AL10.alSourcef(sources.get(nextSource), AL10.AL_GAIN, gain);
```

Final normal Java `Sound.play(1, V)` gain:

```text
V * soundVolume * soundVolume
```

The TS implementation matches this behavior, and `slick2d-ts` already documents/tests it:

- `C:\js-projects\slick2d-ts\docs\SLICK2D-PARITY-API.md` says `Sound` applies sound volume before `SoundStore.playSound(...)`, then `SoundStore.playSound(...)` applies sound volume again.
- `C:\js-projects\slick2d-ts\test\sound-store-parity.test.mjs` asserts that `setSoundVolume(0.5)` followed by `Sound.play(1, 1)` produces gain `0.25`.

## slick2d-ts Music Gain Path

Files:

- `C:\js-projects\slick2d-ts\src\slick\Music.ts`
- `C:\js-projects\slick2d-ts\src\slick\openal\SoundStore.ts`

TS `Music.play()` defaults to per-track volume `1` and calls `Music.start(...)`.

`Music.start(...)` calls:

```ts
this.setVolume(volume);
```

`Music.startSource(...)` creates a per-music gain node:

```ts
this.gain.gain.value = this.volume;
source.connect(this.gain);
this.gain.connect(bus);
```

The music bus gain is set by `SoundStore.setMusicVolume(...)`:

```ts
this.musicVolume = Math.max(0, Math.min(1, volume));
this.musicBus.gain.value = this.musicVolume;
```

Final normal `Music.play(1, V)` gain:

```text
V * musicVolume
```

For Stickvania's no-argument music calls, this is:

```text
1 * musicVolume
```

## Java Slick2D Music Gain Path

Files:

- `C:\java-projects\slick2d\Slick\src\org\newdawn\slick\Music.java`
- `C:\java-projects\slick2d\Slick\src\org\newdawn\slick\openal\SoundStore.java`

Java `Music.startMusic(...)` clamps the per-track volume, plays the audio as music, then calls:

```java
setVolume(volume);
```

Java `Music.setVolume(...)` calls:

```java
SoundStore.get().setCurrentMusicVolume(volume);
```

Java `SoundStore.setCurrentMusicVolume(...)` assigns:

```java
AL10.alSourcef(sources.get(0), AL10.AL_GAIN, lastCurrentMusicVolume * musicVolume);
```

Final normal Java `Music.play(1, V)` gain:

```text
V * musicVolume
```

The TS implementation is parity-accurate for the Stickvania music path.

## App Container and Lifecycle Notes

`slick2d-ts` `AppGameContainer.start()` does not reset music or sound volumes during normal startup. It calls `AL.create()`, then `game.init(this)`, then starts the RAF loop.

`AppGameContainer.reinit()` does reset both volumes to `1`, matching Java `GameContainer.initSystem()`. Stickvania's converted game does not call `reinit()`, so this is not part of the reported low-effects issue.

`AL.destroy()` / `SoundStore.destroy()` stops active audio, closes the browser `AudioContext`, clears buffers, and resets init flags. It does not reset `soundVolume` or `musicVolume`, so the menu slider value can persist across returning to the menu.

## Bugs Found

### Project bug: menu slider was not a neutral master volume

Status: fixed in `src\main.ts`.

Before:

```text
master slider = 0.6
soundVolume = 0.6
musicVolume = 0.6
normal effect gain = 1 * 0.6 * 0.6 = 0.36
normal music gain = 1 * 0.6 = 0.6
```

After:

```text
master slider = 0.6
soundVolume = sqrt(0.6) = 0.7745966692...
musicVolume = 0.6
normal effect gain = 1 * 0.7745966692... * 0.7745966692... = 0.6
normal music gain = 1 * 0.6 = 0.6
```

This restores the original effect/music relationship at any slider value while preserving the Java-to-TS Stickvania class and method mapping.

### slick2d-ts bugs relevant to Stickvania

None found in this pass.

The double sound-volume application in `slick2d-ts` is intentionally Java Slick2D parity and is documented/tested upstream. It should not be changed for Stickvania.

## Upstream slick2d-ts Feature Consideration

No required `slick2d-ts` patch was identified for Stickvania.

A future browser-only helper such as `SoundStore.setMasterVolume(...)` could make PWA host shells cleaner by applying one final gain after both the sound and music buses. That would avoid project-side square-root compensation. It is not required for this game because Stickvania does not call `SoundStore.playSound(...)` directly and does not use looping sound effects that need live master-volume changes after a source has started.

Because no required `slick2d-ts` bug or missing feature was found, no separate `slick2d-ts` fix-request markdown file was created.
