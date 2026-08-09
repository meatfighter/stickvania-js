/*
 * Stickvania
 * Copyright (C) 2010 meatfighter.com
 *
 * This file is part of Stickvania
 *
 * Stickvania is free software; you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published
 * by the Free Software Foundation; either version 3 of the License, or
 * (at your option) any later version.
 *
 * Stickvania is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 */

package stickvania;

import org.newdawn.slick.util.*;
import org.newdawn.slick.*;
import org.newdawn.slick.opengl.*;
import org.lwjgl.opengl.*;
import org.lwjgl.input.*;
import org.lwjgl.*;
import java.io.*;
import java.util.*;
import java.nio.*;

public final class Main extends BasicGame {

  public static final float GRAVITY = 0.21f;
  public static final float SIMON_JUMP_VELOCITY = -5.25f;

  public static final float INVINCIBLE_FRACTION
      = 0.032608695652173913043478260869565f;
  public static final float TITLE_BAT_ANGLE_INC
      = (float)((3 * Math.PI / 2) / 273);
  public static final float TITLE_BAT_SCALE_INC = 54f / 273f;
  public static final float TITLE_BAT_X_RADIUS_INC = 67f / 273f;

  public static final int LEFT = 0;
  public static final int RIGHT = 1;

  public static final int MODE_TITLE_SCREEN = 0;
  public static final int MODE_DEMO = 1;
  public static final int MODE_CONTINUE_SCREEN = 2;
  public static final int MODE_ENDING = 3;
  public static final int MODE_PLAYING = 4;
  public static final int MODE_INTRO = 5;
  public static final int MODE_MAP = 6;
  public static final int MODE_CASTLE_FALLS = 7;
  public static final int MODE_CREDITS = 8;
  public static final int MODE_LOADING = 9;

  public static final char CANDLE_ITEM_AXE = 'a';
  public static final char CANDLE_ITEM_BOOMERANG = 'b';
  public static final char CANDLE_ITEM_CHEST = 'c';
  public static final char CANDLE_ITEM_CROWN = 'r';
  public static final char CANDLE_ITEM_DAGGER = 'd';
  public static final char CANDLE_ITEM_DOUBLE = '2';
  public static final char CANDLE_ITEM_EMPTY = '.';
  public static final char CANDLE_ITEM_HOLY_WATER = 'w';
  public static final char CANDLE_ITEM_KILL_ALL = 'k';
  public static final char CANDLE_ITEM_LARGE_HEART = 'l';
  public static final char CANDLE_ITEM_MEAT = 'm';
  public static final char CANDLE_ITEM_MONEY_BAG = '$';
  public static final char CANDLE_ITEM_ONE_UP = '1';
  public static final char CANDLE_ITEM_POTION = 'p';
  public static final char CANDLE_ITEM_SMALL_HEART = 'h';
  public static final char CANDLE_ITEM_STOP_WATCH = 's';
  public static final char CANDLE_ITEM_TRIPLE = '3';

  public static final char TILE_EMPTY = '.';
  public static final char TILE_SIMON = '*';
  public static final char TILE_CANDLES = 'c';
  public static final char TILE_DOOR = '|';
  public static final char TILE_TORCH = 't';
  public static final char TILE_WALL = 'X';
  public static final char TILE_PLATFORM = '-';
  public static final char TILE_HIDDEN_PLATFORM = '=';
  public static final char TILE_BREAK_WALL = 'B';
  public static final char TILE_STAIRS_LEFT = '\\';
  public static final char TILE_STAIRS_RIGHT = '/';
  public static final char TILE_STAIRS_LEFT_CAPPED = 'L';
  public static final char TILE_STAIRS_RIGHT_CAPPED = 'R';
  public static final char TILE_ZOMBIE_SPAWNER = 'z';
  public static final char TILE_BAT_SPAWNER = 'b';
  public static final char TILE_DOG = 'd';
  public static final char TILE_MERMAN_SPAWNER = 'm';
  public static final char TILE_CHECK_POINT = '*';
  public static final char TILE_BAT_BOSS = 'A';
  public static final char TILE_GRIM_REAPER_BOSS = 'I';
  public static final char TILE_LANCE_KNIGHT = 'l';
  public static final char TILE_AXE_KNIGHT = 'x';
  public static final char TILE_SWOOPING_BAT = 's';
  public static final char TILE_MOVING_PLATFORM = 'p';
  public static final char TILE_MOVING_PLATFORM_2 = 'q';
  public static final char TILE_MEDUSA_HEAD_SPAWNER = 'M';
  public static final char TILE_SPIKES = 'S';
  public static final char TILE_BONE_PILLAR = 'P';
  public static final char TILE_GHOST = 'g';
  public static final char TILE_MEDUSA_BOSS = 'E';
  public static final char TILE_IGOR = 'i';
  public static final char TILE_WHITE_SKELETON = 'k';
  public static final char TILE_RED_SKELETON = 'K';
  public static final char TILE_RAVEN = 'r';
  public static final char TILE_MUMMY_BOSS = 'Y';
  public static final char TILE_FADING_STAIRS = 'f';
  public static final char TILE_BIRD_SPAWNER = 'D';
  public static final char TILE_BONE_DRAGON = 'G';
  public static final char TILE_BONE_DRAGON_2 = 'O';
  public static final char TILE_BRIDGE_BAT = 'T';
  public static final char TILE_SECRET = '!';
  public static final char TILE_DRACULA_BOSS = 'C';
  public static final char TILE_FRANKENSTEIN = 'F';

  public static final int WEAPON_TYPE_NONE = 0;
  public static final int WEAPON_TYPE_AXE = 1;
  public static final int WEAPON_TYPE_BOOMERANG = 2;
  public static final int WEAPON_TYPE_DAGGER = 3;
  public static final int WEAPON_TYPE_HOLY_WATER = 4;
  public static final int WEAPON_TYPE_STOP_WATCH = 5;

  public static final int WEAPON_REPEATS_SINGLE = 0;
  public static final int WEAPON_REPEATS_DOUBLE = 1;
  public static final int WEAPON_REPEATS_TRIPLE = 2;

  public static final int BLOCK_EMPTY = 0;
  public static final int BLOCK_FULL = 15;
  public static final int BLOCK_I_LEFT = 2;
  public static final int BLOCK_I_RIGHT = 1;
  public static final int BLOCK_I_UP = 8;
  public static final int BLOCK_I_DOWN = 4;
  public static final int BLOCK_U_LEFT = 13;
  public static final int BLOCK_U_RIGHT = 14;
  public static final int BLOCK_U_UP = 7;
  public static final int BLOCK_U_DOWN = 11;
  public static final int BLOCK_L_UP_LEFT = 10;
  public static final int BLOCK_L_DOWN_LEFT = 6;
  public static final int BLOCK_L_UP_RIGHT = 9;
  public static final int BLOCK_L_DOWN_RIGHT = 5;
  public static final int BLOCK_H = 3;
  public static final int BLOCK_E = 12;

  public static final int WALL_EMPTY = 0;
  public static final int WALL_PLATFORM = 1;
  public static final int WALL_FULL = 2;

  public static final int BLOCK_STAIRS_LEFT = 16;
  public static final int BLOCK_STAIRS_RIGHT = 17;
  public static final int BLOCK_STAIRS_LEFT_CAPPED = 18;
  public static final int BLOCK_STAIRS_RIGHT_CAPPED = 19;

  public static final int WHIP_LEATHER = 0;
  public static final int WHIP_SHORT_CHAIN = 1;
  public static final int WHIP_LONG_CHAIN = 2;

  public static final int FADE_DONE = 0;
  public static final int FADE_OUT = 1;
  public static final int FADE_IN = 2;

  public static final int FADE_REASON_STAIRS = 0;
  public static final int FADE_REASON_RESTORE_CHECKPOINT = 1;
  public static final int FADE_REASON_SHOW_MAP = 2;
  public static final int FADE_REASON_SHOW_INTRO = 3;
  public static final int FADE_REASON_SHOW_CONTINUE_SCREEN = 4;
  public static final int FADE_REASON_SHOW_TITLE_SCREEN = 5;
  public static final int FADE_REASON_SHOW_CASTLE_FALLS = 6;
  public static final int FADE_REASON_SHOW_DEMO = 7;
  public static final int FADE_REASON_SHOW_CREDITS = 8;
  public static final int FADE_REASON_ADVANCE_CREDITS = 9;

  public static final int[][][] stageNumbers = {
    { { 1, 1, 2, 3, 3 }, { 2 } },
    { { 4 }, { 5, 4 }, { 6, 5 }, { 6 } },
    { { 7, 7 }, { 7, 8 }, { 8, 9 } },
    { { 10 }, { 11, 12 } },
    { { 13 }, { 13, 14 }, { 15, 14 }, { 15 } },
    { { 17, 16 }, { 18, 17 }, { 18 } },
  };

  public static final int[][] whipSizes = { { 43, 3 }, { 48, 7 }, { 80, 7 } };
  public static final int[][][] whipOffsets = {
    { { 5, 11 }, { 0, 11 } },
    { { 0, 9 }, { 0, 9 } },
    { { 0, 9 }, { 0, 9 } },
  };

  public static final int[][] mapBats = {
    { 273, 208 },
    { 175, 142 },
    { 336, 108 }, 
    { 576, 174 }, 
    { 528, 77 }, 
    { 346, 30 },
  };

  public Color[] fades = new Color[23];
  private Cursor nativeCursor;

  public int mode = Main.MODE_LOADING;
  private int loadingIndex = 21;
  public DisplayMode nativeDisplayMode;
  public int maxWidth = 0;
  public int maxHeight = 0;
  public int maxColorDepth = 0;
  public AppGameContainer appGameContainer;
  public AppletGameContainer2 appletGameContainer;
  public ScalableGame2 scalableGame;
  private long nextFrameTime;
  private StageSegment[][] loadedSegments;
  private StageSegment[] stageSegments;
  private StageSegment stageSegment;
  private Checkpoint checkpoint;
  public int[][] map;
  public int[][] walls;
  public ThingStack regionThingStack = new ThingStack();
  public ThingStack regionStackSwap = new ThingStack();
  public ThingStack weaponsStack = new ThingStack();
  public ThingStack weaponsStackSwap = new ThingStack();
  public Thing[] platforms;
  public int mapWidth;
  public int fadeState = FADE_IN;
  public int fade = 22;
  public int fadeReason;  

  public Simon simon;

  public int score = 0;
  public int time = 999;
  public int timeIncrementor = 0;
  public int stage;
  public int stageIndex;
  public int hearts = 5;
  public int players = 4;
  public int playerPower = 16;
  public int enemyPower = 16;
  public int weaponType = WEAPON_TYPE_NONE;
  public int weaponRepeats = WEAPON_REPEATS_SINGLE;
  public int camera;
  public int timeFrozen = 0;
  public boolean killAll;
  public Random random = new Random();
  public boolean beatStage = false;
  public boolean floorBreaking;
  public int beatStageDelay;
  public int visibleWhipCount;
  public int repeatsFlashing;
  public boolean justShowedMap;
  public int demoIndex = 2;

  private byte[][] demoKeyRecordings = new byte[3][2730];
  private byte[][] endingKeyRecordings = new byte[12][728];

  private int titleTimeout;
  private float titleBatAngle;
  private float titleBatX;
  private float titleBatY;
  private float titleBatScale = 10f;
  private float titleBatXRadius;
  private int titleBatSpriteIndex;
  private int titleBatSpriteIndexIncrementor;
  private int titleBatSteps;
  private boolean pressEnterVisible = true;
  private int pressEnterVisibleIncrementor;
  private int pressEnterVisibleCount;
  private boolean enterPressed;
  private static final int[] titleBatSequence = { 0, 1, 2, 1 };

  public int introWalkSpriteIndexIncrementor;
  public int introWalkSpriteIndex;
  public int introSimonX = 512;
  public float introCloudsX = 500;
  public int introTime = 728;
  public float gateBatX1;
  public float gateBatY1;
  public float gateBatX2;
  public float gateBatY2;
  public int gateBatSpriteIndex;
  public int gateBatSpriteIndexIncrementor;

  private float castleFallX;
  private float castleFallY;
  private int castleFallSparkCount;
  private boolean castleFallSparkVisible;
  private int castleFallSparkX;
  private int castleFallSparkY;
  private int castleFallSparkDelay;
  private int castleFallDelay;

  public boolean continueSelected = true;

  public Door door;
  public ThingStack oldThingStack = new ThingStack();

  public Image[] blocks = new Image[20];
  public Image[] symbols = new Image[256];
  public Image[] power = new Image[2];
  public Image[][] simonWalking = new Image[2][3];
  public Image[] simonOnStairsUp = new Image[2];
  public Image[] simonOnStairsDown = new Image[2];
  public Image[] simonKneeling = new Image[2];
  public Image[][] simonWhipping = new Image[2][3];
  public Image[][] simonKneelWhipping = new Image[2][3];
  public Image[][] simonUpWhipping = new Image[2][3];
  public Image[][] simonDownWhipping = new Image[2][3];
  public Image[] simonHurt = new Image[2];
  public Image[] simonDead = new Image[2];
  public Image[][][] whips = new Image[2][3][3];
  public Image[] dropItems = new Image[17];
  public Image[] candles = new Image[2];
  public Image[] itemPoints = new Image[5];
  public Image[] fires = new Image[5];
  public Image[][] doors = new Image[2][3];
  public Image[] daggers = new Image[2];
  public Image[] holyWaters = new Image[2];
  public Image[][] zombies = new Image[2][2];
  public Image[][] bats = new Image[2][4];
  public Image[][] dogs = new Image[2][4];
  public Image[][] mermen = new Image[2][3];
  public Image[] fireballs = new Image[2];
  public Image[] batBoss = new Image[3];
  public Image[][] lanceKnight = new Image[2][3];
  public Image[][] medusaHeads = new Image[2][2];
  public Image[] bonePillars = new Image[2];
  public Image[][] ghosts = new Image[2][2];
  public Image[] medusaBoss = new Image[2];
  public Image[][] snakes = new Image[2][2];
  public Image[][] igors = new Image[2][2];
  public Image[][] skeletons = new Image[2][2];
  public Image[] crumble = new Image[2];
  public Image[][] ravens = new Image[2][4];
  public Image[][] mummyBoss = new Image[2][3];
  public Image[][] wrappings = new Image[2][2];
  public Image[][] birds = new Image[2][2];
  public Image[] boneDragons = new Image[3];
  public Image[][] axeKnights = new Image[2][2];
  public Image[] grimReaperBoss = new Image[2];
  public Image[][] draculaBoss = new Image[2][7];
  public Image[][] frankensteinBoss = new Image[2][3];

  public Image title;
  public Image[] titleBats = new Image[3];

  public Image[] gateBats = new Image[2];
  public Image gates;
  public Image clouds;

  public Image[] castleMaps = new Image[2];

  public Image castleBottom;
  public Image castleTop;
  public Image castleTrees;

  public Image axe;
  public Image boomerang;
  public Image weaponBorder;
  public Image smallHeart;
  public Image spark;
  public Image brickFragment;
  public Image torch;
  public Image droplets;
  public Image orb;
  public Image platform;
  public Image spikes;
  public Image bone;
  public Image sickle;
  public Image simonBack;  
  public Image blank_32;

  public Song boss_1;
  public Song boss_2;
  public Song ending;
  public Music game_over;
  public Music map_1;
  public Music map_2;
  public Music map_3;
  public Music map_4;
  public Music prologue;
  public Music simon_killed;
  public Song stage_1_1;
  public Song stage_1_2;
  public Song stage_2_1;
  public Song stage_3_1;
  public Song stage_4_1;
  public Song stage_4_2;
  public Song stage_5_1;
  public Song stage_6_1;
  public Song stage_6_2;
  public Music stage_cleared;
  public Music dracula_dead;

  public Sound advance_whip;
  public Sound bat_killed;
  public Sound bleep;
  public Sound boss_hurt;
  public Sound boss_killed_1;
  public Sound boss_killed_2;
  public Sound boss_killed_3;
  public Sound breaks_wall;
  public Sound crumble_sfx;
  public Sound dog_killed;
  public Sound door_opens_1;
  public Sound door_opens_2;
  public Sound gain_potion;
  public Sound got_money;
  public Sound heartbeat;
  public Sound hit_candle;
  public Sound killed_1;
  public Sound killed_2;
  public Sound killed_3;
  public Sound killed_4;
  public Sound killed_5;
  public Sound lose_potion;
  public Sound merman_spit;
  public Sound one_up;
  public Sound pressed_enter;
  public Sound simon_hurt;
  public Sound splash;
  public Sound torch_breaks;
  public Sound whip_1;
  public Sound whip_2;
  public Sound wing_flaps;
  public Sound zombie_killed;
  public Sound got_double;
  public Sound kill_all_sfx;
  public Sound simon_in_pit;
  public Sound threw_dagger;
  public Sound got_weapon;
  public Sound used_holy_water;
  public Sound spinning;
  public Sound raven_killed;
  public Sound ching;
  public Sound snuffed;
  public Sound medusa_head_killed;
  public Sound stunned;
  public Sound watch_tick;
  public Sound twang;
  public Sound large_bat_killed;
  public Sound thunder;
  public Sound fire_ball_shot;
  public Sound dracula_to_bats;
  public Sound lands;

  public Song currentSong;
  public Song requestedSong;

  private Input input;

  //private byte[] recording = new byte[91 * 8];
  private int recordingIndex = 0;

  public Main() throws Throwable {
    super("Stickvania");

    for(int i = 0; i < 3; i++) {
      Main.class.getClassLoader().getResourceAsStream(
          "recordings/demo_" + (i + 1) + ".dat").read(demoKeyRecordings[i]);
    }

    for(int i = 0; i < 12; i++) {
      Main.class.getClassLoader().getResourceAsStream(
          "recordings/ending_" + (i + 1) + ".dat").read(endingKeyRecordings[i]);
    }
  }

