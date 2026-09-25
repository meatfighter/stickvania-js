import { BasicGame, Color, FastTrig, GameContainer, Graphics, Image, Input, JavaRandom, Music, PackedSpriteSheet, Sound, SoundStore, Sys } from "slick2d-ts";
import { SONG_FIELD_NAMES, STANDALONE_MUSIC_FIELD_NAMES } from "./AudioRegistry.js";
import { Axe } from "./Axe.js";
import { AxeKnight } from "./AxeKnight.js";
import { BatBoss } from "./BatBoss.js";
import { BatSpawner } from "./BatSpawner.js";
import { BirdSpawner } from "./BirdSpawner.js";
import { BoneDragon } from "./BoneDragon.js";
import { BonePillar } from "./BonePillar.js";
import { Boomerang } from "./Boomerang.js";
import { BreakWall } from "./BreakWall.js";
import { BridgeBat } from "./BridgeBat.js";
import { ButtonMapping, type MappingWriteResult } from "./ButtonMapping.js";
import { Candles } from "./Candles.js";
import { Checkpoint } from "./Checkpoint.js";
import { Dagger } from "./Dagger.js";
import { Dog } from "./Dog.js";
import { Door } from "./Door.js";
import { Dracula } from "./Dracula.js";
import { DropItem } from "./DropItem.js";
import { FadingStairs } from "./FadingStairs.js";
import { FloatingPoints } from "./FloatingPoints.js";
import { FloorBreaker } from "./FloorBreaker.js";
import { Frankenstein } from "./Frankenstein.js";
import { Ghost } from "./Ghost.js";
import { GrimReaper } from "./GrimReaper.js";
import { HolyWater } from "./HolyWater.js";
import { Igor } from "./Igor.js";
import { InputConfigMode, type InputConfigModeSnapshot } from "./InputConfigMode.js";
import { cc, chr, idiv, javaFloat, make2D, make3D, makeArray, readBinaryResource, readResourceLines, trunc } from "./JavaMath.js";
import { LanceKnight } from "./LanceKnight.js";
import { MedusaBoss } from "./MedusaBoss.js";
import { MedusaHeadSpawner } from "./MedusaHeadSpawner.js";
import { MermanSpawner } from "./MermanSpawner.js";
import { MovingPlatform } from "./MovingPlatform.js";
import { MummyBoss } from "./MummyBoss.js";
import { Raven } from "./Raven.js";
import { RedSkeleton } from "./RedSkeleton.js";
import { Region } from "./Region.js";
import { Secret } from "./Secret.js";
import { ShootingSpark } from "./ShootingSpark.js";
import { Simon } from "./Simon.js";
import { SmallHeart } from "./SmallHeart.js";
import { Song } from "./Song.js";
import { Spikes } from "./Spikes.js";
import { StageSegment } from "./StageSegment.js";
import { StairsEntry } from "./StairsEntry.js";
import { StickvaniaInput } from "./StickvaniaInput.js";
import { StopWatch } from "./StopWatch.js";
import { canStartStopWatch } from "./StopWatchMusicHold.js";
import { SwoopingBat } from "./SwoopingBat.js";
import { Thing } from "./Thing.js";
import { ThingStack } from "./ThingStack.js";
import { Torch } from "./Torch.js";
import { WhiteSkeleton } from "./WhiteSkeleton.js";
import { ZombieSpawner } from "./ZombieSpawner.js";
import type { RumbleEffectId } from "../rumble/RumbleEffects.js";
import { isRestorableGameStateMode, isStageRequiredGameStateMode } from "./persistence/GameStatePolicy.js";
import type { RumbleManager } from "../rumble/RumbleManager.js";

export class Main extends BasicGame {
    public static readonly GRAVITY: number = javaFloat(0.21);
    public static readonly SIMON_JUMP_VELOCITY: number = javaFloat(-5.25);
    public static readonly PLAYER_CONTROLLED_GRAVITY: number = javaFloat(0.130027228);
    public static readonly PLAYER_CONTROLLED_JUMP_VELOCITY: number = javaFloat(-4.262100987);
    public static readonly INVINCIBLE_FRACTION: number = javaFloat(0.032608695652173913043478260869565);
    public static readonly TITLE_BAT_ANGLE_INC: number = javaFloat((3 * Math.PI) / 2 / 273);
    public static readonly TITLE_BAT_SCALE_INC: number = javaFloat(54 / 273);
    public static readonly TITLE_BAT_X_RADIUS_INC: number = javaFloat(67 / 273);
    public static readonly LEFT: number = 0;
    public static readonly RIGHT: number = 1;
    public static readonly MODE_TITLE_SCREEN: number = 0;
    public static readonly MODE_DEMO: number = 1;
    public static readonly MODE_CONTINUE_SCREEN: number = 2;
    public static readonly MODE_ENDING: number = 3;
    public static readonly MODE_PLAYING: number = 4;
    public static readonly MODE_INTRO: number = 5;
    public static readonly MODE_MAP: number = 6;
    public static readonly MODE_CASTLE_FALLS: number = 7;
    public static readonly MODE_CREDITS: number = 8;
    public static readonly MODE_INPUT_CONFIG: number = 10;
    public static readonly DIFFICULTY_NORMAL: number = 0;
    public static readonly DIFFICULTY_HARD: number = 1;
    private static readonly HARD_SPAWN_DELAY_MULTIPLIER: number = javaFloat(0.66);
    private static readonly HARD_ATTACK_COOLDOWN_MULTIPLIER: number = javaFloat(0.7);
    private static readonly HARD_BEHAVIOR_DELAY_MULTIPLIER: number = javaFloat(0.75);
    private static readonly HARD_ACTIVE_CAP_BONUS: number = 1;
    public static readonly TITLE_MENU_MAIN: number = 0;
    public static readonly TITLE_MENU_OPTIONS: number = 1;
    public static readonly TITLE_MENU_INPUT: number = 2;
    public static readonly TITLE_MENU_DIFFICULTY: number = 3;
    private static readonly MENU_ROW_HEIGHT: number = 32;
    private static readonly MENU_TWO_OPTION_Y: number = 304;
    private static readonly MENU_THREE_OPTION_Y: number = 288;
    private static readonly TITLE_INPUT_TITLE_Y: number = 92;
    private static readonly TITLE_INPUT_MAPPING_Y: number = 140;
    private static readonly TITLE_INPUT_MAPPING_ROW_HEIGHT: number = 24;
    private static readonly TITLE_INPUT_MENU_Y: number = 308;
    private static readonly TITLE_INPUT_ACTIONS: string[] = ["UP", "DOWN", "LEFT", "RIGHT", "JUMP", "ATTACK"];
    private static readonly TITLE_INPUT_OPTIONS: string[] = ["CHANGE", "RESET", "DONE"];
    private static readonly TITLE_MAIN_OPTIONS: string[] = ["START", "OPTIONS"];
    private static readonly TITLE_OPTIONS_OPTIONS: string[] = ["INPUT", "DIFFICULTY", "DONE"];
    private static readonly TITLE_DIFFICULTY_OPTIONS: string[] = ["NORMAL", "HARD"];
    private static readonly GAME_OVER_OPTIONS: string[] = ["CONTINUE", "END"];
    private static readonly CASTLE_CRUMBLE_RUMBLE_TICK_MS: number = 1000 / 91;
    public static readonly CANDLE_ITEM_AXE: number = cc("a");
    public static readonly CANDLE_ITEM_BOOMERANG: number = cc("b");
    public static readonly CANDLE_ITEM_CHEST: number = cc("c");
    public static readonly CANDLE_ITEM_CROWN: number = cc("r");
    public static readonly CANDLE_ITEM_DAGGER: number = cc("d");
    public static readonly CANDLE_ITEM_DOUBLE: number = cc("2");
    public static readonly CANDLE_ITEM_EMPTY: number = cc(".");
    public static readonly CANDLE_ITEM_HOLY_WATER: number = cc("w");
    public static readonly CANDLE_ITEM_KILL_ALL: number = cc("k");
    public static readonly CANDLE_ITEM_LARGE_HEART: number = cc("l");
    public static readonly CANDLE_ITEM_MEAT: number = cc("m");
    public static readonly CANDLE_ITEM_MONEY_BAG: number = cc("$");
    public static readonly CANDLE_ITEM_ONE_UP: number = cc("1");
    public static readonly CANDLE_ITEM_POTION: number = cc("p");
    public static readonly CANDLE_ITEM_SMALL_HEART: number = cc("h");
    public static readonly CANDLE_ITEM_STOP_WATCH: number = cc("s");
    public static readonly CANDLE_ITEM_TRIPLE: number = cc("3");
    public static readonly TILE_EMPTY: number = cc(".");
    public static readonly TILE_SIMON: number = cc("*");
    public static readonly TILE_CANDLES: number = cc("c");
    public static readonly TILE_DOOR: number = cc("|");
    public static readonly TILE_TORCH: number = cc("t");
    public static readonly TILE_WALL: number = cc("X");
    public static readonly TILE_PLATFORM: number = cc("-");
    public static readonly TILE_HIDDEN_PLATFORM: number = cc("=");
    public static readonly TILE_BREAK_WALL: number = cc("B");
    public static readonly TILE_STAIRS_LEFT: number = cc("\\");
    public static readonly TILE_STAIRS_RIGHT: number = cc("/");
    public static readonly TILE_STAIRS_LEFT_CAPPED: number = cc("L");
    public static readonly TILE_STAIRS_RIGHT_CAPPED: number = cc("R");
    public static readonly TILE_ZOMBIE_SPAWNER: number = cc("z");
    public static readonly TILE_BAT_SPAWNER: number = cc("b");
    public static readonly TILE_DOG: number = cc("d");
    public static readonly TILE_MERMAN_SPAWNER: number = cc("m");
    public static readonly TILE_CHECK_POINT: number = cc("*");
    public static readonly TILE_BAT_BOSS: number = cc("A");
    public static readonly TILE_GRIM_REAPER_BOSS: number = cc("I");
    public static readonly TILE_LANCE_KNIGHT: number = cc("l");
    public static readonly TILE_AXE_KNIGHT: number = cc("x");
    public static readonly TILE_SWOOPING_BAT: number = cc("s");
    public static readonly TILE_MOVING_PLATFORM: number = cc("p");
    public static readonly TILE_MOVING_PLATFORM_2: number = cc("q");
    public static readonly TILE_MEDUSA_HEAD_SPAWNER: number = cc("M");
    public static readonly TILE_SPIKES: number = cc("S");
    public static readonly TILE_BONE_PILLAR: number = cc("P");
    public static readonly TILE_GHOST: number = cc("g");
    public static readonly TILE_MEDUSA_BOSS: number = cc("E");
    public static readonly TILE_IGOR: number = cc("i");
    public static readonly TILE_WHITE_SKELETON: number = cc("k");
    public static readonly TILE_RED_SKELETON: number = cc("K");
    public static readonly TILE_RAVEN: number = cc("r");
    public static readonly TILE_MUMMY_BOSS: number = cc("Y");
    public static readonly TILE_FADING_STAIRS: number = cc("f");
    public static readonly TILE_BIRD_SPAWNER: number = cc("D");
    public static readonly TILE_BONE_DRAGON: number = cc("G");
    public static readonly TILE_BONE_DRAGON_2: number = cc("O");
    public static readonly TILE_BRIDGE_BAT: number = cc("T");
    public static readonly TILE_SECRET: number = cc("!");
    public static readonly TILE_DRACULA_BOSS: number = cc("C");
    public static readonly TILE_FRANKENSTEIN: number = cc("F");
    public static readonly WEAPON_TYPE_NONE: number = 0;
    public static readonly WEAPON_TYPE_AXE: number = 1;
    public static readonly WEAPON_TYPE_BOOMERANG: number = 2;
    public static readonly WEAPON_TYPE_DAGGER: number = 3;
    public static readonly WEAPON_TYPE_HOLY_WATER: number = 4;
    public static readonly WEAPON_TYPE_STOP_WATCH: number = 5;
    public static readonly WEAPON_REPEATS_SINGLE: number = 0;
    public static readonly WEAPON_REPEATS_DOUBLE: number = 1;
    public static readonly WEAPON_REPEATS_TRIPLE: number = 2;
    public static readonly BLOCK_EMPTY: number = 0;
    public static readonly BLOCK_FULL: number = 15;
    public static readonly BLOCK_I_LEFT: number = 2;
    public static readonly BLOCK_I_RIGHT: number = 1;
    public static readonly BLOCK_I_UP: number = 8;
    public static readonly BLOCK_I_DOWN: number = 4;
    public static readonly BLOCK_U_LEFT: number = 13;
    public static readonly BLOCK_U_RIGHT: number = 14;
    public static readonly BLOCK_U_UP: number = 7;
    public static readonly BLOCK_U_DOWN: number = 11;
    public static readonly BLOCK_L_UP_LEFT: number = 10;
    public static readonly BLOCK_L_DOWN_LEFT: number = 6;
    public static readonly BLOCK_L_UP_RIGHT: number = 9;
    public static readonly BLOCK_L_DOWN_RIGHT: number = 5;
    public static readonly BLOCK_H: number = 3;
    public static readonly BLOCK_E: number = 12;
    public static readonly WALL_EMPTY: number = 0;
    public static readonly WALL_PLATFORM: number = 1;
    public static readonly WALL_FULL: number = 2;
    public static readonly BLOCK_STAIRS_LEFT: number = 16;
    public static readonly BLOCK_STAIRS_RIGHT: number = 17;
    public static readonly BLOCK_STAIRS_LEFT_CAPPED: number = 18;
    public static readonly BLOCK_STAIRS_RIGHT_CAPPED: number = 19;
    public static readonly WHIP_LEATHER: number = 0;
    public static readonly WHIP_SHORT_CHAIN: number = 1;
    public static readonly WHIP_LONG_CHAIN: number = 2;
    public static readonly FADE_DONE: number = 0;
    public static readonly FADE_OUT: number = 1;
    public static readonly FADE_IN: number = 2;
    public static readonly FADE_REASON_STAIRS: number = 0;
    public static readonly FADE_REASON_RESTORE_CHECKPOINT: number = 1;
    public static readonly FADE_REASON_SHOW_MAP: number = 2;
    public static readonly FADE_REASON_SHOW_INTRO: number = 3;
    public static readonly FADE_REASON_SHOW_CONTINUE_SCREEN: number = 4;
    public static readonly FADE_REASON_SHOW_TITLE_SCREEN: number = 5;
    public static readonly FADE_REASON_SHOW_CASTLE_FALLS: number = 6;
    public static readonly FADE_REASON_SHOW_DEMO: number = 7;
    public static readonly FADE_REASON_SHOW_CREDITS: number = 8;
    public static readonly FADE_REASON_ADVANCE_CREDITS: number = 9;
    public static readonly FADE_REASON_SHOW_INPUT_CONFIG: number = 10;
    public static readonly stageNumbers: number[][][] = [
        [[1, 1, 2, 3, 3], [2]],
        [[4], [5, 4], [6, 5], [6]],
        [
            [7, 7],
            [7, 8],
            [8, 9]
        ],
        [[10], [11, 12]],
        [[13], [13, 14], [15, 14], [15]],
        [[17, 16], [18, 17], [18]]
    ];

    public static readonly whipSizes: number[][] = [
        [43, 3],
        [48, 7],
        [80, 7]
    ];

    public static readonly whipOffsets: number[][][] = [
        [
            [5, 11],
            [0, 11]
        ],
        [
            [0, 9],
            [0, 9]
        ],
        [
            [0, 9],
            [0, 9]
        ]
    ];

    public static readonly mapBats: number[][] = [
        [273, 208],
        [175, 142],
        [336, 108],
        [576, 174],
        [528, 77],
        [346, 30]
    ];

    public fades: Color[] = makeArray<Color>(23, () => null!);
    public mode: number = Main.MODE_TITLE_SCREEN;
    public darkDisplayMode: boolean = false;
    public displayMonochromePalette: Readonly<{
        blackReplacement: Color;
        whiteReplacement: Color;
    }> | null = null;

    private startupAudioQueued: boolean = false;
    public rumble: RumbleManager | null = null;
    private nextFrameTime: number = 0;
    private loadedSegments: StageSegment[][] | null = null;
    private stageSegments: StageSegment[] | null = null;
    private stageSegment: StageSegment | null = null;
    private checkpoint: Checkpoint | null = null;
    public map: number[][] | null = null;
    public walls: number[][] | null = null;
    public regionThingStack: ThingStack = new ThingStack();
    public regionStackSwap: ThingStack = new ThingStack();
    public weaponsStack: ThingStack = new ThingStack();
    public weaponsStackSwap: ThingStack = new ThingStack();
    public platforms: Array<Thing | null> | null = null;
    public mapWidth: number = 0;
    public fadeState: number = Main.FADE_IN;
    public fade: number = 22;
    public fadeReason: number = 0;
    public simon: Simon | null = null;
    public score: number = 0;
    public time: number = 999;
    public timeIncrementor: number = 0;
    public stage: number = 0;
    public stageIndex: number = 0;
    public hearts: number = 5;
    public players: number = 4;
    public playerPower: number = 16;
    public enemyPower: number = 16;
    public weaponType: number = Main.WEAPON_TYPE_NONE;
    public weaponRepeats: number = Main.WEAPON_REPEATS_SINGLE;
    public camera: number = 0;
    public timeFrozen: number = 0;
    public killAllFlag: boolean = false;
    public random: JavaRandom = new JavaRandom();
    public beatStageFlag: boolean = false;
    public floorBreaking: boolean = false;
    public beatStageDelay: number = 0;
    public visibleWhipCount: number = 0;
    public repeatsFlashing: number = 0;
    public justShowedMap: boolean = false;
    public demoIndex: number = 2;
    private demoKeyRecordings: number[][] = make2D<number>(3, 2730, () => 0);
    private endingKeyRecordings: number[][] = make2D<number>(12, 728, () => 0);
    private titleTimeout: number = 0;
    private titleBatAngle: number = javaFloat(0);
    private titleBatX: number = javaFloat(0);
    private titleBatY: number = javaFloat(0);
    private titleBatScale: number = javaFloat(10);
    private titleBatXRadius: number = javaFloat(0);
    private titleBatSpriteIndex: number = 0;
    private titleBatSpriteIndexIncrementor: number = 0;
    private titleBatSteps: number = 0;
    private titleMenu: number = Main.TITLE_MENU_MAIN;
    private titleSelectedIndex: number = 0;
    private static readonly titleInputLabelStyles = new WeakMap<Main, boolean>();
    private titleInputMappingLines: string[] = makeArray<string>(Main.TITLE_INPUT_ACTIONS.length, () => "");
    private titleInputMappingX: number = 64;
    private titleInputMappingCacheDirty: boolean = true;
    private static readonly titleBatSequence: number[] = [0, 1, 2, 1];
    public introWalkSpriteIndexIncrementor: number = 0;
    public introWalkSpriteIndex: number = 0;
    public introSimonX: number = 512;
    public introCloudsX: number = javaFloat(500);
    public introTime: number = 728;
    public gateBatX1: number = javaFloat(0);
    public gateBatY1: number = javaFloat(0);
    public gateBatX2: number = javaFloat(0);
    public gateBatY2: number = javaFloat(0);
    public gateBatSpriteIndex: number = 0;
    public gateBatSpriteIndexIncrementor: number = 0;
    private castleFallX: number = javaFloat(0);
    private castleFallY: number = javaFloat(0);
    private castleFallSparkCount: number = 0;
    private castleFallSparkVisible: boolean = false;
    private castleFallSparkX: number = 0;
    private castleFallSparkY: number = 0;
    private castleFallSparkDelay: number = 0;
    private castleFallDelay: number = 0;
    private castleCrumbleRumbleTicks: number = 0;
    public continueSelected: boolean = true;
    public door: Door | null = null;
    public oldThingStack: ThingStack = new ThingStack();
    public blocks: Image[] = makeArray<Image>(20, () => null!);
    public symbols: Image[] = makeArray<Image>(256, () => null!);
    public power: Image[] = makeArray<Image>(2, () => null!);
    public simonWalking: Image[][] = make2D<Image>(2, 3, () => null!);
    public simonOnStairsUp: Image[] = makeArray<Image>(2, () => null!);
    public simonOnStairsDown: Image[] = makeArray<Image>(2, () => null!);
    public simonKneeling: Image[] = makeArray<Image>(2, () => null!);
    public simonWhipping: Image[][] = make2D<Image>(2, 3, () => null!);
    public simonKneelWhipping: Image[][] = make2D<Image>(2, 3, () => null!);
    public simonUpWhipping: Image[][] = make2D<Image>(2, 3, () => null!);
    public simonDownWhipping: Image[][] = make2D<Image>(2, 3, () => null!);
    public simonHurt: Image[] = makeArray<Image>(2, () => null!);
    public simonDead: Image[] = makeArray<Image>(2, () => null!);
    public whips: Image[][][] = make3D<Image>(2, 3, 3, () => null!);
    public dropItems: Image[] = makeArray<Image>(17, () => null!);
    public candles: Image[] = makeArray<Image>(2, () => null!);
    public itemPoints: Image[] = makeArray<Image>(5, () => null!);
    public fires: Image[] = makeArray<Image>(5, () => null!);
    public doors: Image[][] = make2D<Image>(2, 3, () => null!);
    public daggers: Image[] = makeArray<Image>(2, () => null!);
    public holyWaters: Image[] = makeArray<Image>(2, () => null!);
    public zombies: Image[][] = make2D<Image>(2, 2, () => null!);
    public bats: Image[][] = make2D<Image>(2, 4, () => null!);
    public dogs: Image[][] = make2D<Image>(2, 4, () => null!);
    public mermen: Image[][] = make2D<Image>(2, 3, () => null!);
    public fireballs: Image[] = makeArray<Image>(2, () => null!);
    public batBoss: Image[] = makeArray<Image>(3, () => null!);
    public lanceKnight: Image[][] = make2D<Image>(2, 3, () => null!);
    public medusaHeads: Image[][] = make2D<Image>(2, 2, () => null!);
    public bonePillars: Image[] = makeArray<Image>(2, () => null!);
    public ghosts: Image[][] = make2D<Image>(2, 2, () => null!);
    public medusaBoss: Image[] = makeArray<Image>(2, () => null!);
    public snakes: Image[][] = make2D<Image>(2, 2, () => null!);
    public igors: Image[][] = make2D<Image>(2, 2, () => null!);
    public skeletons: Image[][] = make2D<Image>(2, 2, () => null!);
    public crumble: Image[] = makeArray<Image>(2, () => null!);
    public ravens: Image[][] = make2D<Image>(2, 4, () => null!);
    public mummyBoss: Image[][] = make2D<Image>(2, 3, () => null!);
    public wrappings: Image[][] = make2D<Image>(2, 2, () => null!);
    public birds: Image[][] = make2D<Image>(2, 2, () => null!);
    public boneDragons: Image[] = makeArray<Image>(3, () => null!);
    public axeKnights: Image[][] = make2D<Image>(2, 2, () => null!);
    public grimReaperBoss: Image[] = makeArray<Image>(2, () => null!);
    public draculaBoss: Image[][] = make2D<Image>(2, 7, () => null!);
    public frankensteinBoss: Image[][] = make2D<Image>(2, 3, () => null!);
    public titleImage: Image = null!;
    public titleBats: Image[] = makeArray<Image>(3, () => null!);
    public gateBats: Image[] = makeArray<Image>(2, () => null!);
    public gates: Image = null!;
    public clouds: Image = null!;
    public castleMaps: Image[] = makeArray<Image>(2, () => null!);
    public castleBottom: Image = null!;
    public castleTop: Image = null!;
    public castleTrees: Image = null!;
    public axe: Image = null!;
    public boomerang: Image = null!;
    public weaponBorder: Image = null!;
    public smallHeart: Image = null!;
    public spark: Image = null!;
    public brickFragment: Image = null!;
    public torch: Image = null!;
    public droplets: Image = null!;
    public orb: Image = null!;
    public platform: Image = null!;
    public spikes: Image = null!;
    public bone: Image = null!;
    public sickle: Image = null!;
    public simonBack: Image = null!;
    public blank_32: Image = null!;
    public boss_1: Song = null!;
    public boss_2: Song = null!;
    public ending: Song = null!;
    public game_over: Music = null!;
    public map_1: Music = null!;
    public map_2: Music = null!;
    public map_3: Music = null!;
    public map_4: Music = null!;
    public prologue: Music = null!;
    public simon_killed: Music = null!;
    public stage_1_1: Song = null!;
    public stage_1_2: Song = null!;
    public stage_2_1: Song = null!;
    public stage_3_1: Song = null!;
    public stage_4_1: Song = null!;
    public stage_4_2: Song = null!;
    public stage_5_1: Song = null!;
    public stage_6_1: Song = null!;
    public stage_6_2: Song = null!;
    public stage_cleared: Music = null!;
    public dracula_dead: Music = null!;
    public advance_whip: Sound = null!;
    public bat_killed: Sound = null!;
    public bleep: Sound = null!;
    public boss_hurt: Sound = null!;
    public boss_killed_1: Sound = null!;
    public boss_killed_2: Sound = null!;
    public boss_killed_3: Sound = null!;
    public breaks_wall: Sound = null!;
    public crumble_sfx: Sound = null!;
    public dog_killed: Sound = null!;
    public door_opens_1: Sound = null!;
    public door_opens_2: Sound = null!;
    public gain_potion: Sound = null!;
    public got_money: Sound = null!;
    public heartbeat: Sound = null!;
    public hit_candle: Sound = null!;
    public killed_1: Sound = null!;
    public killed_2: Sound = null!;
    public killed_3: Sound = null!;
    public killed_4: Sound = null!;
    public killed_5: Sound = null!;
    public lose_potion: Sound = null!;
    public merman_spit: Sound = null!;
    public one_up: Sound = null!;
    public pressed_enter: Sound = null!;
    public simon_hurt: Sound = null!;
    public splash: Sound = null!;
    public torch_breaks: Sound = null!;
    public whip_1: Sound = null!;
    public whip_2: Sound = null!;
    public wing_flaps: Sound = null!;
    public zombie_killed: Sound = null!;
    public got_double: Sound = null!;
    public kill_all_sfx: Sound = null!;
    public simon_in_pit: Sound = null!;
    public threw_dagger: Sound = null!;
    public got_weapon: Sound = null!;
    public used_holy_water: Sound = null!;
    public spinning: Sound = null!;
    public raven_killed: Sound = null!;
    public ching: Sound = null!;
    public snuffed: Sound = null!;
    public medusa_head_killed: Sound = null!;
    public stunned: Sound = null!;
    public watch_tick: Sound = null!;
    public twang: Sound = null!;
    public large_bat_killed: Sound = null!;
    public thunder: Sound = null!;
    public fire_ball_shot: Sound = null!;
    public dracula_to_bats: Sound = null!;
    public lands: Sound = null!;
    public currentSong: Song | null = null;
    public requestedSong: Song | null = null;
    public currentMusic: Music | null = null;
    public loadingCompleteHandler: ((gc: GameContainer) => boolean) | null = null;
    private static readonly inputMappingChangedHandlers = new WeakMap<Main, () => MappingWriteResult>();
    private static readonly difficultyChangedHandlers = new WeakMap<Main, (difficulty: number) => boolean>();
    private browserSuspended: boolean = false;
    private input: Input | null = null;
    public buttonMapping: ButtonMapping = new ButtonMapping();
    public difficulty: number = Main.DIFFICULTY_NORMAL;
    public controlInput: StickvaniaInput | null = null;
    private inputConfigMode: InputConfigMode | null = null;
    private recordingIndex: number = 0;
    public constructor() {
        super("Stickvania");
        for (let i = 0; i < 3; i++) {
            this.demoKeyRecordings[i] = readBinaryResource("recordings/demo_" + (i + 1) + ".dat");
        }
        for (let i = 0; i < 12; i++) {
            this.endingKeyRecordings[i] = readBinaryResource("recordings/ending_" + (i + 1) + ".dat");
        }
    }

