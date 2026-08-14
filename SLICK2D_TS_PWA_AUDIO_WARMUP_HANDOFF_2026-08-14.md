# Slick2D-ts PWA Audio Warmup Handoff

Date: 2026-08-14

Consumer project: `C:\js-projects\stickvania-js`

Engine project to patch: `C:\js-projects\slick2d-ts`

## Goal

Stickvania's PWA should show its launcher menu as quickly as possible, then prepare game resources in the background while the user is on the menu.

The Java-style in-game `LOADING ##` countdown is no longer desired for the PWA. Instead:

- The menu should appear quickly.
- Raw resource downloads should happen in the background.
- Audio decode/preparation should also be attempted in the background.
- Browser audio playback/unlock should still happen from the Start/Continue click.
- If the user clicks before background preparation finishes, Stickvania can show its existing PWA loading/error UI until preparation catches up.

Slick2D-ts already has most of the low-level machinery, but a few small browser-extension APIs would make this much cleaner and safer for Stickvania and future PWA ports.

## Why Slick2D-ts Changes Would Help

Current useful behavior:

- `ResourceLoader.loadResource(ref)` fetches and caches bytes.
- `ResourceLoader.preloadResources(refs, onProgress?)` preloads bytes with progress.
- `ResourceLoader.track(promise, label)` and `ResourceLoader.waitForAll()` track async resource/decode preparation.
- `SoundStore.loadAudioBuffer(ref)` fetches bytes and calls `AudioContext.decodeAudioData(...)`.
- `SoundStore.preloadAudioBuffer(ref)` tracks one decoded audio buffer through `ResourceLoader`.
- `Music` and `Sound` constructors call `SoundStore.preloadAudioBuffer(ref)` for their refs.
- `AppGameContainer.start()` calls `await ResourceLoader.waitForAll()` after `game.init(...)`.

Current friction:

- There is no bulk audio warmup API. A consumer has to either construct temporary `Music`/`Sound` objects or manually call `SoundStore.preloadAudioBuffer(ref)` for every audio ref.
- `SoundStore.clear()` stops playback and clears decoded audio buffers.
- `SoundStore.destroy()` calls `clear()` and closes the `AudioContext`.
- `AL.destroy()` calls `SoundStore.get().destroy()`.
- `AppGameContainer.destroy()` calls `AL.destroy()`.

That lifecycle means a PWA can decode audio in the menu, then accidentally throw away the decoded cache when starting/destroying/restarting a game container.

## Browser Audio Policy Assumption

Modern browsers generally block audible playback or a running `AudioContext` until user activation. They do not generally block `decodeAudioData(...)` itself.

So Stickvania wants to:

- decode audio opportunistically before user interaction;
- call `SoundStore.get().unlock()` directly from the Start/Continue click before awaits;
- rely on cached decoded buffers once gameplay starts.

The Slick2D-ts API should support this pattern without requiring fake playback or game-specific workarounds.

## Requested Feature 1: Bulk Audio Preload/Decode

Add a browser-extension helper to `SoundStore`.

Suggested shape:

```ts
export type AudioPreloadProgress = {
    ref: string;
    loaded: number;
    total: number;
};

public preloadAudioBuffers(
    refs: Iterable<string>,
    onProgress?: (progress: AudioPreloadProgress) => void
): Promise<void>;
```

Expected behavior:

- Deduplicate refs.
- For each ref, call existing `preloadAudioBuffer(ref)`.
- Report progress when each ref completes.
- Resolve when all requested refs are decoded.
- Reject if any ref fails, using existing `SlickException` style.
- Reuse existing decoded/in-flight buffer promises from `SoundStore.buffers`.
- Keep using `ResourceLoader.track(...)` so `ResourceLoader.waitForAll()` remains authoritative.

This should be documented as a browser/PWA extension, not a Java Slick2D parity API.

Potential optional addition:

```ts
public preloadAudioBuffers(
    refs: Iterable<string>,
    options?: {
        concurrency?: number;
        onProgress?: (progress: AudioPreloadProgress) => void;
    }
): Promise<void>;
```

Concurrency is nice but not required for Stickvania. A simple `Promise.all(...)` implementation is acceptable initially because browsers already manage decode scheduling.

## Requested Feature 2: Preserve Decoded Audio Across Container Destroy

Add a way for browser consumers to destroy an `AppGameContainer` without clearing decoded audio buffers or closing the shared `AudioContext`.

Suggested container API:

```ts
public setPreserveAudioCacheOnDestroy(preserve: boolean): void;
public isPreservingAudioCacheOnDestroy(): boolean;
```

Default must be `false` to preserve current behavior for existing consumers.

When `preserveAudioCacheOnDestroy` is `true`, `AppGameContainer.destroy()` should:

- stop active playback;
- clear active handle/source bookkeeping;
- unbind input and dispose rendering as it already does;
- destroy/reset Display state as it already does;
- not clear `SoundStore.buffers`;
- not close the existing `AudioContext`;
- leave the decoded audio cache available for later `Music`/`Sound` construction and playback.