  public void init(GameContainer gc) throws SlickException {

    try {
      for(DisplayMode displayMode : Display.getAvailableDisplayModes()) {
        if ((displayMode.getWidth() > maxWidth 
                  || displayMode.getHeight() > maxHeight)
              || (displayMode.getWidth() == maxWidth
                  && displayMode.getHeight() == maxHeight
                  && displayMode.getBitsPerPixel() > maxColorDepth)) {
          maxWidth = displayMode.getWidth();
          maxHeight = displayMode.getHeight();
          maxColorDepth = displayMode.getBitsPerPixel();
          nativeDisplayMode = displayMode;
        }
      } 
    } catch(Throwable t) {
      throw new SlickException("Error finding native monitor resolution.", t);
    }

    for(int i = 0; i < fades.length; i++) {
      fades[i] = new Color(0, 0, 0, (255 * i) / fades.length);
    }

    input = gc.getInput();

    PackedSpriteSheet pack1 = new PackedSpriteSheet("images/pack_1.def",
        Image.FILTER_NEAREST);
    PackedSpriteSheet pack2 = new PackedSpriteSheet("images/pack_2.def",
        Image.FILTER_NEAREST);

    blank_32 = pack1.getSprite("blank_32");

    for(int i = 0; i < 26; i++) {
      symbols['a' + i] = symbols['A' + i] = pack1.getSprite(
          "symbols_" + (char)('a' + i));
    }
    for(int i = 0; i < 10; i++) {
      symbols['0' + i] = pack1.getSprite("symbols_" + i);
    }
    symbols[' '] = pack1.getSprite("blank_16");
    symbols[':'] = pack1.getSprite("symbols_colon");
    symbols[','] = pack1.getSprite("symbols_comma");    
    symbols['@'] = pack1.getSprite("symbols_copyright");
    symbols['='] = pack1.getSprite("symbols_equals");
    symbols['!'] = pack1.getSprite("symbols_exclamation");
    symbols['>'] = pack1.getSprite("symbols_gt");
    symbols['-'] = pack1.getSprite("symbols_hyphen");
    symbols['<'] = pack1.getSprite("symbols_lt");
    symbols['.'] = pack1.getSprite("symbols_period");
    symbols['+'] = pack1.getSprite("symbols_plus");  
    symbols['?'] = pack1.getSprite("symbols_question");
    symbols['"'] = pack1.getSprite("symbols_quotes");
    symbols['^'] = pack1.getSprite("small_heart");

    power[0] = pack1.getSprite("power_1");
    power[1] = pack1.getSprite("power_2");
    weaponBorder = pack1.getSprite("weapon_border");

    blocks[BLOCK_EMPTY] = pack1.getSprite("blank_32");
    blocks[BLOCK_FULL] = pack1.getSprite("block_4");
    blocks[BLOCK_E] = pack1.getSprite("block_2");
    blocks[BLOCK_H] = blocks[BLOCK_E].copy();
    blocks[BLOCK_H].rotate(90);
    blocks[BLOCK_I_UP] = pack1.getSprite("block_1");
    blocks[BLOCK_I_DOWN] = blocks[BLOCK_I_UP].getFlippedCopy(false, true);
    blocks[BLOCK_I_LEFT] = blocks[BLOCK_I_UP].copy();
    blocks[BLOCK_I_LEFT].rotate(-90);
    blocks[BLOCK_I_RIGHT] = blocks[BLOCK_I_UP].copy();
    blocks[BLOCK_I_RIGHT].rotate(90);
    blocks[BLOCK_U_LEFT] = pack1.getSprite("block_3");
    blocks[BLOCK_U_RIGHT] = pack1.getSprite("block_3")
        .getFlippedCopy(true, false);
    blocks[BLOCK_U_UP] = blocks[BLOCK_U_LEFT].copy();
    blocks[BLOCK_U_UP].rotate(90);
    blocks[BLOCK_U_DOWN] = blocks[BLOCK_U_LEFT].copy();
    blocks[BLOCK_U_DOWN].rotate(-90);
    blocks[BLOCK_L_UP_RIGHT] = pack1.getSprite("block_5");
    blocks[BLOCK_L_DOWN_RIGHT] = blocks[BLOCK_L_UP_RIGHT]
        .getFlippedCopy(false, true);
    blocks[BLOCK_L_UP_LEFT] = blocks[BLOCK_L_UP_RIGHT]
        .getFlippedCopy(true, false);
    blocks[BLOCK_L_DOWN_LEFT] = blocks[BLOCK_L_UP_RIGHT]
        .getFlippedCopy(true, true);
    blocks[BLOCK_STAIRS_LEFT] = pack1.getSprite("stairs_1");
    blocks[BLOCK_STAIRS_RIGHT]
        = blocks[BLOCK_STAIRS_LEFT].getFlippedCopy(true, false);
    blocks[BLOCK_STAIRS_LEFT_CAPPED] = pack1.getSprite("stairs_2");
    blocks[BLOCK_STAIRS_RIGHT_CAPPED]
        = blocks[BLOCK_STAIRS_LEFT_CAPPED].getFlippedCopy(true, false);

    for(int i = 0; i < 3; i++) {
      simonWalking[LEFT][i] = pack1.getSprite("simon_walking_" + (i + 1));
      simonWalking[RIGHT][i] = simonWalking[LEFT][i]
          .getFlippedCopy(true, false);
    }
    simonKneeling[LEFT] = pack1.getSprite("simon_kneeling");
    simonKneeling[RIGHT] = simonKneeling[LEFT].getFlippedCopy(true, false);
    simonOnStairsUp[LEFT] = pack1.getSprite("simon_on_stairs_up");
    simonOnStairsUp[RIGHT] = simonOnStairsUp[LEFT].getFlippedCopy(true, false);
    simonOnStairsDown[LEFT] = pack1.getSprite("simon_on_stairs_down");
    simonOnStairsDown[RIGHT] = simonOnStairsDown[LEFT]
        .getFlippedCopy(true, false);
    simonWhipping[LEFT][0] = pack1.getSprite("simon_whipping_1");
    simonWhipping[LEFT][1] = pack1.getSprite("simon_whipping_2");
    simonWhipping[LEFT][2] = pack1.getSprite("simon_whipping_3");
    simonWhipping[RIGHT][0] = simonWhipping[LEFT][0]
        .getFlippedCopy(true, false);
    simonWhipping[RIGHT][1] = simonWhipping[LEFT][1]
        .getFlippedCopy(true, false);
    simonWhipping[RIGHT][2] = simonWhipping[LEFT][2]
        .getFlippedCopy(true, false);
    simonKneelWhipping[LEFT][0] = pack1.getSprite("simon_kneel_whipping_1");
    simonKneelWhipping[LEFT][1] = pack1.getSprite("simon_kneel_whipping_2");
    simonKneelWhipping[LEFT][2] = pack1.getSprite("simon_kneel_whipping_3");
    simonKneelWhipping[RIGHT][0] = simonKneelWhipping[LEFT][0]
        .getFlippedCopy(true, false);
    simonKneelWhipping[RIGHT][1] = simonKneelWhipping[LEFT][1]
        .getFlippedCopy(true, false);
    simonKneelWhipping[RIGHT][2] = simonKneelWhipping[LEFT][2]
        .getFlippedCopy(true, false);
    simonUpWhipping[LEFT][0] = pack1.getSprite("simon_on_stairs_up_wipping_1");
    simonUpWhipping[LEFT][1] = pack1.getSprite("simon_on_stairs_up_wipping_2");
    simonUpWhipping[LEFT][2] = pack1.getSprite("simon_on_stairs_up_wipping_3");
    simonUpWhipping[RIGHT][0] = simonUpWhipping[LEFT][0]
        .getFlippedCopy(true, false);
    simonUpWhipping[RIGHT][1] = simonUpWhipping[LEFT][1]
        .getFlippedCopy(true, false);
    simonUpWhipping[RIGHT][2] = simonUpWhipping[LEFT][2]
        .getFlippedCopy(true, false);
    simonDownWhipping[LEFT][0]
        = pack1.getSprite("simon_on_stairs_down_wipping_1");
    simonDownWhipping[LEFT][1]
        = pack1.getSprite("simon_on_stairs_down_wipping_2");
    simonDownWhipping[LEFT][2]
        = pack1.getSprite("simon_on_stairs_down_wipping_3");
    simonDownWhipping[RIGHT][0] = simonDownWhipping[LEFT][0]
        .getFlippedCopy(true, false);
    simonDownWhipping[RIGHT][1] = simonDownWhipping[LEFT][1]
        .getFlippedCopy(true, false);
    simonDownWhipping[RIGHT][2] = simonDownWhipping[LEFT][2]
        .getFlippedCopy(true, false);
    simonHurt[LEFT] = pack1.getSprite("simon_hurt");
    simonHurt[RIGHT] = simonHurt[LEFT].getFlippedCopy(true, false);
    simonDead[LEFT] = pack1.getSprite("simon_dead");
    simonDead[RIGHT] = simonDead[LEFT].getFlippedCopy(true, false);    

    whips[LEFT][WHIP_LEATHER][0] = pack1.getSprite("whip_1_1");
    whips[LEFT][WHIP_LEATHER][1] = pack1.getSprite("whip_1_2");
    whips[LEFT][WHIP_LEATHER][2] = pack1.getSprite("whip_1_3");
    whips[LEFT][WHIP_SHORT_CHAIN][0] = pack1.getSprite("whip_2_1");
    whips[LEFT][WHIP_SHORT_CHAIN][1] = pack1.getSprite("whip_2_2");
    whips[LEFT][WHIP_SHORT_CHAIN][2] = pack1.getSprite("whip_2_3");
    whips[LEFT][WHIP_LONG_CHAIN][0] = whips[LEFT][WHIP_SHORT_CHAIN][0];
    whips[LEFT][WHIP_LONG_CHAIN][1] = whips[LEFT][WHIP_SHORT_CHAIN][1];
    whips[LEFT][WHIP_LONG_CHAIN][2] = pack1.getSprite("whip_3_3");

    whips[RIGHT][WHIP_LEATHER][0] = whips[LEFT][WHIP_LEATHER][0]
        .getFlippedCopy(true, false);
    whips[RIGHT][WHIP_LEATHER][1] = whips[LEFT][WHIP_LEATHER][1]
        .getFlippedCopy(true, false);
    whips[RIGHT][WHIP_LEATHER][2] = whips[LEFT][WHIP_LEATHER][2]
        .getFlippedCopy(true, false);
    whips[RIGHT][WHIP_SHORT_CHAIN][0] = whips[LEFT][WHIP_SHORT_CHAIN][0]
        .getFlippedCopy(true, false);
    whips[RIGHT][WHIP_SHORT_CHAIN][1] = whips[LEFT][WHIP_SHORT_CHAIN][1]
        .getFlippedCopy(true, false);
    whips[RIGHT][WHIP_SHORT_CHAIN][2] = whips[LEFT][WHIP_SHORT_CHAIN][2]
        .getFlippedCopy(true, false);
    whips[RIGHT][WHIP_LONG_CHAIN][0] = whips[RIGHT][WHIP_SHORT_CHAIN][0];
    whips[RIGHT][WHIP_LONG_CHAIN][1] = whips[RIGHT][WHIP_SHORT_CHAIN][1];
    whips[RIGHT][WHIP_LONG_CHAIN][2] = whips[LEFT][WHIP_LONG_CHAIN][2]
        .getFlippedCopy(true, false);

    dropItems[DropItem.TYPE_AXE] = pack1.getSprite("axe");
    dropItems[DropItem.TYPE_CHEST] = pack1.getSprite("chest");
    dropItems[DropItem.TYPE_BOOMERANG] = pack1.getSprite("cross");
    dropItems[DropItem.TYPE_CROWN] = pack1.getSprite("crown");
    dropItems[DropItem.TYPE_DAGGER] = pack1.getSprite("dagger");
    dropItems[DropItem.TYPE_DOUBLE] = pack1.getSprite("double");
    dropItems[DropItem.TYPE_HOLY_WATER] = pack1.getSprite("holy_water");
    dropItems[DropItem.TYPE_KILL_ALL] = pack1.getSprite("kill_all");
    dropItems[DropItem.TYPE_LARGE_HEART] = pack1.getSprite("large_heart");
    dropItems[DropItem.TYPE_MEAT] = pack1.getSprite("meat");
    dropItems[DropItem.TYPE_MONEY_BAG] = pack1.getSprite("money_bag");
    dropItems[DropItem.TYPE_1UP] = pack1.getSprite("one_up");    
    dropItems[DropItem.TYPE_POTION] = pack1.getSprite("potion");
    dropItems[DropItem.TYPE_STOP_WATCH] = pack1.getSprite("watch");
    dropItems[DropItem.TYPE_TRIPLE] = pack1.getSprite("triple");
    dropItems[DropItem.TYPE_WHIP] = pack1.getSprite("whip");

    daggers[RIGHT] = pack1.getSprite("dagger");
    daggers[LEFT] = daggers[RIGHT].getFlippedCopy(true, false);
    boomerang = pack1.getSprite("boomerang");
    axe = pack1.getSprite("axe");
    holyWaters[RIGHT] = pack1.getSprite("holy_water_2");
    holyWaters[LEFT] = holyWaters[RIGHT].getFlippedCopy(true, false);

    candles[0] = pack1.getSprite("candles_1");
    candles[1] = pack1.getSprite("candles_2");

    titleBats[0] = pack2.getSprite("title_bat_1");
    titleBats[1] = pack2.getSprite("title_bat_2");
    titleBats[2] = pack2.getSprite("title_bat_3");

    gateBats[0] = pack2.getSprite("gates_bat_1");
    gateBats[1] = pack2.getSprite("gates_bat_2");

    frankensteinBoss[LEFT][0] = pack2.getSprite("frankenstein_1");
    frankensteinBoss[LEFT][1] = pack2.getSprite("frankenstein_2");
    frankensteinBoss[LEFT][2] = pack2.getSprite("frankenstein_3");
    frankensteinBoss[RIGHT][0] = frankensteinBoss[LEFT][0]
        .getFlippedCopy(true, false);
    frankensteinBoss[RIGHT][1] = frankensteinBoss[LEFT][1]
        .getFlippedCopy(true, false);
    frankensteinBoss[RIGHT][2] = frankensteinBoss[LEFT][2]
        .getFlippedCopy(true, false);    

    title = new Image("images/title_screen.png", false, Image.FILTER_NEAREST)
        .getSubImage(0, 1, 512, 278);
    gates = new Image("images/castle_gates.png", false, Image.FILTER_NEAREST)
        .getSubImage(0, 1, 512, 350);
    clouds = pack2.getSprite("gates_clouds");

    ghosts[LEFT][0] = pack1.getSprite("flaming_head_1");
    ghosts[LEFT][1] = pack1.getSprite("flaming_head_2");
    ghosts[RIGHT][0] = ghosts[LEFT][0].getFlippedCopy(true, false);
    ghosts[RIGHT][1] = ghosts[LEFT][1].getFlippedCopy(true, false);

    birds[LEFT][0] = pack2.getSprite("big_bird_1");
    birds[LEFT][1] = pack2.getSprite("big_bird_2");
    birds[RIGHT][0] = birds[LEFT][0].getFlippedCopy(true, false);
    birds[RIGHT][1] = birds[LEFT][1].getFlippedCopy(true, false);

    axeKnights[LEFT][0] = pack1.getSprite("axe_man_1");
    axeKnights[LEFT][1] = pack1.getSprite("axe_man_2");
    axeKnights[RIGHT][0] = axeKnights[LEFT][0].getFlippedCopy(true, false);
    axeKnights[RIGHT][1] = axeKnights[LEFT][1].getFlippedCopy(true, false);

    boneDragons[0] = pack1.getSprite("dragon_head_1");
    boneDragons[1] = pack1.getSprite("dragon_head_2");
    boneDragons[2] = pack1.getSprite("dragon_neck");

    igors[LEFT][0] = pack1.getSprite("monkey_1");
    igors[LEFT][1] = pack1.getSprite("monkey_2");
    igors[RIGHT][0] = igors[LEFT][0].getFlippedCopy(true, false);
    igors[RIGHT][1] = igors[LEFT][1].getFlippedCopy(true, false);

    mummyBoss[LEFT][0] = pack2.getSprite("mummy_boss_1");
    mummyBoss[LEFT][1] = pack2.getSprite("mummy_boss_3");
    mummyBoss[LEFT][2] = pack2.getSprite("mummy_boss_2");
    mummyBoss[RIGHT][0] = mummyBoss[LEFT][0].getFlippedCopy(true, false);
    mummyBoss[RIGHT][1] = mummyBoss[LEFT][1].getFlippedCopy(true, false);
    mummyBoss[RIGHT][2] = mummyBoss[LEFT][2].getFlippedCopy(true, false);

    wrappings[LEFT][0] = pack1.getSprite("mummy_wrapping_1");
    wrappings[LEFT][1] = pack1.getSprite("mummy_wrapping_2");
    wrappings[RIGHT][0] = wrappings[LEFT][0].getFlippedCopy(true, false);
    wrappings[RIGHT][1] = wrappings[LEFT][1].getFlippedCopy(true, false);

    ravens[LEFT][0] = pack1.getSprite("crow_2");
    ravens[LEFT][1] = pack1.getSprite("crow_3");
    ravens[LEFT][2] = pack1.getSprite("crow_1");
    ravens[LEFT][3] = pack1.getSprite("crow_4");
    ravens[RIGHT][0] = ravens[LEFT][0].getFlippedCopy(true, false);
    ravens[RIGHT][1] = ravens[LEFT][1].getFlippedCopy(true, false);
    ravens[RIGHT][2] = ravens[LEFT][2].getFlippedCopy(true, false);
    ravens[RIGHT][3] = ravens[LEFT][3].getFlippedCopy(true, false);

    grimReaperBoss[LEFT] = pack2.getSprite("grim_reaper_boss");
    grimReaperBoss[RIGHT] = grimReaperBoss[LEFT].getFlippedCopy(true, false);

    skeletons[LEFT][0] = pack1.getSprite("skeleton_1");
    skeletons[LEFT][1] = pack1.getSprite("skeleton_2");
    skeletons[RIGHT][0] = skeletons[LEFT][0].getFlippedCopy(true, false);
    skeletons[RIGHT][1] = skeletons[LEFT][1].getFlippedCopy(true, false);

    crumble[0] = pack1.getSprite("crumble_1");
    crumble[1] = pack1.getSprite("crumble_2");

    itemPoints[FloatingPoints.TYPE_100] = pack1.getSprite("points_100");
    itemPoints[FloatingPoints.TYPE_400] = pack1.getSprite("points_400");
    itemPoints[FloatingPoints.TYPE_700] = pack1.getSprite("points_700");
    itemPoints[FloatingPoints.TYPE_1000] = pack1.getSprite("points_1000");
    itemPoints[FloatingPoints.TYPE_2000] = pack1.getSprite("points_2000");

    fires[0] = pack1.getSprite("fire_1");
    fires[1] = pack1.getSprite("fire_2");
    fires[2] = pack1.getSprite("fire_3");
    fires[3] = pack1.getSprite("fire_4");
    fires[4] = pack1.getSprite("fire_5");

    fireballs[LEFT] = pack1.getSprite("fire_ball");
    fireballs[RIGHT] = fireballs[LEFT].getFlippedCopy(true, false);

    medusaHeads[LEFT][0] = pack1.getSprite("flying_head_1");
    medusaHeads[LEFT][1] = pack1.getSprite("flying_head_2");
    medusaHeads[RIGHT][0] = medusaHeads[LEFT][0].getFlippedCopy(true, false);
    medusaHeads[RIGHT][1] = medusaHeads[LEFT][1].getFlippedCopy(true, false);

    draculaBoss[LEFT][0] = pack2.getSprite("dracula_head");
    draculaBoss[LEFT][1] = pack2.getSprite("dracula_1");
    draculaBoss[LEFT][2] = pack2.getSprite("dracula_2");
    draculaBoss[LEFT][3] = pack2.getSprite("final_boss_1");
    draculaBoss[LEFT][4] = pack2.getSprite("final_boss_2");
    draculaBoss[LEFT][5] = pack2.getSprite("final_boss_3");
    draculaBoss[LEFT][6] = pack2.getSprite("final_boss_4");
    draculaBoss[RIGHT][0] = draculaBoss[LEFT][0].getFlippedCopy(true, false);
    draculaBoss[RIGHT][1] = draculaBoss[LEFT][1].getFlippedCopy(true, false);
    draculaBoss[RIGHT][2] = draculaBoss[LEFT][2].getFlippedCopy(true, false);
    draculaBoss[RIGHT][3] = draculaBoss[LEFT][3].getFlippedCopy(true, false);
    draculaBoss[RIGHT][4] = draculaBoss[LEFT][4].getFlippedCopy(true, false);
    draculaBoss[RIGHT][5] = draculaBoss[LEFT][5].getFlippedCopy(true, false);
    draculaBoss[RIGHT][6] = draculaBoss[LEFT][6].getFlippedCopy(true, false);

    bonePillars[LEFT] = pack1.getSprite("two_skulls");
    bonePillars[RIGHT] = bonePillars[LEFT].getFlippedCopy(true, false);

    torch = pack1.getSprite("large_torch");
    droplets = pack1.getSprite("droplets");
    orb = pack1.getSprite("orb");
    platform = pack1.getSprite("platform");
    spark = pack1.getSprite("spark");
    smallHeart = symbols['^'];
    brickFragment = pack1.getSprite("brick_fragment");
    spikes = pack1.getSprite("spiked_platform");
    bone = pack1.getSprite("bone");
    sickle = pack1.getSprite("sickle");
    simonBack = pack2.getSprite("simon_back");

    doors[RIGHT][0] = pack2.getSprite("door_1");
    doors[LEFT][0] = doors[RIGHT][0].getFlippedCopy(true, false);
    doors[RIGHT][1] = pack2.getSprite("door_2");
    doors[LEFT][1] = doors[RIGHT][1].getFlippedCopy(true, false);
    doors[RIGHT][2] = pack2.getSprite("door_3");
    doors[LEFT][2] = doors[RIGHT][2].getFlippedCopy(true, false);

    medusaBoss[0] = pack2.getSprite("medusa_boss_1");
    medusaBoss[1] = pack2.getSprite("medusa_boss_2");

    snakes[RIGHT][0] = pack1.getSprite("snakes_1");
    snakes[RIGHT][1] = pack1.getSprite("snakes_2");
    snakes[LEFT][0] = snakes[RIGHT][0].getFlippedCopy(true, false);
    snakes[LEFT][1] = snakes[RIGHT][1].getFlippedCopy(true, false);

    zombies[LEFT][0] = pack1.getSprite("zombie_1");
    zombies[LEFT][1] = pack1.getSprite("zombie_2");
    zombies[RIGHT][0] = zombies[LEFT][0].getFlippedCopy(true, false);
    zombies[RIGHT][1] = zombies[LEFT][1].getFlippedCopy(true, false);

    mermen[LEFT][0] = pack1.getSprite("water_monster_1");
    mermen[LEFT][1] = pack1.getSprite("water_monster_2");
    mermen[LEFT][2] = pack1.getSprite("water_monster_3");
    mermen[RIGHT][0] = mermen[LEFT][0].getFlippedCopy(true, false);
    mermen[RIGHT][1] = mermen[LEFT][1].getFlippedCopy(true, false);
    mermen[RIGHT][2] = mermen[LEFT][2].getFlippedCopy(true, false);

    bats[LEFT][0] = pack1.getSprite("bat_1");
    bats[LEFT][1] = pack1.getSprite("bat_2");
    bats[LEFT][2] = pack1.getSprite("bat_3");
    bats[LEFT][3] = pack1.getSprite("bat_4");
    bats[RIGHT][0] = bats[LEFT][0].getFlippedCopy(true, false);
    bats[RIGHT][1] = bats[LEFT][1].getFlippedCopy(true, false);
    bats[RIGHT][2] = bats[LEFT][2].getFlippedCopy(true, false);
    bats[RIGHT][3] = bats[LEFT][3].getFlippedCopy(true, false);

    dogs[LEFT][0] = pack1.getSprite("dog_1");
    dogs[LEFT][1] = pack1.getSprite("dog_2");
    dogs[LEFT][2] = pack1.getSprite("dog_3");
    dogs[LEFT][3] = pack1.getSprite("dog_4");
    dogs[RIGHT][0] = dogs[LEFT][0].getFlippedCopy(true, false);
    dogs[RIGHT][1] = dogs[LEFT][1].getFlippedCopy(true, false);
    dogs[RIGHT][2] = dogs[LEFT][2].getFlippedCopy(true, false);
    dogs[RIGHT][3] = dogs[LEFT][3].getFlippedCopy(true, false);

    batBoss[0] = pack2.getSprite("bat_boss_1");
    batBoss[1] = pack2.getSprite("bat_boss_2");
    batBoss[2] = pack2.getSprite("bat_boss_3");

    lanceKnight[LEFT][0] = pack1.getSprite("knight_1");
    lanceKnight[LEFT][1] = pack1.getSprite("knight_2");
    lanceKnight[LEFT][2] = pack1.getSprite("knight_3");
    lanceKnight[RIGHT][0] = lanceKnight[LEFT][0].getFlippedCopy(true, false);
    lanceKnight[RIGHT][1] = lanceKnight[LEFT][1].getFlippedCopy(true, false);
    lanceKnight[RIGHT][2] = lanceKnight[LEFT][2].getFlippedCopy(true, false);

    castleMaps[0] = new Image("images/map_1.png", false, Image.FILTER_NEAREST)
        .getSubImage(1, 1, 384, 289);
    castleMaps[1] = new Image("images/map_2.png", false, Image.FILTER_NEAREST)
        .getSubImage(1, 1, 384, 289);

    castleBottom = pack2.getSprite("ending_castle_bottom");
    castleTop = pack2.getSprite("ending_castle_top");
    castleTrees = new Image("images/ending.png", false, Image.FILTER_NEAREST)
        .getSubImage(1, 1, 510, 174);

    simon = new Simon(this);

    loadedSegments = new StageSegment[6][0];

    loadedSegments[0] = new StageSegment[2];
    loadStageSegment(0, 0);
    loadStageSegment(0, 1);

    loadedSegments[1] = new StageSegment[4];
    loadStageSegment(1, 0);
    loadStageSegment(1, 1);
    loadStageSegment(1, 2);
    loadStageSegment(1, 3);

    loadedSegments[2] = new StageSegment[3];
    loadStageSegment(2, 0);
    loadStageSegment(2, 1);
    loadStageSegment(2, 2);

    loadedSegments[3] = new StageSegment[2];
    loadStageSegment(3, 0);
    loadStageSegment(3, 1);

    loadedSegments[4] = new StageSegment[4];
    loadStageSegment(4, 0);
    loadStageSegment(4, 1);
    loadStageSegment(4, 2);
    loadStageSegment(4, 3);

    loadedSegments[5] = new StageSegment[3];
    loadStageSegment(5, 0);
    loadStageSegment(5, 1);
    loadStageSegment(5, 2);

    gc.setIcon("images/icon.png");
    
    advance_whip = new Sound("soundfx/advance_whip.ogg");
    bat_killed = new Sound("soundfx/bat_killed.ogg");
    bleep = new Sound("soundfx/bleep.ogg");
    boss_hurt = new Sound("soundfx/boss_hurt.ogg");
    boss_killed_1 = new Sound("soundfx/boss_killed_1.ogg");
    boss_killed_2 = new Sound("soundfx/boss_killed_2.ogg");
    boss_killed_3 = new Sound("soundfx/boss_killed_3.ogg");
    breaks_wall = new Sound("soundfx/breaks_wall.ogg");
    crumble_sfx = new Sound("soundfx/crumble.ogg");
    dog_killed = new Sound("soundfx/dog_killed.ogg");
    door_opens_1 = new Sound("soundfx/door_opens_1.ogg");
    door_opens_2 = new Sound("soundfx/door_opens_2.ogg");
    gain_potion = new Sound("soundfx/gain_potion.ogg");
    got_money = new Sound("soundfx/got_money.ogg");
    heartbeat = new Sound("soundfx/heartbeat.ogg");
    hit_candle = new Sound("soundfx/hit_candle.ogg");
    killed_1 = new Sound("soundfx/killed_1.ogg");
    killed_2 = new Sound("soundfx/killed_2.ogg");
    killed_3 = new Sound("soundfx/killed_3.ogg");
    killed_4 = new Sound("soundfx/killed_4.ogg");
    killed_5 = new Sound("soundfx/killed_5.ogg");
    lose_potion = new Sound("soundfx/lose_potion.ogg");
    merman_spit = new Sound("soundfx/merman_spit.ogg");
    one_up = new Sound("soundfx/one_up.ogg");
    pressed_enter = new Sound("soundfx/pressed_enter.ogg");
    simon_hurt = new Sound("soundfx/simon_hurt.ogg");
    splash = new Sound("soundfx/splash.ogg");
    torch_breaks = new Sound("soundfx/torch_breaks.ogg");
    whip_1 = new Sound("soundfx/whip_1.ogg");
    whip_2 = new Sound("soundfx/whip_2.ogg");
    wing_flaps = new Sound("soundfx/wing_flaps.ogg");
    zombie_killed = new Sound("soundfx/zombie_killed.ogg");
    got_double = new Sound("soundfx/got_double.ogg");
    kill_all_sfx = new Sound("soundfx/kill_all_sfx.ogg");
    simon_in_pit = new Sound("soundfx/simon_in_pit.ogg");
    threw_dagger = new Sound("soundfx/threw_dagger.ogg");
    got_weapon = new Sound("soundfx/got_weapon.ogg");
    used_holy_water = new Sound("soundfx/used_holy_water.ogg");
    spinning = new Sound("soundfx/spinning.ogg");
    raven_killed = new Sound("soundfx/raven_killed.ogg");
    ching = new Sound("soundfx/ching.ogg");
    snuffed = new Sound("soundfx/snuffed.ogg");
    medusa_head_killed = new Sound("soundfx/medusa_head_killed.ogg");
    stunned = new Sound("soundfx/stunned.ogg");
    watch_tick = new Sound("soundfx/watch_tick.ogg");
    twang = new Sound("soundfx/twang.ogg");
    large_bat_killed = new Sound("soundfx/large_bat_killed.ogg");
    thunder = new Sound("soundfx/thunder.ogg");
    fire_ball_shot = new Sound("soundfx/fire_ball_shot.ogg");
    dracula_to_bats = new Sound("soundfx/dracula_to_bats.ogg");
    lands = new Sound("soundfx/lands.ogg");

    nextFrameTime = Sys.getTime();
  }