    public setDifficultyChangedHandler(handler: ((difficulty: number) => boolean) | null): void {
        if (handler === null) {
            Main.difficultyChangedHandlers.delete(this);
        } else {
            Main.difficultyChangedHandlers.set(this, handler);
        }
    }

    public setDifficulty(difficulty: number): void {
        this.difficulty = difficulty == Main.DIFFICULTY_HARD ? Main.DIFFICULTY_HARD : Main.DIFFICULTY_NORMAL;
        Main.difficultyChangedHandlers.get(this)?.(this.difficulty);
    }

    public override init(gc: GameContainer): void {
        for (let i: number = 0; i < this.fades.length; i++) {
            this.fades[i] = new Color(0, 0, 0, idiv(255 * i, this.fades.length));
        }

        this.input = gc.getInput();
        this.controlInput = new StickvaniaInput(this.input, this.buttonMapping);

        let pack1: PackedSpriteSheet = new PackedSpriteSheet("images/pack_1.def", Image.FILTER_NEAREST);
        let pack2: PackedSpriteSheet = new PackedSpriteSheet("images/pack_2.def", Image.FILTER_NEAREST);

        this.blank_32 = pack1.getSprite("blank_32");

        for (let i: number = 0; i < 26; i++) {
            this.symbols[cc("a") + i] = this.symbols[cc("A") + i] = pack1.getSprite("symbols_" + chr(cc("a") + i));
        }
        for (let i: number = 0; i < 10; i++) {
            this.symbols[cc("0") + i] = pack1.getSprite("symbols_" + i);
        }
        this.symbols[cc(" ")] = pack1.getSprite("blank_16");
        this.symbols[cc(":")] = pack1.getSprite("symbols_colon");
        this.symbols[cc(",")] = pack1.getSprite("symbols_comma");
        this.symbols[cc("@")] = pack1.getSprite("symbols_copyright");
        this.symbols[cc("=")] = pack1.getSprite("symbols_equals");
        this.symbols[cc("!")] = pack1.getSprite("symbols_exclamation");
        this.symbols[cc(">")] = pack1.getSprite("symbols_gt");
        this.symbols[cc("-")] = pack1.getSprite("symbols_hyphen");
        this.symbols[cc("<")] = pack1.getSprite("symbols_lt");
        this.symbols[cc(".")] = pack1.getSprite("symbols_period");
        this.symbols[cc("+")] = pack1.getSprite("symbols_plus");
        this.symbols[cc("?")] = pack1.getSprite("symbols_question");
        this.symbols[cc('"')] = pack1.getSprite("symbols_quotes");
        this.symbols[cc("^")] = pack1.getSprite("small_heart");

        this.power[0] = pack1.getSprite("power_1");
        this.power[1] = pack1.getSprite("power_2");
        this.weaponBorder = pack1.getSprite("weapon_border");

        this.blocks[Main.BLOCK_EMPTY] = pack1.getSprite("blank_32");
        this.blocks[Main.BLOCK_FULL] = pack1.getSprite("block_4");
        this.blocks[Main.BLOCK_E] = pack1.getSprite("block_2");
        this.blocks[Main.BLOCK_H] = this.blocks[Main.BLOCK_E].copy();
        this.blocks[Main.BLOCK_H].rotate(90);
        this.blocks[Main.BLOCK_I_UP] = pack1.getSprite("block_1");
        this.blocks[Main.BLOCK_I_DOWN] = this.blocks[Main.BLOCK_I_UP].getFlippedCopy(false, true);
        this.blocks[Main.BLOCK_I_LEFT] = this.blocks[Main.BLOCK_I_UP].copy();
        this.blocks[Main.BLOCK_I_LEFT].rotate(-90);
        this.blocks[Main.BLOCK_I_RIGHT] = this.blocks[Main.BLOCK_I_UP].copy();
        this.blocks[Main.BLOCK_I_RIGHT].rotate(90);
        this.blocks[Main.BLOCK_U_LEFT] = pack1.getSprite("block_3");
        this.blocks[Main.BLOCK_U_RIGHT] = pack1.getSprite("block_3").getFlippedCopy(true, false);
        this.blocks[Main.BLOCK_U_UP] = this.blocks[Main.BLOCK_U_LEFT].copy();
        this.blocks[Main.BLOCK_U_UP].rotate(90);
        this.blocks[Main.BLOCK_U_DOWN] = this.blocks[Main.BLOCK_U_LEFT].copy();
        this.blocks[Main.BLOCK_U_DOWN].rotate(-90);
        this.blocks[Main.BLOCK_L_UP_RIGHT] = pack1.getSprite("block_5");
        this.blocks[Main.BLOCK_L_DOWN_RIGHT] = this.blocks[Main.BLOCK_L_UP_RIGHT].getFlippedCopy(false, true);
        this.blocks[Main.BLOCK_L_UP_LEFT] = this.blocks[Main.BLOCK_L_UP_RIGHT].getFlippedCopy(true, false);
        this.blocks[Main.BLOCK_L_DOWN_LEFT] = this.blocks[Main.BLOCK_L_UP_RIGHT].getFlippedCopy(true, true);
        this.blocks[Main.BLOCK_STAIRS_LEFT] = pack1.getSprite("stairs_1");
        this.blocks[Main.BLOCK_STAIRS_RIGHT] = this.blocks[Main.BLOCK_STAIRS_LEFT].getFlippedCopy(true, false);
        this.blocks[Main.BLOCK_STAIRS_LEFT_CAPPED] = pack1.getSprite("stairs_2");
        this.blocks[Main.BLOCK_STAIRS_RIGHT_CAPPED] = this.blocks[Main.BLOCK_STAIRS_LEFT_CAPPED].getFlippedCopy(true, false);

        for (let i: number = 0; i < 3; i++) {
            this.simonWalking[Main.LEFT][i] = pack1.getSprite("simon_walking_" + (i + 1));
            this.simonWalking[Main.RIGHT][i] = this.simonWalking[Main.LEFT][i].getFlippedCopy(true, false);
        }
        this.simonKneeling[Main.LEFT] = pack1.getSprite("simon_kneeling");
        this.simonKneeling[Main.RIGHT] = this.simonKneeling[Main.LEFT].getFlippedCopy(true, false);
        this.simonOnStairsUp[Main.LEFT] = pack1.getSprite("simon_on_stairs_up");
        this.simonOnStairsUp[Main.RIGHT] = this.simonOnStairsUp[Main.LEFT].getFlippedCopy(true, false);
        this.simonOnStairsDown[Main.LEFT] = pack1.getSprite("simon_on_stairs_down");
        this.simonOnStairsDown[Main.RIGHT] = this.simonOnStairsDown[Main.LEFT].getFlippedCopy(true, false);
        this.simonWhipping[Main.LEFT][0] = pack1.getSprite("simon_whipping_1");
        this.simonWhipping[Main.LEFT][1] = pack1.getSprite("simon_whipping_2");
        this.simonWhipping[Main.LEFT][2] = pack1.getSprite("simon_whipping_3");
        this.simonWhipping[Main.RIGHT][0] = this.simonWhipping[Main.LEFT][0].getFlippedCopy(true, false);
        this.simonWhipping[Main.RIGHT][1] = this.simonWhipping[Main.LEFT][1].getFlippedCopy(true, false);
        this.simonWhipping[Main.RIGHT][2] = this.simonWhipping[Main.LEFT][2].getFlippedCopy(true, false);
        this.simonKneelWhipping[Main.LEFT][0] = pack1.getSprite("simon_kneel_whipping_1");
        this.simonKneelWhipping[Main.LEFT][1] = pack1.getSprite("simon_kneel_whipping_2");
        this.simonKneelWhipping[Main.LEFT][2] = pack1.getSprite("simon_kneel_whipping_3");
        this.simonKneelWhipping[Main.RIGHT][0] = this.simonKneelWhipping[Main.LEFT][0].getFlippedCopy(true, false);
        this.simonKneelWhipping[Main.RIGHT][1] = this.simonKneelWhipping[Main.LEFT][1].getFlippedCopy(true, false);
        this.simonKneelWhipping[Main.RIGHT][2] = this.simonKneelWhipping[Main.LEFT][2].getFlippedCopy(true, false);
        this.simonUpWhipping[Main.LEFT][0] = pack1.getSprite("simon_on_stairs_up_wipping_1");
        this.simonUpWhipping[Main.LEFT][1] = pack1.getSprite("simon_on_stairs_up_wipping_2");
        this.simonUpWhipping[Main.LEFT][2] = pack1.getSprite("simon_on_stairs_up_wipping_3");
        this.simonUpWhipping[Main.RIGHT][0] = this.simonUpWhipping[Main.LEFT][0].getFlippedCopy(true, false);
        this.simonUpWhipping[Main.RIGHT][1] = this.simonUpWhipping[Main.LEFT][1].getFlippedCopy(true, false);
        this.simonUpWhipping[Main.RIGHT][2] = this.simonUpWhipping[Main.LEFT][2].getFlippedCopy(true, false);
        this.simonDownWhipping[Main.LEFT][0] = pack1.getSprite("simon_on_stairs_down_wipping_1");
        this.simonDownWhipping[Main.LEFT][1] = pack1.getSprite("simon_on_stairs_down_wipping_2");
        this.simonDownWhipping[Main.LEFT][2] = pack1.getSprite("simon_on_stairs_down_wipping_3");
        this.simonDownWhipping[Main.RIGHT][0] = this.simonDownWhipping[Main.LEFT][0].getFlippedCopy(true, false);
        this.simonDownWhipping[Main.RIGHT][1] = this.simonDownWhipping[Main.LEFT][1].getFlippedCopy(true, false);
        this.simonDownWhipping[Main.RIGHT][2] = this.simonDownWhipping[Main.LEFT][2].getFlippedCopy(true, false);
        this.simonHurt[Main.LEFT] = pack1.getSprite("simon_hurt");
        this.simonHurt[Main.RIGHT] = this.simonHurt[Main.LEFT].getFlippedCopy(true, false);
        this.simonDead[Main.LEFT] = pack1.getSprite("simon_dead");
        this.simonDead[Main.RIGHT] = this.simonDead[Main.LEFT].getFlippedCopy(true, false);

        this.whips[Main.LEFT][Main.WHIP_LEATHER][0] = pack1.getSprite("whip_1_1");
        this.whips[Main.LEFT][Main.WHIP_LEATHER][1] = pack1.getSprite("whip_1_2");
        this.whips[Main.LEFT][Main.WHIP_LEATHER][2] = pack1.getSprite("whip_1_3");
        this.whips[Main.LEFT][Main.WHIP_SHORT_CHAIN][0] = pack1.getSprite("whip_2_1");
        this.whips[Main.LEFT][Main.WHIP_SHORT_CHAIN][1] = pack1.getSprite("whip_2_2");
        this.whips[Main.LEFT][Main.WHIP_SHORT_CHAIN][2] = pack1.getSprite("whip_2_3");
        this.whips[Main.LEFT][Main.WHIP_LONG_CHAIN][0] = this.whips[Main.LEFT][Main.WHIP_SHORT_CHAIN][0];
        this.whips[Main.LEFT][Main.WHIP_LONG_CHAIN][1] = this.whips[Main.LEFT][Main.WHIP_SHORT_CHAIN][1];
        this.whips[Main.LEFT][Main.WHIP_LONG_CHAIN][2] = pack1.getSprite("whip_3_3");

        this.whips[Main.RIGHT][Main.WHIP_LEATHER][0] = this.whips[Main.LEFT][Main.WHIP_LEATHER][0].getFlippedCopy(true, false);
        this.whips[Main.RIGHT][Main.WHIP_LEATHER][1] = this.whips[Main.LEFT][Main.WHIP_LEATHER][1].getFlippedCopy(true, false);
        this.whips[Main.RIGHT][Main.WHIP_LEATHER][2] = this.whips[Main.LEFT][Main.WHIP_LEATHER][2].getFlippedCopy(true, false);
        this.whips[Main.RIGHT][Main.WHIP_SHORT_CHAIN][0] = this.whips[Main.LEFT][Main.WHIP_SHORT_CHAIN][0].getFlippedCopy(true, false);
        this.whips[Main.RIGHT][Main.WHIP_SHORT_CHAIN][1] = this.whips[Main.LEFT][Main.WHIP_SHORT_CHAIN][1].getFlippedCopy(true, false);
        this.whips[Main.RIGHT][Main.WHIP_SHORT_CHAIN][2] = this.whips[Main.LEFT][Main.WHIP_SHORT_CHAIN][2].getFlippedCopy(true, false);
        this.whips[Main.RIGHT][Main.WHIP_LONG_CHAIN][0] = this.whips[Main.RIGHT][Main.WHIP_SHORT_CHAIN][0];
        this.whips[Main.RIGHT][Main.WHIP_LONG_CHAIN][1] = this.whips[Main.RIGHT][Main.WHIP_SHORT_CHAIN][1];
        this.whips[Main.RIGHT][Main.WHIP_LONG_CHAIN][2] = this.whips[Main.LEFT][Main.WHIP_LONG_CHAIN][2].getFlippedCopy(true, false);

        this.dropItems[DropItem.TYPE_AXE] = pack1.getSprite("axe");
        this.dropItems[DropItem.TYPE_CHEST] = pack1.getSprite("chest");
        this.dropItems[DropItem.TYPE_BOOMERANG] = pack1.getSprite("cross");
        this.dropItems[DropItem.TYPE_CROWN] = pack1.getSprite("crown");
        this.dropItems[DropItem.TYPE_DAGGER] = pack1.getSprite("dagger");
        this.dropItems[DropItem.TYPE_DOUBLE] = pack1.getSprite("double");
        this.dropItems[DropItem.TYPE_HOLY_WATER] = pack1.getSprite("holy_water");
        this.dropItems[DropItem.TYPE_KILL_ALL] = pack1.getSprite("kill_all");
        this.dropItems[DropItem.TYPE_LARGE_HEART] = pack1.getSprite("large_heart");
        this.dropItems[DropItem.TYPE_MEAT] = pack1.getSprite("meat");
        this.dropItems[DropItem.TYPE_MONEY_BAG] = pack1.getSprite("money_bag");
        this.dropItems[DropItem.TYPE_1UP] = pack1.getSprite("one_up");
        this.dropItems[DropItem.TYPE_POTION] = pack1.getSprite("potion");
        this.dropItems[DropItem.TYPE_STOP_WATCH] = pack1.getSprite("watch");
        this.dropItems[DropItem.TYPE_TRIPLE] = pack1.getSprite("triple");
        this.dropItems[DropItem.TYPE_WHIP] = pack1.getSprite("whip");

        this.daggers[Main.RIGHT] = pack1.getSprite("dagger");
        this.daggers[Main.LEFT] = this.daggers[Main.RIGHT].getFlippedCopy(true, false);
        this.boomerang = pack1.getSprite("boomerang");
        this.axe = pack1.getSprite("axe");
        this.holyWaters[Main.RIGHT] = pack1.getSprite("holy_water_2");
        this.holyWaters[Main.LEFT] = this.holyWaters[Main.RIGHT].getFlippedCopy(true, false);

        this.candles[0] = pack1.getSprite("candles_1");
        this.candles[1] = pack1.getSprite("candles_2");

        this.titleBats[0] = pack2.getSprite("title_bat_1");
        this.titleBats[1] = pack2.getSprite("title_bat_2");
        this.titleBats[2] = pack2.getSprite("title_bat_3");

        this.gateBats[0] = pack2.getSprite("gates_bat_1");
        this.gateBats[1] = pack2.getSprite("gates_bat_2");

        this.frankensteinBoss[Main.LEFT][0] = pack2.getSprite("frankenstein_1");
        this.frankensteinBoss[Main.LEFT][1] = pack2.getSprite("frankenstein_2");
        this.frankensteinBoss[Main.LEFT][2] = pack2.getSprite("frankenstein_3");
        this.frankensteinBoss[Main.RIGHT][0] = this.frankensteinBoss[Main.LEFT][0].getFlippedCopy(true, false);
        this.frankensteinBoss[Main.RIGHT][1] = this.frankensteinBoss[Main.LEFT][1].getFlippedCopy(true, false);
        this.frankensteinBoss[Main.RIGHT][2] = this.frankensteinBoss[Main.LEFT][2].getFlippedCopy(true, false);

        this.titleImage = new Image("images/title_screen.png", false, Image.FILTER_NEAREST).getSubImage(0, 1, 512, 278);
        this.gates = new Image("images/castle_gates.png", false, Image.FILTER_NEAREST).getSubImage(0, 1, 512, 350);
        this.clouds = pack2.getSprite("gates_clouds");

        this.ghosts[Main.LEFT][0] = pack1.getSprite("flaming_head_1");
        this.ghosts[Main.LEFT][1] = pack1.getSprite("flaming_head_2");
        this.ghosts[Main.RIGHT][0] = this.ghosts[Main.LEFT][0].getFlippedCopy(true, false);
        this.ghosts[Main.RIGHT][1] = this.ghosts[Main.LEFT][1].getFlippedCopy(true, false);

        this.birds[Main.LEFT][0] = pack2.getSprite("big_bird_1");
        this.birds[Main.LEFT][1] = pack2.getSprite("big_bird_2");
        this.birds[Main.RIGHT][0] = this.birds[Main.LEFT][0].getFlippedCopy(true, false);
        this.birds[Main.RIGHT][1] = this.birds[Main.LEFT][1].getFlippedCopy(true, false);

        this.axeKnights[Main.LEFT][0] = pack1.getSprite("axe_man_1");
        this.axeKnights[Main.LEFT][1] = pack1.getSprite("axe_man_2");
        this.axeKnights[Main.RIGHT][0] = this.axeKnights[Main.LEFT][0].getFlippedCopy(true, false);
        this.axeKnights[Main.RIGHT][1] = this.axeKnights[Main.LEFT][1].getFlippedCopy(true, false);

        this.boneDragons[0] = pack1.getSprite("dragon_head_1");
        this.boneDragons[1] = pack1.getSprite("dragon_head_2");
        this.boneDragons[2] = pack1.getSprite("dragon_neck");

        this.igors[Main.LEFT][0] = pack1.getSprite("monkey_1");
        this.igors[Main.LEFT][1] = pack1.getSprite("monkey_2");
        this.igors[Main.RIGHT][0] = this.igors[Main.LEFT][0].getFlippedCopy(true, false);
        this.igors[Main.RIGHT][1] = this.igors[Main.LEFT][1].getFlippedCopy(true, false);

        this.mummyBoss[Main.LEFT][0] = pack2.getSprite("mummy_boss_1");
        this.mummyBoss[Main.LEFT][1] = pack2.getSprite("mummy_boss_3");
        this.mummyBoss[Main.LEFT][2] = pack2.getSprite("mummy_boss_2");
        this.mummyBoss[Main.RIGHT][0] = this.mummyBoss[Main.LEFT][0].getFlippedCopy(true, false);
        this.mummyBoss[Main.RIGHT][1] = this.mummyBoss[Main.LEFT][1].getFlippedCopy(true, false);
        this.mummyBoss[Main.RIGHT][2] = this.mummyBoss[Main.LEFT][2].getFlippedCopy(true, false);

        this.wrappings[Main.LEFT][0] = pack1.getSprite("mummy_wrapping_1");
        this.wrappings[Main.LEFT][1] = pack1.getSprite("mummy_wrapping_2");
        this.wrappings[Main.RIGHT][0] = this.wrappings[Main.LEFT][0].getFlippedCopy(true, false);
        this.wrappings[Main.RIGHT][1] = this.wrappings[Main.LEFT][1].getFlippedCopy(true, false);

        this.ravens[Main.LEFT][0] = pack1.getSprite("crow_2");
        this.ravens[Main.LEFT][1] = pack1.getSprite("crow_3");
        this.ravens[Main.LEFT][2] = pack1.getSprite("crow_1");
        this.ravens[Main.LEFT][3] = pack1.getSprite("crow_4");
        this.ravens[Main.RIGHT][0] = this.ravens[Main.LEFT][0].getFlippedCopy(true, false);
        this.ravens[Main.RIGHT][1] = this.ravens[Main.LEFT][1].getFlippedCopy(true, false);
        this.ravens[Main.RIGHT][2] = this.ravens[Main.LEFT][2].getFlippedCopy(true, false);
        this.ravens[Main.RIGHT][3] = this.ravens[Main.LEFT][3].getFlippedCopy(true, false);

        this.grimReaperBoss[Main.LEFT] = pack2.getSprite("grim_reaper_boss");
        this.grimReaperBoss[Main.RIGHT] = this.grimReaperBoss[Main.LEFT].getFlippedCopy(true, false);

        this.skeletons[Main.LEFT][0] = pack1.getSprite("skeleton_1");
        this.skeletons[Main.LEFT][1] = pack1.getSprite("skeleton_2");
        this.skeletons[Main.RIGHT][0] = this.skeletons[Main.LEFT][0].getFlippedCopy(true, false);
        this.skeletons[Main.RIGHT][1] = this.skeletons[Main.LEFT][1].getFlippedCopy(true, false);

        this.crumble[0] = pack1.getSprite("crumble_1");
        this.crumble[1] = pack1.getSprite("crumble_2");

        this.itemPoints[FloatingPoints.TYPE_100] = pack1.getSprite("points_100");
        this.itemPoints[FloatingPoints.TYPE_400] = pack1.getSprite("points_400");
        this.itemPoints[FloatingPoints.TYPE_700] = pack1.getSprite("points_700");
        this.itemPoints[FloatingPoints.TYPE_1000] = pack1.getSprite("points_1000");
        this.itemPoints[FloatingPoints.TYPE_2000] = pack1.getSprite("points_2000");

        this.fires[0] = pack1.getSprite("fire_1");
        this.fires[1] = pack1.getSprite("fire_2");
        this.fires[2] = pack1.getSprite("fire_3");
        this.fires[3] = pack1.getSprite("fire_4");
        this.fires[4] = pack1.getSprite("fire_5");

        this.fireballs[Main.LEFT] = pack1.getSprite("fire_ball");
        this.fireballs[Main.RIGHT] = this.fireballs[Main.LEFT].getFlippedCopy(true, false);

        this.medusaHeads[Main.LEFT][0] = pack1.getSprite("flying_head_1");
        this.medusaHeads[Main.LEFT][1] = pack1.getSprite("flying_head_2");
        this.medusaHeads[Main.RIGHT][0] = this.medusaHeads[Main.LEFT][0].getFlippedCopy(true, false);
        this.medusaHeads[Main.RIGHT][1] = this.medusaHeads[Main.LEFT][1].getFlippedCopy(true, false);

        this.draculaBoss[Main.LEFT][0] = pack2.getSprite("dracula_head");
        this.draculaBoss[Main.LEFT][1] = pack2.getSprite("dracula_1");
        this.draculaBoss[Main.LEFT][2] = pack2.getSprite("dracula_2");
        this.draculaBoss[Main.LEFT][3] = pack2.getSprite("final_boss_1");
        this.draculaBoss[Main.LEFT][4] = pack2.getSprite("final_boss_2");
        this.draculaBoss[Main.LEFT][5] = pack2.getSprite("final_boss_3");
        this.draculaBoss[Main.LEFT][6] = pack2.getSprite("final_boss_4");
        this.draculaBoss[Main.RIGHT][0] = this.draculaBoss[Main.LEFT][0].getFlippedCopy(true, false);
        this.draculaBoss[Main.RIGHT][1] = this.draculaBoss[Main.LEFT][1].getFlippedCopy(true, false);
        this.draculaBoss[Main.RIGHT][2] = this.draculaBoss[Main.LEFT][2].getFlippedCopy(true, false);
        this.draculaBoss[Main.RIGHT][3] = this.draculaBoss[Main.LEFT][3].getFlippedCopy(true, false);
        this.draculaBoss[Main.RIGHT][4] = this.draculaBoss[Main.LEFT][4].getFlippedCopy(true, false);
        this.draculaBoss[Main.RIGHT][5] = this.draculaBoss[Main.LEFT][5].getFlippedCopy(true, false);
        this.draculaBoss[Main.RIGHT][6] = this.draculaBoss[Main.LEFT][6].getFlippedCopy(true, false);

        this.bonePillars[Main.LEFT] = pack1.getSprite("two_skulls");
        this.bonePillars[Main.RIGHT] = this.bonePillars[Main.LEFT].getFlippedCopy(true, false);

        this.torch = pack1.getSprite("large_torch");
        this.droplets = pack1.getSprite("droplets");
        this.orb = pack1.getSprite("orb");
        this.platform = pack1.getSprite("platform");
        this.spark = pack1.getSprite("spark");
        this.smallHeart = this.symbols[cc("^")];
        this.brickFragment = pack1.getSprite("brick_fragment");
        this.spikes = pack1.getSprite("spiked_platform");
        this.bone = pack1.getSprite("bone");
        this.sickle = pack1.getSprite("sickle");
        this.simonBack = pack2.getSprite("simon_back");

        this.doors[Main.RIGHT][0] = pack2.getSprite("door_1");
        this.doors[Main.LEFT][0] = this.doors[Main.RIGHT][0].getFlippedCopy(true, false);
        this.doors[Main.RIGHT][1] = pack2.getSprite("door_2");
        this.doors[Main.LEFT][1] = this.doors[Main.RIGHT][1].getFlippedCopy(true, false);
        this.doors[Main.RIGHT][2] = pack2.getSprite("door_3");
        this.doors[Main.LEFT][2] = this.doors[Main.RIGHT][2].getFlippedCopy(true, false);

        this.medusaBoss[0] = pack2.getSprite("medusa_boss_1");
        this.medusaBoss[1] = pack2.getSprite("medusa_boss_2");

        this.snakes[Main.RIGHT][0] = pack1.getSprite("snakes_1");
        this.snakes[Main.RIGHT][1] = pack1.getSprite("snakes_2");
        this.snakes[Main.LEFT][0] = this.snakes[Main.RIGHT][0].getFlippedCopy(true, false);
        this.snakes[Main.LEFT][1] = this.snakes[Main.RIGHT][1].getFlippedCopy(true, false);

        this.zombies[Main.LEFT][0] = pack1.getSprite("zombie_1");
        this.zombies[Main.LEFT][1] = pack1.getSprite("zombie_2");
        this.zombies[Main.RIGHT][0] = this.zombies[Main.LEFT][0].getFlippedCopy(true, false);
        this.zombies[Main.RIGHT][1] = this.zombies[Main.LEFT][1].getFlippedCopy(true, false);

        this.mermen[Main.LEFT][0] = pack1.getSprite("water_monster_1");
        this.mermen[Main.LEFT][1] = pack1.getSprite("water_monster_2");
        this.mermen[Main.LEFT][2] = pack1.getSprite("water_monster_3");
        this.mermen[Main.RIGHT][0] = this.mermen[Main.LEFT][0].getFlippedCopy(true, false);
        this.mermen[Main.RIGHT][1] = this.mermen[Main.LEFT][1].getFlippedCopy(true, false);
        this.mermen[Main.RIGHT][2] = this.mermen[Main.LEFT][2].getFlippedCopy(true, false);

        this.bats[Main.LEFT][0] = pack1.getSprite("bat_1");
        this.bats[Main.LEFT][1] = pack1.getSprite("bat_2");
        this.bats[Main.LEFT][2] = pack1.getSprite("bat_3");
        this.bats[Main.LEFT][3] = pack1.getSprite("bat_4");
        this.bats[Main.RIGHT][0] = this.bats[Main.LEFT][0].getFlippedCopy(true, false);
        this.bats[Main.RIGHT][1] = this.bats[Main.LEFT][1].getFlippedCopy(true, false);
        this.bats[Main.RIGHT][2] = this.bats[Main.LEFT][2].getFlippedCopy(true, false);
        this.bats[Main.RIGHT][3] = this.bats[Main.LEFT][3].getFlippedCopy(true, false);

        this.dogs[Main.LEFT][0] = pack1.getSprite("dog_1");
        this.dogs[Main.LEFT][1] = pack1.getSprite("dog_2");
        this.dogs[Main.LEFT][2] = pack1.getSprite("dog_3");
        this.dogs[Main.LEFT][3] = pack1.getSprite("dog_4");
        this.dogs[Main.RIGHT][0] = this.dogs[Main.LEFT][0].getFlippedCopy(true, false);
        this.dogs[Main.RIGHT][1] = this.dogs[Main.LEFT][1].getFlippedCopy(true, false);
        this.dogs[Main.RIGHT][2] = this.dogs[Main.LEFT][2].getFlippedCopy(true, false);
        this.dogs[Main.RIGHT][3] = this.dogs[Main.LEFT][3].getFlippedCopy(true, false);

        this.batBoss[0] = pack2.getSprite("bat_boss_1");
        this.batBoss[1] = pack2.getSprite("bat_boss_2");
        this.batBoss[2] = pack2.getSprite("bat_boss_3");

        this.lanceKnight[Main.LEFT][0] = pack1.getSprite("knight_1");
        this.lanceKnight[Main.LEFT][1] = pack1.getSprite("knight_2");
        this.lanceKnight[Main.LEFT][2] = pack1.getSprite("knight_3");
        this.lanceKnight[Main.RIGHT][0] = this.lanceKnight[Main.LEFT][0].getFlippedCopy(true, false);
        this.lanceKnight[Main.RIGHT][1] = this.lanceKnight[Main.LEFT][1].getFlippedCopy(true, false);
        this.lanceKnight[Main.RIGHT][2] = this.lanceKnight[Main.LEFT][2].getFlippedCopy(true, false);

        this.castleMaps[0] = new Image("images/map_1.png", false, Image.FILTER_NEAREST).getSubImage(1, 1, 384, 289);
        this.castleMaps[1] = new Image("images/map_2.png", false, Image.FILTER_NEAREST).getSubImage(1, 1, 384, 289);

        this.castleBottom = pack2.getSprite("ending_castle_bottom");
        this.castleTop = pack2.getSprite("ending_castle_top");
        this.castleTrees = new Image("images/ending.png", false, Image.FILTER_NEAREST).getSubImage(1, 1, 510, 174);

        this.simon = new Simon(this);

        this.loadedSegments = makeArray<StageSegment[]>(6, () => []);

        this.loadedSegments[0] = makeArray<StageSegment>(2, () => null!);
        this.loadStageSegment(0, 0);
        this.loadStageSegment(0, 1);

        this.loadedSegments[1] = makeArray<StageSegment>(4, () => null!);
        this.loadStageSegment(1, 0);
        this.loadStageSegment(1, 1);
        this.loadStageSegment(1, 2);
        this.loadStageSegment(1, 3);

        this.loadedSegments[2] = makeArray<StageSegment>(3, () => null!);
        this.loadStageSegment(2, 0);
        this.loadStageSegment(2, 1);
        this.loadStageSegment(2, 2);

        this.loadedSegments[3] = makeArray<StageSegment>(2, () => null!);
        this.loadStageSegment(3, 0);
        this.loadStageSegment(3, 1);

        this.loadedSegments[4] = makeArray<StageSegment>(4, () => null!);
        this.loadStageSegment(4, 0);
        this.loadStageSegment(4, 1);
        this.loadStageSegment(4, 2);
        this.loadStageSegment(4, 3);

        this.loadedSegments[5] = makeArray<StageSegment>(3, () => null!);
        this.loadStageSegment(5, 0);
        this.loadStageSegment(5, 1);
        this.loadStageSegment(5, 2);

        gc.setIcon("images/icon.png");

        this.advance_whip = new Sound("soundfx/advance_whip.ogg");
        this.bat_killed = new Sound("soundfx/bat_killed.ogg");
        this.bleep = new Sound("soundfx/bleep.ogg");
        this.boss_hurt = new Sound("soundfx/boss_hurt.ogg");
        this.boss_killed_1 = new Sound("soundfx/boss_killed_1.ogg");
        this.boss_killed_2 = new Sound("soundfx/boss_killed_2.ogg");
        this.boss_killed_3 = new Sound("soundfx/boss_killed_3.ogg");
        this.breaks_wall = new Sound("soundfx/breaks_wall.ogg");
        this.crumble_sfx = new Sound("soundfx/crumble.ogg");
        this.dog_killed = new Sound("soundfx/dog_killed.ogg");
        this.door_opens_1 = new Sound("soundfx/door_opens_1.ogg");
        this.door_opens_2 = new Sound("soundfx/door_opens_2.ogg");
        this.gain_potion = new Sound("soundfx/gain_potion.ogg");
        this.got_money = new Sound("soundfx/got_money.ogg");
        this.heartbeat = new Sound("soundfx/heartbeat.ogg");
        this.hit_candle = new Sound("soundfx/hit_candle.ogg");
        this.killed_1 = new Sound("soundfx/killed_1.ogg");
        this.killed_2 = new Sound("soundfx/killed_2.ogg");
        this.killed_3 = new Sound("soundfx/killed_3.ogg");
        this.killed_4 = new Sound("soundfx/killed_4.ogg");
        this.killed_5 = new Sound("soundfx/killed_5.ogg");
        this.lose_potion = new Sound("soundfx/lose_potion.ogg");
        this.merman_spit = new Sound("soundfx/merman_spit.ogg");
        this.one_up = new Sound("soundfx/one_up.ogg");
        this.pressed_enter = new Sound("soundfx/pressed_enter.ogg");
        this.simon_hurt = new Sound("soundfx/simon_hurt.ogg");
        this.splash = new Sound("soundfx/splash.ogg");
        this.torch_breaks = new Sound("soundfx/torch_breaks.ogg");
        this.whip_1 = new Sound("soundfx/whip_1.ogg");
        this.whip_2 = new Sound("soundfx/whip_2.ogg");
        this.wing_flaps = new Sound("soundfx/wing_flaps.ogg");
        this.zombie_killed = new Sound("soundfx/zombie_killed.ogg");
        this.got_double = new Sound("soundfx/got_double.ogg");
        this.kill_all_sfx = new Sound("soundfx/kill_all_sfx.ogg");
        this.simon_in_pit = new Sound("soundfx/simon_in_pit.ogg");
        this.threw_dagger = new Sound("soundfx/threw_dagger.ogg");
        this.got_weapon = new Sound("soundfx/got_weapon.ogg");
        this.used_holy_water = new Sound("soundfx/used_holy_water.ogg");
        this.spinning = new Sound("soundfx/spinning.ogg");
        this.raven_killed = new Sound("soundfx/raven_killed.ogg");
        this.ching = new Sound("soundfx/ching.ogg");
        this.snuffed = new Sound("soundfx/snuffed.ogg");
        this.medusa_head_killed = new Sound("soundfx/medusa_head_killed.ogg");
        this.stunned = new Sound("soundfx/stunned.ogg");
        this.watch_tick = new Sound("soundfx/watch_tick.ogg");
        this.twang = new Sound("soundfx/twang.ogg");
        this.large_bat_killed = new Sound("soundfx/large_bat_killed.ogg");
        this.thunder = new Sound("soundfx/thunder.ogg");
        this.fire_ball_shot = new Sound("soundfx/fire_ball_shot.ogg");
        this.dracula_to_bats = new Sound("soundfx/dracula_to_bats.ogg");
        this.lands = new Sound("soundfx/lands.ogg");

        this.nextFrameTime = Sys.getTime();
        this.completeStartup(gc);
    }

