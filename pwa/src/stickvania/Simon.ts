import { AL, AppGameContainer, ApplicationGameContainer, BasicGame, BufferUtils, Color, Cursor, CursorLoader, Display, DisplayMode, FastTrig, GameContainer, Graphics, Image, ImageData, Input, JavaRandom, LWJGLException, Log, Music, PackedSpriteSheet, PixelFormat, Renderer, SlickException, Sound, SoundStore, SpriteSheet, Sys, Mouse, ResourceLoader } from "slick2d-ts";
import { cc, chr, idiv, makeArray, make2D, make3D, make4D, readBinaryResource, readResourceLines, toInt, trunc } from "./JavaMath.js";
import { AppletGameContainer2 } from "./AppletGameContainer2.js";
import { Axe } from "./Axe.js";
import { AxeKnight } from "./AxeKnight.js";
import { Bat } from "./Bat.js";
import { BatBoss } from "./BatBoss.js";
import { BatSpawner } from "./BatSpawner.js";
import { Bird } from "./Bird.js";
import { BirdSpawner } from "./BirdSpawner.js";
import { Bone } from "./Bone.js";
import { BoneDragon } from "./BoneDragon.js";
import { BoneDragonVertebra } from "./BoneDragonVertebra.js";
import { BonePillar } from "./BonePillar.js";
import { Boomerang } from "./Boomerang.js";
import { BoomerangAxe } from "./BoomerangAxe.js";
import { BreakWall } from "./BreakWall.js";
import { BrickFragment } from "./BrickFragment.js";
import { BridgeBat } from "./BridgeBat.js";
import { Candles } from "./Candles.js";
import { Checkpoint } from "./Checkpoint.js";
import { Dagger } from "./Dagger.js";
import { DieBat } from "./DieBat.js";
import { Dog } from "./Dog.js";
import { Door } from "./Door.js";
import { Dracula } from "./Dracula.js";
import { DraculaBat } from "./DraculaBat.js";
import { DropItem } from "./DropItem.js";
import { Droplets } from "./Droplets.js";
import { FadingStairs } from "./FadingStairs.js";
import { Fireball } from "./Fireball.js";
import { Flame } from "./Flame.js";
import { FloatingPoints } from "./FloatingPoints.js";
import { FloorBreaker } from "./FloorBreaker.js";
import { FoodOrb } from "./FoodOrb.js";
import { Frankenstein } from "./Frankenstein.js";
import { Ghost } from "./Ghost.js";
import { GrimReaper } from "./GrimReaper.js";
import { HolyWater } from "./HolyWater.js";
import { Igor } from "./Igor.js";
import { LanceKnight } from "./LanceKnight.js";
import { Main } from "./Main.js";
import { MedusaBoss } from "./MedusaBoss.js";
import { MedusaHead } from "./MedusaHead.js";
import { MedusaHeadSpawner } from "./MedusaHeadSpawner.js";
import { Merman } from "./Merman.js";
import { MermanSpawner } from "./MermanSpawner.js";
import { MovingPlatform } from "./MovingPlatform.js";
import { MummyBoss } from "./MummyBoss.js";
import { Orb } from "./Orb.js";
import { Raven } from "./Raven.js";
import { RedSkeleton } from "./RedSkeleton.js";
import { Region } from "./Region.js";
import { ScalableGame2 } from "./ScalableGame2.js";
import { Secret } from "./Secret.js";
import { ShootingSpark } from "./ShootingSpark.js";
import { Sickle } from "./Sickle.js";
import { SmallHeart } from "./SmallHeart.js";
import { Snakes } from "./Snakes.js";
import { Song } from "./Song.js";
import { Spark } from "./Spark.js";
import { Spikes } from "./Spikes.js";
import { StageSegment } from "./StageSegment.js";
import { StairsEntry } from "./StairsEntry.js";
import { StopWatch } from "./StopWatch.js";
import { SwoopingBat } from "./SwoopingBat.js";
import { Thing } from "./Thing.js";
import { ThingStack } from "./ThingStack.js";
import { Torch } from "./Torch.js";
import { WhiteSkeleton } from "./WhiteSkeleton.js";
import { Wrapping } from "./Wrapping.js";
import { Zombie } from "./Zombie.js";
import { ZombieSpawner } from "./ZombieSpawner.js";