  private void showMouseCursor() {
    try {
      Mouse.setNativeCursor(nativeCursor);
    } catch (Exception e) {
			Log.error("Failed to load and apply cursor.", e);
		}
  }

  private void hideMouseCursor() {
    try {
			ByteBuffer buffer = BufferUtils.createByteBuffer(32 * 32 * 4);
			Cursor cursor = CursorLoader.get().getCursor(buffer, 0, 0, 32, 32);
      nativeCursor = Mouse.getNativeCursor();
			Mouse.setNativeCursor(cursor);
		} catch (Exception e) {
			Log.error("Failed to load and apply cursor.", e);
		}
  }

  public void update(GameContainer gc, int delta) throws SlickException {

    int count = 0;
    while(nextFrameTime < Sys.getTime()) {
      update(gc);
      nextFrameTime += Sys.getTimerResolution() / 91;
      if (++count == 8) {
        nextFrameTime = Sys.getTime();
        break;
      }
    }
  }

  private void update(GameContainer gc) throws SlickException {

    if (currentSong != requestedSong && mode == MODE_PLAYING) {
      if (currentSong != null) {
        currentSong.stop();
      }
      currentSong = requestedSong;
      currentSong.play();
    }
    if (currentSong != null) {
      currentSong.update();
    }

    if (input.isKeyPressed(Input.KEY_SPACE)) {
      if (gc.isFullscreen()) {
        showMouseCursor();
        if (appGameContainer == null) {
          appletGameContainer.getContainer().setFullscreen(false);
        } else {
          appGameContainer.setDisplayMode(640, 480, false);
          scalableGame.containerSizeChanged(gc);
        }
      } else {
        hideMouseCursor();
        if (appGameContainer == null) {
          appletGameContainer.getContainer().setDisplayMode(true);
        } else {
          appGameContainer.setDisplayMode(maxWidth, maxHeight, true);
          scalableGame.containerSizeChanged(gc);
        }
      }      
      nextFrameTime = Sys.getTime();
    } else if (gc.isFullscreen() && input.isKeyPressed(Input.KEY_ESCAPE)) {
      showMouseCursor();
      if (appGameContainer == null) {
        appletGameContainer.getContainer().setFullscreen(false);
      } else {
        appGameContainer.setDisplayMode(640, 480, false);
        scalableGame.containerSizeChanged(gc);
      }
      nextFrameTime = Sys.getTime();
    }

    if (fadeState == FADE_IN) {
      if (fade == 0) {
        fadeState = FADE_DONE;
      } else {
        fade--;
        return;
      }
    } else if (fadeState == FADE_OUT) {
      if (fade == 22) {
        switch(fadeReason) {
          case FADE_REASON_STAIRS:
            followStairsToNextSegment();
            break;
          case FADE_REASON_RESTORE_CHECKPOINT:
            mode = MODE_PLAYING;
            players--;
            createStage(stageIndex, false); 
            break;
          case FADE_REASON_SHOW_MAP:
            initMapScreen();
            break;
          case FADE_REASON_SHOW_CASTLE_FALLS:
            initCastleFalls();
            break;
          case FADE_REASON_SHOW_INTRO:
            initIntro();
            break;
          case FADE_REASON_SHOW_CONTINUE_SCREEN:
            initContinueScreen();
            break;
          case FADE_REASON_SHOW_TITLE_SCREEN:
            initTitleScreen();
            break;
          case FADE_REASON_SHOW_DEMO:
            initDemo();
            break;
          case FADE_REASON_SHOW_CREDITS:
            initCredits();
            break;
          case FADE_REASON_ADVANCE_CREDITS:
            advanceCredits();
            break;
        }
        fadeState = FADE_IN;
        return;
      } else {
        fade++;
        return;
      }
    }

    switch(mode) {
      case MODE_TITLE_SCREEN:
        updateTitleScreen(gc);
        return;
      case MODE_CONTINUE_SCREEN:
        updateContinueScreen(gc);
        return;
      case MODE_INTRO:
        updateIntro(gc);
        return;
      case MODE_MAP:
        updateMapScreen(gc);
        return;
      case MODE_CASTLE_FALLS:
        updateCastleFalls(gc);
        return;
      case MODE_CREDITS:
        updateCredits(gc);
        if (creditsPaused) {
          return;
        }
        break;
      case MODE_LOADING:
        updateLoading(gc);
        return;
    }

    if (beatStage) {
      if (beatStageDelay > 0) {
        beatStageDelay--;
      } else if (playerPower != 16) {
        playerPower++;
        beatStageDelay = 7;
        playSound(twang);
      } else if (time > 0) {
        time--;
        addPoints(10);
        if ((time % 5) == 0) {
          playSound(twang);
        }
        beatStageDelay = 1;
      } else if (hearts > 0) {
        hearts--;
        addPoints(100);
        beatStageDelay = 10;
        playSound(twang);
      } else {
        if (stageIndex == 2) {
          beatStage = false;
          floorBreaking = true;
          pushThing(new FloorBreaker(this));
        } else if (stageIndex == 5) {
          fadeState = FADE_OUT;
          fadeReason = FADE_REASON_SHOW_CASTLE_FALLS;
        } else {
          fadeState = FADE_OUT;
          fadeReason = FADE_REASON_SHOW_MAP;
        }
      }
      return;
    }

    if (simon.dead > 473) {
      fadeState = FADE_OUT;
      if (players == 0) {
        fadeReason = FADE_REASON_SHOW_CONTINUE_SCREEN;
      } else {
        fadeReason = FADE_REASON_RESTORE_CHECKPOINT;
      }
      return;
    }

    if (simon.flashing > 0) {
      simon.flashing--;
      flashSimon();
      return;
    }

    if (door != null) {
      door.update(gc);
      return;
    }

    if (timeFrozen == 0 && ++timeIncrementor == 91 && playerPower > 0
        && !floorBreaking) {
      timeIncrementor = 0;
      time--;
      if (time <= 0) {
        time = 0;
        hurtSimon(16);
      }
    }

    updateSimon(gc);
    moveCamera();

    if (fadeState == FADE_OUT) {
      return;
    }

    if (repeatsFlashing > 0) {
      repeatsFlashing--;
    }

    if (killAll) {
      killAll = false;
      Thing[] things = regionThingStack.things;
      for(int i = regionThingStack.top; i >= 0; i--) {
        things[i].kill = true;
      }
    }

    Thing thing = null;
    while((thing = regionThingStack.pop()) != null) {
      if (thing.update(gc)) {
        regionStackSwap.push(thing);        
      }
    }
    ThingStack tempThingStack = regionThingStack;
    regionThingStack = regionStackSwap;
    regionStackSwap = tempThingStack;

    while((thing = weaponsStack.pop()) != null) {
      if (thing.update(gc)) {
        weaponsStackSwap.push(thing);
      }
    }
    tempThingStack = weaponsStack;
    weaponsStack = weaponsStackSwap;
    weaponsStackSwap = tempThingStack;

    for(int i = platforms.length - 1; i >= 0; i--) {
      platforms[i].update(gc);
    }

    if (door != null) {
      oldThingStack.clear();
      oldThingStack.addAll(regionThingStack);

      door.state = Door.STATE_SCROLL_1;
      if (door.direction == RIGHT) {
        door.doorScroll1 = (int)door.x - 264;
        door.doorScroll2 = (int)door.x + 24;
      } else {
        door.doorScroll1 = (int)door.x - 256;
        door.doorScroll2 = (int)door.x - 521;
      }

      ThingStack thingStack 
          = stageSegment.regions[stageSegment.regionIndex].thingStack;
      thingStack.clear();
      thingStack.addAll(regionThingStack);

      if (door.direction == RIGHT) {
        stageSegment.regionIndex++;
      } else {
        stageSegment.regionIndex--;
      }
      Region region = stageSegment.regions[stageSegment.regionIndex];
      requestedSong = region.checkpoint.song;
      stage = region.stageNumber;
      simon.xMin = region.min;
      simon.xMax = region.max;
      regionThingStack.clear();
      regionThingStack.addAll(region.thingStack);
      weaponsStack.clear();
      timeFrozen = 0;
      killAll = false;
    }
  }

