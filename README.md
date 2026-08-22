# Stickvania

## About

*Stickvania* is a stick-figure demake of Konami's original *Castlevania* for the Nintendo Entertainment System. The game reduces the castle, enemies, objects, and Simon Belmont himself to simple line drawings that look like they were scribbled with a Sharpie.

Press the **Play** button below to launch *Stickvania*.

**[Play](WEB_PLAY_URL)**

## Controls

*Stickvania* supports both keyboard and gamepad input. The default controls are:

| Action | Keyboard | Gamepad |
| --- | --- | --- |
| Up | Up Arrow | D-Pad Up |
| Down | Down Arrow | D-Pad Down |
| Left | Left Arrow | D-Pad Left |
| Right | Right Arrow | D-Pad Right |
| Jump | X | A |
| Attack | Z | X |

You can change the button mapping by selecting **Options → Input** from the in-game menu.

*Stickvania* reserves two keyboard controls that you cannot remap:

| Key | Action |
| --- | --- |
| Space | Toggle fullscreen |
| Esc | Exit fullscreen |

### Browser Menu

*Stickvania* opens with a browser menu that provides **New Game** and **Continue** buttons.

**New Game** starts a new game. **Continue** resumes your previous game. *Stickvania* saves your progress so you can close the tab—or even close the browser entirely—and return later to continue playing.

While you play outside fullscreen mode, a hamburger button appears in the upper-left corner of the game. Pressing it pauses the game and returns you to the browser menu.

The browser menu also provides:

- **Volume** — Adjusts the game volume.
- **Dark** — Switches between black lines on a white background and white lines on a black background.
- **Rumble** — Enables or disables gamepad vibration on compatible controllers.

*Stickvania* automatically pauses when the browser loses focus and automatically resumes when the browser regains focus.

### In-Game Menu

The in-game main menu provides **Start** and **Options**.

Selecting **Options** opens another menu with:

- **Input** — Remap keyboard and gamepad controls.
- **Difficulty** — Choose between **Normal** and **Hard**.
- **Done** — Return to the previous menu.

Stickvania does not provide touchscreen controls.

## History

My first exposure to the *Castlevania* series was **Super Castlevania IV** for the Super Nintendo. That game feels responsive, precise, and predictable. You can change direction in midair, and the enemy patterns and level design feel carefully balanced. When I make a mistake, I feel responsible for it.

I had a very different experience when I later played the original *Castlevania* for the NES. Its rigid controls, unforgiving mechanics, and its level design can make a death feel cheap rather than deserved. I like the game. But at the time I found parts of it frustrating.

That experience shaped *Stickvania*.

I originally created *Stickvania* in 2010 as a Java game using the Slick2D and JInput libraries. I studied *Castlevania* in the Nestopia NES emulator and recreated its stages and mechanics by observation. During development, I changed aspects of the game I thought made the original unnecessarily difficult.

I released the original *Stickvania* as a Java applet that ran in a web page and as a downloadable desktop version. As technology evolved, both options became increasingly impractical. Browsers abandoned Java applets, while the desktop version required players to download and run an executable, and to install Java—something many people understandably avoided for the hassle and security reasons. The game also relied on platform-specific native libraries that modern operating systems no longer support.

In 2026, I rewrote *Stickvania* in TypeScript and adapted it to modern web browsers. The new version once again lets visitors launch the game directly from a web page and adds a few modern features, including configurable input, gamepad rumble, and save state. The game itself remains fundamentally the *Stickvania* I created in 2010.

## Differences

*Stickvania* closely follows the stages, enemy placements, and bosses of the original *Castlevania*. But I tightened the controls, rebalanced the weapons, and tweaked enemy behavior to make the game less punishing and, hopefully, more enjoyable.

I adjusted the mechanics so you can move through levels more aggressively. Simon walks faster and can change direction midair. And enemies now take fewer hits to defeat. I also removed setups where a single mistake could cost the player a life. For example, in the second stage, a Medusa Head attacks almost immediately after Simon climbs a staircase into a new scene. Before the player has time to get their bearings, a single hit can knock him backward into a pit and kill him. *Stickvania* avoids setups like that.

