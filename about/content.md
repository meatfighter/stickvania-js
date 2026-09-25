# About

_Stickvania_ is a stick-figure demake of Konami's original _Castlevania_ for the Nintendo Entertainment System. The game reduces the castle, enemies, objects, and Simon Belmont himself to simple line drawings that look like they were scribbled with a Sharpie.

Press the **Play** button below to launch the desktop browser version of _Stickvania_.

[Play](__PWA_URL__)

# Controls

_Stickvania_ supports both keyboard and gamepad input. The default controls are:

| Action | Keyboard    | Gamepad     |
| ------ | ----------- | ----------- |
| Up     | Up Arrow    | D-Pad Up    |
| Down   | Down Arrow  | D-Pad Down  |
| Left   | Left Arrow  | D-Pad Left  |
| Right  | Right Arrow | D-Pad Right |
| Jump   | X           | A           |
| Attack | Z           | X           |

Gamepad button names use Xbox-style labels; equivalent buttons may have different labels on other controllers.

Press **Attack** to use the whip. Hold **Up** and press **Attack** to use your current sub-weapon.

You can change the button mapping by selecting **Options → Input** from the in-game menu.

## Browser Menu

_Stickvania_ opens with a browser menu that provides **New Game** and **Continue** buttons.

**New Game** starts a new game. **Continue** resumes your previous game. _Stickvania_ saves your progress so you can close the tab—or even close the browser entirely—and return later to continue playing.

While playing outside fullscreen mode, a hamburger button appears in the upper-left corner of the game. Pressing it pauses the game and returns you to the browser menu.

The browser menu also provides:

- **Theme** — Selects the game's color scheme.
- **Rumble** — Switches vibration on or off for compatible gamepads.
- **Fullscreen** — Makes the game fill the entire screen.
- **Scaling** — Controls how the game is resized to fit the display.
- **Volume** — Adjusts the game volume.
- **Reset** — Erases saved state and restores settings to their defaults.

## In-Game Menu

The in-game main menu provides **Start** and **Options**.

Selecting **Options** opens another menu with:

- **Input** — Remap keyboard and gamepad controls.
- **Difficulty** — Choose between **Normal** and **Hard**.
- **Done** — Return to the previous menu.

# History

My first exposure to the _Castlevania_ series was _Super Castlevania IV_ for the Super Nintendo. That game feels responsive, precise, and predictable. You can change direction in midair, and the enemy patterns and level design feel carefully balanced. If I make a mistake during play, I feel responsible for it.

I had a very different experience when I later tried the original _Castlevania_ for the NES. Its rigid controls, unforgiving mechanics, and level design can make some deaths feel cheap rather than deserved. I like the game. Though, at the time, I found parts of it frustrating.

That experience shaped _Stickvania_.