    public override update(gc: GameContainer, delta: number): void {
        if (this.browserSuspended) {
            this.nextFrameTime = Sys.getTime();
            return;
        }

        let count: number = 0;
        // Preserve the Java/LWJGL timing expression exactly: 1000 / 91 truncates to a 10 ms (100 TPS) step.
        while (this.nextFrameTime < Sys.getTime()) {
            this.updateFrame(gc);
            this.nextFrameTime += idiv(Sys.getTimerResolution(), 91);
            if (++count == 8) {
                this.nextFrameTime = Sys.getTime();
                break;
            }
        }
    }

    private updateFrame(gc: GameContainer): void {
        if (this.currentSong != this.requestedSong && this.mode == Main.MODE_PLAYING) {
            if (this.currentSong != null) {
                this.currentSong.stop();
            }
            this.currentSong = this.requestedSong;
            this.currentMusic = null;
            this.currentSong!.play();
        }
        if (this.currentSong != null) {
            this.currentSong.update();
        }

        this.controlInput!.update();

        if (this.fadeState == Main.FADE_IN) {
            if (this.fade == 0) {
                this.fadeState = Main.FADE_DONE;
            } else {
                this.fade--;
                return;
            }
        } else if (this.fadeState == Main.FADE_OUT) {
            if (this.fade == 22) {
                switch (this.fadeReason) {
                    case Main.FADE_REASON_STAIRS:
                        this.followStairsToNextSegment();
                        break;
                    case Main.FADE_REASON_RESTORE_CHECKPOINT:
                        this.mode = Main.MODE_PLAYING;
                        this.players--;
                        this.createStage(this.stageIndex, false);
                        this.clearInputPressedRecords();
                        this.simon?.resetInputReleaseLatches();
                        break;
                    case Main.FADE_REASON_SHOW_MAP:
                        this.initMapScreen();
                        break;
                    case Main.FADE_REASON_SHOW_CASTLE_FALLS:
                        this.initCastleFalls();
                        break;
                    case Main.FADE_REASON_SHOW_INTRO:
                        this.initIntro();
                        break;
                    case Main.FADE_REASON_SHOW_CONTINUE_SCREEN:
                        this.initContinueScreen();
                        break;
                    case Main.FADE_REASON_SHOW_TITLE_SCREEN:
                        this.initTitleScreen();
                        break;
                    case Main.FADE_REASON_SHOW_DEMO:
                        this.initDemo();
                        break;
                    case Main.FADE_REASON_SHOW_CREDITS:
                        this.initCredits();
                        break;
                    case Main.FADE_REASON_ADVANCE_CREDITS:
                        this.advanceCredits();
                        break;
                    case Main.FADE_REASON_SHOW_INPUT_CONFIG:
                        this.initInputConfig(gc);
                        break;
                }
                this.fadeState = Main.FADE_IN;
                return;
            } else {
                this.fade++;
                return;
            }
        }

        switch (this.mode) {
            case Main.MODE_TITLE_SCREEN:
                this.updateTitleScreen(gc);
                return;
            case Main.MODE_CONTINUE_SCREEN:
                this.updateContinueScreen(gc);
                return;
            case Main.MODE_INTRO:
                this.updateIntro(gc);
                return;
            case Main.MODE_MAP:
                this.updateMapScreen(gc);
                return;
            case Main.MODE_CASTLE_FALLS:
                this.updateCastleFalls(gc);
                return;
            case Main.MODE_CREDITS:
                this.updateCredits(gc);
                if (this.creditsPaused) {
                    return;
                }
                break;
            case Main.MODE_INPUT_CONFIG:
                this.updateInputConfig(gc);
                return;
        }

        this.syncSimonPhysicsProfile();

        if (this.beatStageFlag) {
            if (this.beatStageDelay > 0) {
                this.beatStageDelay--;
            } else if (this.playerPower != 16) {
                this.playerPower++;
                this.beatStageDelay = 7;
                this.playSound(this.twang);
            } else if (this.time > 0) {
                this.time--;
                this.addPoints(10);
                if (this.time % 5 == 0) {
                    this.playSound(this.twang);
                }
                this.beatStageDelay = 1;
            } else if (this.hearts > 0) {
                this.hearts--;
                this.addPoints(100);
                this.beatStageDelay = 10;
                this.playSound(this.twang);
            } else {
                if (this.stageIndex == 2) {
                    this.beatStageFlag = false;
                    this.floorBreaking = true;
                    this.pushThing(new FloorBreaker(this));
                } else if (this.stageIndex == 5) {
                    this.fadeState = Main.FADE_OUT;
                    this.fadeReason = Main.FADE_REASON_SHOW_CASTLE_FALLS;
                } else {
                    this.fadeState = Main.FADE_OUT;
                    this.fadeReason = Main.FADE_REASON_SHOW_MAP;
                }
            }
            return;
        }

        if (this.simon!.dead > 473) {
            this.fadeState = Main.FADE_OUT;
            if (this.players == 0) {
                this.fadeReason = Main.FADE_REASON_SHOW_CONTINUE_SCREEN;
            } else {
                this.fadeReason = Main.FADE_REASON_RESTORE_CHECKPOINT;
            }
            return;
        }

        if (this.simon!.flashing > 0) {
            this.simon!.flashing--;
            this.flashSimon();
            return;
        }

        if (this.door != null) {
            this.door.update(gc);
            return;
        }

        if (this.timeFrozen == 0 && ++this.timeIncrementor == 91 && this.playerPower > 0 && !this.floorBreaking) {
            this.timeIncrementor = 0;
            this.time--;
            if (this.time <= 0) {
                this.time = 0;
                this.hurtSimon(16);
            }
        }

        this.updateSimon(gc);
        this.moveCamera();

        if (this.fadeState == Main.FADE_OUT) {
            return;
        }

        if (this.repeatsFlashing > 0) {
            this.repeatsFlashing--;
        }

        if (this.killAllFlag) {
            this.killAllFlag = false;
            const things = this.regionThingStack.things;
            for (let i: number = this.regionThingStack.top; i >= 0; i--) {
                things[i]!.kill = true;
            }
        }

        let thing: Thing | null = null;
        while ((thing = this.regionThingStack.pop()) != null) {
            if (thing.update(gc)) {
                this.regionStackSwap.push(thing);
            }
        }
        let tempThingStack: ThingStack = this.regionThingStack;
        this.regionThingStack = this.regionStackSwap;
        this.regionStackSwap = tempThingStack;

        while ((thing = this.weaponsStack.pop()) != null) {
            if (thing.update(gc)) {
                this.weaponsStackSwap.push(thing);
            }
        }
        tempThingStack = this.weaponsStack;
        this.weaponsStack = this.weaponsStackSwap;
        this.weaponsStackSwap = tempThingStack;

        for (let i: number = this.platforms!.length - 1; i >= 0; i--) {
            this.platforms![i]!.update(gc);
        }

        // updateSimon() can enter a door after the earlier null check. A local
        // explicitly widens the property again after that side-effecting call.
        const enteredDoor = this.door as Door | null;
        if (enteredDoor != null) {
            this.oldThingStack.clear();
            this.oldThingStack.addAll(this.regionThingStack);

            enteredDoor.state = Door.STATE_SCROLL_1;
            if (enteredDoor.direction == Main.RIGHT) {
                enteredDoor.doorScroll1 = trunc(enteredDoor.x) - 264;
                enteredDoor.doorScroll2 = trunc(enteredDoor.x) + 24;
            } else {
                enteredDoor.doorScroll1 = trunc(enteredDoor.x) - 256;
                enteredDoor.doorScroll2 = trunc(enteredDoor.x) - 521;
            }

            let thingStack: ThingStack = this.stageSegment!.regions[this.stageSegment!.regionIndex].thingStack;
            thingStack.clear();
            thingStack.addAll(this.regionThingStack);

            if (enteredDoor.direction == Main.RIGHT) {
                this.stageSegment!.regionIndex++;
            } else {
                this.stageSegment!.regionIndex--;
            }
            let region: Region = this.stageSegment!.regions[this.stageSegment!.regionIndex];
            this.requestedSong = region.checkpoint.song;
            this.stage = region.stageNumber;
            this.simon!.xMin = region.min;
            this.simon!.xMax = region.max;
            this.regionThingStack.clear();
            this.regionThingStack.addAll(region.thingStack);
            this.weaponsStack.clear();
            this.timeFrozen = 0;
            this.killAllFlag = false;
        }
    }

