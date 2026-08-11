# slick2d-ts Dark Mode Renderer Handoff

Date: 2026-08-11

## Goal

Add a proper renderer-supported dark/inverted display mode to `C:\js-projects\slick2d-ts` for the Stickvania PWA.

This is needed because the current Stickvania experiment uses CSS:

```css
.game-host canvas {
    filter: invert(1);
}
```

That inverts the final canvas after every draw call. It makes the game art look good, but it also inverts Stickvania's black fade overlays into white fade overlays. The correct behavior for the PWA dark mode is:

- Game/title/menu art can render inverted: black line art on white becomes white line art on black.
- Fade overlays must still fade to black.
- Alpha must not be inverted.
- This should be controlled by the Stickvania PWA menu with a light/dark switch and persisted in local storage.

## Scope

Only implement slick2d-ts support needed by Stickvania.

Do not attempt to implement a general Slick2D Java parity feature. This should be documented as a browser/PWA extension because Java Slick2D does not have this exact API.

This extension is intended for ordinary image, font, and solid primitive draws. It is not expected to exactly match a final CSS postprocess for every possible WebGL blend mode. Stickvania does not currently use special draw modes for gameplay rendering, so shader-side per-draw inversion is acceptable for this project.

## Current Relevant Files

In `C:\js-projects\slick2d-ts`:

- `src\slick\rendering\WebGLRenderer.ts`
- `src\slick\rendering\RenderBackend.ts`
- `src\slick\Graphics.ts`
- `src\slick\opengl\renderer\Renderer.ts`
- Existing docs such as `docs\SLICK2D-PARITY-API.md` and `docs\IMPLEMENTATION-AUDIT.md`

In `C:\js-projects\stickvania-js`:

- `pwa\src\styles.css`
- `pwa\src\main.ts`
- `pwa\src\stickvania\Main.ts`
- `PWA_PARITY_DEVIATIONS.md`

## Current slick2d-ts Renderer Shape

`WebGLRenderer.ts` uses two internal shader programs:

- `SOLID_FRAGMENT` for solid primitives such as `Graphics.fillRect`.
- `TEXTURE_FRAGMENT` for images, sprites, fonts, and texture draws.

Current solid fragment shader:

```glsl
precision mediump float;
uniform vec4 u_color;
in vec4 v_color;
out vec4 outColor;
void main() {
    outColor = v_color * u_color;
}
```

Current texture fragment shader:

```glsl
precision mediump float;
uniform sampler2D u_texture;
uniform vec4 u_color;
uniform float u_flash;
in vec2 v_texCoord;
in vec4 v_color;
out vec4 outColor;
void main() {
    vec4 texel = texture(u_texture, v_texCoord);
    if (u_flash > 0.5) {
        outColor = vec4(v_color.rgb * u_color.rgb, texel.a * v_color.a * u_color.a);
    } else {
        outColor = texel * v_color * u_color;
    }
}
```

Texture rendering batches quads in `queueTextureQuad(...)` and flushes them in `flushTextureBatch()`. The batch is currently split when either the texture object or `flash` mode changes:

```ts
if (this.textureBatchTexture !== null && (this.textureBatchTexture !== texture || this.textureBatchFlash !== flash)) {
    this.flushTextureBatch();
}
```

Solid rendering goes through `submitSolidVertices(...)`, which already flushes pending texture batches before drawing.

## Recommended slick2d-ts API

Add a small stateful color inversion API to the renderer backend and expose it through `Graphics`.

Preferred API:

```ts
// RenderBackend.ts
setColorInverted(inverted: boolean): void;
isColorInverted(): boolean;

// Graphics.ts
public setColorInverted(inverted: boolean): void;
public isColorInverted(): boolean;
```

Naming is intentionally explicit: this is a per-draw color transform, not fullscreen, not CSS, and not a browser theme.

Alternative lower-level API:

```ts
Renderer.getBackend().setColorInverted(true);
```

Prefer the `Graphics` facade because Stickvania already receives `Graphics g` in render methods, and this keeps app code out of the internal `Renderer.getBackend()` path.

## Required Renderer Behavior

Add private state to `WebGLRenderer`:

```ts
private colorInverted = false;
private textureBatchInverted = false;
```

Implement:

```ts
public setColorInverted(inverted: boolean): void {
    if (this.colorInverted === inverted) {
        return;
    }
    this.flushTextureBatch();
    this.colorInverted = inverted;
}

public isColorInverted(): boolean {
    return this.colorInverted;
}
```