  private void updateSimon(GameContainer gc) throws SlickException {

    if (simon.invincible > 0) {

      if (simon.invincible > 705) {
        setSimonAlpha(0.25f + (simon.invincible - 705)
            * Main.INVINCIBLE_FRACTION);
      } else if (simon.drankPotion && simon.invincible == 23) {
        simon.drankPotion = false;
        playSound(lose_potion);
      } else if (simon.invincible < 23) {
        setSimonAlpha(0.25f + (23 - simon.invincible) * Main.INVINCIBLE_FRACTION);
      }

      simon.invincible--;
      if (simon.invincible == 0) {
        setSimonAlpha(1);
      }
    }

    boolean handledUp = false;
    boolean handledDown = false;

    simon.lastX = simon.x;
    simon.lastY = simon.y;

    if (simon.y > 416) {
      if (!floorBreaking) {
        if (playerPower > 0) {
          playSound(simon_in_pit);
          requestMusic(simon_killed);
        }
        playerPower = 0;
        simon.dead++;        
      }
      return;
    }

    if (simon.hurt) {
      simon.update(gc);
      return;
    }
    
    boolean keyDownD = input.isKeyDown(Input.KEY_D);
    boolean keyDownF = input.isKeyDown(Input.KEY_F);
    boolean keyDownUp = input.isKeyDown(Input.KEY_UP);
    boolean keyDownDown = input.isKeyDown(Input.KEY_DOWN);
    boolean keyDownLeft = input.isKeyDown(Input.KEY_LEFT);
    boolean keyDownRight = input.isKeyDown(Input.KEY_RIGHT);

    // -- RECORD KEY PRESSES HERE --------------------
    /*int keyDown = 0;
    keyDown |= keyDownD ? 1 : 0;
    keyDown <<= 1;
    keyDown |= keyDownF ? 1 : 0;
    keyDown <<= 1;
    keyDown |= keyDownUp ? 1 : 0;
    keyDown <<= 1;
    keyDown |= keyDownDown ? 1 : 0;
    keyDown <<= 1;
    keyDown |= keyDownLeft ? 1 : 0;
    keyDown <<= 1;
    keyDown |= keyDownRight ? 1 : 0;
    recording[recordingIndex] = (byte)keyDown;
    if (++recordingIndex == recording.length) {
      try {
        FileOutputStream out = new FileOutputStream("recording.dat");
        out.write(recording);
        out.close();
        System.exit(0);
      } catch(Throwable t) {
        t.printStackTrace();
      }
    }*/

    if (mode == MODE_DEMO || mode == MODE_CREDITS) {
      if (mode == MODE_DEMO) {
        if (recordingIndex == 2730 || input.isKeyPressed(Input.KEY_ENTER)) {
          fadeState = FADE_OUT;
          fadeReason = FADE_REASON_SHOW_TITLE_SCREEN;
          return;
        }
      } else {
        if (recordingIndex == 728 || creditsIndex == 12 || creditsPresents) {
          return;
        }
      }

      int keyDown = mode == MODE_DEMO 
          ? demoKeyRecordings[demoIndex][recordingIndex++]
          : endingKeyRecordings[creditsIndex][recordingIndex++];
      keyDownRight = (keyDown & 1) == 1;
      keyDown >>= 1;
      keyDownLeft = (keyDown & 1) == 1;
      keyDown >>= 1;
      keyDownDown = (keyDown & 1) == 1;
      keyDown >>= 1;
      keyDownUp = (keyDown & 1) == 1;
      keyDown >>= 1;
      keyDownF = (keyDown & 1) == 1;
      keyDown >>= 1;
      keyDownD = (keyDown & 1) == 1;
    }

    if (!keyDownD && !keyDownF) {
      simon.releasedWhip = true;
    }
    if (simon.whipping) {
      simon.whipIncrementor++;
      if (simon.whipIncrementor == 10) {
        simon.whipIndex = 1;
      } else if (simon.whipIncrementor == 20) {
        simon.whipIndex = 2;
        if (simon.throwing) {
          throwWeapon();
        }
      } else if (simon.whipIncrementor == 45) {
        simon.whipping = false;
        simon.throwing = false;
      }
    } else if (simon.releasedWhip) {
      if (keyDownD) {
        if (simon.whipType == 0) {
          playSound(whip_1);
        } else {
          playSound(whip_2);
        }
        simon.whipping = true;
        simon.whipIncrementor = 0;
        simon.whipIndex = 0;
        simon.releasedWhip = false;
      } else if (keyDownF
          && weaponType != WEAPON_TYPE_NONE
          && weaponsStack.top < weaponRepeats
          && ((weaponType != WEAPON_TYPE_STOP_WATCH && hearts > 0)
              || (weaponType == WEAPON_TYPE_STOP_WATCH && hearts > 4))) {
        simon.throwing = true;
        simon.whipping = true;
        simon.whipIncrementor = 0;
        simon.whipIndex = 0;
        simon.releasedWhip = false;
      }
    }

    if (simon.onStairs) {

      if (simon.y <= -62 || simon.y >= 285) {
        fadeState = FADE_OUT;
        fadeReason = FADE_REASON_STAIRS;
        return;
      }

      simon.releasedJump = false;
      simon.releasedKneel = false;
      if (!simon.whipping) {
        if (keyDownUp
            || (simon.rightStairs && keyDownRight)
            || (!simon.rightStairs && keyDownLeft)) {
          handledUp = true;
          int tile = getTile(((int)simon.x + 31), ((int)simon.y + 63));
          if (tile == BLOCK_STAIRS_RIGHT || tile == BLOCK_STAIRS_RIGHT_CAPPED) {
            simon.y--;
            simon.x++;
            simon.up = true;
            simon.direction = Main.RIGHT;
          } else if (tile == BLOCK_STAIRS_LEFT
              || tile == BLOCK_STAIRS_LEFT_CAPPED) {
            simon.y--;
            simon.x--;
            simon.up = true;
            simon.direction = Main.LEFT;
          } else {
            simon.onStairs = false;
            simon.walkSpriteIndex = 0;
          }
        } else if (keyDownDown
            || (!simon.rightStairs && keyDownRight)
            || (simon.rightStairs && keyDownLeft)) {
          handledDown = true;
          int tile = getTile(((int)simon.x + 31), ((int)simon.y + 63));
          if (tile == BLOCK_STAIRS_RIGHT || tile == BLOCK_STAIRS_RIGHT_CAPPED) {
            tile = getTile(((int)simon.x + 30), ((int)simon.y + 64));
            if (tile != BLOCK_STAIRS_RIGHT && tile != BLOCK_STAIRS_RIGHT_CAPPED) {
              simon.onStairs = false;
              simon.walkSpriteIndex = 0;
            } else {
              simon.y++;
              simon.x--;
              simon.up = false;
              simon.direction = Main.LEFT;
            }
          } else if (tile == BLOCK_STAIRS_LEFT
              || tile == BLOCK_STAIRS_LEFT_CAPPED) {
            tile = getTile(((int)simon.x + 32), ((int)simon.y + 64));
            if (tile != BLOCK_STAIRS_LEFT && tile != BLOCK_STAIRS_LEFT_CAPPED) {
              simon.onStairs = false;
              simon.walkSpriteIndex = 0;
            } else {
              simon.y++;
              simon.x++;
              simon.up = false;
              simon.direction = Main.RIGHT;
            }
          } else {
            simon.onStairs = false;
            simon.walkSpriteIndex = 0;
          }
        }
      }
    }

    if (simon.supported && !simon.onStairs && keyDownUp
        && !simon.whipping) {
      int tile = getTile(((int)simon.x + 31), ((int)simon.y + 63));

      if (tile == BLOCK_STAIRS_RIGHT) {
        simon.walkLeft();
        handledUp = true;
      }
      tile = getTile(((int)simon.x + 63), ((int)simon.y + 63));
      if (tile == BLOCK_STAIRS_RIGHT) {
        simon.walkRight();
        handledUp = true;
        if (Math.abs(((((int)simon.x + 31) >> 5) << 5) - (simon.x + 31)) <= 2) {
          simon.onStairs = true;
          simon.kneeling = false;
          simon.rightStairs = true;
          simon.y--;
          simon.up = true;
          simon.x = ((((int)simon.x + 31) >> 5) << 5) - 30;
        }
      }

      tile = getTile(((int)simon.x + 31), ((int)simon.y + 63));
      if (tile == BLOCK_STAIRS_LEFT) {
        simon.walkRight();
        handledUp = true;
      }
      tile = getTile(((int)simon.x + 1), ((int)simon.y + 63));
      if (tile == BLOCK_STAIRS_LEFT) {
        if (Math.abs(((((int)simon.x + 1) >> 5) << 5) - simon.x) <= 2) {
          simon.onStairs = true;
          simon.kneeling = false;
          simon.rightStairs = false;
          simon.y--;
          simon.up = true;
          simon.x = ((((int)simon.x + 1) >> 5) << 5) - 1;
        } else {
          simon.walkLeft();
        }
        handledUp = true;
      }
    }

    if (simon.supported && !simon.onStairs && keyDownDown
        && !simon.whipping) {

      int tile = getTile(((int)simon.x + 33), ((int)simon.y + 64));
      if (tile == BLOCK_STAIRS_RIGHT || tile == BLOCK_STAIRS_RIGHT_CAPPED) {
        simon.walkRight();
        handledDown = true;
      }
      tile = getTile(((int)simon.x + 1), ((int)simon.y + 64));
      if (tile == BLOCK_STAIRS_RIGHT || tile == BLOCK_STAIRS_RIGHT_CAPPED) {
        if (Math.abs(((((int)simon.x + 33) >> 5) << 5) - (simon.x + 31)) <= 2) {
          simon.onStairs = true;
          simon.kneeling = false;
          simon.rightStairs = true;
          handledDown = true;
          simon.y++;
          simon.up = false;
          simon.x = ((((int)simon.x + 33) >> 5) << 5) - 32;
        } else {
          simon.walkLeft();
        }
        handledDown = true;
      }

      tile = getTile(((int)simon.x + 63), ((int)simon.y + 64));
      if (tile == BLOCK_STAIRS_LEFT || tile == BLOCK_STAIRS_LEFT_CAPPED) {
        simon.walkRight();
        handledDown = true;
      }

      tile = getTile(((int)simon.x + 31), ((int)simon.y + 64));
      if (tile == BLOCK_STAIRS_LEFT || tile == BLOCK_STAIRS_LEFT_CAPPED) {
        if (Math.abs((((((int)simon.x + 31) >> 5) - 1) << 5) - simon.x) <= 2) {
          simon.onStairs = true;
          simon.kneeling = false;
          simon.rightStairs = false;
          handledDown = true;
          simon.y++;
          simon.up = false;
          simon.x = (((((int)simon.x + 31) >> 5) - 1) << 5) + 1;
        } else {
          simon.walkLeft();
        }
        handledDown = true;
      }
    }

    if (!simon.onStairs) {
      if (!handledUp && !handledDown &&
          !(simon.whipping && simon.supported)) {
        if (keyDownDown) {
          if (simon.releasedKneel) {
            simon.kneel();
            simon.releasedKneel = false;
            if (keyDownLeft) {
              simon.direction = Main.LEFT;
            }
            if (keyDownRight) {
              simon.direction = Main.RIGHT;
            }
          }
        } else {
          simon.releasedKneel = true;
          boolean walking = false;
          if (keyDownLeft) {
            simon.walkLeft();
            walking = true;
          }
          if (keyDownRight) {
            simon.walkRight();
            walking = true;
          }
          if (!walking) {
            simon.stand();
          }
          if (keyDownUp) {
            if (simon.releasedJump && simon.supported) {
              simon.vy = SIMON_JUMP_VELOCITY;
            }
            simon.releasedJump = false;
          } else {
            simon.releasedJump = true;
          }
        }
      }

      simon.update(gc);
    }
  }

  public void moveCamera() {
    camera = (int)(simon.x - 224);
    if (camera > simon.xMax - 512) {
      camera = simon.xMax - 512;
    } else if (camera < simon.xMin) {
      camera = simon.xMin;
    }
    if (camera < 0) {
      camera = 0;
    }
  }

  public void followStairsToNextSegment() {

    visibleWhipCount = 0;

    ThingStack thingStack
        = stageSegment.regions[stageSegment.regionIndex].thingStack;
    thingStack.clear();
    thingStack.addAll(regionThingStack);

    int distance = Integer.MAX_VALUE;
    StairsEntry entry = null;
    for(int i = 0; i < stageSegment.stairsEntries.length; i++) {
      StairsEntry stairsEntry = stageSegment.stairsEntries[i];
      int dist = (int)Math.abs(simon.x - stairsEntry.x);
      if (dist < distance) {
        distance = dist;
        entry = stairsEntry;
      }
    }

    StairsEntry connection = entry.connection;
    stageSegment = connection.segment;
    map = connection.segment.map;
    walls = connection.segment.walls;    
    weaponsStack.clear();
    timeFrozen = 0;
    killAll = false;
    mapWidth = connection.segment.mapWidth;

    Region region = connection.segment.regions[connection.segment.regionIndex];
    stage = region.stageNumber;
    platforms = region.platforms;
    regionThingStack.clear();
    regionThingStack.addAll(region.thingStack);
    simon.xMin = region.min;
    simon.xMax = region.max;

    simon.onStairs = true;
    simon.direction = connection.direction;
    simon.x = connection.x;
    simon.y = connection.y;
    simon.up = connection.up;

    simon.kneeling = false;
    simon.whipping = false;
    simon.whipIncrementor = 0;
    simon.whipIndex = 0;
    simon.walkSpriteIndex = 0;
    simon.walkSpriteIndexIncrementor = 0;
    simon.invincible = 0;
    simon.flashing = 0;
    simon.intersected = false;
    simon.lastX = simon.x;
    simon.lastY = simon.y;
    simon.releasedJump = true;
    simon.releasedKneel = true;
    simon.releasedWhip = true;
    simon.throwing = false;
    simon.vx = 0;
    simon.vy = 0;

    setSimonAlpha(1);

    moveCamera();
  }

  public void throwWeapon() {

    float x = simon.x + 16;
    float y = simon.kneeling ? simon.y + 16 : simon.y;

    switch(weaponType) {
      case WEAPON_TYPE_AXE:
        pushWeapon(new Axe(this, x, y, simon.direction));
        removeHearts(1);
        break;
      case WEAPON_TYPE_BOOMERANG:
        pushWeapon(new Boomerang(this, x + 1, y + 1, simon.direction));
        removeHearts(1);
        break;
      case WEAPON_TYPE_DAGGER:
        pushWeapon(new Dagger(this, x, y, simon.direction));
        removeHearts(1);
        break;
      case WEAPON_TYPE_HOLY_WATER:
        pushWeapon(new HolyWater(this, x, y, simon.direction));
        removeHearts(1);
        break;
      case WEAPON_TYPE_STOP_WATCH:
        pushWeapon(new StopWatch(this));
        removeHearts(5);
        break;
    }
  }

  public void removeHearts(int hearts) {
    this.hearts -= hearts;
    if (this.hearts < 0) {
      this.hearts = 0;
    }
  }