    private updateSimon(gc: GameContainer): void {
        if (this.simon!.invincible > 0) {
            if (this.simon!.invincible > 705) {
                this.setSimonAlpha(javaFloat(0.25 + javaFloat((this.simon!.invincible - 705) * Main.INVINCIBLE_FRACTION)));
            } else if (this.simon!.drankPotion && this.simon!.invincible == 23) {
                this.simon!.drankPotion = false;
                this.playSound(this.lose_potion);
            } else if (this.simon!.invincible < 23) {
                this.setSimonAlpha(javaFloat(0.25 + javaFloat((23 - this.simon!.invincible) * Main.INVINCIBLE_FRACTION)));
            }

            this.simon!.invincible--;
            if (this.simon!.invincible == 0) {
                this.setSimonAlpha(1);
            }
        }

        let handledUp: boolean = false;
        let handledDown: boolean = false;

        this.simon!.lastX = javaFloat(this.simon!.x);
        this.simon!.lastY = javaFloat(this.simon!.y);

        if (this.simon!.y > 416) {
            if (!this.floorBreaking) {
                if (this.playerPower > 0) {
                    this.playSound(this.simon_in_pit);
                    this.requestMusic(this.simon_killed);
                }
                this.playerPower = 0;
                this.simon!.dead++;
            }
            return;
        }

        if (this.simon!.hurt) {
            this.simon!.update(gc);
            return;
        }

        let keyDownUp: boolean = this.controlInput!.isUp();
        let keyDownDown: boolean = this.controlInput!.isDown();
        let keyDownLeft: boolean = this.controlInput!.isLeft();
        let keyDownRight: boolean = this.controlInput!.isRight();
        let keyDownJump: boolean = this.controlInput!.isJump();
        const keyDownAttack: boolean = this.controlInput!.isAttack();
        const wantsSubWeapon: boolean = keyDownAttack && keyDownUp;
        let keyDownSubWeapon: boolean = wantsSubWeapon && this.canSelectSubWeapon();
        let keyDownWhip: boolean = keyDownAttack && (!wantsSubWeapon || !keyDownSubWeapon);

        if (this.mode == Main.MODE_DEMO || this.mode == Main.MODE_CREDITS) {
            if (this.mode == Main.MODE_DEMO) {
                if (this.recordingIndex == 2730 || this.controlInput!.isAnyNonDirectionalPressed()) {
                    this.stopAllSoundEffects();
                    this.fadeState = Main.FADE_OUT;
                    this.fadeReason = Main.FADE_REASON_SHOW_TITLE_SCREEN;
                    return;
                }
            } else {
                if (this.recordingIndex == 728 || this.creditsIndex == 12 || this.creditsPresents) {
                    return;
                }
            }

            let keyDown: number =
                this.mode == Main.MODE_DEMO
                    ? this.demoKeyRecordings[this.demoIndex][this.recordingIndex++]
                    : this.endingKeyRecordings[this.creditsIndex][this.recordingIndex++];
            keyDownRight = (keyDown & 1) == 1;
            keyDown >>= 1;
            keyDownLeft = (keyDown & 1) == 1;
            keyDown >>= 1;
            keyDownDown = (keyDown & 1) == 1;
            keyDown >>= 1;
            keyDownUp = (keyDown & 1) == 1;
            keyDown >>= 1;
            keyDownSubWeapon = (keyDown & 1) == 1;
            keyDown >>= 1;
            keyDownWhip = (keyDown & 1) == 1;
            keyDownJump = keyDownUp;
        }

        if (!keyDownWhip && !keyDownSubWeapon) {
            this.simon!.releasedWhip = true;
        }
        if (this.simon!.whipping) {
            this.simon!.whipIncrementor++;
            if (this.simon!.whipIncrementor == 10) {
                this.simon!.whipIndex = 1;
            } else if (this.simon!.whipIncrementor == 20) {
                this.simon!.whipIndex = 2;
                if (this.simon!.throwing) {
                    this.throwWeapon();
                }
            } else if (this.simon!.whipIncrementor == 45) {
                this.simon!.whipping = false;
                this.simon!.throwing = false;
            }
        } else if (this.simon!.releasedWhip) {
            if (keyDownWhip) {
                if (this.simon!.whipType == 0) {
                    this.playSound(this.whip_1);
                } else {
                    this.playSound(this.whip_2);
                }
                this.simon!.whipping = true;
                this.simon!.whipIncrementor = 0;
                this.simon!.whipIndex = 0;
                this.simon!.releasedWhip = false;
            } else if (keyDownSubWeapon && this.canUseSubWeapon()) {
                this.simon!.throwing = true;
                this.simon!.whipping = true;
                this.simon!.whipIncrementor = 0;
                this.simon!.whipIndex = 0;
                this.simon!.releasedWhip = false;
            }
        }

        if (this.simon!.onStairs) {
            if (this.simon!.y <= -62 || this.simon!.y >= 285) {
                this.fadeState = Main.FADE_OUT;
                this.fadeReason = Main.FADE_REASON_STAIRS;
                return;
            }

            this.simon!.releasedJump = false;
            this.simon!.releasedKneel = false;
            if (!this.simon!.whipping) {
                if (keyDownUp || (this.simon!.rightStairs && keyDownRight) || (!this.simon!.rightStairs && keyDownLeft)) {
                    handledUp = true;
                    let tile: number = this.getTile(trunc(this.simon!.x) + 31, trunc(this.simon!.y) + 63);
                    if (tile == Main.BLOCK_STAIRS_RIGHT || tile == Main.BLOCK_STAIRS_RIGHT_CAPPED) {
                        this.simon!.y = javaFloat(this.simon!.y - 1);
                        this.simon!.x = javaFloat(this.simon!.x + 1);
                        this.simon!.up = true;
                        this.simon!.direction = Main.RIGHT;
                    } else if (tile == Main.BLOCK_STAIRS_LEFT || tile == Main.BLOCK_STAIRS_LEFT_CAPPED) {
                        this.simon!.y = javaFloat(this.simon!.y - 1);
                        this.simon!.x = javaFloat(this.simon!.x - 1);
                        this.simon!.up = true;
                        this.simon!.direction = Main.LEFT;
                    } else {
                        this.simon!.onStairs = false;
                        this.simon!.walkSpriteIndex = 0;
                    }
                } else if (keyDownDown || (!this.simon!.rightStairs && keyDownRight) || (this.simon!.rightStairs && keyDownLeft)) {
                    handledDown = true;
                    let tile: number = this.getTile(trunc(this.simon!.x) + 31, trunc(this.simon!.y) + 63);
                    if (tile == Main.BLOCK_STAIRS_RIGHT || tile == Main.BLOCK_STAIRS_RIGHT_CAPPED) {
                        tile = this.getTile(trunc(this.simon!.x) + 30, trunc(this.simon!.y) + 64);
                        if (tile != Main.BLOCK_STAIRS_RIGHT && tile != Main.BLOCK_STAIRS_RIGHT_CAPPED) {
                            this.simon!.onStairs = false;
                            this.simon!.walkSpriteIndex = 0;
                        } else {
                            this.simon!.y = javaFloat(this.simon!.y + 1);
                            this.simon!.x = javaFloat(this.simon!.x - 1);
                            this.simon!.up = false;
                            this.simon!.direction = Main.LEFT;
                        }
                    } else if (tile == Main.BLOCK_STAIRS_LEFT || tile == Main.BLOCK_STAIRS_LEFT_CAPPED) {
                        tile = this.getTile(trunc(this.simon!.x) + 32, trunc(this.simon!.y) + 64);
                        if (tile != Main.BLOCK_STAIRS_LEFT && tile != Main.BLOCK_STAIRS_LEFT_CAPPED) {
                            this.simon!.onStairs = false;
                            this.simon!.walkSpriteIndex = 0;
                        } else {
                            this.simon!.y = javaFloat(this.simon!.y + 1);
                            this.simon!.x = javaFloat(this.simon!.x + 1);
                            this.simon!.up = false;
                            this.simon!.direction = Main.RIGHT;
                        }
                    } else {
                        this.simon!.onStairs = false;
                        this.simon!.walkSpriteIndex = 0;
                    }
                }
            }
        }

        if (this.simon!.supported && !this.simon!.onStairs && keyDownUp && !this.simon!.whipping) {
            let tile: number = this.getTile(trunc(this.simon!.x) + 31, trunc(this.simon!.y) + 63);

            if (tile == Main.BLOCK_STAIRS_RIGHT) {
                this.simon!.walkLeft();
                handledUp = true;
            }
            tile = this.getTile(trunc(this.simon!.x) + 63, trunc(this.simon!.y) + 63);
            if (tile == Main.BLOCK_STAIRS_RIGHT) {
                this.simon!.walkRight();
                handledUp = true;
                if (Math.abs(javaFloat((((trunc(this.simon!.x) + 31) >> 5) << 5) - javaFloat(this.simon!.x + 31))) <= 2) {
                    this.simon!.onStairs = true;
                    this.simon!.kneeling = false;
                    this.simon!.rightStairs = true;
                    this.simon!.y = javaFloat(this.simon!.y - 1);
                    this.simon!.up = true;
                    this.simon!.x = javaFloat((((trunc(this.simon!.x) + 31) >> 5) << 5) - 30);
                }
            }

            tile = this.getTile(trunc(this.simon!.x) + 31, trunc(this.simon!.y) + 63);
            if (tile == Main.BLOCK_STAIRS_LEFT) {
                this.simon!.walkRight();
                handledUp = true;
            }
            tile = this.getTile(trunc(this.simon!.x) + 1, trunc(this.simon!.y) + 63);
            if (tile == Main.BLOCK_STAIRS_LEFT) {
                if (Math.abs(javaFloat((((trunc(this.simon!.x) + 1) >> 5) << 5) - this.simon!.x)) <= 2) {
                    this.simon!.onStairs = true;
                    this.simon!.kneeling = false;
                    this.simon!.rightStairs = false;
                    this.simon!.y = javaFloat(this.simon!.y - 1);
                    this.simon!.up = true;
                    this.simon!.x = javaFloat((((trunc(this.simon!.x) + 1) >> 5) << 5) - 1);
                } else {
                    this.simon!.walkLeft();
                }
                handledUp = true;
            }
        }

        if (this.simon!.supported && !this.simon!.onStairs && keyDownDown && !this.simon!.whipping) {
            let tile: number = this.getTile(trunc(this.simon!.x) + 33, trunc(this.simon!.y) + 64);
            if (tile == Main.BLOCK_STAIRS_RIGHT || tile == Main.BLOCK_STAIRS_RIGHT_CAPPED) {
                this.simon!.walkRight();
                handledDown = true;
            }
            tile = this.getTile(trunc(this.simon!.x) + 1, trunc(this.simon!.y) + 64);
            if (tile == Main.BLOCK_STAIRS_RIGHT || tile == Main.BLOCK_STAIRS_RIGHT_CAPPED) {
                if (Math.abs(javaFloat((((trunc(this.simon!.x) + 33) >> 5) << 5) - javaFloat(this.simon!.x + 31))) <= 2) {
                    this.simon!.onStairs = true;
                    this.simon!.kneeling = false;
                    this.simon!.rightStairs = true;
                    handledDown = true;
                    this.simon!.y = javaFloat(this.simon!.y + 1);
                    this.simon!.up = false;
                    this.simon!.x = javaFloat((((trunc(this.simon!.x) + 33) >> 5) << 5) - 32);
                } else {
                    this.simon!.walkLeft();
                }
                handledDown = true;
            }

            tile = this.getTile(trunc(this.simon!.x) + 63, trunc(this.simon!.y) + 64);
            if (tile == Main.BLOCK_STAIRS_LEFT || tile == Main.BLOCK_STAIRS_LEFT_CAPPED) {
                this.simon!.walkRight();
                handledDown = true;
            }

            tile = this.getTile(trunc(this.simon!.x) + 31, trunc(this.simon!.y) + 64);
            if (tile == Main.BLOCK_STAIRS_LEFT || tile == Main.BLOCK_STAIRS_LEFT_CAPPED) {
                if (Math.abs(javaFloat(((((trunc(this.simon!.x) + 31) >> 5) - 1) << 5) - this.simon!.x)) <= 2) {
                    this.simon!.onStairs = true;
                    this.simon!.kneeling = false;
                    this.simon!.rightStairs = false;
                    handledDown = true;
                    this.simon!.y = javaFloat(this.simon!.y + 1);
                    this.simon!.up = false;
                    this.simon!.x = javaFloat(((((trunc(this.simon!.x) + 31) >> 5) - 1) << 5) + 1);
                } else {
                    this.simon!.walkLeft();
                }
                handledDown = true;
            }
        }

        if (!this.simon!.onStairs) {
            if (!handledUp && !handledDown && !(this.simon!.whipping && this.simon!.supported)) {
                if (keyDownDown) {
                    if (this.simon!.releasedKneel) {
                        this.simon!.kneel();
                        this.simon!.releasedKneel = false;
                        if (keyDownLeft) {
                            this.simon!.direction = Main.LEFT;
                        }
                        if (keyDownRight) {
                            this.simon!.direction = Main.RIGHT;
                        }
                    }
                } else {
                    this.simon!.releasedKneel = true;
                    let walking: boolean = false;
                    if (keyDownLeft) {
                        this.simon!.walkLeft();
                        walking = true;
                    }
                    if (keyDownRight) {
                        this.simon!.walkRight();
                        walking = true;
                    }
                    if (!walking) {
                        this.simon!.stand();
                    }
                    if (keyDownJump) {
                        if (this.simon!.releasedJump && this.simon!.supported) {
                            this.simon!.vy = javaFloat(this.simon!.jumpVelocity);
                        }
                        this.simon!.releasedJump = false;
                    } else {
                        this.simon!.releasedJump = true;
                    }
                }
            }

            this.simon!.update(gc);
        }
    }

    public moveCamera(): void {
        this.camera = trunc(javaFloat(this.simon!.x - 224));
        if (this.camera > this.simon!.xMax - 512) {
            this.camera = this.simon!.xMax - 512;
        } else if (this.camera < this.simon!.xMin) {
            this.camera = this.simon!.xMin;
        }
        if (this.camera < 0) {
            this.camera = 0;
        }
    }

    public followStairsToNextSegment(): void {
        this.visibleWhipCount = 0;

        let thingStack: ThingStack = this.stageSegment!.regions[this.stageSegment!.regionIndex].thingStack;
        thingStack.clear();
        thingStack.addAll(this.regionThingStack);

        let distance: number = Number.MAX_SAFE_INTEGER;
        let entry: StairsEntry | null = null;
        for (let i: number = 0; i < this.stageSegment!.stairsEntries.length; i++) {
            let stairsEntry: StairsEntry = this.stageSegment!.stairsEntries[i];
            let dist: number = trunc(Math.abs(javaFloat(this.simon!.x - stairsEntry.x)));
            if (dist < distance) {
                distance = dist;
                entry = stairsEntry;
            }
        }

        const connection = entry!.connection!;
        this.stageSegment = connection.segment;
        this.map = connection.segment.map;
        this.walls = connection.segment.walls;
        this.weaponsStack.clear();
        this.timeFrozen = 0;
        this.killAllFlag = false;
        this.mapWidth = connection.segment.mapWidth;

        let region: Region = connection.segment.regions[connection.segment.regionIndex];
        this.stage = region.stageNumber;
        this.platforms = region.platforms;
        this.regionThingStack.clear();
        this.regionThingStack.addAll(region.thingStack);
        this.simon!.xMin = region.min;
        this.simon!.xMax = region.max;

        this.simon!.onStairs = true;
        this.simon!.direction = connection.direction;
        this.simon!.x = javaFloat(connection.x);
        this.simon!.y = javaFloat(connection.y);
        this.simon!.up = connection.up;

        this.simon!.kneeling = false;
        this.simon!.whipping = false;
        this.simon!.whipIncrementor = 0;
        this.simon!.whipIndex = 0;
        this.simon!.walkSpriteIndex = 0;
        this.simon!.walkSpriteIndexIncrementor = 0;
        this.simon!.invincible = 0;
        this.simon!.flashing = 0;
        this.simon!.intersected = false;
        this.simon!.lastX = javaFloat(this.simon!.x);
        this.simon!.lastY = javaFloat(this.simon!.y);
        this.simon!.releasedJump = true;
        this.simon!.releasedKneel = true;
        this.simon!.releasedWhip = true;
        this.simon!.throwing = false;
        this.simon!.vx = javaFloat(0);
        this.simon!.vy = javaFloat(0);

        this.setSimonAlpha(1);

        this.moveCamera();
    }

    public throwWeapon(): void {
        if (!this.canUseSubWeapon()) {
            return;
        }

        let x: number = javaFloat(this.simon!.x + 16);
        let y: number = javaFloat(this.simon!.kneeling ? javaFloat(this.simon!.y + 16) : this.simon!.y);

        switch (this.weaponType) {
            case Main.WEAPON_TYPE_AXE:
                this.pushWeapon(new Axe(this, x, y, this.simon!.direction));
                this.removeHearts(1);
                this.playRumble("weaponThrow");
                break;
            case Main.WEAPON_TYPE_BOOMERANG:
                this.pushWeapon(new Boomerang(this, javaFloat(x + 1), javaFloat(y + 1), this.simon!.direction));
                this.removeHearts(1);
                this.playRumble("weaponThrow");
                break;
            case Main.WEAPON_TYPE_DAGGER:
                this.pushWeapon(new Dagger(this, x, y, this.simon!.direction));
                this.removeHearts(1);
                this.playRumble("weaponThrow");
                break;
            case Main.WEAPON_TYPE_HOLY_WATER:
                this.pushWeapon(new HolyWater(this, x, y, this.simon!.direction));
                this.removeHearts(1);
                this.playRumble("weaponThrow");
                break;
            case Main.WEAPON_TYPE_STOP_WATCH:
                this.pushWeapon(new StopWatch(this));
                this.removeHearts(5);
                break;
        }
    }

    /**
     * Initial Up+Attack selection only. A blocked StopWatch falls back to the
     * whip through Main's existing three-case input contract. The frame-20
     * throwWeapon() recheck deliberately stays on canUseSubWeapon(), so a
     * StopWatch that becomes invalid during the windup is simply suppressed.
     */
    private canSelectSubWeapon(): boolean {
        return this.canUseSubWeapon() && (this.weaponType != Main.WEAPON_TYPE_STOP_WATCH || canStartStopWatch(this));
    }

    private canUseSubWeapon(): boolean {
        return (
            this.weaponType != Main.WEAPON_TYPE_NONE &&
            this.weaponsStack.top < this.weaponRepeats &&
            ((this.weaponType != Main.WEAPON_TYPE_STOP_WATCH && this.hearts > 0) || (this.weaponType == Main.WEAPON_TYPE_STOP_WATCH && this.hearts > 4))
        );
    }

    public removeHearts(hearts: number): void {
        this.hearts -= hearts;
        if (this.hearts < 0) {
            this.hearts = 0;
        }
    }

    public createStageForStateRestore(stageIndex: number): void {
        this.createStage(stageIndex, true);
    }

    private createStage(stageIndex: number, setCheckpoint: boolean): void {
        this.stageIndex = stageIndex;

        this.stageSegments = this.loadedSegments![stageIndex];
        for (let i: number = 0; i < this.stageSegments.length; i++) {
            this.convertStage(stageIndex, this.stageSegments[i]);
        }

        switch (stageIndex) {
            case 0:
                this.time = 300;

                this.linkStageSegments(0, 0, 1, 0);
                this.linkStageSegments(0, 1, 1, 1);

                this.stageSegments[0].regions[0].checkpoint.song = this.stage_1_1;
                this.stageSegments[0].regions[1].checkpoint.song = this.stage_1_2;
                this.stageSegments[0].regions[2].checkpoint.song = this.stage_1_2;
                this.stageSegments[0].regions[3].checkpoint.song = this.stage_1_2;

                if (setCheckpoint) {
                    this.checkpoint = this.stageSegments[0].regions[0].checkpoint;
                }
                break;

            case 1:
                this.time = 400;

                this.linkStageSegments(0, 0, 1, 1);
                this.linkStageSegments(1, 0, 2, 1);
                this.linkStageSegments(3, 0, 2, 0);

                this.stageSegments[0].regions[0].checkpoint.song = this.stage_2_1;
                this.stageSegments[1].regions[0].checkpoint.song = this.stage_2_1;
                this.stageSegments[2].regions[0].checkpoint.song = this.stage_2_1;

                if (setCheckpoint) {
                    this.checkpoint = this.stageSegments[0].regions[0].checkpoint;
                }
                break;

            case 2:
                this.time = 500;

                this.stageSegments[0].direction = Main.LEFT;
                this.linkStageSegments(0, 0, 1, 0);
                this.linkStageSegments(1, 1, 2, 0);

                this.stageSegments[0].regions[0].checkpoint.song = this.stage_3_1;
                this.stageSegments[1].regions[1].checkpoint.song = this.stage_3_1;
                this.stageSegments[2].regions[1].checkpoint.song = this.stage_3_1;

                if (setCheckpoint) {
                    this.checkpoint = this.stageSegments[0].regions[0].checkpoint;
                }
                break;

            case 3:
                this.time = 400;

                this.linkStageSegments(0, 0, 1, 0);
                this.stageSegments[0].regions[0].checkpoint.y = javaFloat(-96);

                this.stageSegments[0].regions[0].checkpoint.song = this.stage_4_1;
                this.stageSegments[1].regions[0].checkpoint.song = this.stage_4_2;
                this.stageSegments[1].regions[1].checkpoint.song = this.stage_4_2;

                if (setCheckpoint) {
                    this.checkpoint = this.stageSegments[0].regions[0].checkpoint;
                }
                break;

            case 4:
                this.time = 500;

                this.linkStageSegments(0, 0, 1, 0);
                this.linkStageSegments(1, 1, 2, 1);
                this.linkStageSegments(2, 0, 3, 0);

                this.stageSegments[0].regions[0].checkpoint.song = this.stage_5_1;
                this.stageSegments[1].regions[1].checkpoint.song = this.stage_5_1;
                this.stageSegments[2].regions[0].checkpoint.song = this.stage_5_1;

                if (setCheckpoint) {
                    this.checkpoint = this.stageSegments[0].regions[0].checkpoint;
                }
                break;

            case 5:
                this.time = 700;

                this.linkStageSegments(1, 0, 2, 0);
                this.linkStageSegments(1, 1, 0, 0);
                this.linkStageSegments(1, 2, 0, 1);
                this.linkStageSegments(1, 3, 0, 2);

                this.stageSegments[0].regions[0].checkpoint.song = this.stage_6_1;
                this.stageSegments[0].regions[1].checkpoint.song = this.stage_6_1;
                this.stageSegments[1].regions[0].checkpoint.song = this.stage_6_2;

                if (setCheckpoint) {
                    this.checkpoint = this.stageSegments[0].regions[1].checkpoint;
                }
                break;
        }

        this.restoreCheckpoint();

        this.nextFrameTime = Sys.getTime();
    }

