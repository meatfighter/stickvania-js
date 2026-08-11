import { AL, AppGameContainer, ApplicationGameContainer, BasicGame, BufferUtils, Color, Cursor, CursorLoader, Display, DisplayMode, FastTrig, GameContainer, Graphics, Image, ImageData, Input, JavaRandom, LWJGLException, Log, Music, PackedSpriteSheet, PixelFormat, Renderer, SlickException, Sound, SoundStore, SpriteSheet, Sys, Mouse, ResourceLoader } from "slick2d-ts";
import { cc, chr, idiv, makeArray, make2D, make3D, make4D, readBinaryResource, readResourceLines, toInt, trunc } from "./JavaMath.js";
import { AppletGameContainer2 } from "./AppletGameContainer2.js";
import { Axe } from "./Axe.js";
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

export class AxeKnight extends Thing {
    private static readonly STATE_INACTIVE: number = 0;
    private static readonly STATE_WALKING: number = 1;
    private static readonly STATE_STANDING: number = 2;
    public hits: number = 3;
    public stunned: number = 0;
    private direction: number = 0;
    private displayDirection: number = 0;
    private spriteIndex: number = 0;
    private spriteIndexIncrementor: number = 0;
    private standingDelay: number = 0;
    private state: number = AxeKnight.STATE_INACTIVE;
    private walkedDistance: number = 0;
    private throwDelay: number = 0;
    private hasAxe: boolean = true;
    public dead: boolean = false;
    public constructor(main: Main, x: number, y: number) {
    super(main, 48, 64);
    this.x = x;
    this.y = y;

    this.hits = main.adjustEnemyHits(this.hits);
    this.throwDelay = main.adjustEnemyCooldown(main.random.nextInt(273));
  
    }
    public axeGone(): void {
    this.hasAxe = true;
    this.throwDelay = this.main.adjustEnemyCooldown(this.main.random.nextInt(273));
  
    }
    public update(gc: GameContainer): boolean {

    if (this.kill) {
      this.hits = 0;
      this.stunned = 0;
    }

    if (this.stunned > 0) {
      this.stunned--;
    } else if (this.main.intersectsWhip(this)
        || this.main.intersectsWeapon(this) || this.kill) {
      this.main.pushThing(new Spark(this.main, this));
      if (--this.hits <= 0) {
        if (this.main.random.nextBoolean()) {
          this.main.pushThing(this.main.createCandleItem(trunc(this.x), trunc(this.y), cc("h")));
        }
        this.main.pushThing(new Flame(this.main, this.x, this.y + 24, 0, 0, -0.08, 0, 10));
        this.main.pushThing(new Flame(this.main, this.x + 16, this.y + 32, 0, 0, -0.08, 0, 10));
        this.main.addPoints(500);
        this.main.playSound(this.main.killed_4);
        this.dead = true;
        return false;
      } else {
        this.main.playSound(this.main.stunned);
        this.stunned = 45;
      }
    }

    if (this.main.intersectsSimon(this)) {
      this.main.hurtSimon(2);
    }

    if (this.main.timeFrozen == 0) {

      if (this.main.simon.x + 8 < this.x) {
        this.displayDirection = Main.LEFT;
      } else {
        this.displayDirection = Main.RIGHT;
      }

      this.applyGravity();

      if (this.state != AxeKnight.STATE_INACTIVE && this.hasAxe) {
        if (this.throwDelay <= 0) {
          this.throwDelay = this.main.adjustEnemyCooldown(this.main.random.nextInt(273));
          this.main.pushThing(new BoomerangAxe(this.main, this.x + 8, this.main.random.nextBoolean() ? this.y : this.y + 32, this.displayDirection, this));
          this.hasAxe = false;
        } else {
          this.throwDelay--;
        }
      }

      switch(this.state) {
        case AxeKnight.STATE_INACTIVE:
          if (this.x >= this.main.camera - 96 && this.x <= this.main.camera + 576) {
            this.state = AxeKnight.STATE_WALKING;
          }
          break;
        case AxeKnight.STATE_WALKING:
          if (this.direction == Main.LEFT) {
            if (!this.moveX(-.5) || !this.main.isSupportive(trunc(this.x), trunc(this.y + 64))) {
              this.direction = Main.RIGHT;
            }
          } else {
            if (!this.moveX(.5)
                || !this.main.isSupportive(trunc(this.x + 47), trunc(this.y + 64))) {
              this.direction = Main.LEFT;
            }
          }

          if (++this.spriteIndexIncrementor == 20) {
            this.spriteIndexIncrementor = 0;
            if (++this.spriteIndex == 2) {
              this.spriteIndex = 0;
            }
          }

          if (++this.walkedDistance >= 96) {
            this.walkedDistance = this.main.random.nextInt(43);
            this.state = AxeKnight.STATE_STANDING;
          }
          break;
        case AxeKnight.STATE_STANDING:
          if (++this.standingDelay == 43) {
            this.standingDelay = this.main.random.nextInt(43);
            this.state = AxeKnight.STATE_WALKING;
            let distance: number = this.main.simon.x + 8 - this.x;
            let aDist: number = Math.abs(distance);
            if (aDist < 128) {
              if (distance < 0) {
                this.direction = Main.RIGHT;
              } else {
                this.direction = Main.LEFT;
              }
            } else if (aDist > 256) {
              if (distance < 0) {
                this.direction = Main.LEFT;
              } else {
                this.direction = Main.RIGHT;
              }
            }
          }
          break;
      }
    }

    return true;
  
    }
    public render(gc: GameContainer, g: Graphics): void {
    this.main.draw(this.main.axeKnights[this.displayDirection][this.spriteIndex], this.x, this.y);
  
    }
}