I originally created _Stickvania_ in 2010 as a Java game using the [Slick2D](https://github.com/nguillaumin/slick2d-maven) and [JInput](https://jinput.github.io/jinput/) libraries. I studied _Castlevania_ in the [Nestopia](https://sourceforge.net/projects/nestopia/) NES emulator and recreated its stages and mechanics through observation. During development, I changed aspects of the game I thought made the original unnecessarily difficult.

I released _Stickvania_ as a Java applet that ran in a web page and as a downloadable desktop version. As technology evolved, both options became increasingly impractical. Browsers abandoned Java applets, while the desktop version required players to download and run an executable and install Java—something many people understandably avoided because of the hassle and security concerns. The game also relied on platform-specific native libraries that became increasingly difficult to run reliably on modern systems.

In 2026, I rewrote _Stickvania_ in TypeScript and adapted it to modern web browsers. The new version once again lets visitors launch the game directly from a web page and adds a few modern features, including configurable input, gamepad rumble, and save-state support. The game itself remains fundamentally the _Stickvania_ I created in 2010.

# Differences

_Stickvania_ closely follows the stages, enemy placements, and bosses of the original _Castlevania_. I tightened the controls, rebalanced the weapons, and tweaked enemy behavior to make the game less punishing and, hopefully, more enjoyable.

I adjusted the mechanics so you can move through levels more aggressively. Simon walks faster and can change direction midair. Enemies also take fewer hits to defeat. I removed setups where a single mistake could cost the player a life. For example, in the second stage, Medusa Heads attack almost immediately after Simon climbs a staircase into a new scene. Before the player has time to get their bearings, a single hit can knock Simon backward into a pit and kill him. _Stickvania_ avoids setups like that.

I tweaked the sub-weapons. I tried to make each one useful so picking one up never feels like a downgrade. For instance, the Dagger is one of the least useful weapons in the original game. I made it faster to throw and increased its damage.

In the original _Castlevania_, Holy Water passes through an enemy before hitting the floor and bursting into flame. It damages and stuns the enemy as it passes through. I did not understand that subtle mechanic when I first played the game; visually, the weapon appeared to pass through the enemy instead of hitting it. In _Stickvania_, Holy Water explodes when it hits an enemy and causes damage. I made its behavior more obvious because that was how I expected the weapon to work.

I removed strategies that let a single weapon dominate the boss fights. Holy Water can no longer tear through nearly every boss in the game.

I altered the bosses as well. The Giant Bat now attacks alongside smaller bats. Medusa moves around the screen in a more animated, almost flying pattern. You can no longer cheese the Mummies by whipping from a high block. Frankenstein's Monster spawns multiple Fleamen, but they no longer shoot fireballs. The Grim Reaper uses a different sickle pattern that keeps the fight challenging without making it feel impossible. And the final battle with Dracula draws more heavily from _Super Castlevania IV_, as do Dracula's death animation and the ending sequence that follows.

I changed how some of the hidden items are revealed. The original _Castlevania_ sometimes requires Simon to kneel in specific spots, which a typical player is unlikely to discover on their own. In _Stickvania_, I wanted players to have a better chance of finding the secrets. You might instead reveal an item by breaking a nearby block—something you can discover accidentally or by simply wondering whether a suspicious wall hides something.

I also included an Easter egg from _Super Castlevania IV_ that may help you in the final battle with Dracula. It's out there for you to discover.

# Hard Mode

If you think I made the game too easy, select **Hard** from **Options → Difficulty**. Hard Mode increases the challenge. It was inspired by the more difficult second loop of the original _Castlevania_, but you can select it immediately without completing Normal Mode first.

# Resources

_Stickvania_ is a reimplementation of _Castlevania_, not an emulation. It does not run or include the original NES ROM.

The source code for the project is available in the [meatfighter/stickvania-js repository](__REPOSITORY_URL__).

The Java desktop version is available as a [ZIP file](__DESKTOP_ZIP__). To use a gamepad with the Java version, connect and enable it before starting the game.

Download and extract the ZIP, then run the launcher for your operating system:

- Windows: `run-windows.cmd`
- Linux: `run-linux.sh`
- macOS: `run-macos.sh`

Java 21 or newer is required.

# Acknowledgements

Konami developed and published the original _Castlevania_ and _Super Castlevania IV_. _Stickvania_ would not exist without the work of the designers, programmers, artists, composers, and other people who created those games.

_Stickvania_ borrows music and sound effects from _Super Castlevania IV_. The game's music was composed by **Masanori Adachi** and **Taro Kudo**, who were credited in the original game as **Masanori Oodachi** and **Taro**, respectively. The sound staff also included **Akira Sōji**, with **Akkun** credited for "Super Voice."

The only music borrowed from the original _Castlevania_ is **"Prologue,"** the short piece that plays during the opening sequence as Simon walks toward the castle gates. **Kinuyo Yamashita** composed that piece.

_Stickvania_ is an unofficial fan-made project and tribute to the original games. It is not affiliated with, sponsored by, or endorsed by the creators, publishers, trademark owners, or other rights holders of the games it references. Preexisting games, graphics, music, sound effects, characters, names, logos, trademarks, and other third-party content remain the property of their respective rights holders.

I provide _Stickvania_ free of charge. It contains no advertising and generates no revenue.