  private void createStage(int stageIndex, boolean setCheckpoint) {

    this.stageIndex = stageIndex;

    stageSegments = loadedSegments[stageIndex];
    for(int i = 0; i < stageSegments.length; i++) {
      convertStage(stageIndex, stageSegments[i]);
    }

    switch(stageIndex) {
      case 0:
        time = 300;

        linkStageSegments(0, 0, 1, 0);
        linkStageSegments(0, 1, 1, 1);

        stageSegments[0].regions[0].checkpoint.song = stage_1_1;
        stageSegments[0].regions[1].checkpoint.song = stage_1_2;
        stageSegments[0].regions[2].checkpoint.song = stage_1_2;
        stageSegments[0].regions[3].checkpoint.song = stage_1_2;

        if (setCheckpoint) {
          checkpoint = stageSegments[0].regions[0].checkpoint;
        }
        break;

      case 1:
        time = 400;

        linkStageSegments(0, 0, 1, 1);
        linkStageSegments(1, 0, 2, 1);
        linkStageSegments(3, 0, 2, 0);

        stageSegments[0].regions[0].checkpoint.song = stage_2_1;
        stageSegments[1].regions[0].checkpoint.song = stage_2_1;
        stageSegments[2].regions[0].checkpoint.song = stage_2_1;

        if (setCheckpoint) {
          checkpoint = stageSegments[0].regions[0].checkpoint;
        }
        break;

      case 2:
        time = 500;

        stageSegments[0].direction = LEFT;
        linkStageSegments(0, 0, 1, 0);
        linkStageSegments(1, 1, 2, 0);

        stageSegments[0].regions[0].checkpoint.song = stage_3_1;
        stageSegments[1].regions[1].checkpoint.song = stage_3_1;
        stageSegments[2].regions[1].checkpoint.song = stage_3_1;

        if (setCheckpoint) {
          checkpoint = stageSegments[0].regions[0].checkpoint;
        }
        break;

      case 3:
        time = 400;

        linkStageSegments(0, 0, 1, 0);
        stageSegments[0].regions[0].checkpoint.y = -96;

        stageSegments[0].regions[0].checkpoint.song = stage_4_1;
        stageSegments[1].regions[0].checkpoint.song = stage_4_2;
        stageSegments[1].regions[1].checkpoint.song = stage_4_2;

        if (setCheckpoint) {
          checkpoint = stageSegments[0].regions[0].checkpoint;
        }
        break;

      case 4:
        time = 500;

        linkStageSegments(0, 0, 1, 0);
        linkStageSegments(1, 1, 2, 1);
        linkStageSegments(2, 0, 3, 0);

        stageSegments[0].regions[0].checkpoint.song = stage_5_1;
        stageSegments[1].regions[1].checkpoint.song = stage_5_1;
        stageSegments[2].regions[0].checkpoint.song = stage_5_1;

        if (setCheckpoint) {
          checkpoint = stageSegments[0].regions[0].checkpoint;
        }
        break;

      case 5:
        time = 700;

        linkStageSegments(1, 0, 2, 0);
        linkStageSegments(1, 1, 0, 0);
        linkStageSegments(1, 2, 0, 1);
        linkStageSegments(1, 3, 0, 2);

        stageSegments[0].regions[0].checkpoint.song = stage_6_1;
        stageSegments[0].regions[1].checkpoint.song = stage_6_1;
        stageSegments[1].regions[0].checkpoint.song = stage_6_2;

        if (setCheckpoint) {
          checkpoint = stageSegments[0].regions[1].checkpoint;
        }
        break;
    }

    restoreCheckpoint();

    nextFrameTime = Sys.getTime();
  }

  private void convertStage(int stageIndex, StageSegment segment) {

    ArrayList<StairsEntry> stairsEntries = new ArrayList<StairsEntry>();

    int width = segment.mapWidth = segment.stage[0].length;

    ArrayList<Thing> platformList = new ArrayList<Thing>();

    ArrayList<Region> regions = new ArrayList<Region>();
    int regionCount = 0;
    Region region = new Region();
    region.stageNumber 
        = stageNumbers[stageIndex][segment.stageSegmentIndex][regionCount++];
    region.max = width << 5;
    regions.add(region);

    segment.map = new int[11][width + 1];
    segment.walls = new int[11][width + 1];

    int zombieSpawnerX = -1;
    int batSpawnerX = -1;
    int birdSpawnerX = -1;
    int medusaHeadSpawnerX = -1;
    int mermanSpawnerX = -1;
    int platformX = -1;
    int spikesIndex = 0;

    int regionIndex = 0;
    int candleIndex = 0;        
    for(int j = 0; j < width; j++) {
      for(int i = 0; i < 11; i++) {
        char[] row = segment.stage[i];
        int x = j << 5;
        int y = i << 5;
        switch(row[j]) {
          case TILE_WALL:
            segment.walls[i][j] = WALL_FULL;
            replaceWithBlock(segment.map, segment.stage, j, i, width);
            break;
          case TILE_PLATFORM:
            segment.walls[i][j] = WALL_PLATFORM;
            replaceWithBlock(segment.map, segment.stage, j, i, width);
            break;
          case TILE_HIDDEN_PLATFORM:
            segment.walls[i][j] = WALL_PLATFORM;
            segment.map[i][j] = BLOCK_EMPTY;
            break;
          case TILE_DOOR: {
            segment.walls[i][j] = WALL_PLATFORM;
            segment.map[i][j] = BLOCK_EMPTY;

            if (segment.direction == RIGHT) {
              region.max = x + 32;
              if (j == width - 1) {
                region.thingStack.push(new Door(this, x + 8, y, RIGHT, false));
                segment.walls[i + 1][j] = WALL_PLATFORM;
                segment.map[i + 1][j] = BLOCK_EMPTY;
                segment.walls[i + 2][j] = WALL_PLATFORM;
                segment.map[i + 2][j] = BLOCK_EMPTY;
              } else {
                region.thingStack.push(new Door(this, x + 8, y, RIGHT, true));
              }

              region.platforms = new Thing[platformList.size()];
              platformList.toArray(region.platforms);

              region = new Region();
              region.stageNumber
                  = stageNumbers[stageIndex][segment.stageSegmentIndex]
                      [regionCount++];
              region.min = x + 32;
              region.max = width << 5;
              regions.add(region);
              regionIndex++;
            } else {
              if (j == 0) {
                region.thingStack.push(new Door(this, x + 8, y, LEFT, false));
                segment.walls[i + 1][j] = WALL_PLATFORM;
                segment.map[i + 1][j] = BLOCK_EMPTY;
                segment.walls[i + 2][j] = WALL_PLATFORM;
                segment.map[i + 2][j] = BLOCK_EMPTY;
              } else {

                region.max = x - 1;
                region.platforms = new Thing[platformList.size()];
                platformList.toArray(region.platforms);

                region = new Region();
                region.stageNumber
                    = stageNumbers[stageIndex][segment.stageSegmentIndex]
                        [regionCount++];
                region.min = x - 1;
                region.max = width << 5;
                regions.add(region);
                regionIndex++;   

                region.thingStack.push(new Door(this, x + 8, y, LEFT, true));
              }
            }
            break;
          }
          case TILE_STAIRS_LEFT:
            segment.walls[i][j] = WALL_EMPTY;
            segment.map[i][j] = BLOCK_STAIRS_LEFT;
            if (i == 0) {
              StairsEntry stairsEntry = new StairsEntry();
              stairsEntries.add(stairsEntry);
              stairsEntry.segment = segment;
              stairsEntry.direction = Main.RIGHT;
              stairsEntry.up = false;
              stairsEntry.x = x + 32;
              stairsEntry.y = 0;
            } else if (i == 10) {
              StairsEntry stairsEntry = new StairsEntry();
              stairsEntries.add(stairsEntry);
              stairsEntry.segment = segment;
              stairsEntry.direction = Main.LEFT;
              stairsEntry.up = true;
              stairsEntry.x = x - 7;
              stairsEntry.y = y - 39;
            }
            break;
          case TILE_STAIRS_RIGHT:
            segment.walls[i][j] = WALL_EMPTY;
            segment.map[i][j] = BLOCK_STAIRS_RIGHT;
            if (i == 0) {
              StairsEntry stairsEntry = new StairsEntry();
              stairsEntries.add(stairsEntry);
              stairsEntry.segment = segment;
              stairsEntry.direction = Main.LEFT;
              stairsEntry.up = false;
              stairsEntry.x = x - 63;
              stairsEntry.y = 0;
            } else if (i == 10) {
              StairsEntry stairsEntry = new StairsEntry();
              stairsEntries.add(stairsEntry);
              stairsEntry.segment = segment;
              stairsEntry.direction = Main.RIGHT;
              stairsEntry.up = true;
              stairsEntry.x = x - 24;
              stairsEntry.y = y - 39;
            }
            break;
          case TILE_STAIRS_LEFT_CAPPED:
            segment.walls[i][j] = WALL_PLATFORM;
            segment.map[i][j] = BLOCK_STAIRS_LEFT_CAPPED;
            if (i == 0) {
              StairsEntry stairsEntry = new StairsEntry();
              stairsEntries.add(stairsEntry);
              stairsEntry.segment = segment;
              stairsEntry.direction = Main.RIGHT;
              stairsEntry.up = false;
              stairsEntry.x = x + 32;
              stairsEntry.y = 0;
            } else if (i == 10) {
              StairsEntry stairsEntry = new StairsEntry();
              stairsEntries.add(stairsEntry);
              stairsEntry.segment = segment;
              stairsEntry.direction = Main.LEFT;
              stairsEntry.up = true;
              stairsEntry.x = x - 7;
              stairsEntry.y = y - 39;
            }
            break;
          case TILE_STAIRS_RIGHT_CAPPED:
            segment.walls[i][j] = WALL_PLATFORM;
            segment.map[i][j] = BLOCK_STAIRS_RIGHT_CAPPED;
            if (i == 0) {
              StairsEntry stairsEntry = new StairsEntry();
              stairsEntries.add(stairsEntry);
              stairsEntry.segment = segment;
              stairsEntry.direction = Main.LEFT;
              stairsEntry.up = false;
              stairsEntry.x = x - 63;
              stairsEntry.y = 0;
            } else if (i == 10) {
              StairsEntry stairsEntry = new StairsEntry();
              stairsEntries.add(stairsEntry);
              stairsEntry.segment = segment;
              stairsEntry.direction = Main.RIGHT;
              stairsEntry.up = true;
              stairsEntry.x = x - 24;
              stairsEntry.y = y - 39;
            }
            break;
          case TILE_CANDLES:
            segment.walls[i][j] = WALL_EMPTY;
            segment.map[i][j] = BLOCK_EMPTY;
            region.thingStack.push(new Candles(this, x + 8, y + 8,
                segment.candleItems.charAt(candleIndex++)));
            break;
          case TILE_TORCH:
            segment.walls[i][j] = WALL_EMPTY;
            segment.map[i][j] = BLOCK_EMPTY;
            region.thingStack.push(
                new Torch(this, x, y, 
                    segment.candleItems.charAt(candleIndex++)));
            break;
          case TILE_BREAK_WALL:
            segment.walls[i][j] = WALL_PLATFORM;
            replaceWithBlock(segment.map, segment.stage, j, i, width);
            region.thingStack.push(
                new BreakWall(this, j, i, 
                    segment.candleItems.charAt(candleIndex++)));
            break;
          case TILE_ZOMBIE_SPAWNER:
            segment.walls[i][j] = WALL_EMPTY;
            segment.map[i][j] = BLOCK_EMPTY;
            if (zombieSpawnerX == -1) {
              zombieSpawnerX = x;
            } else {
              region.thingStack.push(
                  new ZombieSpawner(this, zombieSpawnerX, x, y));
              zombieSpawnerX = -1;
            }
            break;
          case TILE_MERMAN_SPAWNER:
            segment.walls[i][j] = WALL_EMPTY;
            segment.map[i][j] = BLOCK_EMPTY;
            if (mermanSpawnerX == -1) {
              mermanSpawnerX = x;
            } else {
              region.thingStack.push(
                  new MermanSpawner(this, mermanSpawnerX, x, y));
              mermanSpawnerX = -1;
            }
            break;
          case TILE_BAT_SPAWNER:
            segment.walls[i][j] = WALL_EMPTY;
            segment.map[i][j] = BLOCK_EMPTY;
            if (batSpawnerX == -1) {
              batSpawnerX = x;
            } else {
              region.thingStack.push(new BatSpawner(this, batSpawnerX, x));
              batSpawnerX = -1;
            }
            break;
          case TILE_BIRD_SPAWNER:
            segment.walls[i][j] = WALL_EMPTY;
            segment.map[i][j] = BLOCK_EMPTY;
            if (birdSpawnerX == -1) {
              birdSpawnerX = x;
            } else {
              region.thingStack.push(new BirdSpawner(this, birdSpawnerX, x));
              birdSpawnerX = -1;
            }
            break;
          case TILE_MEDUSA_HEAD_SPAWNER:
            segment.walls[i][j] = WALL_EMPTY;
            segment.map[i][j] = BLOCK_EMPTY;
            if (medusaHeadSpawnerX == -1) {
              medusaHeadSpawnerX = x;
            } else {
              region.thingStack.push(
                  new MedusaHeadSpawner(this, medusaHeadSpawnerX, x));
              medusaHeadSpawnerX = -1;
            }
            break;
          case TILE_MOVING_PLATFORM:
            segment.walls[i][j] = WALL_EMPTY;
            segment.map[i][j] = BLOCK_EMPTY;
            if (platformX == -1) {
              platformX = x;
            } else {
              platformList.add(new MovingPlatform(this, platformX, x, y));
              platformX = -1;
            }
            break;
          case TILE_MOVING_PLATFORM_2:
            segment.walls[i][j] = WALL_EMPTY;
            segment.map[i][j] = BLOCK_EMPTY;
            if (platformX == -1) {
              platformX = x;
            } else {
              platformList.add(new MovingPlatform(this, platformX, x, y + 16));
              platformX = -1;
            }
            break;
          case TILE_DOG:
            segment.walls[i][j] = WALL_EMPTY;
            segment.map[i][j] = BLOCK_EMPTY;
            region.thingStack.push(new Dog(this, x, y));
            break;
          case TILE_IGOR:
            segment.walls[i][j] = WALL_EMPTY;
            segment.map[i][j] = BLOCK_EMPTY;
            region.thingStack.push(new Igor(this, x, y));
            break;
          case TILE_WHITE_SKELETON:
            segment.walls[i][j] = WALL_EMPTY;
            segment.map[i][j] = BLOCK_EMPTY;
            region.thingStack.push(new WhiteSkeleton(this, x, y));
            break;
          case TILE_RED_SKELETON:
            segment.walls[i][j] = WALL_EMPTY;
            segment.map[i][j] = BLOCK_EMPTY;
            region.thingStack.push(new RedSkeleton(this, x, y));
            break;
          case TILE_BONE_DRAGON:
            segment.walls[i][j] = WALL_EMPTY;
            segment.map[i][j] = BLOCK_EMPTY;
            region.thingStack.push(new BoneDragon(this, x, y,
                segment.candleItems.charAt(candleIndex++), false));
            break;
          case TILE_BONE_DRAGON_2:
            segment.walls[i][j] = WALL_EMPTY;
            segment.map[i][j] = BLOCK_EMPTY;
            region.thingStack.push(new BoneDragon(this, x, y,
                segment.candleItems.charAt(candleIndex++), true));
            break;
          case TILE_RAVEN:
            segment.walls[i][j] = WALL_EMPTY;
            segment.map[i][j] = BLOCK_EMPTY;
            region.thingStack.push(new Raven(this, x, y));
            break;
          case TILE_GHOST:
            segment.walls[i][j] = WALL_EMPTY;
            segment.map[i][j] = BLOCK_EMPTY;
            region.thingStack.push(new Ghost(this, x, y));
            break;
          case TILE_SPIKES:
            segment.walls[i][j] = WALL_EMPTY;
            segment.map[i][j] = BLOCK_EMPTY;
            region.thingStack.push(new Spikes(this, x, y, spikesIndex++));
            break;
          case TILE_BONE_PILLAR:
            segment.walls[i][j] = WALL_EMPTY;
            segment.map[i][j] = BLOCK_EMPTY;
            region.thingStack.push(new BonePillar(this, x, y));
            break;
          case TILE_CHECK_POINT:
            segment.walls[i][j] = WALL_EMPTY;
            segment.map[i][j] = BLOCK_EMPTY;
            region.checkpoint = new Checkpoint(this, x, y,
                segment.stageSegmentIndex, regionIndex);
            region.thingStack.push(region.checkpoint);
            break;
          case TILE_BAT_BOSS:
            segment.walls[i][j] = WALL_EMPTY;
            segment.map[i][j] = BLOCK_EMPTY;
            region.thingStack.push(new BatBoss(this, x, y));
            break;
          case TILE_GRIM_REAPER_BOSS:
            segment.walls[i][j] = WALL_EMPTY;
            segment.map[i][j] = BLOCK_EMPTY;
            region.thingStack.push(new GrimReaper(this, x, y));
            break;
          case TILE_BRIDGE_BAT:
            segment.walls[i][j] = WALL_EMPTY;
            segment.map[i][j] = BLOCK_EMPTY;
            region.thingStack.push(new BridgeBat(this, x, y));
            break;
          case TILE_FRANKENSTEIN:
            segment.walls[i][j] = WALL_EMPTY;
            segment.map[i][j] = BLOCK_EMPTY;
            region.thingStack.push(new Frankenstein(this, x, y));
            break;
          case TILE_SECRET:
            segment.walls[i][j] = WALL_EMPTY;
            segment.map[i][j] = BLOCK_EMPTY;
            region.thingStack.push(new Secret(this, x, y));
            break;
          case TILE_MEDUSA_BOSS:
            segment.walls[i][j] = WALL_EMPTY;
            segment.map[i][j] = BLOCK_EMPTY;
            region.thingStack.push(new MedusaBoss(this, x, y));
            break;
          case TILE_DRACULA_BOSS:
            segment.walls[i][j] = WALL_EMPTY;
            segment.map[i][j] = BLOCK_EMPTY;
            region.thingStack.push(new Dracula(this, x, y));
            break;
          case TILE_LANCE_KNIGHT:
            segment.walls[i][j] = WALL_EMPTY;
            segment.map[i][j] = BLOCK_EMPTY;
            region.thingStack.push(new LanceKnight(this, x, y));
            break;
          case TILE_AXE_KNIGHT:
            segment.walls[i][j] = WALL_EMPTY;
            segment.map[i][j] = BLOCK_EMPTY;
            region.thingStack.push(new AxeKnight(this, x, y));   
            break;
          case TILE_SWOOPING_BAT:
            segment.walls[i][j] = WALL_EMPTY;
            segment.map[i][j] = BLOCK_EMPTY;
            region.thingStack.push(new SwoopingBat(this, x, y));
            break;
          case TILE_MUMMY_BOSS:
            segment.walls[i][j] = WALL_EMPTY;
            segment.map[i][j] = BLOCK_EMPTY;
            region.thingStack.push(
                new MummyBoss(this, x, y - 16, Main.RIGHT));
            region.thingStack.push(
                new MummyBoss(this, x + 352, y - 16, Main.LEFT));
            break;
          case TILE_FADING_STAIRS:
            segment.walls[i][j] = WALL_EMPTY;
            segment.map[i][j] = BLOCK_EMPTY;
            region.thingStack.push(new FadingStairs(this, x, y, segment));
            break;
          default:
            segment.walls[i][j] = WALL_EMPTY;
            segment.map[i][j] = BLOCK_EMPTY;
            break;
        }
      }

      region.platforms = new Thing[platformList.size()];
      platformList.toArray(region.platforms);
    }

    segment.regions = new Region[regions.size()];
    regions.toArray(segment.regions);

    segment.stairsEntries = new StairsEntry[stairsEntries.size()];
    stairsEntries.toArray(segment.stairsEntries);

    if (segment.direction == Main.RIGHT) {
      segment.regionIndex = 0;
    } else {
      segment.regionIndex = regions.size() - 1;
    }
  }

