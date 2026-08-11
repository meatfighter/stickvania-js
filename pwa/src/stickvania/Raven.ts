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

export class Raven extends Thing {
    private static readonly spriteSequence: number[] = [ 0, 1, 2, 1, 3 ];
    public static readonly STATE_INACTIVE: number = 0;
    public static readonly STATE_HOVERING: number = 1;
    public static readonly STATE_FLYING: number = 2;
    private spriteIndex: number = 4;
    private spriteIndexIncrementor: number = 0;
    private direction: number = 0;
    private state: number = Raven.STATE_INACTIVE;
    private delay: number = 0;
    private targetX: number = 0;
    private applyingGravity: boolean = false;
    public constructor(main: Main, x: number, y: number) {
    super(main, 32, 32);
    this.x = x;
    this.y = y;
  
    }
    private findTarget(): void {
    if (this.main.simon.x + 16 < this.x) {
      this.targetX = this.main.simon.x + 16 - this.main.random.nextInt(96);
    } else {
      this.targetX = this.main.simon.x + 48 + this.main.random.nextInt(96);
    }
    if (this.main.random.nextBoolean()) {
      let targetY: number = this.main.random.nextBoolean()
          ? this.main.simon.y + 8 : this.main.simon.y - 64;
      this.applyingGravity = true;
      let t: number = Math.abs(this.main.simon.x + 16 - this.x);
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
      this.main.pushThing(new Flame(this.main, this.x, this.y, 0, 0, -0.05, 0, 10));
      this.main.addPoints(200);
      this.main.playSound(this.main.raven_killed);
      return false;
    }

    if (this.main.timeFrozen == 0) {

      if (this.main.simon.x + 16 < this.x) {
        this.direction = Main.LEFT;
      } else {
        this.direction = Main.RIGHT;
      }

      if (this.state != Raven.STATE_INACTIVE) {
        if (++this.spriteIndexIncrementor == 15) {
          this.spriteIndexIncrementor = 0;
          if (++this.spriteIndex == 4) {
            this.spriteIndex = 0;
          }
        }
      }

      switch(this.state) {
        case Raven.STATE_INACTIVE:
          if (Math.abs(this.main.simon.x + 16 - this.x) < 192) {
            this.state = Raven.STATE_HOVERING;
            this.delay = this.main.adjustEnemyBehaviorDelay(91 + this.main.random.nextInt(91));
            this.spriteIndex = 0;
          }
          break;
        case Raven.STATE_HOVERING:
          if (--this.delay == 0) {
            this.state = Raven.STATE_FLYING;
            this.findTarget();
          }
          break;
        case Raven.STATE_FLYING:
          if (this.applyingGravity) {
            this.applyGravity();
            if (this.y < 0) {
              this.y = 0;
              this.applyingGravity = false;
            } else if (this.y > 320) {
              this.y = 320;
              this.applyingGravity = false;
            }
          }
          if (Math.abs(this.targetX - this.x) <= 2) {
            this.state = Raven.STATE_HOVERING;
            this.delay = this.main.adjustEnemyBehaviorDelay(91 + this.main.random.nextInt(91));
          } else if (this.targetX < this.x) {
            if (!this.moveX(-1)) {
              this.state = Raven.STATE_HOVERING;
              this.delay = this.main.adjustEnemyBehaviorDelay(91 + this.main.random.nextInt(91));
            }
          } else {
            if (!this.moveX(1)) {
              this.state = Raven.STATE_HOVERING;
              this.delay = this.main.adjustEnemyBehaviorDelay(91 + this.main.random.nextInt(91));
            }
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
    this.main.draw(this.main.ravens[this.direction][Raven.spriteSequence[this.spriteIndex]], this.x, this.y);
  
    }
}
