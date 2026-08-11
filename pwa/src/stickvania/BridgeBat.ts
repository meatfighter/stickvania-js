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
import { Simon } from "./Simon.js";
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

export class BridgeBat extends Thing {
    public static readonly STATE_INACTIVE: number = 0;
    public static readonly STATE_HOVERING: number = 1;
    public static readonly STATE_FLYING: number = 2;
    private state: number = BridgeBat.STATE_INACTIVE;
    private spriteIndex: number = 0;
    private spriteIndexIncrementor: number = 0;
    private targetX: number = 0;
    private applyingGravity: boolean = false;
    private delay: number = 0;
    public constructor(main: Main, x: number, y: number) {
    super(main, 96, 48);
    this.x = x;
    this.y = y;

    this.spriteIndex = 1;
  
    }
    private findTarget(): void {
    if (this.main.simon.x < this.x + 16) {
      this.targetX = this.main.simon.x - 16 - this.main.random.nextInt(96);
    } else {
      this.targetX = this.main.simon.x + 48 + this.main.random.nextInt(96);
    }
    if (this.main.random.nextInt(5) < 3) {
      let targetY: number = this.main.random.nextInt(5) < 3
          ? this.main.simon.y + 8 : this.main.simon.y - 80;
      this.applyingGravity = true;
      let t: number = 2 * Math.abs(this.main.simon.x - this.x - 16);
      let h: number = Math.abs(targetY - this.y);
      this.G = 2 * h / (t * t);
      this.vy = Math.min(4, Math.sqrt(2 * this.G * h));
      if (targetY > this.y) {
        this.G = -this.G;
      } else {
        this.vy = -this.vy;
      }
    } else {
      this.applyingGravity = false;
    }
  
    }
    public update(gc: GameContainer): boolean {

    if (this.main.intersectsWhip(this) || this.main.intersectsWeapon(this) || this.kill) {
      this.main.pushThing(new Spark(this.main, this));
      this.main.pushThing(new Flame(this.main, this.x, this.y, -0.9, 0, -0.06, 0, 10));
      this.main.pushThing(new Flame(this.main, this.x + 32, this.y, 0, 0, -0.09, 0, 10));
      this.main.pushThing(new Flame(this.main, this.x + 64, this.y, 1, 0, -0.08, 0, 10));
      this.main.pushThing(new Flame(this.main, this.x, this.y + 32, 0, 0, 0.05, 0, 10));
      this.main.pushThing(new Flame(this.main, this.x + 32, this.y + 32, 0, 0, 0.08, 0, 10));
      this.main.pushThing(new Flame(this.main, this.x + 64, this.y + 32, 0, 0, 0.065, 0, 10));
      this.main.addPoints(200);
      this.main.playSound(this.main.large_bat_killed);
      return false;
    }

    if (this.main.timeFrozen == 0) {

      if (++this.spriteIndexIncrementor == 40) {
        this.spriteIndexIncrementor = 0;
        if (this.state != BridgeBat.STATE_INACTIVE) {
          this.main.playSound(this.main.wing_flaps);
        }
        if (++this.spriteIndex == 3) {
          this.spriteIndex = 1;
        }
      }

      switch(this.state) {
        case BridgeBat.STATE_INACTIVE:
          if (Math.abs(this.main.simon.x - this.x - 16) < 350) {
            this.state = BridgeBat.STATE_HOVERING;
            this.delay = this.main.adjustEnemyBehaviorDelay(this.main.random.nextInt(43));
            this.spriteIndex = 1;
          }
          break;
        case BridgeBat.STATE_HOVERING:
          if (--this.delay == 0) {
            this.state = BridgeBat.STATE_FLYING;
            this.findTarget();
          }
          break;
        case BridgeBat.STATE_FLYING:
          if (this.applyingGravity) {
            this.y += this.vy;
            this.vy += this.G;
            if (this.y < 0) {
              this.y = 0;
              this.applyingGravity = false;
            } else if (this.y > 303) {
              this.y = 303;
              this.applyingGravity = false;
            }
          }
          if (Math.abs(this.targetX - this.x) <= 4) {
            this.state = BridgeBat.STATE_HOVERING;
            this.delay = this.main.adjustEnemyBehaviorDelay(this.main.random.nextInt(43));
          } else if (this.targetX < this.x) {
            this.x -= 2;
          } else {
            this.x += 2;
          }
          break;
      }
    }

    if (this.main.intersectsSimon(this)) {
      this.main.hurtSimon(2);
    } 

    return true;
  
    }
    public render(gc: GameContainer, g: Graphics): void {
    this.main.draw(this.main.batBoss[this.spriteIndex], this.x, this.y);
  
    }
}