Important details:

- Flush the texture batch before changing the state.
- The state affects subsequent draw calls only.
- Treat this as sharp renderer state. It must be reset at a safe boundary and Stickvania must bracket it with `try`/`finally`.
- It must apply to both solid primitives and textures.
- It must preserve alpha.
- It must work with image tinting, corner colors, font rendering, and flash rendering.
- It must not change the clear color used by `beginFrame(...)` unless explicitly drawing an inverted primitive afterward.

## Shader Changes

Add a `uniform float u_invert;` to both fragment shaders.

For solid rendering:

```glsl
vec4 color = v_color * u_color;
if (u_invert > 0.5) {
    color.rgb = 1.0 - color.rgb;
}
outColor = color;
```

For texture rendering:

```glsl
vec4 texel = texture(u_texture, v_texCoord);
vec4 color;
if (u_flash > 0.5) {
    color = vec4(v_color.rgb * u_color.rgb, texel.a * v_color.a * u_color.a);
} else {
    color = texel * v_color * u_color;
}
if (u_invert > 0.5) {
    color.rgb = 1.0 - color.rgb;
}
outColor = color;
```

Do not invert `color.a`.

## Texture Batch Changes

When queueing texture quads, the batch must also split on the current invert state.

Update the batch split condition conceptually to:

```ts
if (
    this.textureBatchTexture !== null
    && (
        this.textureBatchTexture !== texture
        || this.textureBatchFlash !== flash
        || this.textureBatchInverted !== this.colorInverted
    )
) {
    this.flushTextureBatch();
}
```

After assigning `textureBatchTexture` and `textureBatchFlash`, assign:

```ts
this.textureBatchInverted = this.colorInverted;
```

In `flushTextureBatch()`, set `u_invert` from `textureBatchInverted`, not from the current mutable `colorInverted`, because queued vertices may have been collected under a prior state.

After flushing, reset:

```ts
this.textureBatchInverted = false;
```

## Solid Draw Changes

In `submitSolidVertices(...)`, after setting `u_color`, also set `u_invert` from `this.colorInverted`.

Solid draws already flush textures first, so they do not need a solid batch split.

## Reset/Context Behavior

Reset inversion to false when the renderer is initialized/disposed/restored unless the existing renderer conventions indicate state should survive. Stickvania should explicitly set the desired state during render, so false is the safest baseline.

Check these methods:

- `initialize(...)`
- `beginFrame(...)`
- `handleContextLost()`
- `handleContextRestored()`
- `dispose()`

Reset `colorInverted` to false in `beginFrame(...)`. `WebGLRenderer` is effectively global through `Renderer.getBackend()`, so carrying this state across frames makes mistakes too easy to leak into fades, loading/menu modes, or the next game render.

Preferred behavior:

- Reset in `beginFrame(...)`, `initialize(...)`, `dispose()`, and context loss/restoration paths.
- Stickvania must set the desired inversion during each `render(...)`.
- Stickvania must always restore inversion to false with `try`/`finally`.
- Do not reset in the middle of a frame except through explicit `setColorInverted(false)` calls made by app code.

## Stickvania Integration After slick2d-ts Is Updated

Remove the CSS experiment from `pwa\src\styles.css`:

```css
.game-host canvas {
    filter: invert(1);
}
```

Add a persisted light/dark switch to the PWA menu in `pwa\src\main.ts`.

Suggested storage:

```ts
const DISPLAY_MODE_STORAGE_KEY = "stickvania-display-mode";
type DisplayMode = "light" | "dark";
```

Default should be `"light"` unless the user explicitly requests dark by default.

Add a setter on `Main` or equivalent PWA state:

```ts
public darkDisplayMode: boolean = false;
```

Then in `Main.render(...)`, apply inversion only around the art/menu scene, and disable it before the true fade overlay.

Current final fade overlay in `Main.ts`:

```ts
if (this.fadeState != Main.FADE_DONE) {
    g.setColor(this.fades[this.fade]);
    g.fillRect(64, 32, 512, 416);
}
```

Desired structure:

```ts
try {
    g.setColorInverted(this.darkDisplayMode);
    // existing scene/title/menu render logic
} finally {
    g.setColorInverted(false);
}

if (this.fadeState != Main.FADE_DONE) {
    g.setColorInverted(false);
    g.setColor(this.fades[this.fade]);
    g.fillRect(64, 32, 512, 416);
}
```