This may require a lower-level audio lifecycle split in `SoundStore` and `AL`.

## Requested Feature 3: Split SoundStore Cleanup Levels

Right now `SoundStore.clear()` does too much for PWA warmup because it both stops playback and clears decoded buffers.

Suggested API split:

```ts
public stopAllPlayback(): void;
public clearDecodedBuffers(): void;
public resetPlaybackState(): void;
```

Expected behavior:

- `stopAllPlayback()` stops all active handles and clears active handle sets.
- `resetPlaybackState()` clears source-slot bookkeeping without clearing decoded buffers.
- `clearDecodedBuffers()` clears `buffers`.
- Existing `clear()` can continue to call `stopAllPlayback()`, `clearDecodedBuffers()`, and `resetPlaybackState()` to preserve current behavior.
- Existing `destroy()` can continue to do full cleanup by default.

Then `AppGameContainer.destroy()` can choose:

- normal path: current full `AL.destroy()` behavior;
- preserve-audio-cache path: stop playback/reset source bookkeeping while leaving context and decoded buffers alive.

Implementation detail to think through:

- `AL.isCreated()` should probably become `false` after a container is destroyed, even if `SoundStore` keeps a suspended/running context and decoded buffers for reuse.
- A later `AL.create()` should call `SoundStore.init()` and reuse the existing context/buffers.

## Requested Feature 4: Optional Audio Cache Introspection

Not required, but useful for tests and PWA decisions:

```ts
public hasAudioBuffer(ref: string): boolean;
public getAudioBufferState(ref: string): "missing" | "pending" | "ready";
```

This would let a PWA know whether audio warmup is complete without reaching into private fields.

If this feels too broad, skip it. Stickvania can rely on the warmup promise.

## Requested Feature 5: Optional Resource/Decode Progress Snapshot

Not required for the first Stickvania integration.

Current `ResourceLoader.getPendingCount()` is useful but not enough to render a true progress bar for decode tasks because there is no total count. A future helper could expose tracked group progress.

Possible shape:

```ts
const group = ResourceLoader.createTrackedGroup("stickvania audio");
group.track(promise, ref);
group.getProgress();
await group.wait();
```

This is optional. Do not block the main audio warmup work on this.

## Things Not Requested

Do not add game-specific Stickvania logic to Slick2D-ts.

Do not add menu, PWA, or service-worker behavior to Slick2D-ts.

Do not change Java-style `Music` or `Sound` constructor semantics unless required internally.

Do not make the default `AppGameContainer.destroy()` preserve audio cache. Existing behavior should remain default.

Do not implement hidden game/container warmup yet. Stickvania's first target is audio/resource warmup, not a hidden RAF/rendering lifecycle.

## Stickvania Usage After These Changes

Stickvania would likely do this after showing the PWA menu:

```ts
const { ResourceLoader, SoundStore } = await import("slick2d-ts");

await ResourceLoader.preloadResources(STICKVANIA_RESOURCE_REFS, onProgress);
await SoundStore.get().preloadAudioBuffers(STICKVANIA_AUDIO_REFS, onAudioProgress);
```

Then on Start/Continue click:

```ts
void SoundStore.get().unlock();
await backgroundPreparationPromise;

const appContainer = new AppGameContainer(...);
appContainer.setPreserveAudioCacheOnDestroy(true);
await appContainer.start();
```

The exact Stickvania code will differ, but these are the engine capabilities it needs.

## Validation Expectations In Slick2D-ts

Run:

```text
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
```

Add tests covering:

- `SoundStore.preloadAudioBuffers(...)` deduplicates refs.
- Bulk preload resolves only after all requested decodes resolve.
- Bulk preload reports progress.
- Bulk preload rejects and records tracked failures on decode/load failure.
- Repeated preload calls reuse in-flight/cached audio buffer promises.
- `SoundStore.stopAllPlayback()` stops handles but does not clear decoded buffers.
- Existing `SoundStore.clear()` still clears decoded buffers.
- Existing `SoundStore.destroy()` still closes the context and clears buffers by default.
- `AppGameContainer.destroy()` keeps current behavior by default.
- `AppGameContainer.setPreserveAudioCacheOnDestroy(true)` stops playback/disposes the container but preserves decoded buffer promises and the reusable audio context.

The fake Web Audio test harness can verify decode-call counts and context close calls. A browser smoke test should verify that:

- background decode can run before Start;
- Start/Continue calls `unlock()` from the click path;
- playback works from warmed decoded buffers afterward.

## Stickvania Acceptance Criteria

After Slick2D-ts exposes these capabilities, Stickvania should be able to:

- show the PWA menu before heavy game/resource preparation completes;
- warm audio in the background while the menu is visible;
- remove the Java-style `LOADING ##` countdown from the PWA path;
- show a PWA loading/error screen only if the user clicks Start/Continue before background preparation finishes;
- preserve decoded audio across returning to the PWA menu and starting again in the same page session.