    private convertStage(stageIndex: number, segment: StageSegment): void {
        let stairsEntries: StairsEntry[] = [];

        let width: number = (segment.mapWidth = segment.stage[0].length);

        let platformList: Thing[] = [];

        let regions: Region[] = [];
        let regionCount: number = 0;
        let region: Region = new Region();
        region.stageNumber = Main.stageNumbers[stageIndex][segment.stageSegmentIndex][regionCount++];
        region.max = width << 5;
        regions.push(region);

        segment.map = make2D<number>(11, width + 1, () => 0);
        segment.walls = make2D<number>(11, width + 1, () => 0);

        let zombieSpawnerX: number = -1;
        let batSpawnerX: number = -1;
        let birdSpawnerX: number = -1;
        let medusaHeadSpawnerX: number = -1;
        let mermanSpawnerX: number = -1;
        let platformX: number = -1;
        let spikesIndex: number = 0;

        let regionIndex: number = 0;
        let candleIndex: number = 0;
        for (let j: number = 0; j < width; j++) {
            for (let i: number = 0; i < 11; i++) {
                let row: number[] = segment.stage[i];
                let x: number = j << 5;
                let y: number = i << 5;
                switch (row[j]) {
                    case Main.TILE_WALL:
                        segment.walls[i][j] = Main.WALL_FULL;
                        this.replaceWithBlock(segment.map, segment.stage, j, i, width);
                        break;
                    case Main.TILE_PLATFORM:
                        segment.walls[i][j] = Main.WALL_PLATFORM;
                        this.replaceWithBlock(segment.map, segment.stage, j, i, width);
                        break;
                    case Main.TILE_HIDDEN_PLATFORM:
                        segment.walls[i][j] = Main.WALL_PLATFORM;
                        segment.map[i][j] = Main.BLOCK_EMPTY;
                        break;
                    case Main.TILE_DOOR: {
                        segment.walls[i][j] = Main.WALL_PLATFORM;
                        segment.map[i][j] = Main.BLOCK_EMPTY;

                        if (segment.direction == Main.RIGHT) {
                            region.max = x + 32;
                            if (j == width - 1) {
                                region.thingStack.push(new Door(this, x + 8, y, Main.RIGHT, false));
                                segment.walls[i + 1][j] = Main.WALL_PLATFORM;
                                segment.map[i + 1][j] = Main.BLOCK_EMPTY;
                                segment.walls[i + 2][j] = Main.WALL_PLATFORM;
                                segment.map[i + 2][j] = Main.BLOCK_EMPTY;
                            } else {
                                region.thingStack.push(new Door(this, x + 8, y, Main.RIGHT, true));
                            }

                            region.platforms = platformList.slice();

                            region = new Region();
                            region.stageNumber = Main.stageNumbers[stageIndex][segment.stageSegmentIndex][regionCount++];
                            region.min = x + 32;
                            region.max = width << 5;
                            regions.push(region);
                            regionIndex++;
                        } else {
                            if (j == 0) {
                                region.thingStack.push(new Door(this, x + 8, y, Main.LEFT, false));
                                segment.walls[i + 1][j] = Main.WALL_PLATFORM;
                                segment.map[i + 1][j] = Main.BLOCK_EMPTY;
                                segment.walls[i + 2][j] = Main.WALL_PLATFORM;
                                segment.map[i + 2][j] = Main.BLOCK_EMPTY;
                            } else {
                                region.max = x - 1;
                                region.platforms = platformList.slice();

                                region = new Region();
                                region.stageNumber = Main.stageNumbers[stageIndex][segment.stageSegmentIndex][regionCount++];
                                region.min = x - 1;
                                region.max = width << 5;
                                regions.push(region);
                                regionIndex++;

                                region.thingStack.push(new Door(this, x + 8, y, Main.LEFT, true));
                            }
                        }
                        break;
                    }
                    case Main.TILE_STAIRS_LEFT:
                        segment.walls[i][j] = Main.WALL_EMPTY;
                        segment.map[i][j] = Main.BLOCK_STAIRS_LEFT;
                        if (i == 0) {
                            let stairsEntry: StairsEntry = new StairsEntry();
                            stairsEntries.push(stairsEntry);
                            stairsEntry.segment = segment;
                            stairsEntry.direction = Main.RIGHT;
                            stairsEntry.up = false;
                            stairsEntry.x = x + 32;
                            stairsEntry.y = 0;
                        } else if (i == 10) {
                            let stairsEntry: StairsEntry = new StairsEntry();
                            stairsEntries.push(stairsEntry);
                            stairsEntry.segment = segment;
                            stairsEntry.direction = Main.LEFT;
                            stairsEntry.up = true;
                            stairsEntry.x = x - 7;
                            stairsEntry.y = y - 39;
                        }
                        break;
                    case Main.TILE_STAIRS_RIGHT:
                        segment.walls[i][j] = Main.WALL_EMPTY;
                        segment.map[i][j] = Main.BLOCK_STAIRS_RIGHT;
                        if (i == 0) {
                            let stairsEntry: StairsEntry = new StairsEntry();
                            stairsEntries.push(stairsEntry);
                            stairsEntry.segment = segment;
                            stairsEntry.direction = Main.LEFT;
                            stairsEntry.up = false;
                            stairsEntry.x = x - 63;
                            stairsEntry.y = 0;
                        } else if (i == 10) {
                            let stairsEntry: StairsEntry = new StairsEntry();
                            stairsEntries.push(stairsEntry);
                            stairsEntry.segment = segment;
                            stairsEntry.direction = Main.RIGHT;
                            stairsEntry.up = true;
                            stairsEntry.x = x - 24;
                            stairsEntry.y = y - 39;
                        }
                        break;
                    case Main.TILE_STAIRS_LEFT_CAPPED:
                        segment.walls[i][j] = Main.WALL_PLATFORM;
                        segment.map[i][j] = Main.BLOCK_STAIRS_LEFT_CAPPED;
                        if (i == 0) {
                            let stairsEntry: StairsEntry = new StairsEntry();
                            stairsEntries.push(stairsEntry);
                            stairsEntry.segment = segment;
                            stairsEntry.direction = Main.RIGHT;
                            stairsEntry.up = false;
                            stairsEntry.x = x + 32;
                            stairsEntry.y = 0;
                        } else if (i == 10) {
                            let stairsEntry: StairsEntry = new StairsEntry();
                            stairsEntries.push(stairsEntry);
                            stairsEntry.segment = segment;
                            stairsEntry.direction = Main.LEFT;
                            stairsEntry.up = true;
                            stairsEntry.x = x - 7;
                            stairsEntry.y = y - 39;
                        }
                        break;
                    case Main.TILE_STAIRS_RIGHT_CAPPED:
                        segment.walls[i][j] = Main.WALL_PLATFORM;
                        segment.map[i][j] = Main.BLOCK_STAIRS_RIGHT_CAPPED;
                        if (i == 0) {
                            let stairsEntry: StairsEntry = new StairsEntry();
                            stairsEntries.push(stairsEntry);
                            stairsEntry.segment = segment;
                            stairsEntry.direction = Main.LEFT;
                            stairsEntry.up = false;
                            stairsEntry.x = x - 63;
                            stairsEntry.y = 0;
                        } else if (i == 10) {
                            let stairsEntry: StairsEntry = new StairsEntry();
                            stairsEntries.push(stairsEntry);
                            stairsEntry.segment = segment;
                            stairsEntry.direction = Main.RIGHT;
                            stairsEntry.up = true;
                            stairsEntry.x = x - 24;
                            stairsEntry.y = y - 39;
                        }
                        break;
                    case Main.TILE_CANDLES:
                        segment.walls[i][j] = Main.WALL_EMPTY;
                        segment.map[i][j] = Main.BLOCK_EMPTY;
                        region.thingStack.push(new Candles(this, x + 8, y + 8, segment.candleItems.charCodeAt(candleIndex++)));
                        break;
                    case Main.TILE_TORCH:
                        segment.walls[i][j] = Main.WALL_EMPTY;
                        segment.map[i][j] = Main.BLOCK_EMPTY;
                        region.thingStack.push(new Torch(this, x, y, segment.candleItems.charCodeAt(candleIndex++)));
                        break;
                    case Main.TILE_BREAK_WALL:
                        segment.walls[i][j] = Main.WALL_PLATFORM;
                        this.replaceWithBlock(segment.map, segment.stage, j, i, width);
                        region.thingStack.push(new BreakWall(this, j, i, segment.candleItems.charCodeAt(candleIndex++)));
                        break;
                    case Main.TILE_ZOMBIE_SPAWNER:
                        segment.walls[i][j] = Main.WALL_EMPTY;
                        segment.map[i][j] = Main.BLOCK_EMPTY;
                        if (zombieSpawnerX == -1) {
                            zombieSpawnerX = x;
                        } else {
                            region.thingStack.push(new ZombieSpawner(this, zombieSpawnerX, x, y));
                            zombieSpawnerX = -1;
                        }
                        break;
                    case Main.TILE_MERMAN_SPAWNER:
                        segment.walls[i][j] = Main.WALL_EMPTY;
                        segment.map[i][j] = Main.BLOCK_EMPTY;
                        if (mermanSpawnerX == -1) {
                            mermanSpawnerX = x;
                        } else {
                            region.thingStack.push(new MermanSpawner(this, mermanSpawnerX, x, y));
                            mermanSpawnerX = -1;
                        }
                        break;
                    case Main.TILE_BAT_SPAWNER:
                        segment.walls[i][j] = Main.WALL_EMPTY;
                        segment.map[i][j] = Main.BLOCK_EMPTY;
                        if (batSpawnerX == -1) {
                            batSpawnerX = x;
                        } else {
                            region.thingStack.push(new BatSpawner(this, batSpawnerX, x));
                            batSpawnerX = -1;
                        }
                        break;
                    case Main.TILE_BIRD_SPAWNER:
                        segment.walls[i][j] = Main.WALL_EMPTY;
                        segment.map[i][j] = Main.BLOCK_EMPTY;
                        if (birdSpawnerX == -1) {
                            birdSpawnerX = x;
                        } else {
                            region.thingStack.push(new BirdSpawner(this, birdSpawnerX, x));
                            birdSpawnerX = -1;
                        }
                        break;
                    case Main.TILE_MEDUSA_HEAD_SPAWNER:
                        segment.walls[i][j] = Main.WALL_EMPTY;
                        segment.map[i][j] = Main.BLOCK_EMPTY;
                        if (medusaHeadSpawnerX == -1) {
                            medusaHeadSpawnerX = x;
                        } else {
                            region.thingStack.push(new MedusaHeadSpawner(this, medusaHeadSpawnerX, x));
                            medusaHeadSpawnerX = -1;
                        }
                        break;
                    case Main.TILE_MOVING_PLATFORM:
                        segment.walls[i][j] = Main.WALL_EMPTY;
                        segment.map[i][j] = Main.BLOCK_EMPTY;
                        if (platformX == -1) {
                            platformX = x;
                        } else {
                            platformList.push(new MovingPlatform(this, platformX, x, y));
                            platformX = -1;
                        }
                        break;
                    case Main.TILE_MOVING_PLATFORM_2:
                        segment.walls[i][j] = Main.WALL_EMPTY;
                        segment.map[i][j] = Main.BLOCK_EMPTY;
                        if (platformX == -1) {
                            platformX = x;
                        } else {
                            platformList.push(new MovingPlatform(this, platformX, x, y + 16));
                            platformX = -1;
                        }
                        break;
                    case Main.TILE_DOG:
                        segment.walls[i][j] = Main.WALL_EMPTY;
                        segment.map[i][j] = Main.BLOCK_EMPTY;
                        region.thingStack.push(new Dog(this, x, y));
                        break;
                    case Main.TILE_IGOR:
                        segment.walls[i][j] = Main.WALL_EMPTY;
                        segment.map[i][j] = Main.BLOCK_EMPTY;
                        region.thingStack.push(new Igor(this, x, y));
                        break;
                    case Main.TILE_WHITE_SKELETON:
                        segment.walls[i][j] = Main.WALL_EMPTY;
                        segment.map[i][j] = Main.BLOCK_EMPTY;
                        region.thingStack.push(new WhiteSkeleton(this, x, y));
                        break;
                    case Main.TILE_RED_SKELETON:
                        segment.walls[i][j] = Main.WALL_EMPTY;
                        segment.map[i][j] = Main.BLOCK_EMPTY;
                        region.thingStack.push(new RedSkeleton(this, x, y));
                        break;
                    case Main.TILE_BONE_DRAGON:
                        segment.walls[i][j] = Main.WALL_EMPTY;
                        segment.map[i][j] = Main.BLOCK_EMPTY;
                        region.thingStack.push(new BoneDragon(this, x, y, segment.candleItems.charCodeAt(candleIndex++), false));
                        break;
                    case Main.TILE_BONE_DRAGON_2:
                        segment.walls[i][j] = Main.WALL_EMPTY;
                        segment.map[i][j] = Main.BLOCK_EMPTY;
                        region.thingStack.push(new BoneDragon(this, x, y, segment.candleItems.charCodeAt(candleIndex++), true));
                        break;
                    case Main.TILE_RAVEN:
                        segment.walls[i][j] = Main.WALL_EMPTY;
                        segment.map[i][j] = Main.BLOCK_EMPTY;
                        region.thingStack.push(new Raven(this, x, y));
                        break;
                    case Main.TILE_GHOST:
                        segment.walls[i][j] = Main.WALL_EMPTY;
                        segment.map[i][j] = Main.BLOCK_EMPTY;
                        region.thingStack.push(new Ghost(this, x, y));
                        break;
                    case Main.TILE_SPIKES:
                        segment.walls[i][j] = Main.WALL_EMPTY;
                        segment.map[i][j] = Main.BLOCK_EMPTY;
                        region.thingStack.push(new Spikes(this, x, y, spikesIndex++));
                        break;
                    case Main.TILE_BONE_PILLAR:
                        segment.walls[i][j] = Main.WALL_EMPTY;
                        segment.map[i][j] = Main.BLOCK_EMPTY;
                        region.thingStack.push(new BonePillar(this, x, y));
                        break;
                    case Main.TILE_CHECK_POINT:
                        segment.walls[i][j] = Main.WALL_EMPTY;
                        segment.map[i][j] = Main.BLOCK_EMPTY;
                        region.checkpoint = new Checkpoint(this, x, y, segment.stageSegmentIndex, regionIndex);
                        region.thingStack.push(region.checkpoint);
                        break;
                    case Main.TILE_BAT_BOSS:
                        segment.walls[i][j] = Main.WALL_EMPTY;
                        segment.map[i][j] = Main.BLOCK_EMPTY;
                        region.thingStack.push(new BatBoss(this, x, y));
                        break;
                    case Main.TILE_GRIM_REAPER_BOSS:
                        segment.walls[i][j] = Main.WALL_EMPTY;
                        segment.map[i][j] = Main.BLOCK_EMPTY;
                        region.thingStack.push(new GrimReaper(this, x, y));
                        break;
                    case Main.TILE_BRIDGE_BAT:
                        segment.walls[i][j] = Main.WALL_EMPTY;
                        segment.map[i][j] = Main.BLOCK_EMPTY;
                        region.thingStack.push(new BridgeBat(this, x, y));
                        break;
                    case Main.TILE_FRANKENSTEIN:
                        segment.walls[i][j] = Main.WALL_EMPTY;
                        segment.map[i][j] = Main.BLOCK_EMPTY;
                        region.thingStack.push(new Frankenstein(this, x, y));
                        break;
                    case Main.TILE_SECRET:
                        segment.walls[i][j] = Main.WALL_EMPTY;
                        segment.map[i][j] = Main.BLOCK_EMPTY;
                        region.thingStack.push(new Secret(this, x, y));
                        break;
                    case Main.TILE_MEDUSA_BOSS:
                        segment.walls[i][j] = Main.WALL_EMPTY;
                        segment.map[i][j] = Main.BLOCK_EMPTY;
                        region.thingStack.push(new MedusaBoss(this, x, y));
                        break;
                    case Main.TILE_DRACULA_BOSS:
                        segment.walls[i][j] = Main.WALL_EMPTY;
                        segment.map[i][j] = Main.BLOCK_EMPTY;
                        region.thingStack.push(new Dracula(this, x, y));
                        break;
                    case Main.TILE_LANCE_KNIGHT:
                        segment.walls[i][j] = Main.WALL_EMPTY;
                        segment.map[i][j] = Main.BLOCK_EMPTY;
                        region.thingStack.push(new LanceKnight(this, x, y));
                        break;
                    case Main.TILE_AXE_KNIGHT:
                        segment.walls[i][j] = Main.WALL_EMPTY;
                        segment.map[i][j] = Main.BLOCK_EMPTY;
                        region.thingStack.push(new AxeKnight(this, x, y));
                        break;
                    case Main.TILE_SWOOPING_BAT:
                        segment.walls[i][j] = Main.WALL_EMPTY;
                        segment.map[i][j] = Main.BLOCK_EMPTY;
                        region.thingStack.push(new SwoopingBat(this, x, y));
                        break;
                    case Main.TILE_MUMMY_BOSS:
                        segment.walls[i][j] = Main.WALL_EMPTY;
                        segment.map[i][j] = Main.BLOCK_EMPTY;
                        region.thingStack.push(new MummyBoss(this, x, y - 16, Main.RIGHT));
                        region.thingStack.push(new MummyBoss(this, x + 352, y - 16, Main.LEFT));
                        break;
                    case Main.TILE_FADING_STAIRS:
                        segment.walls[i][j] = Main.WALL_EMPTY;
                        segment.map[i][j] = Main.BLOCK_EMPTY;
                        region.thingStack.push(new FadingStairs(this, x, y, segment));
                        break;
                    default:
                        segment.walls[i][j] = Main.WALL_EMPTY;
                        segment.map[i][j] = Main.BLOCK_EMPTY;
                        break;
                }
            }

            region.platforms = platformList.slice();
        }

        segment.regions = regions.slice();

        segment.stairsEntries = stairsEntries.slice();

        if (segment.direction == Main.RIGHT) {
            segment.regionIndex = 0;
        } else {
            segment.regionIndex = regions.length - 1;
        }
    }

    public createCandleItem(x: number, y: number, item: number): Thing | null {
        switch (this.weaponType) {
            case Main.WEAPON_TYPE_AXE:
                if (item == Main.CANDLE_ITEM_AXE) {
                    item = Main.CANDLE_ITEM_DOUBLE;
                }
                break;
            case Main.WEAPON_TYPE_BOOMERANG:
                if (item == Main.CANDLE_ITEM_BOOMERANG) {
                    item = Main.CANDLE_ITEM_DOUBLE;
                }
                break;
            case Main.WEAPON_TYPE_DAGGER:
                if (item == Main.CANDLE_ITEM_DAGGER) {
                    item = Main.CANDLE_ITEM_DOUBLE;
                }
                break;
            case Main.WEAPON_TYPE_HOLY_WATER:
                if (item == Main.CANDLE_ITEM_HOLY_WATER) {
                    item = Main.CANDLE_ITEM_DOUBLE;
                }
                break;
            case Main.WEAPON_TYPE_STOP_WATCH:
                if (item == Main.CANDLE_ITEM_STOP_WATCH) {
                    item = Main.CANDLE_ITEM_DOUBLE;
                }
                break;
        }

        switch (item) {
            case Main.CANDLE_ITEM_AXE:
                return new DropItem(this, x, y, DropItem.TYPE_AXE);
            case Main.CANDLE_ITEM_BOOMERANG:
                return new DropItem(this, x, y, DropItem.TYPE_BOOMERANG);
            case Main.CANDLE_ITEM_CHEST:
                return new DropItem(this, x, y, DropItem.TYPE_CHEST);
            case Main.CANDLE_ITEM_CROWN:
                return new DropItem(this, x, y, DropItem.TYPE_CROWN);
            case Main.CANDLE_ITEM_DAGGER:
                return new DropItem(this, x, y, DropItem.TYPE_DAGGER);
            case Main.CANDLE_ITEM_DOUBLE:
            case Main.CANDLE_ITEM_TRIPLE:
                if (this.weaponType == Main.WEAPON_TYPE_NONE || this.weaponRepeats == Main.WEAPON_REPEATS_TRIPLE) {
                    return new DropItem(this, x, y, DropItem.TYPE_LARGE_HEART);
                } else if (this.weaponRepeats == Main.WEAPON_REPEATS_DOUBLE) {
                    return new DropItem(this, x, y, DropItem.TYPE_TRIPLE);
                } else if (this.weaponRepeats == Main.WEAPON_REPEATS_SINGLE) {
                    return new DropItem(this, x, y, DropItem.TYPE_DOUBLE);
                }
            case Main.CANDLE_ITEM_HOLY_WATER:
                return new DropItem(this, x, y, DropItem.TYPE_HOLY_WATER);
            case Main.CANDLE_ITEM_KILL_ALL:
                return new DropItem(this, x, y, DropItem.TYPE_KILL_ALL);
            case Main.CANDLE_ITEM_LARGE_HEART:
                return new DropItem(this, x, y, DropItem.TYPE_LARGE_HEART);
            case Main.CANDLE_ITEM_MEAT:
                return new DropItem(this, x, y, DropItem.TYPE_MEAT);
            case Main.CANDLE_ITEM_MONEY_BAG:
                return new DropItem(this, x, y, DropItem.TYPE_MONEY_BAG);
            case Main.CANDLE_ITEM_ONE_UP:
                return new DropItem(this, x, y, DropItem.TYPE_1UP);
            case Main.CANDLE_ITEM_POTION:
                return new DropItem(this, x, y, DropItem.TYPE_POTION);
            case Main.CANDLE_ITEM_SMALL_HEART:
                if (this.simon!.whipType + this.visibleWhipCount < 2 && this.random.nextBoolean()) {
                    this.whipCreated();
                    return new DropItem(this, x, y, DropItem.TYPE_WHIP);
                } else {
                    if (this.random.nextInt(31) == 11) {
                        if (this.weaponType == Main.WEAPON_TYPE_NONE || this.weaponRepeats == Main.WEAPON_REPEATS_TRIPLE) {
                            return new DropItem(this, x, y, DropItem.TYPE_LARGE_HEART);
                        } else if (this.weaponRepeats == Main.WEAPON_REPEATS_DOUBLE) {
                            return new DropItem(this, x, y, DropItem.TYPE_TRIPLE);
                        } else if (this.weaponRepeats == Main.WEAPON_REPEATS_SINGLE) {
                            return new DropItem(this, x, y, DropItem.TYPE_DOUBLE);
                        }
                    } else {
                        return new SmallHeart(this, x + 8, y + 8);
                    }
                }
            case Main.CANDLE_ITEM_STOP_WATCH:
                return new DropItem(this, x, y, DropItem.TYPE_STOP_WATCH);
            case Main.CANDLE_ITEM_EMPTY:
                return null;
            default:
                throw new Error("Unknown candle type: " + item);
        }
    }

    public pushWeapon(weapon: Thing): void {
        this.weaponsStack.push(weapon);
    }

    public pushThing(thingStacks: ThingStack[], thing: Thing): void;
    public pushThing(thing: Thing): void;
    public pushThing(thingOrStacks: ThingStack[] | Thing, maybeThing?: Thing): void {
        if (Array.isArray(thingOrStacks)) {
            const thingStacks = thingOrStacks;
            const thing = maybeThing;
            if (thing === null || thing === undefined) {
                return;
            }
            let index: number = trunc(thing.x) >> 8;
            if (index < 0) {
                index = 0;
            } else if (index >= thingStacks.length) {
                index = thingStacks.length - 1;
            }
            thingStacks[index].push(thing);
            return;
        }
        this.regionThingStack.push(thingOrStacks);
    }

    public removeBlock(x: number, y: number): void {
        this.map![y][x] = Main.BLOCK_EMPTY;
        this.walls![y][x] = Main.BLOCK_EMPTY;
        this.repairBlock(x - 1, y);
        this.repairBlock(x + 1, y);
        this.repairBlock(x, y - 1);
        this.repairBlock(x, y + 1);
    }

    private repairBlock(x: number, y: number): void {
        if (y >= 0 && y < 11 && x >= 0 && x < this.mapWidth && (this.walls![y][x] == Main.WALL_PLATFORM || this.walls![y][x] == Main.WALL_FULL)) {
            let up: number = 0;
            let down: number = 0;
            let left: number = 0;
            let right: number = 0;

            if (y > 0 && this.walls![y - 1][x] == Main.WALL_EMPTY) {
                up = 1;
            }
            if (y < 10 && this.walls![y + 1][x] == Main.WALL_EMPTY) {
                down = 1;
            }
            if (x > 0 && this.walls![y][x - 1] == Main.WALL_EMPTY) {
                left = 1;
            }
            if (x < this.mapWidth - 1 && this.walls![y][x + 1] == Main.WALL_EMPTY) {
                right = 1;
            }

            this.map![y][x] = (up << 3) | (down << 2) | (left << 1) | right;
        }
    }