  public Thing createCandleItem(int x, int y, char item) {

    switch(weaponType) {
      case WEAPON_TYPE_AXE:
        if (item == CANDLE_ITEM_AXE) {
          item = CANDLE_ITEM_DOUBLE;
        }
        break;
      case WEAPON_TYPE_BOOMERANG:
        if (item == CANDLE_ITEM_BOOMERANG) {
          item = CANDLE_ITEM_DOUBLE;
        }
        break;
      case WEAPON_TYPE_DAGGER:
        if (item == CANDLE_ITEM_DAGGER) {
          item = CANDLE_ITEM_DOUBLE;
        }
        break;
      case WEAPON_TYPE_HOLY_WATER:
        if (item == CANDLE_ITEM_HOLY_WATER) {
          item = CANDLE_ITEM_DOUBLE;
        }
        break;
      case WEAPON_TYPE_STOP_WATCH:
        if (item == CANDLE_ITEM_STOP_WATCH) {
          item = CANDLE_ITEM_DOUBLE;
        }
        break;
    }

    switch(item) {
      case CANDLE_ITEM_AXE:
        return new DropItem(this, x, y, DropItem.TYPE_AXE);
      case CANDLE_ITEM_BOOMERANG:
        return new DropItem(this, x, y, DropItem.TYPE_BOOMERANG);
      case CANDLE_ITEM_CHEST:
        return new DropItem(this, x, y, DropItem.TYPE_CHEST);
      case CANDLE_ITEM_CROWN:
        return new DropItem(this, x, y, DropItem.TYPE_CROWN);
      case CANDLE_ITEM_DAGGER:
        return new DropItem(this, x, y, DropItem.TYPE_DAGGER);
      case CANDLE_ITEM_DOUBLE:
      case CANDLE_ITEM_TRIPLE:
        if (weaponType == WEAPON_TYPE_NONE
            || weaponRepeats == WEAPON_REPEATS_TRIPLE) {
          return new DropItem(this, x, y, DropItem.TYPE_LARGE_HEART);
        } else if (weaponRepeats == WEAPON_REPEATS_DOUBLE) {
          return new DropItem(this, x, y, DropItem.TYPE_TRIPLE);
        } else if (weaponRepeats == WEAPON_REPEATS_SINGLE) {
          return new DropItem(this, x, y, DropItem.TYPE_DOUBLE);
        }
      case CANDLE_ITEM_HOLY_WATER:
        return new DropItem(this, x, y, DropItem.TYPE_HOLY_WATER);
      case CANDLE_ITEM_KILL_ALL:
        return new DropItem(this, x, y, DropItem.TYPE_KILL_ALL);
      case CANDLE_ITEM_LARGE_HEART:
        return new DropItem(this, x, y, DropItem.TYPE_LARGE_HEART);
      case CANDLE_ITEM_MEAT:
        return new DropItem(this, x, y, DropItem.TYPE_MEAT);
      case CANDLE_ITEM_MONEY_BAG:
        return new DropItem(this, x, y, DropItem.TYPE_MONEY_BAG);
      case CANDLE_ITEM_ONE_UP:
        return new DropItem(this, x, y, DropItem.TYPE_1UP);
      case CANDLE_ITEM_POTION:
        return new DropItem(this, x, y, DropItem.TYPE_POTION);
      case CANDLE_ITEM_SMALL_HEART:
        if (simon.whipType + visibleWhipCount < 2 && random.nextBoolean()) {
          whipCreated();
          return new DropItem(this, x, y, DropItem.TYPE_WHIP);
        } else {
          if (random.nextInt(31) == 11) {
            if (weaponType == WEAPON_TYPE_NONE
                || weaponRepeats == WEAPON_REPEATS_TRIPLE) {
              return new DropItem(this, x, y, DropItem.TYPE_LARGE_HEART);
            } else if (weaponRepeats == WEAPON_REPEATS_DOUBLE) {
              return new DropItem(this, x, y, DropItem.TYPE_TRIPLE);
            } else if (weaponRepeats == WEAPON_REPEATS_SINGLE) {
              return new DropItem(this, x, y, DropItem.TYPE_DOUBLE);
            }
          } else {
            return new SmallHeart(this, x + 8, y + 8);
          }
        }
      case CANDLE_ITEM_STOP_WATCH:
        return new DropItem(this, x, y, DropItem.TYPE_STOP_WATCH);
      case CANDLE_ITEM_EMPTY:
        return null;
      default:
        throw new RuntimeException("Unknown candle type: " + item);
    }
  }

  public void pushWeapon(Thing weapon) {
    weaponsStack.push(weapon);
  }

  public void pushThing(ThingStack[] thingStacks, Thing thing) {
    if (thing == null) {
      return;
    }
    int index = ((int)thing.x) >> 8;
    if (index < 0) {
      index = 0;
    } else if (index >= thingStacks.length) {
      index = thingStacks.length - 1;
    }
    thingStacks[index].push(thing);
  }

  public void pushThing(Thing thing) {
    regionThingStack.push(thing);
  }

  public void removeBlock(int x, int y) {
    map[y][x] = BLOCK_EMPTY;
    walls[y][x] = BLOCK_EMPTY;
    repairBlock(x - 1, y);
    repairBlock(x + 1, y);
    repairBlock(x, y - 1);
    repairBlock(x, y + 1);
  }

  private void repairBlock(int x, int y) {
    if (y >= 0 && y < 11 && x >= 0 && x < mapWidth
        && (walls[y][x] == WALL_PLATFORM || walls[y][x] == WALL_FULL)) {

      int up = 0;
      int down = 0;
      int left = 0;
      int right = 0;

      if (y > 0 && walls[y - 1][x] == WALL_EMPTY) {
        up = 1;
      }
      if (y < 10 && walls[y + 1][x] == WALL_EMPTY) {
        down = 1;
      }
      if (x > 0 && walls[y][x - 1] == WALL_EMPTY) {
        left = 1;
      }
      if (x < mapWidth - 1 && walls[y][x + 1] == WALL_EMPTY) {
        right = 1;
      }

      map[y][x] = (up << 3) | (down << 2) | (left << 1) | right;
    } 
  }

  private boolean isBlock(char[][] s, int x, int y) {
    char c = s[y][x];
    if (c == TILE_STAIRS_LEFT || c == TILE_STAIRS_RIGHT) {
      return isBlock(s, x - 1, y) && isBlock(s, x + 1, y);
    }
    return c == TILE_WALL || c == TILE_STAIRS_LEFT_CAPPED
        || c == TILE_STAIRS_RIGHT_CAPPED || c == TILE_BREAK_WALL
        || c == TILE_PLATFORM;
  }

  private void replaceWithBlock(
      int[][] map, char[][] s, int x, int y, int width) {
    int up = 0;
    int down = 0;
    int left = 0;
    int right = 0;

    if (y > 0 && !isBlock(s, x, y - 1)) {
      up = 1;
    }
    if (y < 10 && !isBlock(s, x, y + 1)) {
      down = 1;
    }
    if (x > 0 && !isBlock(s, x - 1, y)) {
      left = 1;
    }
    if (x < width - 1 && !isBlock(s, x + 1, y)) {
      right = 1;
    }

    map[y][x] = (up << 3) | (down << 2) | (left << 1) | right;
  }

  private void loadStageSegment(int a, int b) {

    loadedSegments[a][b] = new StageSegment();
    loadedSegments[a][b].stageSegmentIndex = b;

    ArrayList<String> level = new ArrayList<String>();    
    try {
      ClassLoader classLoader = Main.class.getClassLoader();
      String fileName = "stages/stage_" + a + "_" + b + ".txt";
      BufferedReader br = new BufferedReader(new InputStreamReader(
          classLoader.getResourceAsStream(fileName)));

      loadedSegments[a][b].direction = (br.readLine().trim().charAt(0) == 'l')
          ? Main.LEFT : Main.RIGHT;
      loadedSegments[a][b].candleItems = br.readLine().trim();
      br.readLine();

      String line = null;
      while((line = br.readLine()) != null) {
        if (line.trim().length() == 0) {
          continue;
        }
        level.add(line);
      }
      br.close();
    } catch(Throwable t) {
      t.printStackTrace();
    }

    loadedSegments[a][b].stage = new char[11][(level.size() / 11) << 4];

    int x = 0;
    int y = 0;
    for(int i = 0; i < level.size(); i++) {
      String line = level.get(i);
      for(int j = 0; j < 16; j++) {
        loadedSegments[a][b].stage[y][j + x] = line.charAt(j);
      }
      if (++y == 11) {
        y = 0;
        x += 16;
      }
    }
  }

  private void drawNumber(int value, int digits, int x, int y) {
    if (value < 0) {
      value = 0;
    }
    x += (digits - 1) << 4;
    for(int i = 0; i < digits; i++, x -= 16, value /= 10) {
      symbols['0' + (value % 10)].draw(x, y);
    }
  }

  private void drawStringCentered(String string, int y) {
    int x = (640 - (string.length() << 4)) >> 1;
    for(int i = 0; i < string.length(); i++, x += 16) {
      symbols[string.charAt(i)].draw(x, y);
    }
  }

  private void drawString(String string, int x, int y, int length) {
    for(int i = 0; i < string.length() && i < length; i++, x += 16) {
      symbols[string.charAt(i)].draw(x, y);
    }
  }

  private void drawString(String string, int x, int y) {
    for(int i = 0; i < string.length(); i++, x += 16) {
      symbols[string.charAt(i)].draw(x, y);
    }
  }

  public int getWall(int x, int y) {
    int X = x >> 5;
    int Y = y >> 5;
    if (Y < 0 || Y >= 11 || X >= mapWidth || X < 0) {
      return WALL_EMPTY;
    }
    return walls[Y][X];
  }

  public int getTile(int x, int y) {
    int X = x >> 5;
    int Y = y >> 5;
    if (Y < 0 || Y >= 11 || X >= mapWidth || X < 0) {
      return BLOCK_EMPTY;
    }
    return map[Y][X];
  }

  public boolean isPlatform(int x, int y) {
    int X = x >> 5;
    int Y = y >> 5;
    if (Y < 0 || Y >= 11 || X >= mapWidth || X < 0) {
      return false;
    }
    return walls[Y][X] == WALL_PLATFORM;
  }

  public Thing findPlatform(int x, int y) {
    for(int i = platforms.length - 1; i >= 0; i--) {
      Thing p = platforms[i];
      if (y == p.y && x >= p.x && x <= p.x + 63) {
        return p;
      }
    }
    return null;
  }

  public boolean isSupportive(int x, int y) {
    int X = x >> 5;
    int Y = y >> 5;
    if (Y < 0 || Y >= 11 || X >= mapWidth || X < 0) {
      return false;
    }
    int tile = walls[Y][X];
    return tile == WALL_FULL || tile == WALL_PLATFORM;
  }

  public boolean isSolid(int x, int y) {
    int X = x >> 5;
    int Y = y >> 5;
    if (Y < 0 || Y >= 11 || X >= mapWidth || X < 0) {
      return false;
    }
    return walls[Y][X] == WALL_FULL;
  }

  public boolean isEmpty(int x, int y) {
    int X = x >> 5;
    int Y = y >> 5;
    if (Y < 0 || Y >= 11 || X >= mapWidth || X < 0) {
      return false;
    }
    return walls[Y][X] == WALL_EMPTY;
  }

  public void flashSimon() {

    float alpha = 1;

    if (simon.flashing > 0) {
      alpha = (float)FastTrig.cos(2 * simon.flashing);
    }

    setSimonAlpha(alpha);
  }

  public void setSimonAlpha(float alpha) {
    for(int i = 0; i < 2; i++) {
      simonOnStairsUp[i].setAlpha(alpha);
      simonOnStairsDown[i].setAlpha(alpha);
      simonKneeling[i].setAlpha(alpha);
      simonHurt[i].setAlpha(alpha);
      simonDead[i].setAlpha(alpha);

      for(int j = 0; j < 3; j++) {
        simonWalking[i][j].setAlpha(alpha);
        simonWhipping[i][j].setAlpha(alpha);
        simonKneelWhipping[i][j].setAlpha(alpha);
        simonUpWhipping[i][j].setAlpha(alpha);
        simonDownWhipping[i][j].setAlpha(alpha);
      }
    }
  }

  public void whipCreated() {
    visibleWhipCount++;
    if (visibleWhipCount > 2) {
      visibleWhipCount = 2;
    }
  }

  public void whipDestroyed() {
    visibleWhipCount--;
    if (visibleWhipCount < 0) {
      visibleWhipCount = 0;
    }
  }

  public void advanceWhip() {
    whipDestroyed();
    if (simon.whipType < 2) {
      playSound(advance_whip);
      simon.whipType++;
      simon.flashing = 60;
    }
  }

  public void setWeapon(int weaponType) {
    if (this.weaponType != weaponType) {
      this.weaponType = weaponType;
      this.weaponRepeats = WEAPON_TYPE_NONE;
    }
  }

  public void setWeaponRepeats(int weaponRepeats) {
    if (weaponType != WEAPON_TYPE_NONE
        || this.weaponRepeats < weaponRepeats) {
      playSound(got_double);
      this.weaponRepeats = weaponRepeats;
      repeatsFlashing = 45;
    }
  }

  public void playSound(Sound sound) {
    if (mode == MODE_PLAYING || mode == MODE_DEMO
        || mode == MODE_TITLE_SCREEN) {
      sound.play();
    }
  }

  public void stopSong() {
    if (currentSong != null) {
      currentSong.stop();
    }
    requestedSong = null;
    currentSong = null;
  }

  public void requestMusic(Music music) {
    if (mode == MODE_PLAYING || mode == MODE_INTRO || mode == MODE_MAP
        || mode == MODE_CONTINUE_SCREEN) {
      if (currentSong != null) {
        currentSong.stop();
      }
      requestedSong = null;
      currentSong = null;
      music.play();
    }
  }

  public void requestSong(Song song) {
    requestedSong = song;
  }

  public void addPlayers(int players) {
    playSound(one_up);
    this.players += players;
    if (this.players > 99) {
      this.players = 99;
    }
  }

  public void addPoints(DropItem dropItem) {
    switch(dropItem.type) {
      case DropItem.TYPE_MONEY_BAG:
        switch(random.nextInt(3)) {
          case 0:
            pushThing(new FloatingPoints(this,
                dropItem.x, dropItem.y, FloatingPoints.TYPE_100));
            addPoints(100);
            break;
          case 1:
            pushThing(new FloatingPoints(this,
                dropItem.x, dropItem.y, FloatingPoints.TYPE_400));
            addPoints(400);
            break;
          case 2:
            pushThing(new FloatingPoints(this,
                dropItem.x, dropItem.y, FloatingPoints.TYPE_700));
            addPoints(700);
            break;
        }
        break;
      case DropItem.TYPE_CHEST:
        pushThing(new FloatingPoints(this,
            dropItem.x, dropItem.y, FloatingPoints.TYPE_1000));
        addPoints(1000);
        break;
      case DropItem.TYPE_CROWN:
        pushThing(new FloatingPoints(this,
            dropItem.x, dropItem.y, FloatingPoints.TYPE_2000));
        addPoints(2000);
        break;
    }
  }

  public void addPoints(int points) {
    int bucket1 = (score + 20000) / 50000;
    score += points;
    int bucket2 = (score + 20000) / 50000;
    if (bucket1 != bucket2) {
      addPlayers(1);
    }
  }

  public void hurtSimon(int power) {

    if (simon.hurt || simon.invincible > 0 || playerPower == 0) {
      return;
    }

    playSound(simon_hurt);

    playerPower -= power;
    if (playerPower < 0) {
      playerPower = 0;
    }

    if (playerPower == 0) {
      simon.onStairs = false;
    }

    if (simon.onStairs) {
      setSimonAlpha(0.25f);
      simon.invincible = 182;
    } else if (simon.supported) {
      simon.vy = SIMON_JUMP_VELOCITY;
      simon.vx = simon.direction == LEFT ? 2 : -2;
      simon.hurt = true;
    } else if (!simon.onStairs) {
      simon.vy = -1f;
      simon.vx = simon.direction == LEFT ? 2 : -2;
      simon.hurt = true;
    } 
  }

  public void enterNextRegion(Door door) {
    simon.whipIndex = 0;
    simon.whipIncrementor = 0;
    simon.whipping = false;
    this.door = door;
    this.visibleWhipCount = 0;
  }

  public void restoreHealth() {
    playerPower = 16;
  }

  public void fireSparks(float x, float y) {
    float angle = 0f;
    for(int i = 0; i < 8; i++, angle += 0.78539816339744830961566084581988f) {
      pushThing(new ShootingSpark(this, x, y,
          8f * (float)FastTrig.cos(angle), 8f * (float)FastTrig.sin(angle)));
    }
  }

  public void killAll() {
    killAll = true;
  }

  public void linkStageSegments(
      int segment1, int stairs1, int segment2, int stairs2) {
    stageSegments[segment1].stairsEntries[stairs1].connection
        = stageSegments[segment2].stairsEntries[stairs2];
    stageSegments[segment2].stairsEntries[stairs2].connection
        = stageSegments[segment1].stairsEntries[stairs1]; 
  }

  public void restoreCheckpoint() {

    StageSegment segment = stageSegments[checkpoint.stageSegmentIndex];
    Region region = segment.regions[checkpoint.regionIndex];
    stage = region.stageNumber;

    platforms = region.platforms;

    simon.reset();

    simon.xMin = region.min;
    simon.xMax = region.max;
    simon.x = checkpoint.x;
    simon.y = checkpoint.y;
    simon.direction = segment.direction;

    if (stageIndex == 1 && checkpoint.stageSegmentIndex == 0) {
      simon.direction = RIGHT;
    }

    segment.regionIndex = checkpoint.regionIndex;
    stageSegment = segment;

    map = segment.map;
    walls = segment.walls;
    weaponsStack.clear();
    weaponsStackSwap.clear();
    regionThingStack.clear();
    regionStackSwap.clear();
    regionThingStack.addAll(region.thingStack);
    mapWidth = segment.mapWidth;
    beatStage = false;

    moveCamera();

    requestedSong = checkpoint.song;
  }

