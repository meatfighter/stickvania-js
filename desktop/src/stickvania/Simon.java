package stickvania;

import org.newdawn.slick.*;

public class Simon extends Thing {

  public static final int[][][][] standingWhipTable = {
    { { { 62, 15 }, { -14, 15 } },
      { { 47, 10 }, { -15, 10 } },
      { { -43, 17 }, { 59, 17 } }, },

    { { { 62, 15 }, { -14, 15 } },
      { { 47, 10 }, { -15, 10 } },
      { { -43, 17 }, { 59, 17 } }, },

    { { { 62, 15 }, { -14, 15 } },
      { { 47, 10 }, { -15, 10 } },
      { { -75, 17 }, { 59, 17 } }, },
  };
  public static final int[][][][] kneelingWhipTable = {
    { { { 63, 30 }, { -15, 30 } },
      { { 48, 25 }, { -16, 25 } },
      { { -44, 31 }, { 59, 31 } }, },

    { { { 63, 30 }, { -15, 30 } },
      { { 48, 25 }, { -16, 25 } },
      { { -44, 31 }, { 59, 31 } }, },

    { { { 63, 30 }, { -15, 30 } },
      { { 48, 25 }, { -16, 25 } },
      { { -76, 31 }, { 60, 31 } }, },
  };
  public static final int[][][][] upWhipTable = {
    { { { 62, 13 }, { -14, 13 } },
      { { 46, 9 }, { -14, 9 } },
      { { -42, 13 }, { 58, 13 } }, },

    { { { 62, 13 }, { -14, 13 } },
      { { 46, 9 }, { -14, 9 } },
      { { -42, 13 }, { 58, 13 } }, },

    { { { 62, 13 }, { -14, 13 } },
      { { 46, 9 }, { -14, 9 } },
      { { -74, 13 }, { 58, 13 } }, },
  };
  public static final int[][][][] downWhipTable = {
    { { { 60, 12 }, { -12, 12 } },
      { { 44, 6 }, { -12, 6 } },
      { { -45, 12 }, { 61, 12 } }, },

    { { { 60, 12 }, { -12, 12 } },
      { { 44, 6 }, { -12, 6 } },
      { { -45, 12 }, { 61, 12 } }, },

    { { { 60, 12 }, { -12, 12 } },
      { { 44, 6 }, { -12, 6 } },
      { { -77, 12 }, { 61, 12 } }, },
  };

  public static final int[] walkSpriteIndexes = { 0, 1, 2, 1 };

  public int walkSpriteIndexIncrementor;
  public int walkSpriteIndex;
  public int direction = Main.RIGHT;
  public int whipIncrementor;
  public int whipIndex;
  public int whipType = Main.WHIP_LEATHER;
  public boolean releasedJump;
  public boolean releasedKneel;
  public boolean kneeling;
  public boolean onStairs;
  public boolean rightStairs;
  public boolean up;
  public boolean whipping;
  public boolean throwing;
  public boolean releasedWhip;
  public float lastX;
  public float lastY;
  public int flashing;
  public int xMin;
  public int xMax;
  public int invincible;
  public boolean hurt;
  public int dead;
  public boolean drankPotion;

  public Simon(Main main) {
    super(main, 20, 4, 24, 60);
  }

  private void changeWalkSprite() {
    if (++walkSpriteIndexIncrementor == 16) {
      walkSpriteIndexIncrementor = 0;
      if (++walkSpriteIndex == 4) {
        walkSpriteIndex = 0;
      }
    }
  }

  public void kneel() {
    kneeling = true;
  }

  public void walkLeft() {
    kneeling = false;
    direction = Main.LEFT;
    moveX(-2);
    changeWalkSprite();
  }

  public void walkRight() {
    kneeling = false;
    direction = Main.RIGHT;
    moveX(2);
    changeWalkSprite();
  }

  public void stand() {
    kneeling = false;
    walkSpriteIndexIncrementor = 13;
    walkSpriteIndex = 0;
  }

