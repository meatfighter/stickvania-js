# Stickvania

## About

_Stickvania_ is a stick-figure demake of Konami's original _Castlevania_ for the Nintendo Entertainment System. The game reduces the castle, enemies, objects, and Simon Belmont himself to simple line drawings that look like they were scribbled with a Sharpie.

Press the **Play** button below to launch _Stickvania_.

**[Play](https://meatfighter.com/stickvania/)**

## Controls

_Stickvania_ supports both keyboard and gamepad input. The default controls are:

| Action | Keyboard    | Gamepad     |
| ------ | ----------- | ----------- |
| Up     | Up Arrow    | D-Pad Up    |
| Down   | Down Arrow  | D-Pad Down  |
| Left   | Left Arrow  | D-Pad Left  |
| Right  | Right Arrow | D-Pad Right |
| Jump   | X           | A           |
| Attack | Z           | X           |

You can change the button mapping by selecting **Options → Input** from the in-game menu.

_Stickvania_ reserves two keyboard controls that you cannot remap:

| Key   | Action            |
| ----- | ----------------- |
| Space | Toggle fullscreen |
| Esc   | Exit fullscreen   |

### Browser Menu

_Stickvania_ opens with a browser menu that provides **New Game** and **Continue** buttons.

**New Game** starts a new game. **Continue** resumes your previous game. _Stickvania_ saves your progress so you can close the tab—or even close the browser entirely—and return later to continue playing.

While you play outside fullscreen mode, a hamburger button appears in the upper-left corner of the game. Pressing it pauses the game and returns you to the browser menu.

The browser menu also provides:

- **Volume** — Adjusts the game volume.
- **Dark** — Switches between black lines on a white background and white lines on a black background.
- **Rumble** — Enables or disables gamepad vibration on compatible controllers.

_Stickvania_ automatically pauses when the browser loses focus and automatically resumes when the browser regains focus.

### In-Game Menu

The in-game main menu provides **Start** and **Options**.

Selecting **Options** opens another menu with:

- **Input** — Remap keyboard and gamepad controls.
- **Difficulty** — Choose between **Normal** and **Hard**.
- **Done** — Return to the previous menu.

Stickvania does not provide touchscreen controls.

## History

My first exposure to the _Castlevania_ series was **Super Castlevania IV** for the Super Nintendo. That game feels responsive, precise, and predictable. You can change direction in midair, and the enemy patterns and level design feel carefully balanced. When I make a mistake, I feel responsible for it.

I had a very different experience when I later played the original _Castlevania_ for the NES. Its rigid controls, unforgiving mechanics, and its level design can make a death feel cheap rather than deserved. I like the game. But at the time I found parts of it frustrating.

That experience shaped _Stickvania_.

I originally created _Stickvania_ in 2010 as a Java game using the Slick2D and JInput libraries. I studied _Castlevania_ in the Nestopia NES emulator and recreated its stages and mechanics by observation. During development, I changed aspects of the game I thought made the original unnecessarily difficult.

I released the original _Stickvania_ as a Java applet that ran in a web page and as a downloadable desktop version. As technology evolved, both options became increasingly impractical. Browsers abandoned Java applets, while the desktop version required players to download and run an executable, and to install Java—something many people understandably avoided for the hassle and security reasons. The game also relied on platform-specific native libraries that modern operating systems no longer support.

In 2026, I rewrote _Stickvania_ in TypeScript and adapted it to modern web browsers. The new version once again lets visitors launch the game directly from a web page and adds a few modern features, including configurable input, gamepad rumble, and save state. The game itself remains fundamentally the _Stickvania_ I created in 2010.

## Differences

_Stickvania_ closely follows the stages, enemy placements, and bosses of the original _Castlevania_. But I tightened the controls, rebalanced the weapons, and tweaked enemy behavior to make the game less punishing and, hopefully, more enjoyable.

I adjusted the mechanics so you can move through levels more aggressively. Simon walks faster and can change direction midair. And enemies now take fewer hits to defeat. I also removed setups where a single mistake could cost the player a life. For example, in the second stage, a Medusa Head attacks almost immediately after Simon climbs a staircase into a new scene. Before the player has time to get their bearings, a single hit can knock him backward into a pit and kill him. _Stickvania_ avoids setups like that.

I also tweaked the sub-weapons. I tried to make each one useful so picking one up never felt like a downgrade. For instance, the Dagger is one of the least useful weapons in the original game. I made it faster to throw and increased its damage.

In the original _Castlevania_, Holy Water passes through an enemy before hitting the floor and bursting into flame. It damages and stuns the enemy as it passes through. But I did not understand that subtle mechanic when I first played the game; visually, the weapon appeared to pass through the enemy instead of hitting it. In _Stickvania_, Holy Water explodes when it hits an enemy and causes damage. I made its behavior more obvious because that was how I expected the weapon to work.

I also removed strategies that let a single weapon dominate the boss fights. You cannot simply use Holy Water to tear through nearly every boss in the game.

I altered the bosses as well. The Giant Bat now attacks alongside smaller bats. Medusa moves around the screen in a more animated, almost flying pattern. You can no longer cheese the Mummies by whipping from a high block. Frankenstein's Monster spawns multiple Fleamen, but they no longer shoot fireballs. The Grim Reaper uses a different sickle pattern that keeps the fight challenging without making it feel impossible. And the final battle with Dracula draws more heavily from _Super Castlevania IV_, as do Dracula's death animation and the ending sequence that follows.

I also changed how some of the hidden items are revealed. The original _Castlevania_ sometimes requires Simon to kneel in specific spots, which a typical player is unlikely to discover on their own. In _Stickvania_, I wanted players to have a better chance of finding the secrets. You might instead reveal an item by breaking a nearby block—something you can discover accidentally or by simply wondering whether a suspicious wall hides something.

I also included an Easter egg from _Super Castlevania IV_ that may help you in the final battle with Dracula. It's out there for you to discover.

If you think I made the game too easy, select **Hard** from **Options → Difficulty**. Hard Mode increases the challenge and takes inspiration from the more difficult second loop of the original _Castlevania_, but you can select it immediately without completing Normal Mode first.

## Audio

_Stickvania_ borrows music and sound effects from _Super Castlevania IV_. The game's music was composed by **Masanori Adachi** and **Taro Kudo**, who were credited in the original game as **Masanori Oodachi** and **Taro**, respectively. The sound staff also included **Akira Sōji**, with **Akkun** credited for "Super Voice."

The only music borrowed from the original _Castlevania_ is **"Prologue,"** the short piece that plays during the opening sequence as Simon walks toward the castle gates. **Kinuyo Yamashita** composed that piece.

## Source

_Stickvania_ is a reimplementation of _Castlevania_, not an emulation. It does not run or include the original NES ROM.

The repo is available **[here](https://github.com/meatfighter/stickvania-js)**.

## Java Desktop Version

**[Download the Java desktop version](https://meatfighter.com/stickvania/downloads/stickvania-desktop.zip)**

## Acknowledgements

Konami developed and published the original _Castlevania_ and _Super Castlevania IV_. _Stickvania_ would not exist without the work of the designers, programmers, artists, composers, and other developers who created those games.

_Stickvania_ is an unofficial fan-made project. I am not affiliated with Konami or Nintendo, and neither company sponsors, endorses, or approves this game.

_Castlevania_, _Super Castlevania IV_, Simon Belmont, and related characters, music, names, and other original material belong to their respective rights holders. Nintendo Entertainment System and NES are trademarks of Nintendo.

I provide _Stickvania_ free of charge. The game contains no advertising and generates no revenue.