I also tweaked the sub-weapons. I tried to make each one useful so picking one up never felt like a downgrade. For instance, the Dagger is one of the least useful weapons in the original game. I made it faster to throw and increased its damage.

In the original *Castlevania*, Holy Water passes through an enemy before hitting the floor and bursting into flame. It damages and stuns the enemy as it passes through. But I did not understand that subtle mechanic when I first played the game; visually, the weapon appeared to pass through the enemy instead of hitting it. In *Stickvania*, Holy Water explodes when it hits an enemy and causes damage. I made its behavior more obvious because that was how I expected the weapon to work.

I also removed strategies that let a single weapon dominate the boss fights. You cannot simply use Holy Water to tear through nearly every boss in the game.

I altered the bosses as well. The Giant Bat now attacks alongside smaller bats. Medusa moves around the screen in a more animated, almost flying pattern. You can no longer cheese the Mummies by whipping from a high block. Frankenstein's Monster spawns multiple Fleamen, but they no longer shoot fireballs. The Grim Reaper uses a different sickle pattern that keeps the fight challenging without making it feel impossible. And the final battle with Dracula draws more heavily from *Super Castlevania IV*, as do Dracula's death animation and the ending sequence that follows.

I also changed how some of the hidden items are revealed. The original *Castlevania* sometimes requires Simon to kneel in specific spots, which a typical player is unlikely to discover on their own. In *Stickvania*, I wanted players to have a better chance of finding the secrets. You might instead reveal an item by breaking a nearby block—something you can discover accidentally or by simply wondering whether a suspicious wall hides something.

I also included an Easter egg from *Super Castlevania IV* that may help you in the final battle with Dracula. It's out there for you to discover.

If you think I made the game too easy, select **Hard** from **Options → Difficulty**. Hard Mode increases the challenge and takes inspiration from the more difficult second loop of the original *Castlevania*, but you can select it immediately without completing Normal Mode first.

## Audio

*Stickvania* borrows music and sound effects from *Super Castlevania IV*. The game's music was composed by **Masanori Adachi** and **Taro Kudo**, who were credited in the original game as **Masanori Oodachi** and **Taro**, respectively. The sound staff also included **Akira Sōji**, with **Akkun** credited for "Super Voice."

The only music borrowed from the original *Castlevania* is **"Prologue,"** the short piece that plays during the opening sequence as Simon walks toward the castle gates. **Kinuyo Yamashita** composed that piece.

## Source

*Stickvania* is a reimplementation of *Castlevania*, not an NES emulator. It does not run or include the original NES ROM.

The repo is available **[here](REPOSITORY_URL)**.

## Java Desktop Version

**[Download the Java desktop version](JAVA_DESKTOP_DOWNLOAD_URL)**

## Acknowledgements

Konami developed and published the original *Castlevania* and *Super Castlevania IV*. *Stickvania* would not exist without the work of the designers, programmers, artists, composers, and other developers who created those games.

*Stickvania* is an unofficial fan-made project. I am not affiliated with Konami or Nintendo, and neither company sponsors, endorses, or approves this game.

*Castlevania*, *Super Castlevania IV*, Simon Belmont, and related characters, music, names, and other original material belong to their respective rights holders. Nintendo Entertainment System and NES are trademarks of Nintendo.

I provide *Stickvania* free of charge. The game contains no advertising and generates no revenue.

---

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
- Java for desktop builds.
- Maven is optional. If Maven is available on Windows or in WSL2, `build:desktop` will prefer it; otherwise the Node build helper uses a local `javac` fallback.

On Windows, the examples below use `npm.cmd`. On non-Windows shells, use `npm` for the same scripts.

Install dependencies:

```text
npm.cmd install
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
npm.cmd run build
```

The full production build creates a verified candidate under `.release-components/production-candidate`, verifies the browser and desktop release artifacts, then promotes the candidate to `dist/`. If the build fails before promotion, the existing `dist/` is preserved.

### Production Output

After `npm.cmd run build`, `dist/` is the deployable web folder:

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
- `npm.cmd run build` is the production path that atomically promotes a verified candidate to `dist/`.
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
npm.cmd run build
```

Then inspect the generated `dist/` bundle in a browser.

## License

Project code is licensed under GPL-3.0-or-later unless a file says otherwise. Third-party notices are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