    private isBlock(s: number[][], x: number, y: number): boolean {
        let c: number = s[y][x];
        if (c == Main.TILE_STAIRS_LEFT || c == Main.TILE_STAIRS_RIGHT) {
            return this.isBlock(s, x - 1, y) && this.isBlock(s, x + 1, y);
        }
        return (
            c == Main.TILE_WALL ||
            c == Main.TILE_STAIRS_LEFT_CAPPED ||
            c == Main.TILE_STAIRS_RIGHT_CAPPED ||
            c == Main.TILE_BREAK_WALL ||
            c == Main.TILE_PLATFORM
        );
    }

    private replaceWithBlock(map: number[][], s: number[][], x: number, y: number, width: number): void {
        let up: number = 0;
        let down: number = 0;
        let left: number = 0;
        let right: number = 0;

        if (y > 0 && !this.isBlock(s, x, y - 1)) {
            up = 1;
        }
        if (y < 10 && !this.isBlock(s, x, y + 1)) {
            down = 1;
        }
        if (x > 0 && !this.isBlock(s, x - 1, y)) {
            left = 1;
        }
        if (x < width - 1 && !this.isBlock(s, x + 1, y)) {
            right = 1;
        }

        map[y][x] = (up << 3) | (down << 2) | (left << 1) | right;
    }

    private loadStageSegment(a: number, b: number): void {
        this.loadedSegments![a][b] = new StageSegment();
        this.loadedSegments![a][b].stageSegmentIndex = b;

        const fileName = "stages/stage_" + a + "_" + b + ".txt";
        const lines = readResourceLines(fileName);
        let index = 0;
        this.loadedSegments![a][b].direction = lines[index].trim().charCodeAt(0) === cc("l") ? Main.LEFT : Main.RIGHT;
        index++;
        this.loadedSegments![a][b].candleItems = lines[index].trim();
        index += 2;

        const level: string[] = [];
        for (; index < lines.length; index++) {
            const line = lines[index];
            if (line.trim().length === 0) {
                continue;
            }
            level.push(line);
        }

        this.loadedSegments![a][b].stage = make2D<number>(11, idiv(level.length, 11) << 4, () => 0);

        let x = 0;
        let y = 0;
        for (let i = 0; i < level.length; i++) {
            const line = level[i];
            for (let j = 0; j < 16; j++) {
                this.loadedSegments![a][b].stage[y][j + x] = line.charCodeAt(j);
            }
            if (++y === 11) {
                y = 0;
                x += 16;
            }
        }
    }

    private drawNumber(value: number, digits: number, x: number, y: number): void {
        if (value < 0) {
            value = 0;
        }
        x += (digits - 1) << 4;
        for (let i: number = 0; i < digits; i++, x -= 16, value = idiv(value, 10)) {
            this.symbols[cc("0") + (value % 10)].draw(x, y);
        }
    }

    public drawString(string: string, x: number, y: number): void;
    public drawString(string: string, x: number, y: number, length: number): void;
    public drawString(string: string, x: number, y: number, length: number = string.length): void {
        for (let i: number = 0; i < string.length && i < length; i++, x += 16) {
            this.symbols[string.charCodeAt(i)].draw(x, y);
        }
    }

    public getWall(x: number, y: number): number {
        let X: number = x >> 5;
        let Y: number = y >> 5;
        if (Y < 0 || Y >= 11 || X >= this.mapWidth || X < 0) {
            return Main.WALL_EMPTY;
        }
        return this.walls![Y][X];
    }

    public getTile(x: number, y: number): number {
        let X: number = x >> 5;
        let Y: number = y >> 5;
        if (Y < 0 || Y >= 11 || X >= this.mapWidth || X < 0) {
            return Main.BLOCK_EMPTY;
        }
        return this.map![Y][X];
    }

    public isPlatform(x: number, y: number): boolean {
        let X: number = x >> 5;
        let Y: number = y >> 5;
        if (Y < 0 || Y >= 11 || X >= this.mapWidth || X < 0) {
            return false;
        }
        return this.walls![Y][X] == Main.WALL_PLATFORM;
    }

    public findPlatform(x: number, y: number): Thing | null {
        for (let i: number = this.platforms!.length - 1; i >= 0; i--) {
            const p = this.platforms![i]!;
            if (y == p.y && x >= p.x && x <= javaFloat(p.x + 63)) {
                return p;
            }
        }
        return null;
    }

    public isSupportive(x: number, y: number): boolean {
        let X: number = x >> 5;
        let Y: number = y >> 5;
        if (Y < 0 || Y >= 11 || X >= this.mapWidth || X < 0) {
            return false;
        }
        let tile: number = this.walls![Y][X];
        return tile == Main.WALL_FULL || tile == Main.WALL_PLATFORM;
    }

    public isSolid(x: number, y: number): boolean {
        let X: number = x >> 5;
        let Y: number = y >> 5;
        if (Y < 0 || Y >= 11 || X >= this.mapWidth || X < 0) {
            return false;
        }
        return this.walls![Y][X] == Main.WALL_FULL;
    }

    public isEmpty(x: number, y: number): boolean {
        let X: number = x >> 5;
        let Y: number = y >> 5;
        if (Y < 0 || Y >= 11 || X >= this.mapWidth || X < 0) {
            return false;
        }
        return this.walls![Y][X] == Main.WALL_EMPTY;
    }

    public flashSimon(): void {
        let alpha: number = javaFloat(1);

        if (this.simon!.flashing > 0) {
            alpha = javaFloat(FastTrig.cos(2 * this.simon!.flashing));
        }

        this.setSimonAlpha(alpha);
    }

    public setSimonAlpha(alpha: number): void {
        alpha = javaFloat(alpha);
        for (let i: number = 0; i < 2; i++) {
            this.simonOnStairsUp[i].setAlpha(alpha);
            this.simonOnStairsDown[i].setAlpha(alpha);
            this.simonKneeling[i].setAlpha(alpha);
            this.simonHurt[i].setAlpha(alpha);
            this.simonDead[i].setAlpha(alpha);

            for (let j: number = 0; j < 3; j++) {
                this.simonWalking[i][j].setAlpha(alpha);
                this.simonWhipping[i][j].setAlpha(alpha);
                this.simonKneelWhipping[i][j].setAlpha(alpha);
                this.simonUpWhipping[i][j].setAlpha(alpha);
                this.simonDownWhipping[i][j].setAlpha(alpha);
            }
        }
    }

    public whipCreated(): void {
        this.visibleWhipCount++;
        if (this.visibleWhipCount > 2) {
            this.visibleWhipCount = 2;
        }
    }

    public whipDestroyed(): void {
        this.visibleWhipCount--;
        if (this.visibleWhipCount < 0) {
            this.visibleWhipCount = 0;
        }
    }

    public advanceWhip(): void {
        this.whipDestroyed();
        if (this.simon!.whipType < 2) {
            this.playSound(this.advance_whip);
            this.playRumble("whipUpgrade");
            this.simon!.whipType++;
            this.simon!.flashing = 60;
        }
    }

    public setWeapon(weaponType: number): void {
        if (this.weaponType != weaponType) {
            this.weaponType = weaponType;
            this.weaponRepeats = Main.WEAPON_TYPE_NONE;
        }
    }

    public setWeaponRepeats(weaponRepeats: number): void {
        if (this.weaponType != Main.WEAPON_TYPE_NONE || this.weaponRepeats < weaponRepeats) {
            this.playSound(this.got_double);
            this.weaponRepeats = weaponRepeats;
            this.repeatsFlashing = 45;
        }
    }

    public playSound(sound: Sound): void {
        if (this.mode == Main.MODE_PLAYING || this.mode == Main.MODE_DEMO || this.mode == Main.MODE_TITLE_SCREEN) {
            sound.play();
        }
    }

    public playRumble(effect: RumbleEffectId): void {
        if (this.rumble == null || this.browserSuspended || !this.isRumbleModeAllowed()) {
            return;
        }
        this.rumble.play(effect);
    }

    public stopRumble(effect: RumbleEffectId): void {
        this.rumble?.stop(effect);
    }

    public stopAllRumbles(): void {
        this.rumble?.stopAll();
    }

    public resumeBrowserOnlyRumbles(): void {
        if (this.rumble == null || this.browserSuspended || !this.isRumbleModeAllowed()) {
            return;
        }
        if (this.mode == Main.MODE_CASTLE_FALLS && this.isCastleCrumbleActive()) {
            this.rumble.playFromOffset("castleCrumble", this.getCastleCrumbleRumbleOffsetMs());
        }
    }

    private isRumbleModeAllowed(): boolean {
        return this.mode == Main.MODE_PLAYING || this.mode == Main.MODE_CASTLE_FALLS;
    }

    private isCastleCrumbleActive(): boolean {
        return this.castleFallSparkCount > 0 || this.castleFallY < 220 || this.castleFallDelay > 0;
    }

    private getCastleCrumbleRumbleOffsetMs(): number {
        return this.castleCrumbleRumbleTicks * Main.CASTLE_CRUMBLE_RUMBLE_TICK_MS;
    }

    public stopSong(): void {
        if (this.currentSong != null) {
            this.currentSong.stop();
        }
        this.requestedSong = null;
        this.currentSong = null;
    }

    public requestMusic(music: Music): void {
        if (this.mode == Main.MODE_PLAYING || this.mode == Main.MODE_INTRO || this.mode == Main.MODE_MAP || this.mode == Main.MODE_CONTINUE_SCREEN) {
            if (this.currentSong != null) {
                this.currentSong.stop();
            }
            this.requestedSong = null;
            this.currentSong = null;
            this.currentMusic = music;
            music.play();
        }
    }

    public requestSong(song: Song): void {
        this.requestedSong = song;
    }

    /** Destroy every logical SFX voice without changing application Sound policy. */
    public stopAllSoundEffects(): void {
        SoundStore.get().stopSoundEffects();
    }

    public stopAllSounds(): void {
        this.stopAllSoundEffects();
        for (let i = 0; i < STANDALONE_MUSIC_FIELD_NAMES.length; i++) {
            this[STANDALONE_MUSIC_FIELD_NAMES[i]].stop();
        }
        for (let i = 0; i < SONG_FIELD_NAMES.length; i++) {
            this[SONG_FIELD_NAMES[i]].stop();
        }
        this.currentMusic = null;
        this.currentSong = null;
        this.requestedSong = null;
        this.stopAllRumbles();
    }

    /** Menu suspension freezes simulation and input without unpausing any Music. */
    public setBrowserSuspended(suspended: boolean): void {
        this.browserSuspended = suspended;
        if (suspended) {
            this.stopAllRumbles();
        }
        this.clearInputPressedRecords();
        if (!suspended) {
            if (this.mode == Main.MODE_PLAYING) {
                this.simon?.resetInputReleaseLatches();
            }
            if (this.mode == Main.MODE_INPUT_CONFIG) {
                this.inputConfigMode?.resyncInputAfterBrowserResume();
            }
        }
        this.resetNextFrameTime();
    }

    public resetNextFrameTime(): void {
        this.nextFrameTime = Sys.getTime();
    }

    private isUserControlledSimonPhysics(): boolean {
        return (
            this.mode == Main.MODE_PLAYING &&
            this.simon != null &&
            this.playerPower > 0 &&
            this.simon.dead == 0 &&
            this.door == null &&
            !this.beatStageFlag &&
            !this.floorBreaking
        );
    }

    public isHardDifficultyActiveForGameplay(): boolean {
        return this.difficulty == Main.DIFFICULTY_HARD && this.isUserControlledSimonPhysics();
    }

    private isHardDifficultyEnabledForStageState(): boolean {
        return (
            this.difficulty == Main.DIFFICULTY_HARD &&
            this.mode != Main.MODE_DEMO &&
            this.mode != Main.MODE_CREDITS &&
            this.mode != Main.MODE_ENDING &&
            this.mode != Main.MODE_CASTLE_FALLS &&
            this.mode != Main.MODE_TITLE_SCREEN &&
            this.mode != Main.MODE_INPUT_CONFIG
        );
    }

    public adjustEnemyHits(baseHits: number): number {
        return this.isHardDifficultyEnabledForStageState() ? baseHits + 1 : baseHits;
    }

    public adjustEnemySpawnDelay(baseDelay: number): number {
        return this.adjustHardDelay(baseDelay, Main.HARD_SPAWN_DELAY_MULTIPLIER);
    }

    public adjustEnemyCooldown(baseDelay: number): number {
        return this.adjustHardDelay(baseDelay, Main.HARD_ATTACK_COOLDOWN_MULTIPLIER);
    }

    public adjustEnemyBehaviorDelay(baseDelay: number): number {
        return this.adjustHardDelay(baseDelay, Main.HARD_BEHAVIOR_DELAY_MULTIPLIER);
    }

    public adjustEnemyActiveCap(baseCount: number): number {
        return this.isHardDifficultyEnabledForStageState() ? baseCount + Main.HARD_ACTIVE_CAP_BONUS : baseCount;
    }

    public adjustSimonDamage(power: number): number {
        if (!this.isHardDifficultyActiveForGameplay() || power >= 16) {
            return power;
        }
        return power + 1;
    }

    private adjustHardDelay(baseDelay: number, multiplier: number): number {
        multiplier = javaFloat(multiplier);
        if (!this.isHardDifficultyEnabledForStageState()) {
            return baseDelay;
        }
        if (baseDelay <= 0) {
            return baseDelay;
        }
        return Math.max(1, trunc(javaFloat(baseDelay * multiplier)));
    }

    public syncSimonPhysicsProfile(): void {
        if (this.simon == null) {
            return;
        }
        if (this.isUserControlledSimonPhysics()) {
            this.simon.G = javaFloat(Main.PLAYER_CONTROLLED_GRAVITY);
            this.simon.jumpVelocity = javaFloat(Main.PLAYER_CONTROLLED_JUMP_VELOCITY);
        } else {
            this.simon.G = javaFloat(Main.GRAVITY);
            this.simon.jumpVelocity = javaFloat(Main.SIMON_JUMP_VELOCITY);
        }
    }

    public clearInputPressedRecords(): void {
        if (this.input != null) {
            this.input.clearKeyPressedRecord();
            this.input.clearControlPressedRecord();
        }
        if (this.controlInput != null) {
            this.controlInput.clearPressedState();
        }
    }

    public finishInputConfig(): void {
        this.invalidateTitleInputMappingCache();
        this.initTitleScreen();

        // Let the player review the active mappings before leaving Input.
        // initTitleScreen already cleared/rebaselined input at this post-poll boundary.
        this.titleMenu = Main.TITLE_MENU_INPUT;
        this.titleSelectedIndex = 2;
    }

    public setInputMappingChangedHandler(handler: (() => MappingWriteResult) | null): void {
        if (handler === null) {
            Main.inputMappingChangedHandlers.delete(this);
        } else {
            Main.inputMappingChangedHandlers.set(this, handler);
        }
    }

    public notifyInputMappingChanged(): MappingWriteResult {
        return Main.inputMappingChangedHandlers.get(this)?.() ?? { saved: false, reason: "unavailable" };
    }

    private completeStartup(gc: GameContainer): void {
        this.queueStartupAudio();
        if (this.loadingCompleteHandler != null) {
            const handler = this.loadingCompleteHandler;
            this.loadingCompleteHandler = null;
            if (handler(gc)) {
                return;
            }
        }
        this.initTitleScreen();
    }

    public isStateSaveReady(): boolean {
        if (!isRestorableGameStateMode(this.mode) || this.loadedSegments == null || this.input == null || this.controlInput == null) {
            return false;
        }
        if (this.isStageStateRequiredForStateSave()) {
            return this.hasStageStateForStateSave();
        }
        return true;
    }

    public shouldCaptureStageForStateSave(): boolean {
        return this.isStageStateRequiredForStateSave() && this.hasStageStateForStateSave();
    }

    private isStageStateRequiredForStateSave(): boolean {
        return isStageRequiredGameStateMode(this.mode);
    }

    private hasStageStateForStateSave(): boolean {
        return (
            this.simon != null &&
            this.stageSegments != null &&
            this.stageSegment != null &&
            this.checkpoint != null &&
            this.loadedSegments != null &&
            this.regionThingStack != null &&
            this.regionStackSwap != null &&
            this.weaponsStack != null &&
            this.weaponsStackSwap != null &&
            this.oldThingStack != null
        );
    }

    public addPlayers(players: number): void {
        this.playSound(this.one_up);
        this.players += players;
        if (this.players > 99) {
            this.players = 99;
        }
    }

    public addPoints(dropItem: DropItem): void;
    public addPoints(points: number): void;
    public addPoints(dropItemOrPoints: DropItem | number): void {
        if (dropItemOrPoints instanceof DropItem) {
            const dropItem = dropItemOrPoints;
            switch (dropItem.type) {
                case DropItem.TYPE_MONEY_BAG:
                    switch (this.random.nextInt(3)) {
                        case 0:
                            this.pushThing(new FloatingPoints(this, dropItem.x, dropItem.y, FloatingPoints.TYPE_100));
                            this.addPoints(100);
                            break;
                        case 1:
                            this.pushThing(new FloatingPoints(this, dropItem.x, dropItem.y, FloatingPoints.TYPE_400));
                            this.addPoints(400);
                            break;
                        case 2:
                            this.pushThing(new FloatingPoints(this, dropItem.x, dropItem.y, FloatingPoints.TYPE_700));
                            this.addPoints(700);
                            break;
                    }
                    break;
                case DropItem.TYPE_CHEST:
                    this.pushThing(new FloatingPoints(this, dropItem.x, dropItem.y, FloatingPoints.TYPE_1000));
                    this.addPoints(1000);
                    break;
                case DropItem.TYPE_CROWN:
                    this.pushThing(new FloatingPoints(this, dropItem.x, dropItem.y, FloatingPoints.TYPE_2000));
                    this.addPoints(2000);
                    break;
            }
            return;
        }

        const points = dropItemOrPoints;
        const bucket1: number = idiv(this.score + 20000, 50000);
        this.score += points;
        const bucket2: number = idiv(this.score + 20000, 50000);
        if (bucket1 !== bucket2) {
            this.addPlayers(1);
        }
    }

    public hurtSimon(power: number): void {
        if (this.beatStageFlag) {
            return;
        }
        this.syncSimonPhysicsProfile();

        if (this.simon!.hurt || this.simon!.invincible > 0 || this.playerPower == 0) {
            return;
        }

        this.playSound(this.simon_hurt);

        this.playerPower -= this.adjustSimonDamage(power);
        if (this.playerPower < 0) {
            this.playerPower = 0;
        }
        this.playRumble(this.playerPower == 0 ? "playerDeath" : "playerHurt");

        if (this.playerPower == 0) {
            this.simon!.onStairs = false;
        }

        if (this.simon!.onStairs) {
            this.setSimonAlpha(0.25);
            this.simon!.invincible = 182;
        } else if (this.simon!.supported) {
            this.simon!.vy = javaFloat(this.simon!.jumpVelocity);
            this.simon!.vx = javaFloat(this.simon!.direction == Main.LEFT ? 2 : -2);
            this.simon!.hurt = true;
        } else if (!this.simon!.onStairs) {
            this.simon!.vy = javaFloat(-1);
            this.simon!.vx = javaFloat(this.simon!.direction == Main.LEFT ? 2 : -2);
            this.simon!.hurt = true;
        }
    }

    public enterNextRegion(door: Door): void {
        this.simon!.whipIndex = 0;
        this.simon!.whipIncrementor = 0;
        this.simon!.whipping = false;
        this.door = door;
        this.visibleWhipCount = 0;
    }

    public restoreHealth(): void {
        this.playerPower = 16;
    }

    public fireSparks(x: number, y: number): void {
        x = javaFloat(x);
        y = javaFloat(y);
        let angle: number = javaFloat(0);
        for (let i: number = 0; i < 8; i++, angle = javaFloat(angle + 0.78539816339744830961566084581988)) {
            this.pushThing(new ShootingSpark(this, x, y, javaFloat(8 * javaFloat(FastTrig.cos(angle))), javaFloat(8 * javaFloat(FastTrig.sin(angle)))));
        }
    }

    public killAll(): void {
        this.killAllFlag = true;
    }

    public linkStageSegments(segment1: number, stairs1: number, segment2: number, stairs2: number): void {
        this.stageSegments![segment1].stairsEntries[stairs1].connection = this.stageSegments![segment2].stairsEntries[stairs2];
        this.stageSegments![segment2].stairsEntries[stairs2].connection = this.stageSegments![segment1].stairsEntries[stairs1];
    }

    public restoreCheckpoint(): void {
        let segment: StageSegment = this.stageSegments![this.checkpoint!.stageSegmentIndex];
        let region: Region = segment.regions[this.checkpoint!.regionIndex];
        this.stage = region.stageNumber;

        this.platforms = region.platforms;

        this.simon!.reset();

        this.simon!.xMin = region.min;
        this.simon!.xMax = region.max;
        this.simon!.x = javaFloat(this.checkpoint!.x);
        this.simon!.y = javaFloat(this.checkpoint!.y);
        this.simon!.direction = segment.direction;

        if (this.stageIndex == 1 && this.checkpoint!.stageSegmentIndex == 0) {
            this.simon!.direction = Main.RIGHT;
        }

        segment.regionIndex = this.checkpoint!.regionIndex;
        this.stageSegment = segment;

        this.map = segment.map;
        this.walls = segment.walls;
        this.weaponsStack.clear();
        this.weaponsStackSwap.clear();
        this.regionThingStack.clear();
        this.regionStackSwap.clear();
        this.regionThingStack.addAll(region.thingStack);
        this.mapWidth = segment.mapWidth;
        this.beatStageFlag = false;

        this.moveCamera();

        this.requestedSong = this.checkpoint!.song;
        this.syncSimonPhysicsProfile();
    }

    public checkpointReached(checkpoint: Checkpoint): void {
        this.checkpoint = checkpoint;
    }

    public beatStage(): void {
        this.beatStageFlag = true;

        if (this.stageIndex != 5) {
            this.beatStageDelay = 455;
            this.requestMusic(this.stage_cleared);
        } else {
            this.beatStageDelay = 0;
            this.requestSong(this.ending);
        }
    }

    public addHearts(hearts: number): void {
        this.hearts += hearts;
        if (this.hearts > 99) {
            this.hearts = 99;
        }
    }

    public intersectsWeapon(thing: Thing): boolean;
    public intersectsWeapon(x1: number, y1: number, x2: number, y2: number): boolean;
    public intersectsWeapon(thingOrX1: Thing | number, y1?: number, x2?: number, y2?: number): boolean {
        if (thingOrX1 instanceof Thing) {
            const thing = thingOrX1;
            return this.intersectsWeaponRect(
                thing.rx1 + trunc(thing.x),
                thing.ry1 + trunc(thing.y),
                thing.rx2 + trunc(thing.x),
                thing.ry2 + trunc(thing.y),
                !thing.kill
            );
        }

        return this.intersectsWeaponRect(thingOrX1, y1 as number, x2 as number, y2 as number, true);
    }

    private intersectsWeaponRect(x1: number, y1: number, x2: number, y2: number, rumbleImpact: boolean): boolean {
        if (this.beatStageFlag || this.playerPower === 0) {
            return false;
        }
        const weapons = this.weaponsStack.things;
        for (let j: number = this.weaponsStack.top; j >= 0; j--) {
            const weapon = weapons[j]!;
            if (
                this.intersects(
                    weapon.rx1 + trunc(weapon.x),
                    weapon.ry1 + trunc(weapon.y),
                    weapon.rx2 + trunc(weapon.x),
                    weapon.ry2 + trunc(weapon.y),
                    x1,
                    y1,
                    x2,
                    y2
                )
            ) {
                if (rumbleImpact) {
                    this.playRumble("weaponImpactLight");
                }
                weapon.intersected = true;
                return true;
            }
        }
        return false;
    }

