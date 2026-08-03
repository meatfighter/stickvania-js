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

export class MummyBoss extends Thing {
    private static readonly walkingPattern: number[] = [ 0, 1, 2, 1 ];
    private static readonly STATE_RESTING: number = 0;
    private static readonly STATE_STANDING: number = 1;
    private static readonly STATE_WALKING: number = 2;
    private static readonly STATE_DEAD: number = 3;
    private direction: number = 0;
    private originalDirection: number = 0;
    private spriteIndex: number = 0;
    private spriteIndexIncrementor: number = 0;
    private state: number = MummyBoss.STATE_RESTING;
    private delay: number = 0;
    private shootDelay: number = 0;
    private targetX: number = 0;
    private stunned: number = 0;
    private hits: number = 16;
    public constructor(main: Main, x: number, y: number, direction: number) {
    super(main, 32, 80);
    this.x = x;
    this.y = y;
    this.originalDirection = this.direction = direction;
    this.shootDelay = 91 + main.random.nextInt(91);
  
    }
    private findTarget(): void {
    if (this.originalDirection == Main.RIGHT) {
      this.targetX = this.main.simon.x + 16 - this.main.random.nextInt(192);
    } else {
      this.targetX = this.main.simon.x + 16 + this.main.random.nextInt(192);
    }
  
    }
    public moveX(dx: number): boolean {
    let target: number = this.x + dx;
    if (target < this.main.simon.xMin) {
      this.x = this.main.simon.xMin;
      return false;
    } else if (target > this.main.simon.xMax) {
      this.x = this.main.simon.xMax;
      return false;
    }
    this.x = target;
    return true;
  
    }
    public update(gc: GameContainer): boolean {

    if (this.state == MummyBoss.STATE_STANDING || this.state == MummyBoss.STATE_WALKING) {
      if (this.main.intersectsSimon(this)) {
        this.main.hurtSimon(2);
        this.kill = true;
      }
      
      if (--this.shootDelay <= 0) {
        this.shootDelay = 91 + this.main.random.nextInt(364);
        if (this.main.simon.x + 16 < this.x) {
          this.main.pushThing(new Wrapping(this.main, this.x, this.y + 24, Main.LEFT));
        } else {
          this.main.pushThing(new Wrapping(this.main, this.x, this.y + 24, Main.RIGHT));
        }
      }

      if (this.stunned == 0) {
        if (this.main.intersectsWhip(this) || this.main.intersectsWeapon(this)) {
          this.main.pushThing(new Spark(this.main, this));
          this.main.playSound(this.main.boss_hurt);
          this.stunned = 45;
          this.hits--;
          if ((this.hits & 1) == 0) {
            this.main.enemyPower--;
            if (this.main.enemyPower <= 0) {
              this.main.enemyPower = 0;
              this.main.fireSparks(this.x, this.y + 24);              
              this.main.stopSong();
              this.main.killAll();
              this.main.addPoints(3000);
              this.main.pushThing(new Orb(this.main, this.main.simon.xMin + 240, 96, 273));

              this.main.pushThing(new Flame(this.main, this.x - 16, this.y + 42, -2, .5, -0.09, 90, 91));
              this.main.pushThing(new Flame(this.main, this.x - 8, this.y + 42, -1, 1.5, -0.11, 90, 91));
              this.main.pushThing(new Flame(this.main, this.x, this.y + 42, 0.25, 2.5,  -0.13, 90, 91));
              this.main.pushThing(new Flame(this.main, this.x + 8, this.y + 42, 1, 2, -0.12, 90, 91));
              this.main.pushThing(new Flame(this.main, this.x + 16, this.y + 42, 2, 1, -0.1, 90, 91));

              this.main.pushThing(new Flame(this.main, this.x - 16, this.y + 24, -2.5, 0, -0.09, 60, 91));
              this.main.pushThing(new Flame(this.main, this.x - 8, this.y + 16, -1, 0, -0.11, 60, 91));
              this.main.pushThing(new Flame(this.main, this.x, this.y + 24, 0.25, 0,  -0.13, 60, 91));
              this.main.pushThing(new Flame(this.main, this.x + 8, this.y + 16, 1, 0, -0.12, 60, 91));
              this.main.pushThing(new Flame(this.main, this.x + 16, this.y + 24, 2.5, 0, -0.1, 60, 91));
            }
          }
          if (this.hits == 0) {
            this.state = MummyBoss.STATE_DEAD;

            this.main.playSound(this.main.boss_killed_3);

            this.main.pushThing(new Flame(this.main, this.x - 16, this.y + 42, 0, 0, -0.09, 0, 91));
            this.main.pushThing(new Flame(this.main, this.x, this.y + 42, 0, 0, -0.08, 0, 91));
            this.main.pushThing(new Flame(this.main, this.x + 16, this.y + 42, 0, 0, -0.1, 0, 91));

            this.main.pushThing(new Flame(this.main, this.x - 16, this.y, 0, 0, -0.06, 30, 91));
            this.main.pushThing(new Flame(this.main, this.x, this.y, 0, 0, -0.08, 30, 91));
            this.main.pushThing(new Flame(this.main, this.x + 16, this.y, 0, 0, -0.09, 30, 91));

            this.main.pushThing(new Flame(this.main, this.x - 16, this.y + 32, 0, 0, -0.1, 15, 91));
            this.main.pushThing(new Flame(this.main, this.x, this.y + 32, 0, 0, -0.06, 15, 91));
            this.main.pushThing(new Flame(this.main, this.x + 16, this.y + 32, 0, 0, -0.09, 15, 91));

            this.main.pushThing(new Flame(this.main, this.x - 32, this.y, 0, 0, 0.03, 50, 91));
            this.main.pushThing(new Flame(this.main, this.x, this.y, 0, 0, 0.05, 50, 91));
            this.main.pushThing(new Flame(this.main, this.x + 32, this.y, 0, 0, 0.01, 50, 91));
          }
        }
      } else {
        this.stunned--;
      }
    }

    switch(this.state) {
      case MummyBoss.STATE_RESTING:
        if (this.main.simon.xMax - this.main.simon.x < 250) {
          this.main.killAll();
          this.main.requestSong(this.main.boss_1);
          this.main.simon.xMin = this.main.simon.xMax - 512;
          this.state = MummyBoss.STATE_WALKING;
          this.delay = 91 + this.main.random.nextInt(364);
          this.findTarget();
        }
        break;
      case MummyBoss.STATE_WALKING:
        if (++this.spriteIndexIncrementor == 35) {
          this.spriteIndexIncrementor = 0;
          if (++this.spriteIndex == 4) {
            this.spriteIndex = 0;
          }
        }
        if (--this.delay <= 0) {
          this.state = MummyBoss.STATE_STANDING;
          this.delay = 43 + this.main.random.nextInt(91);
          this.spriteIndexIncrementor = 0;
          this.spriteIndex = 0;
        }
        if (Math.abs(this.targetX - this.x) <= 2) {
          this.findTarget();
        } else if (this.targetX < this.x) {
          this.direction = Main.LEFT;
          if (!this.moveX(-1)) {
            this.targetX = this.x + this.main.random.nextInt(192);
          }
        } else {
          this.direction = Main.RIGHT;
          if (!this.moveX(1)) {
            this.targetX = this.x - this.main.random.nextInt(192);
          }
        }
        break;
      case MummyBoss.STATE_STANDING:
        if (--this.delay <= 0) {
          this.state = MummyBoss.STATE_WALKING;
          this.delay = 91 + this.main.random.nextInt(364);
          this.findTarget();
        }
        break;
    }

    return true;
  
    }
    public render(gc: GameContainer, g: Graphics): void {
    if (this.state != MummyBoss.STATE_DEAD) {
      this.main.draw(this.main.mummyBoss[this.direction][MummyBoss.walkingPattern[this.spriteIndex]], this.x, this.y);
    }
  
    }
}