  public void reset() {
    drankPotion = false;
    kneeling = false;
    whipping = false;
    whipIncrementor = 0;
    whipIndex = 0;
    walkSpriteIndex = 0;
    walkSpriteIndexIncrementor = 0;
    invincible = 0;
    flashing = 0;
    intersected = false;
    lastX = x;
    lastY = y;
    releasedJump = true;
    releasedKneel = true;
    releasedWhip = true;
    throwing = false;
    vx = 0;
    vy = 0;
    onStairs = false;
    direction = Main.RIGHT;
    hurt = false;
    dead = 0;    
    main.playerPower = 16;
    main.hearts = 5;
    main.enemyPower = 16;
    main.timeFrozen = 0;
    main.timeIncrementor = 0;
    main.visibleWhipCount = 0;
    main.repeatsFlashing = 0;
    main.floorBreaking = false;
    main.continueSelected = true;

    if (main.justShowedMap) {
      main.justShowedMap = false;
    } else {
      whipType = Main.WHIP_LEATHER;
      main.weaponRepeats = Main.WEAPON_REPEATS_SINGLE;
      main.weaponType = Main.WEAPON_TYPE_NONE;
    }
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {

    applyGravityWithPlatforms();

    if (main.playerPower == 0 && supported) {
      if (dead == 0) {
        main.requestMusic(main.simon_killed);
      }
      dead++;
      return true;
    }

    if (kneeling) {
      ry1 = 19;
    } else {
      ry1 = 4;
    }

    if (hurt) {
      if (supported) {
        hurt = false;
        if (main.playerPower > 0) {
          main.setSimonAlpha(0.25f);
          invincible = 182;
        } else {
          dead = 1;
          main.requestMusic(main.simon_killed);
        }
      } else {
        moveX(vx);
      }
    }

    return true;
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {
    if (dead > 0) {
      if (dead < 30) {
        main.draw(main.simonKneeling[direction], x, y);
      } else {
        main.draw(main.simonDead[direction], x, y);
      }
    } else if (hurt) {
      main.draw(main.simonHurt[direction], x, y);
    } else if (whipping) {
      if (onStairs) {
        if (up) {
          if (!throwing) {
            int[] p = upWhipTable[whipType][whipIndex][direction];
            main.draw(main.whips[direction][whipType][whipIndex],
                x + p[0], y + p[1]);
          }
          main.draw(main.simonUpWhipping[direction][whipIndex], x, y);
        } else {
          if (!throwing) {
            int[] p = downWhipTable[whipType][whipIndex][direction];
            main.draw(main.whips[direction][whipType][whipIndex],
                x + p[0], y + p[1]);
          }
          main.draw(main.simonDownWhipping[direction][whipIndex], x, y);
        }
      } else if (kneeling) {
        if (!throwing) {
          int[] p = kneelingWhipTable[whipType][whipIndex][direction];
          main.draw(main.whips[direction][whipType][whipIndex],
              x + p[0], y + p[1]);
        }
        main.draw(main.simonKneelWhipping[direction][whipIndex], x, y);
      } else {
        if (!throwing) {
          int[] p = standingWhipTable[whipType][whipIndex][direction];
          main.draw(main.whips[direction][whipType][whipIndex],
              x + p[0], y + p[1]);
        }
        main.draw(main.simonWhipping[direction][whipIndex], x, y);
      }
    } else if (kneeling) {
      main.draw(main.simonKneeling[direction], x, y);
    } else {
      if (vy < 0) {
        main.draw(main.simonKneeling[direction], x, y - 14);
      } else if (vy > 0) {
        main.draw(main.simonWalking[direction][0], x, y);
      } else {
        if (onStairs) {
          if (((((int)y + 8) >> 4) & 1) == 0) {
            if (up) {
              main.draw(main.simonOnStairsUp[direction], x, y);
            } else {
              main.draw(main.simonOnStairsDown[direction], x, y);
            }
          } else {
            if (up) {
              main.draw(main.simonWalking[direction][1], x, y);
            } else {
              main.draw(main.simonWalking[direction][1], x, y - 8);
            }
          }
        } else {
          main.draw(main.simonWalking
              [direction][walkSpriteIndexes[walkSpriteIndex]], x, y);
        }
      }
    }
  }
}