    public intersectsWhip(thing: Thing): boolean;
    public intersectsWhip(x1: number, y1: number, x2: number, y2: number): boolean;
    public intersectsWhip(thingOrX1: Thing | number, y1?: number, x2?: number, y2?: number): boolean {
        if (thingOrX1 instanceof Thing) {
            const thing = thingOrX1;
            return this.intersectsWhipRect(
                thing.rx1 + trunc(thing.x),
                thing.ry1 + trunc(thing.y),
                thing.rx2 + trunc(thing.x),
                thing.ry2 + trunc(thing.y),
                !thing.kill
            );
        }

        return this.intersectsWhipRect(thingOrX1, y1 as number, x2 as number, y2 as number, true);
    }

    private intersectsWhipRect(x1: number, y1: number, x2: number, y2: number, rumbleImpact: boolean): boolean {
        if (this.beatStageFlag || !this.simon!.whipping || this.simon!.whipIndex !== 2 || this.simon!.throwing || this.playerPower === 0) {
            return false;
        }

        const whipSize: number[] = Main.whipSizes[this.simon!.whipType];
        const whipOffset: number[] = Main.whipOffsets[this.simon!.whipType][this.simon!.direction];
        let p: number[] | null = null;
        if (this.simon!.onStairs) {
            if (this.simon!.up) {
                p = Simon.upWhipTable[this.simon!.whipType][2][this.simon!.direction];
            } else {
                p = Simon.downWhipTable[this.simon!.whipType][2][this.simon!.direction];
            }
        } else if (this.simon!.kneeling) {
            p = Simon.kneelingWhipTable[this.simon!.whipType][2][this.simon!.direction];
        } else {
            p = Simon.standingWhipTable[this.simon!.whipType][2][this.simon!.direction];
        }

        const lastX: number = trunc(this.simon!.lastX);
        const lastY: number = trunc(this.simon!.lastY);
        const x: number = trunc(this.simon!.x);
        const y: number = trunc(this.simon!.y);

        const wx1: number = whipOffset[0] + p[0];
        const wy1: number = whipOffset[1] + p[1];

        const ax1: number = lastX + wx1;
        const ay1: number = lastY + wy1;
        const ax2: number = ax1 + whipSize[0];
        const ay2: number = ay1 + whipSize[1];

        const bx1: number = x + wx1;
        const by1: number = y + wy1;
        const bx2: number = bx1 + whipSize[0];
        const by2: number = by1 + whipSize[1];

        let rx1: number = Math.min(ax1, bx1);
        const ry1: number = Math.min(ay1, by1);
        let rx2: number = Math.max(ax2, bx2);
        const ry2: number = Math.max(ay2, by2);

        if (this.simon!.direction === Main.LEFT) {
            rx2 += 16;
        } else {
            rx1 -= 16;
        }

        const hit = this.intersects(rx1, ry1, rx2, ry2, x1, y1, x2, y2);
        if (hit && rumbleImpact) {
            this.playRumble("weaponImpactLight");
        }
        return hit;
    }

    public intersectsSimon(thing: Thing): boolean;
    public intersectsSimon(x1: number, y1: number, x2: number, y2: number): boolean;
    public intersectsSimon(thingOrX1: Thing | number, y1?: number, x2?: number, y2?: number): boolean {
        if (thingOrX1 instanceof Thing) {
            const thing = thingOrX1;
            const x: number = trunc(thing.x);
            const y: number = trunc(thing.y);
            return this.intersectsSimon(x + thing.rx1, y + thing.ry1, x + thing.rx2, y + thing.ry2);
        }

        const x1 = thingOrX1;
        if (this.beatStageFlag || this.playerPower === 0) {
            return false;
        }
        return this.intersects(
            trunc(this.simon!.x) + this.simon!.rx1,
            trunc(this.simon!.y) + this.simon!.ry1,
            trunc(this.simon!.x) + this.simon!.rx2,
            trunc(this.simon!.y) + this.simon!.ry2,
            x1,
            y1 as number,
            x2 as number,
            y2 as number
        );
    }

    public intersects(thing1: Thing, thing2: Thing): boolean;
    public intersects(ax1: number, ay1: number, ax2: number, ay2: number, bx1: number, by1: number, bx2: number, by2: number): boolean;
    public intersects(
        first: Thing | number,
        second: Thing | number,
        third?: number,
        fourth?: number,
        fifth?: number,
        sixth?: number,
        seventh?: number,
        eighth?: number
    ): boolean {
        if (first instanceof Thing && second instanceof Thing) {
            const thing1 = first;
            const thing2 = second;
            const x1: number = trunc(thing1.x);
            const x2: number = trunc(thing2.x);
            const y1: number = trunc(thing1.y);
            const y2: number = trunc(thing2.y);
            return this.intersects(
                x1 + thing1.rx1,
                y1 + thing1.ry1,
                x1 + thing1.rx2,
                y1 + thing1.ry2,
                x2 + thing2.rx1,
                y2 + thing2.ry1,
                x2 + thing2.rx2,
                y2 + thing2.ry2
            );
        }

        const ax1 = first as number;
        const ay1 = second as number;
        const ax2 = third as number;
        const ay2 = fourth as number;
        const bx1 = fifth as number;
        const by1 = sixth as number;
        const bx2 = seventh as number;
        const by2 = eighth as number;
        return ax2 >= bx1 && ax1 <= bx2 && ay2 >= by1 && ay1 <= by2;
    }

    private static readonly credits: string[] = [
        "MAIN PROGRAMMER",
        "PLAYER PROGRAMMER",
        "ENEMY PROGRAMMER",
        "MAIN DESIGNER",
        "VRAM DESIGNER",
        "OBJECT DESIGNER",
        "TOTAL DIRECTOR",
        "PRODUCER",
        "TECHNICAL ADVISOR",
        "PLANNER",
        "CODE GUY",
        "INSPIRED BY",
        "PRESENTED BY"
    ];

    private static readonly CREDITS2: string = "MICHAEL BIRKEN";
    private static readonly CREDITS3: string = "THE BRILLIANT WORKS OF KONAMI";
    private static readonly CREDITS4: string = "MEATFIGHTER.COM";
    private creditsIndex: number = 0;
    private creditsPaused: boolean = false;
    private creditsAdvance: boolean = false;
    private creditsTitleIndex: number = 0;
    private creditsTitleIndex2: number = 0;
    private creditsDelay: number = 0;
    private creditsPresents: boolean = false;
    public initCredits(): void {
        this.creditsIndex = -1;
        this.creditsPresents = false;
        this.advanceCredits();
    }

    public advanceCredits(): void {
        this.mode = Main.MODE_CREDITS;
        this.clearInputPressedRecords();
        if (this.creditsIndex == 11) {
            this.creditsIndex = 12;
            this.creditsPresents = true;
            this.creditsPaused = true;
            this.creditsTitleIndex = 0;
            this.creditsTitleIndex2 = 0;
            this.creditsDelay = 0;
            this.creditsAdvance = false;
            this.recordingIndex = 728;
        } else {
            this.mountCreditsRecording(++this.creditsIndex);
        }
    }

    private mountCreditsRecording(index: number): void {
        this.random = new JavaRandom(0xdeadbeef | 0);

        this.creditsIndex = index;
        this.creditsPaused = false;
        this.recordingIndex = 0;
        this.creditsTitleIndex = 0;
        this.creditsTitleIndex2 = 0;
        this.creditsDelay = 0;
        this.creditsAdvance = false;
        this.creditsPresents = false;

        switch (index) {
            case 0:
                this.createStage(0, true);
                this.checkpoint = this.stageSegments![0].regions[1].checkpoint;
                this.checkpoint.x = javaFloat(javaFloat(this.checkpoint.x + 16 * 32) - 64);
                this.restoreCheckpoint();
                break;

            case 1:
                this.createStage(0, true);
                this.checkpoint = this.stageSegments![0].regions[3].checkpoint;
                this.checkpoint.x = javaFloat(javaFloat(this.checkpoint.x + 16 * 32 * 2) + 64);
                this.checkpoint.y = javaFloat(this.checkpoint.y + 32 * 6);
                this.restoreCheckpoint();
                break;

            case 2:
                this.createStage(1, true);
                this.checkpoint = this.stageSegments![2].regions[0].checkpoint;
                this.checkpoint.x = javaFloat(this.checkpoint.x - (16 * 32 * 2 - 128));
                this.checkpoint.y = javaFloat(this.checkpoint.y + 32 * 1);
                this.restoreCheckpoint();
                break;

            case 3:
                this.createStage(1, true);
                this.checkpoint = this.stageSegments![2].regions[0].checkpoint;
                this.checkpoint.stageSegmentIndex = 3;
                this.checkpoint.x = javaFloat(this.checkpoint.x - (16 * 32 * 2 - 128));
                this.checkpoint.y = javaFloat(this.checkpoint.y + 32 * 1);
                this.restoreCheckpoint();
                break;

            case 4:
                this.createStage(2, true);
                this.checkpoint = this.stageSegments![0].regions[0].checkpoint;
                this.restoreCheckpoint();
                break;

            case 5:
                this.createStage(2, true);
                this.checkpoint = this.stageSegments![2].regions[1].checkpoint;
                this.checkpoint.x = javaFloat(javaFloat(this.checkpoint.x + 16 * 32 * 2) + 32 * 11);
                this.restoreCheckpoint();
                break;

            case 6:
                this.createStage(2, true);
                this.checkpoint = this.stageSegments![2].regions[1].checkpoint;
                this.checkpoint.x = javaFloat(javaFloat(this.checkpoint.x + 16 * 32 * 5) - 128);
                this.restoreCheckpoint();
                break;

            case 7:
                this.createStage(3, true);
                break;

            case 8:
                this.createStage(3, true);
                this.checkpoint = this.stageSegments![1].regions[0].checkpoint;
                this.checkpoint.x = javaFloat(this.checkpoint.x + 16 * 32 * 5);
                this.restoreCheckpoint();
                break;

            case 9:
                this.createStage(3, true);
                this.checkpoint = this.stageSegments![1].regions[1].checkpoint;
                this.checkpoint.x = javaFloat(javaFloat(this.checkpoint.x + 16 * 32 * 3) + 128);
                this.checkpoint.y = javaFloat(this.checkpoint.y + 32);
                this.restoreCheckpoint();
                break;

            case 10:
                this.createStage(4, true);
                this.checkpoint = this.stageSegments![1].regions[1].checkpoint;
                this.restoreCheckpoint();
                break;

            case 11:
                this.createStage(4, true);
                this.checkpoint = this.stageSegments![2].regions[0].checkpoint;
                this.checkpoint.stageSegmentIndex = 3;
                this.checkpoint.x = javaFloat(this.checkpoint.x - 16 * 32);
                this.checkpoint.y = javaFloat(this.checkpoint.y + 32);
                this.restoreCheckpoint();
                break;
        }

        this.simon!.whipType = 2;
        this.weaponType = Main.WEAPON_TYPE_BOOMERANG;
        this.weaponRepeats = Main.WEAPON_REPEATS_TRIPLE;
        this.hearts = 99;

        this.random = new JavaRandom(0xdeadbeef | 0);

        this.clearInputPressedRecords();

        this.nextFrameTime = Sys.getTime();
    }

    public updateCredits(gc: GameContainer): void {
        if (this.recordingIndex == 728) {
            this.creditsPaused = true;

            let creditsString: string = this.creditsPresents ? Main.CREDITS4 : this.creditsIndex == 11 ? Main.CREDITS3 : Main.CREDITS2;

            if (this.creditsDelay <= 0) {
                if (this.creditsTitleIndex < Main.credits[this.creditsIndex].length) {
                    this.creditsTitleIndex++;
                    this.creditsDelay = 15;
                } else if (this.creditsTitleIndex2 < creditsString.length) {
                    this.creditsTitleIndex2++;
                    this.creditsDelay = 15;
                } else if (!this.creditsAdvance) {
                    this.creditsAdvance = true;
                    this.creditsDelay = this.creditsPresents ? 1365 : 182;
                } else {
                    this.fadeState = Main.FADE_OUT;
                    this.fadeReason = this.creditsPresents ? Main.FADE_REASON_SHOW_TITLE_SCREEN : Main.FADE_REASON_ADVANCE_CREDITS;
                }
            } else {
                this.creditsDelay--;
                if (this.creditsPresents && this.controlInput!.isAnyNonDirectionalPressed()) {
                    this.creditsDelay = 0;
                }
            }
        }
    }

    public renderCredits(gc: GameContainer, g: Graphics): void {
        if (this.creditsPaused) {
            if (this.creditsPresents) {
                g.setColor(Color.white);
                g.fillRect(64, 32, 512, 416);
                this.drawString(Main.credits[this.creditsIndex], 224, 192, this.creditsTitleIndex);
                this.drawString(Main.CREDITS4, 200, 224, this.creditsTitleIndex2);
            } else if (this.creditsIndex == 0 || this.creditsIndex == 3 || this.creditsIndex == 10) {
                this.drawString(Main.credits[this.creditsIndex], 304, 64, this.creditsTitleIndex);
                this.drawString(Main.CREDITS2, 336, 96, this.creditsTitleIndex2);
            } else if (this.creditsIndex == 11) {
                this.drawString(Main.credits[this.creditsIndex], 80, 64, this.creditsTitleIndex);
                this.drawString(Main.CREDITS3, 96, 96, this.creditsTitleIndex2);
            } else {
                this.drawString(Main.credits[this.creditsIndex], 112, 64, this.creditsTitleIndex);
                this.drawString(Main.CREDITS2, 144, 96, this.creditsTitleIndex2);
            }
        }
    }

    public initCastleFalls(): void {
        this.mode = Main.MODE_CASTLE_FALLS;
        this.castleCrumbleRumbleTicks = 0;
        this.playRumble("castleCrumble");

        this.castleFallDelay = 91;
        this.castleFallX = javaFloat(410);
        this.castleFallY = javaFloat(111);
        this.castleFallSparkDelay = 45;
        this.castleFallSparkCount = 8;
        this.castleFallSparkVisible = false;

        this.nextFrameTime = Sys.getTime();
    }

    public updateCastleFalls(gc: GameContainer): void {
        if (this.isCastleCrumbleActive()) {
            this.castleCrumbleRumbleTicks++;
        }

        if (this.castleFallSparkCount > 0) {
            if (this.castleFallSparkDelay > 0) {
                this.castleFallSparkDelay--;
            } else {
                if (this.castleFallSparkVisible) {
                    this.castleFallSparkCount--;
                    this.castleFallSparkVisible = false;
                    this.castleFallSparkDelay = 5;
                } else {
                    this.castleFallSparkVisible = true;
                    this.castleFallSparkDelay = 10;
                    this.castleFallSparkX = 433 + this.random.nextInt(16);
                    this.castleFallSparkY = 113 + this.random.nextInt(16);
                }
            }
        } else {
            if (this.castleFallY < 220) {
                this.castleFallY = javaFloat(this.castleFallY + 0.2);
            } else if (this.castleFallDelay == 0) {
                this.stopRumble("castleCrumble");
                this.fadeState = Main.FADE_OUT;
                this.fadeReason = Main.FADE_REASON_SHOW_CREDITS;
            } else {
                this.castleFallDelay--;
            }
            this.castleFallX = javaFloat(410 + this.random.nextInt(5) - 2);
        }
    }

    public renderCastleFalls(gc: GameContainer, g: Graphics): void {
        g.setColor(Color.white);
        g.fillRect(64, 32, 512, 416);
        this.castleTrees.draw(65, 192);
        this.castleTop.draw(trunc(this.castleFallX), trunc(this.castleFallY));
        this.castleBottom.draw(389, 195);
        if (this.castleFallSparkVisible) {
            this.spark.draw(this.castleFallSparkX, this.castleFallSparkY);
        }
    }

    public initDemo(): void {
        this.mode = Main.MODE_DEMO;

        if (++this.demoIndex == 3) {
            this.demoIndex = 0;
        }

        this.players = 4;
        this.score = 0;
        this.recordingIndex = 0;

        this.random = new JavaRandom(0xdeadbeef | 0);

        switch (this.demoIndex) {
            case 0:
                this.createStage(3, true);
                this.checkpoint = this.stageSegments![1].regions[1].checkpoint;
                this.restoreCheckpoint();
                break;
            case 1:
                this.createStage(2, true);
                break;
            case 2:
                this.createStage(2, true);
                this.checkpoint = this.stageSegments![1].regions[1].checkpoint;
                this.restoreCheckpoint();
                break;
        }

        this.random = new JavaRandom(0xdeadbeef | 0);

        this.nextFrameTime = Sys.getTime();
    }

    public initIntro(): void {
        this.mode = Main.MODE_INTRO;
        this.introWalkSpriteIndexIncrementor = 0;
        this.introWalkSpriteIndex = 0;
        this.introSimonX = 512;
        this.introCloudsX = javaFloat(500);
        this.introTime = 637;
        this.gateBatX1 = javaFloat(0);
        this.gateBatY1 = javaFloat(0);
        this.gateBatX2 = javaFloat(0);
        this.gateBatY2 = javaFloat(0);
        this.gateBatSpriteIndex = 0;
        this.gateBatSpriteIndexIncrementor = 0;

        this.players = 4;
        this.score = 0;
        this.stageIndex = 0;
        this.random = new JavaRandom();

        this.createStage(this.stageIndex, true);

        this.clearInputPressedRecords();

        let percent: number = javaFloat(1 - this.introTime * 0.0013755158184319119669876203576341);
        let angle: number = javaFloat(percent * 1.5707963267948966192313216916398);
        this.gateBatX1 = javaFloat(158 + javaFloat(161 * percent));
        this.gateBatY1 = javaFloat(224 - javaFloat(90 * javaFloat(FastTrig.sin(angle))));

        angle = javaFloat(angle * 2);
        this.gateBatX2 = javaFloat(336 + javaFloat(48 * javaFloat(FastTrig.cos(angle))));
        this.gateBatY2 = javaFloat(140 - javaFloat(48 * javaFloat(FastTrig.sin(angle))));

        this.requestMusic(this.prologue);

        this.nextFrameTime = Sys.getTime();
    }

    public updateIntro(gc: GameContainer): void {
        if (++this.gateBatSpriteIndexIncrementor == 10) {
            this.gateBatSpriteIndexIncrementor = 0;
            if (++this.gateBatSpriteIndex == 2) {
                this.gateBatSpriteIndex = 0;
            }
        }

        let percent: number = javaFloat(1 - this.introTime * 0.0013755158184319119669876203576341);
        let angle: number = javaFloat(percent * 1.5707963267948966192313216916398);
        this.gateBatX1 = javaFloat(158 + javaFloat(161 * percent));
        this.gateBatY1 = javaFloat(224 - javaFloat(90 * javaFloat(FastTrig.sin(angle))));

        angle = javaFloat(angle * 2);
        this.gateBatX2 = javaFloat(336 + javaFloat(48 * javaFloat(FastTrig.cos(angle))));
        this.gateBatY2 = javaFloat(140 - javaFloat(48 * javaFloat(FastTrig.sin(angle))));

        if (--this.introTime == 0) {
            this.fadeState = Main.FADE_OUT;
            this.fadeReason = Main.FADE_REASON_RESTORE_CHECKPOINT;
        }

        if (this.introSimonX > 292) {
            this.introSimonX--;

            if (++this.introWalkSpriteIndexIncrementor == 16) {
                this.introWalkSpriteIndexIncrementor = 0;
                if (++this.introWalkSpriteIndex == 4) {
                    this.introWalkSpriteIndex = 0;
                }
            }
        }

        this.introCloudsX = javaFloat(this.introCloudsX - 0.125);
    }

    public renderIntro(gc: GameContainer, g: Graphics): void {
        g.setColor(Color.white);
        g.fillRect(64, 32, 512, 98);
        this.gates.draw(64, 98);

        this.clouds.draw(trunc(this.introCloudsX), 153);
        this.gateBats[this.gateBatSpriteIndex].draw(trunc(this.gateBatX1), trunc(this.gateBatY1));
        this.gateBats[1 ^ this.gateBatSpriteIndex].draw(trunc(this.gateBatX2), trunc(this.gateBatY2));

        if (this.introSimonX == 292) {
            this.simonBack.draw(292, 375);
        } else {
            this.simonWalking[Main.LEFT][Simon.walkSpriteIndexes[this.introWalkSpriteIndex]].draw(this.introSimonX, 375);
        }
    }

    public initContinueScreen(): void {
        this.mode = Main.MODE_CONTINUE_SCREEN;

        this.players = 4;
        this.score = 0;
        this.continueSelected = true;

        this.createStage(this.stageIndex, true);

        this.clearInputPressedRecords();

        this.requestMusic(this.game_over);

        this.nextFrameTime = Sys.getTime();
    }

    public updateContinueScreen(gc: GameContainer): void {
        if (this.controlInput!.isMenuUpPressed()) {
            this.continueSelected = true;
        } else if (this.controlInput!.isMenuDownPressed()) {
            this.continueSelected = false;
        } else if (this.controlInput!.isMenuSelectPressed()) {
            this.fadeState = Main.FADE_OUT;
            if (this.continueSelected) {
                this.fadeReason = Main.FADE_REASON_RESTORE_CHECKPOINT;
            } else {
                this.fadeReason = Main.FADE_REASON_SHOW_TITLE_SCREEN;
            }
        }
    }

    public renderContinueScreen(gc: GameContainer, g: Graphics): void {
        g.setColor(Color.white);
        g.fillRect(64, 32, 512, 416);

        this.drawString("GAME OVER", 256, 208);
        const optionX = this.centerLongestMenuOptionX(Main.GAME_OVER_OPTIONS);
        this.drawString("CONTINUE", optionX, Main.MENU_TWO_OPTION_Y);
        this.drawString("END", optionX, Main.MENU_TWO_OPTION_Y + Main.MENU_ROW_HEIGHT);

        if (this.continueSelected) {
            this.smallHeart.draw(optionX - 32, Main.MENU_TWO_OPTION_Y);
        } else {
            this.smallHeart.draw(optionX - 32, Main.MENU_TWO_OPTION_Y + Main.MENU_ROW_HEIGHT);
        }
    }

    public initInputConfig(gc: GameContainer): void {
        this.mode = Main.MODE_INPUT_CONFIG;
        if (this.inputConfigMode != null) {
            this.inputConfigMode.dispose();
        }
        this.inputConfigMode = new InputConfigMode(this);
        this.inputConfigMode.init(gc);
        this.nextFrameTime = Sys.getTime();
    }

    public captureInputConfigModeState(): InputConfigModeSnapshot | null {
        if (this.mode != Main.MODE_INPUT_CONFIG || this.inputConfigMode == null) {
            return null;
        }
        return this.inputConfigMode.createSnapshot();
    }

    public restoreInputConfigModeState(gc: GameContainer, snapshot: InputConfigModeSnapshot | null): void {
        if (this.inputConfigMode != null) {
            this.inputConfigMode.dispose();
            this.inputConfigMode = null;
        }
        if (this.mode != Main.MODE_INPUT_CONFIG || snapshot == null) {
            return;
        }
        this.inputConfigMode = new InputConfigMode(this);
        this.inputConfigMode.restoreSnapshot(gc, snapshot);
    }

    public updateInputConfig(gc: GameContainer): void {
        if (this.inputConfigMode != null) {
            this.inputConfigMode.update(gc);
        }
    }

    public renderInputConfig(gc: GameContainer, g: Graphics): void {
        if (this.inputConfigMode != null) {
            this.inputConfigMode.render(gc, g);
        }
    }