Be careful: `Main.ts` has several mode-specific full-screen rectangles. Do not blindly disable inversion for every `fillRect(64, 32, 512, 416)`. Some are white scene backgrounds and should invert to black in dark mode.

The confirmed true fade-to-black overlay is the draw that uses `this.fades[this.fade]` at the end of `Main.render(...)`:

```text
this.fades
fadeState
```

Only intended fade-to-black overlays must draw with inversion off.

Because CSS inversion currently affects the entire final canvas, and renderer inversion affects only draw calls, the clear color may differ after this change. Stickvania uses `setClearEachFrame(true)` in the PWA bootstrap, so manually validate title, loading, gameplay, map, and menu screens for untouched margins or regions.

## Performance Notes

This approach should be performant for Stickvania.

It does not add a full-screen framebuffer postprocess pass. It adds one shader uniform and one cheap RGB transform inside the existing solid and texture shaders:

```glsl
color.rgb = 1.0 - color.rgb;
```

The main performance concern is texture batching. Keep inversion coarse:

- On for the normal scene/title/menu draw section.
- Off for the final fade overlay.
- Avoid toggling around individual sprites, text draws, or small UI elements.

With that usage, the expected cost is at most a small number of extra texture flushes per frame, and often only around fade rendering.

## PWA Menu Switch

Add a simple binary switch on the launch menu near volume:

- Label: `Display`
- Choices: `Light` and `Dark`

It should:

- Use the existing black-and-white PWA menu style.
- Persist immediately to localStorage when changed.
- Apply to New Game and Continue.
- Not require a resource reload.
- Not affect audio, game state serialization, input mappings, or difficulty.

If the game is already running and the user opens the hamburger/PWA menu, changing the switch should affect the next New Game or Continue. Live in-game toggling is optional, but it is fine if naturally supported by passing the setting into the active `Main` instance.

## Tests to Add in slick2d-ts

Add focused renderer tests if the current test harness can cover WebGL fakes. At minimum cover:

1. `setColorInverted(true)` changes the uniform sent to the solid shader.
2. `setColorInverted(true)` changes the uniform sent to the texture shader.
3. Alpha is preserved by shader logic.
4. Texture batches flush/split when inversion changes.
5. Texture batches use the queued inversion state, not a later mutable state.
6. `setColorInverted(false)` restores normal drawing.
7. `beginFrame(...)` resets the renderer to non-inverted state.
8. Context restore/dispose leaves the renderer in a clean non-inverted state.

If shader execution cannot be tested directly in Node, test the WebGL calls. These fake WebGL tests are still useful, but they do not fully prove shader output or alpha behavior; browser validation is required.

- `getUniformLocation(..., "u_invert")`
- `uniform1f(..., 1)` when inverted
- `uniform1f(..., 0)` when normal
- draw-call separation when toggling inversion between two image draws

## Validation

Run in `C:\js-projects\slick2d-ts`:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test
```

Then in `C:\js-projects\stickvania-js`:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build:pwa
```

Manual browser validation:

- Launch PWA in light mode; confirm original black-on-white look.
- Launch PWA in dark mode; confirm white art on black background.
- Trigger title/gameplay fades; confirm fades go to black, not white.
- Open hamburger menu and return; confirm display mode persists.
- Refresh the browser; confirm display mode persists.
- Continue a saved game; confirm display mode applies and game state still restores.

## Documentation Updates

In `C:\js-projects\slick2d-ts`, update docs to say this is a browser extension:

- `docs\SLICK2D-PARITY-API.md`
- `docs\IMPLEMENTATION-AUDIT.md`

In `C:\js-projects\stickvania-js`, update:

- `PWA_PARITY_DEVIATIONS.md`

Record that dark display mode is an intentional PWA-only deviation from the Java game.

## Acceptance Criteria

The work is complete when:

- No CSS `filter: invert(...)` remains in Stickvania.
- Inversion is implemented inside slick2d-ts WebGL rendering.
- Both texture and solid primitive draws can be inverted.
- Fade overlays can opt out and still draw black.
- The Stickvania PWA menu exposes a persisted Light/Dark switch.
- Typecheck, lint, tests, and PWA build pass.
- The change is documented as an intentional PWA/browser extension, not Java Slick2D parity.