  public void checkpointReached(Checkpoint checkpoint) {
    this.checkpoint = checkpoint;
  }

  public void beatStage() {
    beatStage = true;
    
    if (stageIndex != 5) {
      beatStageDelay = 455;
      requestMusic(stage_cleared);
    } else {
      beatStageDelay = 0;
      requestSong(ending);
    }
  }

  public void addHearts(int hearts) {
    this.hearts += hearts;
    if (this.hearts > 99) {
      this.hearts = 99;
    }
  }

  public boolean intersectsWeapon(Thing thing) {
    return intersectsWeapon(
        thing.rx1 + (int)thing.x,
        thing.ry1 + (int)thing.y,
        thing.rx2 + (int)thing.x,
        thing.ry2 + (int)thing.y);
  }

  public boolean intersectsWeapon(int x1, int y1, int x2, int y2) {
    if (playerPower == 0) {
      return false;
    }
    Thing[] weapons = weaponsStack.things;
    for(int j = weaponsStack.top; j >= 0; j--) {
      Thing weapon = weapons[j];
      if (intersects(
          weapon.rx1 + (int)weapon.x,
          weapon.ry1 + (int)weapon.y,
          weapon.rx2 + (int)weapon.x,
          weapon.ry2 + (int)weapon.y,
          x1, y1, x2, y2)) {
        weapon.intersected = true;
        return true;
      }
    }
    return false;
  }

  public boolean intersectsWhip(Thing thing) {
    return intersectsWhip(
        thing.rx1 + (int)thing.x,
        thing.ry1 + (int)thing.y,
        thing.rx2 + (int)thing.x,
        thing.ry2 + (int)thing.y);
  }

  public boolean intersectsWhip(int x1, int y1, int x2, int y2) {
    if (!simon.whipping || simon.whipIndex != 2 || simon.throwing
        || playerPower == 0) {
      return false;
    }

    int[] whipSize = whipSizes[simon.whipType];
    int[] whipOffset = whipOffsets[simon.whipType][simon.direction];
    int[] p = null;
    if (simon.onStairs) {
      if (simon.up) {
        p = Simon.upWhipTable[simon.whipType][2][simon.direction];
      } else {
        p = Simon.downWhipTable[simon.whipType][2][simon.direction];
      }
    } else if (simon.kneeling) {
      p = Simon.kneelingWhipTable[simon.whipType][2][simon.direction];
    } else {
      p = Simon.standingWhipTable[simon.whipType][2][simon.direction];
    }

    int lastX = (int)simon.lastX;
    int lastY = (int)simon.lastY;
    int x = (int)simon.x;
    int y = (int)simon.y;

    int wx1 = whipOffset[0] + p[0];
    int wy1 = whipOffset[1] + p[1];

    int ax1 = lastX + wx1;
    int ay1 = lastY + wy1;
    int ax2 = ax1 + whipSize[0];
    int ay2 = ay1 + whipSize[1];

    int bx1 = x + wx1;
    int by1 = y + wy1;
    int bx2 = bx1 + whipSize[0];
    int by2 = by1 + whipSize[1];

    int rx1 = Math.min(ax1, bx1);
    int ry1 = Math.min(ay1, by1);
    int rx2 = Math.max(ax2, bx2);
    int ry2 = Math.max(ay2, by2);

    if (simon.direction == Main.LEFT) {
      rx2 += 16;
    } else {
      rx1 -= 16;
    }

    return intersects(rx1, ry1, rx2, ry2, x1, y1, x2, y2);
  }

  public boolean intersectsSimon(Thing thing) {
    int x = (int)thing.x;
    int y = (int)thing.y;
    return intersectsSimon(
        x + thing.rx1, y + thing.ry1, x + thing.rx2, y + thing.ry2);
  }

  public boolean intersectsSimon(int x1, int y1, int x2, int y2) {
    if (playerPower == 0) {
      return false;
    }
    return intersects(
        (int)simon.x + simon.rx1, (int)simon.y + simon.ry1,
        (int)simon.x + simon.rx2, (int)simon.y + simon.ry2,
        x1, y1, x2, y2);
  }

  public boolean intersects(Thing thing1, Thing thing2) {
    int x1 = (int)thing1.x;
    int x2 = (int)thing2.x;
    int y1 = (int)thing1.y;
    int y2 = (int)thing2.y;
    return intersects(
        x1 + thing1.rx1, y1 + thing1.ry1, x1 + thing1.rx2, y1 + thing1.ry2,
        x2 + thing2.rx1, y2 + thing2.ry1, x2 + thing2.rx2, y2 + thing2.ry2);
  }

  public boolean intersects(
      int ax1, int ay1, int ax2, int ay2,
      int bx1, int by1, int bx2, int by2) {
    return ax2 >= bx1 && ax1 <= bx2 && ay2 >= by1 && ay1 <= by2;
  }

  private static final String[] credits = {
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

    "PRESENTED BY",
  };
  private static final String CREDITS2 = "MICHAEL BIRKEN";
  private static final String CREDITS3 = "THE BRILLIANT WORKS OF KONAMI";
  private static final String CREDITS4 = "MEATFIGHTER.COM";

  private int creditsIndex;
  private boolean creditsPaused;
  private boolean creditsAdvance;
  private int creditsTitleIndex;
  private int creditsTitleIndex2;
  private int creditsDelay;
  private boolean creditsPresents;

  public void initCredits() {
    creditsIndex = -1;
    creditsPresents = false;
    advanceCredits();
  }

  public void advanceCredits() {
    mode = MODE_CREDITS;
    input.clearKeyPressedRecord();
    if (creditsIndex == 11) {
      creditsIndex = 12;
      creditsPresents = true;
      creditsPaused = true;
      creditsTitleIndex = 0;
      creditsTitleIndex2 = 0;
      creditsDelay = 0;
      creditsAdvance = false;
      recordingIndex = 728;
    } else {
      mountCreditsRecording(++creditsIndex);
    }
  }

  private void mountCreditsRecording(int index) {
    random = new Random(0xDEADBEEF);

    creditsIndex = index;
    creditsPaused = false;
    recordingIndex = 0;
    creditsTitleIndex = 0;
    creditsTitleIndex2 = 0;
    creditsDelay = 0;
    creditsAdvance = false;
    creditsPresents = false;

    switch (index) {
      case 0:
        createStage(0, true);
        checkpoint = stageSegments[0].regions[1].checkpoint;
        checkpoint.x += 16 * 32 - 64;
        restoreCheckpoint();
        break;

      case 1:
        createStage(0, true);
        checkpoint = stageSegments[0].regions[3].checkpoint;
        checkpoint.x += 16 * 32 * 2 + 64;
        checkpoint.y += 32 * 6;
        restoreCheckpoint();
        break;

      case 2:
        createStage(1, true);
        checkpoint = stageSegments[2].regions[0].checkpoint;
        checkpoint.x -= 16 * 32 * 2 - 128;
        checkpoint.y += 32 * 1;
        restoreCheckpoint();
        break;

      case 3:
        createStage(1, true);
        checkpoint = stageSegments[2].regions[0].checkpoint;
        checkpoint.stageSegmentIndex = 3;
        checkpoint.x -= 16 * 32 * 2 - 128;
        checkpoint.y += 32 * 1;
        restoreCheckpoint();
        break;

      case 4:
        createStage(2, true);
        checkpoint = stageSegments[0].regions[0].checkpoint;
        restoreCheckpoint();
        break;

      case 5:
        createStage(2, true);
        checkpoint = stageSegments[2].regions[1].checkpoint;
        checkpoint.x += 16 * 32 * 2 + 32 * 11;
        restoreCheckpoint();
        break;

      case 6:
        createStage(2, true);
        checkpoint = stageSegments[2].regions[1].checkpoint;
        checkpoint.x += 16 * 32 * 5 - 128;
        restoreCheckpoint();
        break;

      case 7:
        createStage(3, true);
        break;

      case 8:
        createStage(3, true);
        checkpoint = stageSegments[1].regions[0].checkpoint;
        checkpoint.x += 16 * 32 * 5;
        restoreCheckpoint();
        break;

      case 9:
        createStage(3, true);
        checkpoint = stageSegments[1].regions[1].checkpoint;
        checkpoint.x += 16 * 32 * 3 + 128;
        checkpoint.y += 32;
        restoreCheckpoint();
        break;

      case 10:
        createStage(4, true);
        checkpoint = stageSegments[1].regions[1].checkpoint;
        restoreCheckpoint();
        break;

      case 11:
        createStage(4, true);
        checkpoint = stageSegments[2].regions[0].checkpoint;
        checkpoint.stageSegmentIndex = 3;
        checkpoint.x -= 16 * 32;
        checkpoint.y += 32;
        restoreCheckpoint();
        break;
    }

    simon.whipType = 2;
    weaponType = WEAPON_TYPE_BOOMERANG;
    weaponRepeats = WEAPON_REPEATS_TRIPLE;
    hearts = 99;

    random = new Random(0xDEADBEEF);

    nextFrameTime = Sys.getTime();
  }

  public void updateCredits(GameContainer gc) throws SlickException {
    if (recordingIndex == 728) {
      creditsPaused = true;

      String creditsString = creditsPresents ? CREDITS4
          : creditsIndex == 11 ? CREDITS3 : CREDITS2;

      if (creditsDelay <= 0) {
        if (creditsTitleIndex < credits[creditsIndex].length()) {
          creditsTitleIndex++;
          creditsDelay = 15;
        } else if (creditsTitleIndex2 < creditsString.length()) {
          creditsTitleIndex2++;
          creditsDelay = 15;
        } else if (!creditsAdvance) {
          creditsAdvance = true;
          creditsDelay = creditsPresents ? 1365 : 182;
        } else {
          fadeState = FADE_OUT;
          fadeReason = creditsPresents ? FADE_REASON_SHOW_TITLE_SCREEN
              : FADE_REASON_ADVANCE_CREDITS;
        }
      } else {
        creditsDelay--;
        if (creditsPresents && input.isKeyPressed(Input.KEY_ENTER)) {
          creditsDelay = 0;
        }
      }
    }
  }

  public void renderCredits(GameContainer gc, Graphics g)
      throws SlickException {

    if (creditsPaused) {
      if (creditsPresents) {
        g.setColor(Color.white);
        g.fillRect(64, 32, 512, 416);
        drawString(credits[creditsIndex], 224, 192, creditsTitleIndex);
        drawString(CREDITS4, 200, 224, creditsTitleIndex2);
      } else if (creditsIndex == 0 || creditsIndex == 3 || creditsIndex == 10) {
        drawString(credits[creditsIndex], 304, 64, creditsTitleIndex);
        drawString(CREDITS2, 336, 96, creditsTitleIndex2);
      } else if (creditsIndex == 11) {
        drawString(credits[creditsIndex], 80, 64, creditsTitleIndex);
        drawString(CREDITS3, 96, 96, creditsTitleIndex2);
      } else {
        drawString(credits[creditsIndex], 112, 64, creditsTitleIndex);
        drawString(CREDITS2, 144, 96, creditsTitleIndex2);
      }
    }
  }

  public void initCastleFalls() {
    mode = MODE_CASTLE_FALLS;

    castleFallDelay = 91;
    castleFallX = 410;
    castleFallY = 111;
    castleFallSparkDelay = 45;
    castleFallSparkCount = 8;
    castleFallSparkVisible = false;

    nextFrameTime = Sys.getTime();
  }

  public void updateCastleFalls(GameContainer gc) throws SlickException {

    if (castleFallSparkCount > 0) {
      if (castleFallSparkDelay > 0) {
        castleFallSparkDelay--;
      } else {
        if (castleFallSparkVisible) {
          castleFallSparkCount--;
          castleFallSparkVisible = false;
          castleFallSparkDelay = 5;
        } else {
          castleFallSparkVisible = true;
          castleFallSparkDelay = 10;
          castleFallSparkX = 433 + random.nextInt(16);
          castleFallSparkY = 113 + random.nextInt(16); 
        }
      }
    } else {
      if (castleFallY < 220) {
        castleFallY += 0.2f;
      } else if (castleFallDelay == 0) {
        fadeState = FADE_OUT;
        fadeReason = FADE_REASON_SHOW_CREDITS;
      } else {
        castleFallDelay--;
      }
      castleFallX = 410 + random.nextInt(5) - 2;
    }
  }

  public void renderCastleFalls(GameContainer gc, Graphics g)
      throws SlickException {
    g.setColor(Color.white);
    g.fillRect(64, 32, 512, 416);
    castleTrees.draw(65, 192);    
    castleTop.draw((int)castleFallX, (int)castleFallY);
    castleBottom.draw(389, 195);
    if (castleFallSparkVisible) {
      spark.draw(castleFallSparkX, castleFallSparkY);
    }
  }

  public void initDemo() {

    mode = MODE_DEMO;

    if (++demoIndex == 3) {
      demoIndex = 0;
    }

    players = 4;
    score = 0;
    recordingIndex = 0;

    random = new Random(0xDEADBEEF);

    switch(demoIndex) {
      case 0:
        createStage(3, true);
        checkpoint = stageSegments[1].regions[1].checkpoint;
        restoreCheckpoint();
        break;
      case 1:
        createStage(2, true);
        break;
      case 2:
        createStage(2, true);
        checkpoint = stageSegments[1].regions[1].checkpoint;
        restoreCheckpoint();
        break;
    }

    random = new Random(0xDEADBEEF);

    nextFrameTime = Sys.getTime();
  }

  public void initIntro() {
    mode = MODE_INTRO;
    introWalkSpriteIndexIncrementor = 0;
    introWalkSpriteIndex = 0;
    introSimonX = 512;
    introCloudsX = 500;
    introTime = 637;
    gateBatX1 = 0;
    gateBatY1 = 0;
    gateBatX2 = 0;
    gateBatY2 = 0;
    gateBatSpriteIndex = 0;
    gateBatSpriteIndexIncrementor = 0;

    players = 4;
    score = 0;
    stageIndex = 0;
    random = new Random();

    createStage(stageIndex, true);

    input.clearKeyPressedRecord();

    float percent = 1f - introTime * 0.0013755158184319119669876203576341f;
    float angle = percent * 1.5707963267948966192313216916398f;
    gateBatX1 = 158 + 161 * percent;
    gateBatY1 = 224 - 90 * (float)FastTrig.sin(angle);

    angle *= 2;
    gateBatX2 = 336 + 48 * (float)FastTrig.cos(angle);
    gateBatY2 = 140 - 48 * (float)FastTrig.sin(angle);

    requestMusic(prologue);

    nextFrameTime = Sys.getTime();
  }

  public void updateIntro(GameContainer gc) throws SlickException {

    if (++gateBatSpriteIndexIncrementor == 10) {
      gateBatSpriteIndexIncrementor = 0;
      if (++gateBatSpriteIndex == 2) {
        gateBatSpriteIndex = 0;
      }
    }

    float percent = 1f - introTime * 0.0013755158184319119669876203576341f;
    float angle = percent * 1.5707963267948966192313216916398f;
    gateBatX1 = 158 + 161 * percent;
    gateBatY1 = 224 - 90 * (float)FastTrig.sin(angle);

    angle *= 2;
    gateBatX2 = 336 + 48 * (float)FastTrig.cos(angle);
    gateBatY2 = 140 - 48 * (float)FastTrig.sin(angle);

    if (--introTime == 0) {
      fadeState = FADE_OUT;
      fadeReason = FADE_REASON_RESTORE_CHECKPOINT;
    }

    if (introSimonX > 292) {
      introSimonX--;

      if (++introWalkSpriteIndexIncrementor == 16) {
        introWalkSpriteIndexIncrementor = 0;
        if (++introWalkSpriteIndex == 4) {
          introWalkSpriteIndex = 0;
        }
      }
    }

    introCloudsX -= 0.125f;
  }

  public void renderIntro(GameContainer gc, Graphics g)
      throws SlickException {
    g.setColor(Color.white);
    g.fillRect(64, 32, 512, 98);
    gates.draw(64, 98);

    clouds.draw((int)introCloudsX, 153);
    gateBats[gateBatSpriteIndex].draw((int)gateBatX1, (int)gateBatY1);
    gateBats[1 ^ gateBatSpriteIndex].draw((int)gateBatX2, (int)gateBatY2);

    if (introSimonX == 292) {
      simonBack.draw(292, 375);
    } else {
      simonWalking[LEFT][Simon.walkSpriteIndexes[introWalkSpriteIndex]]
          .draw(introSimonX, 375);
    }
  }

  public void initContinueScreen() {

    mode = MODE_CONTINUE_SCREEN;

    players = 4;
    score = 0;
    continueSelected = true;

    createStage(stageIndex, true);

    input.clearKeyPressedRecord();

    requestMusic(game_over);

    nextFrameTime = Sys.getTime();
  }

  public void updateContinueScreen(GameContainer gc) throws SlickException {
    if (input.isKeyPressed(Input.KEY_UP)) {
      continueSelected = true;
    } else if (input.isKeyPressed(Input.KEY_DOWN)) {
      continueSelected = false;
    } else if (input.isKeyPressed(Input.KEY_ENTER)) {
      fadeState = FADE_OUT;
      if (continueSelected) {
        fadeReason = FADE_REASON_RESTORE_CHECKPOINT;
      } else {
        fadeReason = FADE_REASON_SHOW_TITLE_SCREEN;
      }
    }
  }

  public void renderContinueScreen(GameContainer gc, Graphics g)
      throws SlickException {

    g.setColor(Color.white);
    g.fillRect(64, 32, 512, 416);

    drawString("GAME OVER", 256, 208);
    drawString("CONTINUE", 272, 288);
    drawString("END", 272, 336);

    if (continueSelected) {
      smallHeart.draw(240, 288);
    } else {
      smallHeart.draw(240, 336);
    }
  }

  private int mapScreenX;
  private int mapScreenTargetX;
  private int mapDelay;