    private mapScreenX: number = 0;
    private mapScreenTargetX: number = 0;
    private mapDelay: number = 0;
    public initMapScreen(): void {
        this.mode = Main.MODE_MAP;

        this.gateBatSpriteIndex = 0;
        this.gateBatSpriteIndexIncrementor = 0;
        this.introWalkSpriteIndexIncrementor = 0;
        this.introWalkSpriteIndex = 0;
        this.introSimonX = 0;

        this.stageIndex++;
        this.players++;

        this.mapScreenX = 576;
        this.mapScreenTargetX = this.stageIndex > 2 ? -192 : 64;

        this.clearInputPressedRecords();

        this.justShowedMap = true;
        this.createStage(this.stageIndex, true);
        this.justShowedMap = true;

        switch (this.stageIndex) {
            case 0:
                this.requestMusic(this.map_1);
                this.mapDelay = 5 * 91;
                break;
            case 1:
                this.requestMusic(this.map_1);
                this.mapDelay = 5 * 91;
                break;
            case 2:
                this.requestMusic(this.map_2);
                this.mapDelay = 2 * 91;
                break;
            case 3:
                this.requestMusic(this.map_1);
                this.mapDelay = 2 * 91;
                break;
            case 4:
                this.requestMusic(this.map_3);
                this.mapDelay = 4 * 91;
                break;
            case 5:
                this.requestMusic(this.map_4);
                this.mapDelay = 1 * 91;
                break;
        }

        this.nextFrameTime = Sys.getTime();
    }

    private queueStartupAudio(): void {
        if (this.startupAudioQueued) {
            return;
        }
        this.startupAudioQueued = true;

        this.boss_1 = new Song("music/boss_1_intro.ogg", "music/boss_1_loop.ogg");
        this.boss_2 = new Song("music/boss_2_intro.ogg", "music/boss_2_loop.ogg");
        this.ending = new Song(null, "music/ending_loop.ogg");
        this.game_over = new Music("music/game_over.ogg");
        this.map_1 = new Music("music/map_1.ogg");
        this.map_2 = new Music("music/map_2.ogg");
        this.map_3 = new Music("music/map_3.ogg");
        this.map_4 = new Music("music/map_4.ogg");
        this.prologue = new Music("music/prologue.ogg");
        this.simon_killed = new Music("music/simon_killed.ogg");
        this.stage_1_1 = new Song(null, "music/stage_1_1_loop.ogg");
        this.stage_1_2 = new Song("music/stage_1_2_intro.ogg", "music/stage_1_2_loop.ogg");
        this.stage_2_1 = new Song("music/stage_2_1_intro.ogg", "music/stage_2_1_loop.ogg");
        this.stage_3_1 = new Song("music/stage_3_1_intro.ogg", "music/stage_3_1_loop.ogg");
        this.stage_4_1 = new Song(null, "music/stage_4_1_loop.ogg");
        this.stage_4_2 = new Song(null, "music/stage_4_2_loop.ogg");
        this.stage_5_1 = new Song("music/stage_5_1_intro.ogg", "music/stage_5_1_loop.ogg");
        this.stage_6_1 = new Song(null, "music/stage_6_1_loop.ogg");
        this.stage_6_2 = new Song("music/stage_6_2_intro.ogg", "music/stage_6_2_loop.ogg");
        this.stage_cleared = new Music("music/stage_cleared.ogg");
        this.dracula_dead = new Music("music/dracula_dead.ogg");
    }

    public updateMapScreen(gc: GameContainer): void {
        if (this.mapScreenX > this.mapScreenTargetX) {
            this.mapScreenX--;
        } else if (this.introSimonX < 576) {
            this.introSimonX++;

            if (++this.introWalkSpriteIndexIncrementor == 16) {
                this.introWalkSpriteIndexIncrementor = 0;
                if (++this.introWalkSpriteIndex == 4) {
                    this.introWalkSpriteIndex = 0;
                }
            }
        } else if (this.mapDelay > 0) {
            this.mapDelay--;
        } else {
            this.fadeState = Main.FADE_OUT;
            this.fadeReason = Main.FADE_REASON_RESTORE_CHECKPOINT;
        }

        if (++this.gateBatSpriteIndexIncrementor == 10) {
            this.gateBatSpriteIndexIncrementor = 0;
            if (++this.gateBatSpriteIndex == 2) {
                this.gateBatSpriteIndex = 0;
            }
        }
    }

    public renderMapScreen(gc: GameContainer, g: Graphics): void {
        g.setColor(Color.white);
        g.fillRect(64, 32, 512, 416);

        this.castleMaps[0].draw(trunc(this.mapScreenX), 96);
        this.castleMaps[1].draw(384 + trunc(this.mapScreenX), 96);

        this.gateBats[this.gateBatSpriteIndex].draw(trunc(this.mapScreenX) + Main.mapBats[this.stageIndex][0], 96 + Main.mapBats[this.stageIndex][1]);

        this.simonWalking[Main.RIGHT][Simon.walkSpriteIndexes[this.introWalkSpriteIndex]].draw(this.introSimonX, 321);

        g.setColor(Color.black);
        g.fillRect(0, 96, 64, 352);
        g.fillRect(576, 96, 64, 352);
    }

    public initTitleScreen(): void {
        this.stopSong();
        if (this.game_over.playing()) {
            this.game_over.stop();
        }
        if (this.inputConfigMode != null) {
            this.inputConfigMode.dispose();
            this.inputConfigMode = null;
        }

        this.mode = Main.MODE_TITLE_SCREEN;

        this.titleTimeout = 1365;
        this.titleBatX = javaFloat(0);
        this.titleBatY = javaFloat(0);
        this.titleBatScale = javaFloat(10);
        this.titleBatXRadius = javaFloat(0);
        this.titleBatSpriteIndex = 0;
        this.titleBatSpriteIndexIncrementor = 0;
        this.titleBatSteps = 0;
        this.titleMenu = Main.TITLE_MENU_MAIN;
        this.titleSelectedIndex = 0;
        this.titleBatAngle = javaFloat(0);

        this.clearInputPressedRecords();

        this.nextFrameTime = Sys.getTime();
    }

    public updateTitleScreen(gc: GameContainer): void {
        if (this.fade == Main.FADE_DONE) {
            if (this.titleBatSteps < 273) {
                this.titleBatSteps++;
                this.titleBatX = javaFloat(499 + javaFloat(this.titleBatXRadius * javaFloat(FastTrig.sin(this.titleBatAngle))));
                this.titleBatY = javaFloat(220 + javaFloat(12 * javaFloat(FastTrig.sin(this.titleBatAngle))));

                this.titleBatAngle = javaFloat(this.titleBatAngle + Main.TITLE_BAT_ANGLE_INC);
                this.titleBatScale = javaFloat(this.titleBatScale + Main.TITLE_BAT_SCALE_INC);
                this.titleBatXRadius = javaFloat(this.titleBatXRadius + Main.TITLE_BAT_X_RADIUS_INC);
            }

            if (++this.titleBatSpriteIndexIncrementor == 9) {
                this.titleBatSpriteIndexIncrementor = 0;
                if (++this.titleBatSpriteIndex == 4) {
                    this.titleBatSpriteIndex = 0;
                }
            }

            if (this.controlInput!.isMenuUpPressed()) {
                this.titleSelectedIndex--;
                if (this.titleSelectedIndex < 0) {
                    this.titleSelectedIndex = 0;
                }
                this.titleTimeout = 1365;
            } else if (this.controlInput!.isMenuDownPressed()) {
                this.titleSelectedIndex++;
                const optionCount = this.getTitleOptionCount();
                if (this.titleSelectedIndex >= optionCount) {
                    this.titleSelectedIndex = optionCount - 1;
                }
                this.titleTimeout = 1365;
            } else if (this.controlInput!.isMenuSelectPressed()) {
                this.playSound(this.pressed_enter);
                this.selectTitleMenuOption();
            } else if (this.titleMenu == Main.TITLE_MENU_MAIN && --this.titleTimeout <= 0) {
                this.fadeState = Main.FADE_OUT;
                this.fadeReason = Main.FADE_REASON_SHOW_DEMO;
            } else if (this.titleMenu != Main.TITLE_MENU_MAIN) {
                this.titleTimeout = 1365;
            }
        }
    }

    public renderTitleScreen(gc: GameContainer, g: Graphics): void {
        if (this.titleMenu == Main.TITLE_MENU_INPUT) {
            g.setColor(Color.white);
            g.fillRect(64, 32, 512, 416);
            this.renderTitleInputMenu(gc);
            return;
        }

        this.titleImage.draw(64, 32);

        g.setColor(Color.white);
        g.fillRect(64, 310, 512, 138);

        if (this.titleBatSteps == 273) {
            this.titleBats[Main.titleBatSequence[this.titleBatSpriteIndex]].draw(432, 208);
        } else {
            this.titleBats[Main.titleBatSequence[this.titleBatSpriteIndex]].draw(
                trunc(this.titleBatX),
                trunc(this.titleBatY),
                trunc(this.titleBatScale),
                trunc(this.titleBatScale)
            );
        }

        switch (this.titleMenu) {
            case Main.TITLE_MENU_MAIN:
                this.renderTitleMainMenu();
                break;
            case Main.TITLE_MENU_OPTIONS:
                this.renderTitleOptionsMenu();
                break;
            case Main.TITLE_MENU_DIFFICULTY:
                this.renderTitleDifficultyMenu();
                break;
        }

        const attributionText = "2010, 2026 MEATFIGHTER.COM";
        this.drawString(attributionText, this.centerTextX(attributionText), 430);
    }

    private getTitleOptionCount(): number {
        switch (this.titleMenu) {
            case Main.TITLE_MENU_OPTIONS:
            case Main.TITLE_MENU_INPUT:
                return 3;
            case Main.TITLE_MENU_MAIN:
            case Main.TITLE_MENU_DIFFICULTY:
            default:
                return 2;
        }
    }

    private selectTitleMenuOption(): void {
        switch (this.titleMenu) {
            case Main.TITLE_MENU_MAIN:
                if (this.titleSelectedIndex == 0) {
                    this.fadeState = Main.FADE_OUT;
                    this.fadeReason = Main.FADE_REASON_SHOW_INTRO;
                } else {
                    this.setTitleMenu(Main.TITLE_MENU_OPTIONS);
                }
                break;
            case Main.TITLE_MENU_OPTIONS:
                switch (this.titleSelectedIndex) {
                    case 0:
                        this.setTitleMenu(Main.TITLE_MENU_INPUT);
                        break;
                    case 1:
                        this.setTitleMenu(Main.TITLE_MENU_DIFFICULTY, this.difficulty);
                        break;
                    case 2:
                        this.setTitleMenu(Main.TITLE_MENU_MAIN);
                        break;
                }
                break;
            case Main.TITLE_MENU_INPUT:
                if (this.titleSelectedIndex == 0) {
                    this.fadeState = Main.FADE_OUT;
                    this.fadeReason = Main.FADE_REASON_SHOW_INPUT_CONFIG;
                } else if (this.titleSelectedIndex == 1) {
                    this.buttonMapping.resetToDefaults();
                    this.notifyInputMappingChanged();
                    this.invalidateTitleInputMappingCache();
                    this.setTitleMenu(Main.TITLE_MENU_INPUT, 1);
                } else {
                    this.setTitleMenu(Main.TITLE_MENU_MAIN);
                }
                break;
            case Main.TITLE_MENU_DIFFICULTY:
                this.setDifficulty(this.titleSelectedIndex == 0 ? Main.DIFFICULTY_NORMAL : Main.DIFFICULTY_HARD);
                this.setTitleMenu(Main.TITLE_MENU_MAIN);
                break;
        }
    }

    private setTitleMenu(menu: number): void;
    private setTitleMenu(menu: number, selectedIndex: number): void;
    private setTitleMenu(menu: number, selectedIndex: number = 0): void {
        this.titleMenu = menu;
        this.titleSelectedIndex = selectedIndex;
        const optionCount = this.getTitleOptionCount();
        if (this.titleSelectedIndex >= optionCount) {
            this.titleSelectedIndex = optionCount - 1;
        }
        if (this.titleSelectedIndex < 0) {
            this.titleSelectedIndex = 0;
        }
        this.titleTimeout = 1365;
        this.clearInputPressedRecords();
    }

    private renderTitleMainMenu(): void {
        const optionX = this.centerLongestMenuOptionX(Main.TITLE_MAIN_OPTIONS);
        this.drawString("START", optionX, Main.MENU_TWO_OPTION_Y);
        this.drawString("OPTIONS", optionX, Main.MENU_TWO_OPTION_Y + Main.MENU_ROW_HEIGHT);
        this.drawTitleHeart(optionX - 32, Main.MENU_TWO_OPTION_Y);
    }

    private renderTitleOptionsMenu(): void {
        const optionX = this.centerLongestMenuOptionX(Main.TITLE_OPTIONS_OPTIONS);
        this.drawString("INPUT", optionX, Main.MENU_THREE_OPTION_Y);
        this.drawString("DIFFICULTY", optionX, Main.MENU_THREE_OPTION_Y + Main.MENU_ROW_HEIGHT);
        this.drawString("DONE", optionX, Main.MENU_THREE_OPTION_Y + Main.MENU_ROW_HEIGHT * 2);
        this.drawTitleHeart(optionX - 32, Main.MENU_THREE_OPTION_Y);
    }

    private renderTitleInputMenu(gc: GameContainer): void {
        this.drawCenteredString("INPUT", Main.TITLE_INPUT_TITLE_Y);
        this.updateTitleInputMappingCache(ButtonMapping.usesStandardGamepadLabels(gc.getInput()));
        const mappingX = this.titleInputMappingX;
        for (let i: number = 0; i < Main.TITLE_INPUT_ACTIONS.length; i++) {
            this.drawString(this.titleInputMappingLines[i], mappingX, Main.TITLE_INPUT_MAPPING_Y + i * Main.TITLE_INPUT_MAPPING_ROW_HEIGHT);
        }
        const optionX = this.centerLongestMenuOptionX(Main.TITLE_INPUT_OPTIONS);
        for (let i: number = 0; i < Main.TITLE_INPUT_OPTIONS.length; i++) {
            this.drawString(Main.TITLE_INPUT_OPTIONS[i], optionX, Main.TITLE_INPUT_MENU_Y + i * Main.MENU_ROW_HEIGHT);
        }
        this.drawString("^", optionX - 32, Main.TITLE_INPUT_MENU_Y + this.titleSelectedIndex * Main.MENU_ROW_HEIGHT);
    }

    private renderTitleDifficultyMenu(): void {
        const optionX = this.centerLongestMenuOptionX(Main.TITLE_DIFFICULTY_OPTIONS);
        this.drawString("NORMAL", optionX, Main.MENU_TWO_OPTION_Y);
        this.drawString("HARD", optionX, Main.MENU_TWO_OPTION_Y + Main.MENU_ROW_HEIGHT);
        this.drawTitleHeart(optionX - 32, Main.MENU_TWO_OPTION_Y);
    }

    private drawTitleHeart(x: number, y: number, rowHeight: number = Main.MENU_ROW_HEIGHT): void {
        this.smallHeart.draw(x, y + this.titleSelectedIndex * rowHeight);
    }

    private invalidateTitleInputMappingCache(): void {
        this.titleInputMappingCacheDirty = true;
    }

    private updateTitleInputMappingCache(standardLayout: boolean = Main.titleInputLabelStyles.get(this) ?? false): void {
        if (!this.titleInputMappingCacheDirty && Main.titleInputLabelStyles.get(this) === standardLayout) return;
        let maxLength = 0;
        for (let i = 0; i < Main.TITLE_INPUT_ACTIONS.length; i++) {
            const line = this.createInputMappingLine(Main.TITLE_INPUT_ACTIONS[i], standardLayout);
            this.titleInputMappingLines[i] = line;
            maxLength = Math.max(maxLength, line.length);
        }
        this.titleInputMappingX = Math.max(64, this.centerTextX(maxLength));
        this.titleInputMappingCacheDirty = false;
        Main.titleInputLabelStyles.set(this, standardLayout);
    }

    private createInputMappingLine(action: string, standardLayout: boolean = false): string {
        return (
            action.padEnd(7, " ") + "= " + this.buttonMapping.keyboardLabelFor(action) + ", " + this.buttonMapping.controllerLabelFor(action, standardLayout)
        );
    }

    private drawCenteredString(text: string, y: number): void {
        this.drawString(text, this.centerTextX(text), y);
    }

    private centerTextX(text: string): number;
    private centerTextX(length: number): number;
    private centerTextX(textOrLength: string | number): number {
        const length = typeof textOrLength === "string" ? textOrLength.length : textOrLength;
        return (640 - (length << 4)) >> 1;
    }

    private centerLongestMenuOptionX(options: string[]): number {
        let maxLength: number = 0;
        for (let i: number = 0; i < options.length; i++) {
            maxLength = Math.max(maxLength, options[i].length);
        }
        return this.centerTextX(maxLength);
    }

    private drawStatusBar(g: Graphics): void {
        g.setColor(Color.white);
        g.fillRect(64, 32, 512, 64);

        if (this.mode == Main.MODE_CREDITS) {
            return;
        }

        this.drawString("SCORE-", 64, 32);
        this.drawString("PLAYER", 64, 48);
        this.drawString("ENEMY", 64, 64);
        this.drawNumber(this.score, 6, 160, 32);
        this.drawString("TIME", 272, 32);
        this.drawNumber(this.time, 4, 352, 32);
        this.drawString("STAGE", 432, 32);
        this.drawNumber(this.stage, 2, 528, 32);
        this.drawString("^-", 400, 48);
        this.drawString("P-", 400, 64);
        this.drawNumber(this.hearts, 2, 432, 48);
        this.drawNumber(this.players, 2, 432, 64);

        for (let i: number = 0; i < this.playerPower; i++) {
            this.power[0].draw(176 + (i << 3), 48);
        }
        for (let i: number = this.playerPower; i < 16; i++) {
            this.power[1].draw(176 + (i << 3), 48);
        }
        for (let i: number = 0; i < this.enemyPower; i++) {
            this.power[0].draw(176 + (i << 3), 64);
        }
        for (let i: number = this.enemyPower; i < 16; i++) {
            this.power[1].draw(176 + (i << 3), 64);
        }

        this.weaponBorder.draw(320, 48);
        if (this.repeatsFlashing == 0 || ((this.repeatsFlashing >> 2) & 1) == 0) {
            if (this.weaponRepeats == Main.WEAPON_REPEATS_DOUBLE) {
                this.dropItems[DropItem.TYPE_DOUBLE].draw(480, 48);
            } else if (this.weaponRepeats == Main.WEAPON_REPEATS_TRIPLE) {
                this.dropItems[DropItem.TYPE_TRIPLE].draw(480, 48);
            }
        }

        switch (this.weaponType) {
            case Main.WEAPON_TYPE_AXE:
                this.dropItems[DropItem.TYPE_AXE].draw(336, 56);
                break;
            case Main.WEAPON_TYPE_BOOMERANG:
                this.dropItems[DropItem.TYPE_BOOMERANG].draw(336, 56);
                break;
            case Main.WEAPON_TYPE_DAGGER:
                this.dropItems[DropItem.TYPE_DAGGER].draw(336, 56);
                break;
            case Main.WEAPON_TYPE_HOLY_WATER:
                this.dropItems[DropItem.TYPE_HOLY_WATER].draw(336, 56);
                break;
            case Main.WEAPON_TYPE_STOP_WATCH:
                this.dropItems[DropItem.TYPE_STOP_WATCH].draw(336, 56);
                break;
        }
    }

    public drawFaded(image: Image, x: number, y: number, alpha: number): void {
        x = javaFloat(x);
        y = javaFloat(y);
        alpha = javaFloat(alpha);
        image.setAlpha(alpha);
        image.draw(64 + trunc(x) - this.camera, 96 + trunc(y));
        image.setAlpha(1);
    }

    public draw(image: Image, x: number, y: number): void;
    public draw(image: Image, x: number, y: number, angle: number): void;
    public draw(image: Image, x: number, y: number, angle?: number): void {
        x = javaFloat(x);
        y = javaFloat(y);
        if (angle !== undefined) {
            angle = javaFloat(angle);
            image.setRotation(trunc(angle));
            image.draw(64 + trunc(x) - this.camera, 96 + trunc(y));
            image.setRotation(0);

            return;
        }
        image.draw(64 + trunc(x) - this.camera, 96 + trunc(y));
    }

    public drawLine(g: Graphics, x1: number, y1: number, x2: number, y2: number): void {
        x1 = javaFloat(x1);
        y1 = javaFloat(y1);
        x2 = javaFloat(x2);
        y2 = javaFloat(y2);
        let color: Color = g.getColor();
        g.setColor(Color.red);
        g.drawLine(javaFloat(javaFloat(x1 - this.camera) + 64), javaFloat(y1 + 96), javaFloat(javaFloat(x2 - this.camera) + 64), javaFloat(y2 + 96));
        g.setColor(color);
    }

    public override render(gc: GameContainer, g: Graphics): void {
        let skipFadeOverlay: boolean = false;
        const displayMonochromePalette = this.displayMonochromePalette;
        try {
            g.setColorInverted(this.darkDisplayMode);
            if (displayMonochromePalette !== null) {
                g.setMonochromePalette(displayMonochromePalette.blackReplacement, displayMonochromePalette.whiteReplacement);
            }

            switch (this.mode) {
                case Main.MODE_TITLE_SCREEN:
                    this.renderTitleScreen(gc, g);
                    break;
                case Main.MODE_CONTINUE_SCREEN:
                    this.renderContinueScreen(gc, g);
                    break;
                case Main.MODE_INTRO:
                    this.renderIntro(gc, g);
                    break;
                case Main.MODE_MAP:
                    this.renderMapScreen(gc, g);
                    break;
                case Main.MODE_INPUT_CONFIG:
                    this.renderInputConfig(gc, g);
                    break;
                case Main.MODE_CASTLE_FALLS:
                    this.renderCastleFalls(gc, g);
                    break;
                case Main.MODE_CREDITS:
                    if (this.creditsPresents) {
                        skipFadeOverlay = true;
                        this.renderCredits(gc, g);
                        break;
                    }
                case Main.MODE_DEMO:
                case Main.MODE_PLAYING:
                    g.setColor(Color.white);
                    g.fillRect(64, 96, 512, 352);

                    let offset: number = 64 - (this.camera & 0x1f);
                    let x: number = this.camera >> 5;

                    for (let i: number = 0; i < 11; i++) {
                        for (let j: number = 0; j < 17; j++) {
                            let block: number = this.map![i][j + x];
                            if (block > 0) {
                                this.blocks[block].draw((j << 5) + offset, 96 + (i << 5));
                            }
                        }
                    }

                    let things = this.regionThingStack.things;
                    for (let j: number = this.regionThingStack.top; j >= 0; j--) {
                        things[j]!.render(gc, g);
                    }

                    things = this.oldThingStack.things;
                    for (let j: number = this.oldThingStack.top; j >= 0; j--) {
                        things[j]!.render(gc, g);
                    }

                    const weapons = this.weaponsStack.things;
                    for (let j: number = this.weaponsStack.top; j >= 0; j--) {
                        weapons[j]!.render(gc, g);
                    }

                    for (let i: number = this.platforms!.length - 1; i >= 0; i--) {
                        this.platforms![i]!.render(gc, g);
                    }

                    this.simon!.render(gc, g);

                    g.setColor(Color.black);
                    g.fillRect(0, 96, 64, 352);
                    g.fillRect(576, 96, 64, 352);

                    this.drawStatusBar(g);

                    break;
            }

            if (this.mode == Main.MODE_CREDITS && !skipFadeOverlay) {
                this.renderCredits(gc, g);
            }
        } finally {
            if (displayMonochromePalette !== null) {
                g.clearMonochromePalette();
            }
            g.setColorInverted(false);
        }

        if (!skipFadeOverlay && this.fadeState != Main.FADE_DONE) {
            g.setColor(this.fades[this.fade]);
            g.fillRect(64, 32, 512, 416);
        }
    }

    public static main(_args: string[]): void {
        throw new Error("Use the PWA bootstrap in src/main.ts instead of Main.main().");
    }
}