export class Simon extends Thing {
    public static readonly standingWhipTable: number[][][][] = [ [ [ [ 62, 15 ], [ -14, 15 ] ], [ [ 47, 10 ], [ -15, 10 ] ], [ [ -43, 17 ], [ 59, 17 ] ], ], [ [ [ 62, 15 ], [ -14, 15 ] ], [ [ 47, 10 ], [ -15, 10 ] ], [ [ -43, 17 ], [ 59, 17 ] ], ], [ [ [ 62, 15 ], [ -14, 15 ] ], [ [ 47, 10 ], [ -15, 10 ] ], [ [ -75, 17 ], [ 59, 17 ] ], ], ];
    public static readonly kneelingWhipTable: number[][][][] = [ [ [ [ 63, 30 ], [ -15, 30 ] ], [ [ 48, 25 ], [ -16, 25 ] ], [ [ -44, 31 ], [ 59, 31 ] ], ], [ [ [ 63, 30 ], [ -15, 30 ] ], [ [ 48, 25 ], [ -16, 25 ] ], [ [ -44, 31 ], [ 59, 31 ] ], ], [ [ [ 63, 30 ], [ -15, 30 ] ], [ [ 48, 25 ], [ -16, 25 ] ], [ [ -76, 31 ], [ 60, 31 ] ], ], ];
    public static readonly upWhipTable: number[][][][] = [ [ [ [ 62, 13 ], [ -14, 13 ] ], [ [ 46, 9 ], [ -14, 9 ] ], [ [ -42, 13 ], [ 58, 13 ] ], ], [ [ [ 62, 13 ], [ -14, 13 ] ], [ [ 46, 9 ], [ -14, 9 ] ], [ [ -42, 13 ], [ 58, 13 ] ], ], [ [ [ 62, 13 ], [ -14, 13 ] ], [ [ 46, 9 ], [ -14, 9 ] ], [ [ -74, 13 ], [ 58, 13 ] ], ], ];
    public static readonly downWhipTable: number[][][][] = [ [ [ [ 60, 12 ], [ -12, 12 ] ], [ [ 44, 6 ], [ -12, 6 ] ], [ [ -45, 12 ], [ 61, 12 ] ], ], [ [ [ 60, 12 ], [ -12, 12 ] ], [ [ 44, 6 ], [ -12, 6 ] ], [ [ -45, 12 ], [ 61, 12 ] ], ], [ [ [ 60, 12 ], [ -12, 12 ] ], [ [ 44, 6 ], [ -12, 6 ] ], [ [ -77, 12 ], [ 61, 12 ] ], ], ];
    public static readonly walkSpriteIndexes: number[] = [ 0, 1, 2, 1 ];
    public walkSpriteIndexIncrementor: number = 0;
    public walkSpriteIndex: number = 0;
    public direction: number = Main.RIGHT;
    public whipIncrementor: number = 0;
    public whipIndex: number = 0;
    public whipType: number = Main.WHIP_LEATHER;
    public releasedJump: boolean = false;
    public releasedKneel: boolean = false;
    public kneeling: boolean = false;
    public onStairs: boolean = false;
    public rightStairs: boolean = false;
    public up: boolean = false;
    public whipping: boolean = false;
    public throwing: boolean = false;
    public releasedWhip: boolean = false;
    public lastX: number = 0;
    public lastY: number = 0;
    public flashing: number = 0;
    public xMin: number = 0;
    public xMax: number = 0;
    public invincible: number = 0;
    public hurt: boolean = false;
    public dead: number = 0;
    public drankPotion: boolean = false;
    public jumpVelocity: number = Main.SIMON_JUMP_VELOCITY;
    public constructor(main: Main) {
    super(main, 20, 4, 24, 60);
  
    }
    private changeWalkSprite(): void {
    if (++this.walkSpriteIndexIncrementor == 16) {
      this.walkSpriteIndexIncrementor = 0;
      if (++this.walkSpriteIndex == 4) {
        this.walkSpriteIndex = 0;
      }
    }
  
    }
    public kneel(): void {
    this.kneeling = true;
  
    }
    public walkLeft(): void {
    this.kneeling = false;
    this.direction = Main.LEFT;
    this.moveX(-2);
    this.changeWalkSprite();
  
    }
    public walkRight(): void {
    this.kneeling = false;
    this.direction = Main.RIGHT;
    this.moveX(2);
    this.changeWalkSprite();
  
    }
    public stand(): void {
    this.kneeling = false;
    this.walkSpriteIndexIncrementor = 13;
    this.walkSpriteIndex = 0;
  
    }
    public reset(): void {
    this.G = Main.GRAVITY;
    this.jumpVelocity = Main.SIMON_JUMP_VELOCITY;
    this.drankPotion = false;
    this.kneeling = false;
    this.whipping = false;
    this.whipIncrementor = 0;
    this.whipIndex = 0;
    this.walkSpriteIndex = 0;
    this.walkSpriteIndexIncrementor = 0;
    this.invincible = 0;
    this.flashing = 0;
    this.intersected = false;
    this.lastX = this.x;
    this.lastY = this.y;
    this.releasedJump = true;
    this.releasedKneel = true;
    this.releasedWhip = true;
    this.throwing = false;
    this.vx = 0;
    this.vy = 0;
    this.onStairs = false;
    this.direction = Main.RIGHT;
    this.hurt = false;
    this.dead = 0;    
    this.main.playerPower = 16;
    this.main.hearts = 5;
    this.main.enemyPower = 16;
    this.main.timeFrozen = 0;
    this.main.timeIncrementor = 0;
    this.main.visibleWhipCount = 0;
    this.main.repeatsFlashing = 0;
    this.main.floorBreaking = false;
    this.main.continueSelected = true;

    if (this.main.justShowedMap) {
      this.main.justShowedMap = false;
    } else {
      this.whipType = Main.WHIP_LEATHER;
      this.main.weaponRepeats = Main.WEAPON_REPEATS_SINGLE;
      this.main.weaponType = Main.WEAPON_TYPE_NONE;
    }
  
    }
    public update(gc: GameContainer): boolean {

    this.applyGravityWithPlatforms();

    if (this.main.playerPower == 0 && this.supported) {
      if (this.dead == 0) {
        this.main.requestMusic(this.main.simon_killed);
      }
      this.dead++;
      return true;
    }

    if (this.kneeling) {
      this.ry1 = 19;
    } else {
      this.ry1 = 4;
    }

    if (this.hurt) {
      if (this.supported) {
        this.hurt = false;
        if (this.main.playerPower > 0) {
          this.main.setSimonAlpha(0.25);
          this.invincible = 182;
        } else {
          this.dead = 1;
          this.main.requestMusic(this.main.simon_killed);
        }
      } else {
        this.moveX(this.vx);
      }
    }

    return true;
  
    }
    public render(gc: GameContainer, g: Graphics): void {
    if (this.dead > 0) {
      if (this.dead < 30) {
        this.main.draw(this.main.simonKneeling[this.direction], this.x, this.y);
      } else {
        this.main.draw(this.main.simonDead[this.direction], this.x, this.y);
      }
    } else if (this.hurt) {
      this.main.draw(this.main.simonHurt[this.direction], this.x, this.y);
    } else if (this.whipping) {
      if (this.onStairs) {
        if (this.up) {
          if (!this.throwing) {
            let p: number[] = Simon.upWhipTable[this.whipType][this.whipIndex][this.direction];
            this.main.draw(this.main.whips[this.direction][this.whipType][this.whipIndex], this.x + p[0], this.y + p[1]);
          }
          this.main.draw(this.main.simonUpWhipping[this.direction][this.whipIndex], this.x, this.y);
        } else {
          if (!this.throwing) {
            let p: number[] = Simon.downWhipTable[this.whipType][this.whipIndex][this.direction];
            this.main.draw(this.main.whips[this.direction][this.whipType][this.whipIndex], this.x + p[0], this.y + p[1]);
          }
          this.main.draw(this.main.simonDownWhipping[this.direction][this.whipIndex], this.x, this.y);
        }
      } else if (this.kneeling) {
        if (!this.throwing) {
          let p: number[] = Simon.kneelingWhipTable[this.whipType][this.whipIndex][this.direction];
          this.main.draw(this.main.whips[this.direction][this.whipType][this.whipIndex], this.x + p[0], this.y + p[1]);
        }
        this.main.draw(this.main.simonKneelWhipping[this.direction][this.whipIndex], this.x, this.y);
      } else {
        if (!this.throwing) {
          let p: number[] = Simon.standingWhipTable[this.whipType][this.whipIndex][this.direction];
          this.main.draw(this.main.whips[this.direction][this.whipType][this.whipIndex], this.x + p[0], this.y + p[1]);
        }
        this.main.draw(this.main.simonWhipping[this.direction][this.whipIndex], this.x, this.y);
      }
    } else if (this.kneeling) {
      this.main.draw(this.main.simonKneeling[this.direction], this.x, this.y);
    } else {
      if (this.vy < 0) {
        this.main.draw(this.main.simonKneeling[this.direction], this.x, this.y - 14);
      } else if (this.vy > 0) {
        this.main.draw(this.main.simonWalking[this.direction][0], this.x, this.y);
      } else {
        if (this.onStairs) {
          if ((((trunc(this.y) + 8) >> 4) & 1) == 0) {
            if (this.up) {
              this.main.draw(this.main.simonOnStairsUp[this.direction], this.x, this.y);
            } else {
              this.main.draw(this.main.simonOnStairsDown[this.direction], this.x, this.y);
            }
          } else {
            if (this.up) {
              this.main.draw(this.main.simonWalking[this.direction][1], this.x, this.y);
            } else {
              this.main.draw(this.main.simonWalking[this.direction][1], this.x, this.y - 8);
            }
          }
        } else {
          this.main.draw(this.main.simonWalking
              [this.direction][Simon.walkSpriteIndexes[this.walkSpriteIndex]], this.x, this.y);
        }
      }
    }
  
    }
}
