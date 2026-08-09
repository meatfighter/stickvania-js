import { AL, AppGameContainer, ApplicationGameContainer, BasicGame, BufferUtils, Color, Cursor, CursorLoader, Display, DisplayMode, FastTrig, GameContainer, Graphics, Image, ImageData, Input, JavaRandom, LWJGLException, Log, Music, PackedSpriteSheet, PixelFormat, Renderer, SlickException, Sound, SoundStore, SpriteSheet, Sys, Mouse, ResourceLoader } from "slick2d-ts";
import { cc, chr, idiv, makeArray, make2D, make3D, make4D, readBinaryResource, readResourceLines, toInt, trunc } from "./JavaMath.js";
import { AppletGameContainer2 } from "./AppletGameContainer2.js";
import { Axe } from "./Axe.js";
import { AxeKnight } from "./AxeKnight.js";
import { Bat } from "./Bat.js";
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

export class BatBoss extends Thing {
    public static readonly STATE_RESTING: number = 0;
    public static readonly STATE_HOVERING: number = 1;
    public static readonly STATE_ATTACKING: number = 2;
    public static readonly STATE_DEAD: number = 3;
    private static readonly ATTACK_FRACTION: number = (1.0 / (91 * 2.0));
    public state: number = BatBoss.STATE_RESTING;
    public spriteIndex: number = 0;
    public spriteIndexIncrementor: number = 40;
    public hoveringMoving: number = 0;
    public hoveringPause: number = 0;
    public spawnDelay: number = 0;
    public stunned: number = 0;
    public constructor(main: Main, x: number, y: number) {
    super(main, 96, 48);
    this.x = x;
    this.y = y;

    this.G = 0;
  
    }
    public update(gc: GameContainer): boolean {

    if (this.state == BatBoss.STATE_HOVERING || this.state == BatBoss.STATE_ATTACKING) {

      if (--this.spriteIndexIncrementor == 0) {
        this.spriteIndexIncrementor = 40;
        this.main.playSound(this.main.wing_flaps);
        if (++this.spriteIndex == 3) {
          this.spriteIndex = 1;
        }
      }

      if (this.spawnDelay == 0) {
        this.spawnDelay = 546;
        if (this.main.simon.direction == Main.RIGHT) {
          this.main.pushThing(new Bat(this.main, this.main.camera + 520, this.main.simon.y + 8, Main.LEFT));
          this.main.pushThing(new Bat(this.main, this.main.camera - 40, this.main.random.nextInt(320), Main.RIGHT));
        } else {
          this.main.pushThing(new Bat(this.main, this.main.camera + 520, this.main.random.nextInt(320), Main.LEFT));
          this.main.pushThing(new Bat(this.main, this.main.camera - 40, this.main.simon.y + 8, Main.RIGHT));
        }
      } else {
        this.spawnDelay--;
      }

      if (this.stunned == 0) {
        if (this.main.intersectsWhip(this) || this.main.intersectsWeapon(this)) {
          this.main.pushThing(new Spark(this.main, this));
          this.main.playSound(this.main.boss_hurt);
          this.stunned = 45;

          this.main.enemyPower -= 1;
          if (this.main.enemyPower <= 0) {
            this.main.enemyPower = 0;
            this.main.fireSparks(this.x + 32, this.y + 8);
            this.main.playSound(this.main.boss_killed_1);
            this.main.stopSong();
            this.main.killAll();
            this.main.addPoints(3000);
            this.state = BatBoss.STATE_DEAD;

            this.main.pushThing(new Flame(this.main, this.x, this.y + 32, 0, 0, -0.08, 0, 91));
            this.main.pushThing(new Flame(this.main, this.x + 32, this.y + 32, 0, 0, -0.08, 0, 91));
            this.main.pushThing(new Flame(this.main, this.x + 64, this.y + 32, 0, 0, -0.08, 0, 91));

            this.main.pushThing(new Flame(this.main, this.x, this.y, 0, 0, -0.08, 30, 91));
            this.main.pushThing(new Flame(this.main, this.x + 32, this.y, 0, 0, -0.08, 30, 91));
            this.main.pushThing(new Flame(this.main, this.x + 64, this.y, 0, 0, -0.08, 30, 91));

            this.main.pushThing(new Flame(this.main, this.x, this.y + 16, -2, .5, -0.09, 90, 91));
            this.main.pushThing(new Flame(this.main, this.x + 16, this.y + 16, -1, 1.5, -0.11, 90, 91));
            this.main.pushThing(new Flame(this.main, this.x + 32, this.y + 16, 0.25, 2.5,  -0.13, 90, 91));
            this.main.pushThing(new Flame(this.main, this.x + 48, this.y + 16, 1, 2, -0.12, 90, 91));
            this.main.pushThing(new Flame(this.main, this.x + 64, this.y + 16, 2, 1, -0.1, 90, 91));

            this.main.pushThing(new Flame(this.main, this.x, this.y + 16, -2.5, 0, -0.09, 60, 91));
            this.main.pushThing(new Flame(this.main, this.x + 16, this.y + 16, -1, 0, -0.11, 60, 91));
            this.main.pushThing(new Flame(this.main, this.x + 32, this.y + 16, 0.25, 0,  -0.13, 60, 91));
            this.main.pushThing(new Flame(this.main, this.x + 48, this.y + 16, 1, 0, -0.12, 60, 91));
            this.main.pushThing(new Flame(this.main, this.x + 64, this.y + 16, 2.5, 0, -0.1, 60, 91));

            this.main.pushThing(new Flame(this.main, this.x, this.y + 32, 0, 0, -0.08, 120, 91));
            this.main.pushThing(new Flame(this.main, this.x + 32, this.y + 32, 0, 0, -0.08, 120, 91));
            this.main.pushThing(new Flame(this.main, this.x + 64, this.y + 32, 0, 0, -0.08, 120, 91));

            this.main.pushThing(new Flame(this.main, this.x, this.y, 0, 0, -0.08, 90, 91));
            this.main.pushThing(new Flame(this.main, this.x + 32, this.y, 0, 0, -0.08, 90, 91));
            this.main.pushThing(new Flame(this.main, this.x + 64, this.y, 0, 0, -0.08, 90, 91));

            this.main.pushThing(new Orb(this.main, this.main.simon.xMin + 240, 96, 273));
          }
        }
      } else {
        this.stunned--;
      }

      if (this.main.intersectsSimon(this)) {
        this.main.hurtSimon(2);
      }
    }

    switch(this.state) {
      case BatBoss.STATE_RESTING:
        if (this.main.simon.xMax - this.main.simon.x < 250) {
          this.main.requestSong(this.main.boss_1);
          this.main.killAll();
          this.main.simon.xMin = this.main.simon.xMax - 512;
          this.state = BatBoss.STATE_HOVERING;
          this.spriteIndex = 1;
          this.vx = this.main.random.nextBoolean() ? -1 : 1;
          this.hoveringMoving = this.main.random.nextInt(182) + 91;
        }
        break;
      case BatBoss.STATE_HOVERING:
        if (this.hoveringPause > 0) {
          this.hoveringPause--;
        } else {
          if (!this.moveX(this.vx)) {
            this.vx = -this.vx;
          }
          if (this.y > 0) {
            this.y -= 1;
          } else if (this.y < 0) {
            this.y = 0;
          }
          if (--this.hoveringMoving == 0) {
            this.hoveringPause = this.main.random.nextInt(91) + 91;
            this.hoveringMoving = this.main.random.nextInt(182) + 91;
            this.vx = -this.vx;
            if (this.main.random.nextBoolean()) {
              let targetX: number = this.main.simon.x - 16;
              let targetY: number = this.main.simon.y + 8;
              this.vx = (targetX - this.x) * BatBoss.ATTACK_FRACTION;
              this.vy = (targetY - this.y) * BatBoss.ATTACK_FRACTION;
              this.state = BatBoss.STATE_ATTACKING;
              break;
            }
          } 
        }
        break;
      case BatBoss.STATE_ATTACKING:
        
        this.applyGravity();

        if (this.y < 0) {
          this.y = 0;
        }
        if (!this.moveX(this.vx) || this.supported) {
          this.state = BatBoss.STATE_HOVERING;
          this.vx = this.main.random.nextBoolean() ? -1 : 1;
          this.hoveringPause = 0;
        }
        break;
    }

    return true;
  
    }
    public render(gc: GameContainer, g: Graphics): void {
    if (this.state != BatBoss.STATE_DEAD) {
      this.main.draw(this.main.batBoss[this.spriteIndex], this.x, this.y);
    }
  
    }
}