  public void initMapScreen() {
    mode = MODE_MAP;

    gateBatSpriteIndex = 0;
    gateBatSpriteIndexIncrementor = 0;
    introWalkSpriteIndexIncrementor = 0;
    introWalkSpriteIndex = 0;
    introSimonX = 0;    

    stageIndex++;
    players++;

    mapScreenX = 576;
    mapScreenTargetX = stageIndex > 2 ? -192 : 64;

    input.clearKeyPressedRecord();

    justShowedMap = true;
    createStage(stageIndex, true);
    justShowedMap = true;

    switch(stageIndex) {
      case 0:
        requestMusic(map_1);
        mapDelay = 5 * 91;
        break;
      case 1:
        requestMusic(map_1);
        mapDelay = 5 * 91;
        break;
      case 2:
        requestMusic(map_2);
        mapDelay = 2 * 91;
        break;
      case 3:
        requestMusic(map_1);
        mapDelay = 2 * 91;
        break;
      case 4:
        requestMusic(map_3);
        mapDelay = 4 * 91;
        break;
      case 5:
        requestMusic(map_4);
        mapDelay = 1 * 91;
        break;
    }

    nextFrameTime = Sys.getTime();
  }

  public void updateLoading(GameContainer gc) throws SlickException {
    switch(loadingIndex) {
      case 21:
        boss_1 = new Song("music/boss_1_intro.ogg", "music/boss_1_loop.ogg");
        break;
      case 20:
        boss_2 = new Song("music/boss_2_intro.ogg", "music/boss_2_loop.ogg");
        break;
      case 19:
        ending = new Song(null, "music/ending_loop.ogg");
        break;
      case 18:
        game_over = new Music("music/game_over.ogg");
        break;
      case 17:
        map_1 = new Music("music/map_1.ogg");
        break;
      case 16:
        map_2 = new Music("music/map_2.ogg");
        break;
      case 15:
        map_3 = new Music("music/map_3.ogg");
        break;
      case 14:
        map_4 = new Music("music/map_4.ogg");
        break;
      case 13:
        prologue = new Music("music/prologue.ogg");
        break;
      case 12:
        simon_killed = new Music("music/simon_killed.ogg");
        break;
      case 11:
        stage_1_1 = new Song(null, "music/stage_1_1_loop.ogg");
        break;
      case 10:
        stage_1_2 = new Song(
            "music/stage_1_2_intro.ogg", "music/stage_1_2_loop.ogg");
        break;
      case 9:
        stage_2_1 = new Song(
            "music/stage_2_1_intro.ogg", "music/stage_2_1_loop.ogg");
        break;
      case 8:
        stage_3_1 = new Song(
            "music/stage_3_1_intro.ogg", "music/stage_3_1_loop.ogg");
        break;
      case 7:
        stage_4_1 = new Song(null, "music/stage_4_1_loop.ogg");
        break;
      case 6:
        stage_4_2 = new Song(null, "music/stage_4_2_loop.ogg");
        break;
      case 5:
        stage_5_1 = new Song(
            "music/stage_5_1_intro.ogg", "music/stage_5_1_loop.ogg");
        break;
      case 4:
        stage_6_1 = new Song(null, "music/stage_6_1_loop.ogg");
        break;
      case 3:
        stage_6_2 = new Song(
            "music/stage_6_2_intro.ogg", "music/stage_6_2_loop.ogg");
        break;
      case 2:
        stage_cleared = new Music("music/stage_cleared.ogg");
        break;
      case 1:
        dracula_dead = new Music("music/dracula_dead.ogg");
        break;
      case 0:
        fadeState = FADE_OUT;
        fadeReason = FADE_REASON_SHOW_TITLE_SCREEN;
        break;
    }

    loadingIndex--;
    nextFrameTime = Sys.getTime();
  }

  public void renderLoading(GameContainer gc, Graphics g)
      throws SlickException {

    g.setColor(Color.white);
    g.fillRect(64, 32, 512, 416);

    drawString("LOADING", 80, 48);
    drawNumber(loadingIndex, 2, 208, 48);
  }

  public void updateMapScreen(GameContainer gc) throws SlickException {
    if (mapScreenX > mapScreenTargetX) {
      mapScreenX--;
    } else if (introSimonX < 576) {
      introSimonX++;

      if (++introWalkSpriteIndexIncrementor == 16) {
        introWalkSpriteIndexIncrementor = 0;
        if (++introWalkSpriteIndex == 4) {
          introWalkSpriteIndex = 0;
        }
      }
    } else if (mapDelay > 0) {
      mapDelay--;
    } else {
      fadeState = FADE_OUT;
      fadeReason = FADE_REASON_RESTORE_CHECKPOINT;
    }

    if (++gateBatSpriteIndexIncrementor == 10) {
      gateBatSpriteIndexIncrementor = 0;
      if (++gateBatSpriteIndex == 2) {
        gateBatSpriteIndex = 0;
      }
    }
  }

  public void renderMapScreen(GameContainer gc, Graphics g)
      throws SlickException {

    g.setColor(Color.white);
    g.fillRect(64, 32, 512, 416);

    castleMaps[0].draw((int)mapScreenX, 96);
    castleMaps[1].draw(384 + (int)mapScreenX, 96);

    gateBats[gateBatSpriteIndex].draw((int)mapScreenX + mapBats[stageIndex][0],
        96 + mapBats[stageIndex][1]);

    simonWalking[RIGHT][Simon.walkSpriteIndexes[introWalkSpriteIndex]]
        .draw(introSimonX, 321);
    
    g.setColor(Color.black);
    g.fillRect(0, 96, 64, 352);
    g.fillRect(576, 96, 64, 352);
  }

  public void initTitleScreen() {

    stopSong();
    if (game_over.playing()) {
      game_over.stop();
    }

    mode = MODE_TITLE_SCREEN;

    titleTimeout = 1365;
    titleBatX = 0;
    titleBatY = 0;
    titleBatScale = 10f;
    titleBatXRadius = 0;
    titleBatSpriteIndex = 0;
    titleBatSpriteIndexIncrementor = 0;
    titleBatSteps = 0;
    pressEnterVisible = true;
    pressEnterVisibleIncrementor = 0;
    pressEnterVisibleCount = 0;
    enterPressed = false;
    titleBatAngle = 0;

    input.clearKeyPressedRecord();

    nextFrameTime = Sys.getTime();
  }

  public void updateTitleScreen(GameContainer gc) throws SlickException {
    if (fade == FADE_DONE) {
      if (titleBatSteps < 273) {
        titleBatSteps++;
        titleBatX = 499 + titleBatXRadius * (float)FastTrig.sin(titleBatAngle);
        titleBatY = 220 + 12 * (float)FastTrig.sin(titleBatAngle);

        titleBatAngle += TITLE_BAT_ANGLE_INC;
        titleBatScale += TITLE_BAT_SCALE_INC;
        titleBatXRadius += TITLE_BAT_X_RADIUS_INC;
      }

      if (++titleBatSpriteIndexIncrementor == 9) {
        titleBatSpriteIndexIncrementor = 0;
        if (++titleBatSpriteIndex == 4) {
          titleBatSpriteIndex = 0;
        }
      }

      if (enterPressed) {
        if (++pressEnterVisibleIncrementor == 20) {
          pressEnterVisibleIncrementor = 0;
          pressEnterVisible = !pressEnterVisible;
          if (++pressEnterVisibleCount == 10) {
            fadeState = FADE_OUT;
            fadeReason = FADE_REASON_SHOW_INTRO;
          }
        }
      } else if (input.isKeyPressed(Input.KEY_ENTER)) {
        playSound(pressed_enter);
        enterPressed = true;
        pressEnterVisible = false;
      } else if (--titleTimeout <= 0) {
        fadeState = FADE_OUT;
        fadeReason = FADE_REASON_SHOW_DEMO;
      }
    }
  }

  public void renderTitleScreen(GameContainer gc, Graphics g) 
      throws SlickException {

    title.draw(64, 32);

    g.setColor(Color.white);
    g.fillRect(64, 310, 512, 138);

    if (titleBatSteps == 273) {
      titleBats[titleBatSequence[titleBatSpriteIndex]].draw(432, 208);
    } else {
      titleBats[titleBatSequence[titleBatSpriteIndex]].draw(
          (int)titleBatX, (int)titleBatY,
          (int)titleBatScale, (int)titleBatScale);
    }

    if (pressEnterVisible) {
      drawString("PRESS ENTER", 240, 240);
    }
    drawString("D - WHIP", 224, 288);
    drawString("F - SUB-WEAPON", 224, 320);
    drawString("ARROW KEYS - WALK, JUMP, KNEEL", 80, 352);
    drawString("SPACE - FULL-SCREEN MODE", 160, 384);
    drawString("@ 2010 MEATFIGHTER.COM", 144, 430);
  }


  /*private void drawStatusBar(Graphics g) {
    for(int i = 0; i < 16; i++) {
      for(int j = 0; j < 2; j++) {
        blank_32.draw((i << 5), (j << 5));
      }
    }

    drawString("SCORE-", 0, 0);
    drawString("PLAYER", 0, 16);
    drawString("ENEMY", 0, 32);
    drawNumber(score, 6, 96, 0);
    drawString("TIME", 208, 0);
    drawNumber(time, 4, 288, 0);
    drawString("STAGE", 368, 0);
    drawNumber(stage, 2, 464, 0);
    drawString("^-", 336, 16);
    drawString("P-", 336, 32);
    drawNumber(hearts, 2, 368, 16);
    drawNumber(players, 2, 368, 32);

    for(int i = 0; i < playerPower; i++) {
      power[0].draw(112 + (i << 3), 16);
    }
    for(int i = playerPower; i < 16; i++) {
      power[1].draw(112 + (i << 3), 16);
    }
    for(int i = 0; i < enemyPower; i++) {
      power[0].draw(112 + (i << 3), 32);
    }
    for(int i = enemyPower; i < 16; i++) {
      power[1].draw(112 + (i << 3), 32);
    }

    weaponBorder.draw(256, 16);
    if (weaponRepeats == WEAPON_REPEATS_DOUBLE) {
      dropItems[DropItem.TYPE_DOUBLE].draw(416, 16);
    } else if (weaponRepeats == WEAPON_REPEATS_TRIPLE) {
      dropItems[DropItem.TYPE_TRIPLE].draw(416, 16);
    }

    switch(weaponType) {
      case WEAPON_TYPE_AXE:
        dropItems[DropItem.TYPE_AXE].draw(272, 24);
        break;
      case WEAPON_TYPE_BOOMERANG:
        dropItems[DropItem.TYPE_BOOMERANG].draw(272, 24);
        break;
      case WEAPON_TYPE_DAGGER:
        dropItems[DropItem.TYPE_DAGGER].draw(272, 24);
        break;
      case WEAPON_TYPE_HOLY_WATER:
        dropItems[DropItem.TYPE_HOLY_WATER].draw(272, 24);
        break;
      case WEAPON_TYPE_STOP_WATCH:
        dropItems[DropItem.TYPE_STOP_WATCH].draw(272, 24);
        break;
    }
  }

  public void drawFaded(Image image, float x, float y, float alpha) {
    image.setAlpha(alpha);
    image.draw(((int)x) - camera, 64 + (int)y);
    image.setAlpha(1f);
  }

  public void draw(Image image, float x, float y, float angle) {
    image.setRotation(angle);
    image.draw(((int)x) - camera, 64 + (int)y);
    image.setRotation(0);
  }

  public void draw(Image image, float x, float y) {
    image.draw(((int)x) - camera, 64 + (int)y);
  }

  public void render(GameContainer gc, Graphics g) throws SlickException {

    // g.setClip(0, 0, 512, 416);

    int offset = camera & 0x1f;
    int x = camera >> 5;

    for(int i = 0; i < 11; i++) {
      for(int j = 0; j < 17; j++) {
        blocks[map[i][j + x]].draw((j << 5) - offset, (i << 5) + 64);
      }
    }

    Thing[] things = regionThingStack.things;
    for(int j = regionThingStack.top; j >= 0; j--) {
      things[j].render(gc, g);
    }

    things = oldThingStack.things;
    for(int j = oldThingStack.top; j >= 0; j--) {
      things[j].render(gc, g);
    }

    Thing[] weapons = weaponsStack.things;
    for(int j = weaponsStack.top; j >= 0; j--) {
      weapons[j].render(gc, g);
    }

    for(int i = platforms.length - 1; i >= 0; i--) {
      platforms[i].render(gc, g);
    }

    simon.render(gc, g);

    drawStatusBar(g);

    if (fadeState != FADE_DONE) {
      g.setColor(fades[fade]);
      g.fillRect(0, 0, 512, 416);
    }
  }*/
  
  private void drawStatusBar(Graphics g) {

    g.setColor(Color.white);
    g.fillRect(64, 32, 512, 64);

    if (mode == MODE_CREDITS) {
      return;
    }

    drawString("SCORE-", 64, 32);
    drawString("PLAYER", 64, 48);
    drawString("ENEMY", 64, 64);
    drawNumber(score, 6, 160, 32);
    drawString("TIME", 272, 32);
    drawNumber(time, 4, 352, 32);
    drawString("STAGE", 432, 32);
    drawNumber(stage, 2, 528, 32);
    drawString("^-", 400, 48);
    drawString("P-", 400, 64);
    drawNumber(hearts, 2, 432, 48);
    drawNumber(players, 2, 432, 64);

    for(int i = 0; i < playerPower; i++) {
      power[0].draw(176 + (i << 3), 48);
    }
    for(int i = playerPower; i < 16; i++) {
      power[1].draw(176 + (i << 3), 48);
    }
    for(int i = 0; i < enemyPower; i++) {
      power[0].draw(176 + (i << 3), 64);
    }
    for(int i = enemyPower; i < 16; i++) {
      power[1].draw(176 + (i << 3), 64);
    }

    weaponBorder.draw(320, 48);
    if (repeatsFlashing == 0 || ((repeatsFlashing >> 2) & 1) == 0) {
      if (weaponRepeats == WEAPON_REPEATS_DOUBLE) {
        dropItems[DropItem.TYPE_DOUBLE].draw(480, 48);
      } else if (weaponRepeats == WEAPON_REPEATS_TRIPLE) {
        dropItems[DropItem.TYPE_TRIPLE].draw(480, 48);
      }
    }

    switch(weaponType) {
      case WEAPON_TYPE_AXE:
        dropItems[DropItem.TYPE_AXE].draw(336, 56);
        break;
      case WEAPON_TYPE_BOOMERANG:
        dropItems[DropItem.TYPE_BOOMERANG].draw(336, 56);
        break;
      case WEAPON_TYPE_DAGGER:
        dropItems[DropItem.TYPE_DAGGER].draw(336, 56);
        break;
      case WEAPON_TYPE_HOLY_WATER:
        dropItems[DropItem.TYPE_HOLY_WATER].draw(336, 56);
        break;
      case WEAPON_TYPE_STOP_WATCH:
        dropItems[DropItem.TYPE_STOP_WATCH].draw(336, 56);
        break;
    }
  }

  public void drawFaded(Image image, float x, float y, float alpha) {
    image.setAlpha(alpha);
    image.draw(64 + ((int)x) - camera, 96 + (int)y);
    image.setAlpha(1f);
  }

  public void draw(Image image, float x, float y, float angle) {
    image.setRotation((int)angle);
    image.draw(64 + ((int)x) - camera, 96 + (int)y);
    image.setRotation(0);
  }

  public void draw(Image image, float x, float y) {
    image.draw(64 + ((int)x) - camera, 96 + (int)y);
  }

  public void drawLine(Graphics g, float x1, float y1, float x2, float y2) {
    Color color = g.getColor();
    g.setColor(Color.red);
    g.drawLine(x1 - camera + 64, y1 + 96, x2 - camera + 64, y2 + 96);
    g.setColor(color);
  }

  public void render(GameContainer gc, Graphics g) throws SlickException {

    switch(mode) {
      case MODE_TITLE_SCREEN:
        renderTitleScreen(gc, g);
        break;
      case MODE_CONTINUE_SCREEN:
        renderContinueScreen(gc, g);
        break;
      case MODE_INTRO:
        renderIntro(gc, g);
        break;
      case MODE_MAP:
        renderMapScreen(gc, g);
        break;
      case MODE_LOADING:
        renderLoading(gc, g);
        break;
      case MODE_CASTLE_FALLS:
        renderCastleFalls(gc, g);
        break;      
      case MODE_CREDITS:
        if (creditsPresents) {
          renderCredits(gc, g);
          return;
        }
      case MODE_DEMO:
      case MODE_PLAYING:

        g.setColor(Color.white);
        g.fillRect(64, 96, 512, 352);

        int offset = 64 - (camera & 0x1f);
        int x = camera >> 5;

        for(int i = 0; i < 11; i++) {
          for(int j = 0; j < 17; j++) {
            int block = map[i][j + x];
            if (block > 0) {
              blocks[block].draw((j << 5) + offset, 96 + (i << 5));
            }
          }
        }

        Thing[] things = regionThingStack.things;
        for(int j = regionThingStack.top; j >= 0; j--) {
          things[j].render(gc, g);
        }

        things = oldThingStack.things;
        for(int j = oldThingStack.top; j >= 0; j--) {
          things[j].render(gc, g);
        }

        Thing[] weapons = weaponsStack.things;
        for(int j = weaponsStack.top; j >= 0; j--) {
          weapons[j].render(gc, g);
        }

        for(int i = platforms.length - 1; i >= 0; i--) {
          platforms[i].render(gc, g);
        }

        simon.render(gc, g);

        g.setColor(Color.black);
        g.fillRect(0, 96, 64, 352);
        g.fillRect(576, 96, 64, 352);

        drawStatusBar(g);

        break;
    }

    if (mode == MODE_CREDITS) {
      renderCredits(gc, g);
    }

    if (fadeState != FADE_DONE) {
      g.setColor(fades[fade]);
      g.fillRect(64, 32, 512, 416);
    }
  }

  public static void main(String[] args) throws Throwable {

    //System.out.println(System.getProperty("java.io.tmpdir"));

    java.awt.Toolkit.getDefaultToolkit();

    Main main = new Main();
    main.scalableGame = new ScalableGame2(main, 640, 480, true);
    main.appGameContainer = new AppGameContainer(main.scalableGame);
    main.appGameContainer.setDisplayMode(640, 480, false);
    main.appGameContainer.setAlwaysRender(true);
    main.appGameContainer.setVSync(true);
    main.appGameContainer.setSmoothDeltas(false);
    main.appGameContainer.setShowFPS(false);
    main.appGameContainer.setSoundOn(false);
    main.appGameContainer.start();
  }
}
