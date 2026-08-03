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

export class GrimReaper extends Thing {
    public static readonly STATE_INACTIVE: number = 0;
    public static readonly STATE_FADE_IN: number = 1;
    public static readonly STATE_DEAD: number = 2;
    public static readonly STATE_THROWING: number = 3;
    public static readonly STATE_FLYING: number = 4;
    public readonly FADE_FRACTION: number = 0;
    public dead: boolean = false;
    public direction: number = 0;
    private state: number = GrimReaper.STATE_INACTIVE;
    private fadeIn: number = 0;
    private fadeTime: number = 0;
    private throwDelay: number = 0;
    private sickles: number = 3;
    private throwCount: number = 0;
    private Y: number = 0;
    private hoverAngle: number = 0;
    private targetX: number = 0;
    private flyTime: number = 0;
    private angleInc: number = 0;
    private startY: number = 0;
    private dy: number = 0;
    private angle: number = 0;
    private stunned: number = 0;
    private power: number = 32;
    private shouldMove: boolean = false;
    public constructor(main: Main, x: number, y: number) {
    super(main, 80, 96);

    y -= 8;
    this.x = x;
    this.y = -97;

    this.G = 0.05;

    let t: number = Math.sqrt(2 * (y - this.y) / this.G);
    this.fadeTime = trunc(t);
    this.FADE_FRACTION = 1 / t;
    this.vy = this.G * t;
  
    }
    public sickleGone(): void {
    this.sickles++;
  
    }
    public update(gc: GameContainer): boolean {

    this.direction = this.main.simon.x - this.x - 8 < 0 ? Main.LEFT : Main.RIGHT;

    if (this.state == GrimReaper.STATE_THROWING || this.state == GrimReaper.STATE_FLYING) {
      if (this.stunned <= 0) {
        if (this.main.intersectsWhip(this) || this.main.intersectsWeapon(this)) {
          this.main.pushThing(new Spark(this.main, this));
          this.stunned = 45;
          this.main.playSound(this.main.boss_hurt);
          this.shouldMove = true;
          this.power--;
          this.main.enemyPower = this.power >> 1;
          if (this.power <= 0) {
            this.main.fireSparks(this.x + 24, this.y + 32);
            this.main.killAll();
            this.main.playSound(this.main.boss_killed_1);
            this.main.stopSong();      
            this.main.addPoints(7000);
            this.state = GrimReaper.STATE_DEAD;
            this.main.pushThing(new Orb(this.main, this.main.simon.xMin + 240, 96, 546));
            for (let i: number = 0; i < 4; i++) {
              for (let j: number = 0; j < 3; j++) {
                if ((i == 0 && j == 0) || (i == 0 && j == 2)
                    || (i == 3 && j == 0) || (i == 3 && j == 2)) {
                  continue;
                }
                this.main.pushThing(new Flame(this.main, this.x + (j << 5) - 16, this.y + (i << 5) + 16, 0, 0, -0.0004, 0, 455));
              }
            }
            for (let i: number = 0; i < 4; i++) {
              for (let j: number = 0; j < 3; j++) {
                if ((i == 0 && j == 0) || (i == 0 && j == 2)
                    || (i == 3 && j == 0) || (i == 3 && j == 2)) {
                  continue;
                }
                this.main.pushThing(new Flame(this.main, this.x + (j << 5), this.y + (i << 5), 0, 0, -0.0002, 0, 455));
                for (let k: number = 0; k < 5; k++) {
                  this.main.pushThing(new Flame(this.main, this.x + 8 + this.main.random.nextInt(64), this.y + this.main.random.nextInt(64), this.main.random.nextFloat() * 4 - 2, -1, 0.08, ((j << 2) + i) * 45 + (k << 2), 35));
                }
              }
            }
          } else if (this.main.enemyPower == 0) {
            this.main.enemyPower = 1;
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
      case GrimReaper.STATE_INACTIVE:
        if (this.main.simon.x - this.main.simon.xMin < 220) {
          this.main.killAll();
          this.main.requestSong(this.main.boss_1);
          this.main.simon.xMax = 512;
          this.state = GrimReaper.STATE_FADE_IN;
        }
        break;
      case GrimReaper.STATE_FADE_IN:
        this.y += this.vy;
        this.vy -= this.G;
        if (++this.fadeIn == this.fadeTime) {
          this.state = GrimReaper.STATE_THROWING;
          this.fadeIn = this.fadeTime;
        }
        this.Y = this.y;
        break;
      case GrimReaper.STATE_THROWING:
        this.y = this.Y + 8 * FastTrig.sin(this.hoverAngle);
        this.hoverAngle += 0.02;
        if (--this.throwDelay <= 0) {
          this.throwDelay = ++this.throwCount == 3 ? 182 : 23;
          if (this.throwCount >= 3) {
            this.throwCount = 0;
            if (this.shouldMove || this.main.random.nextInt(3) == 1) {
              this.shouldMove = false;
              this.state = GrimReaper.STATE_FLYING;
              if (this.main.random.nextBoolean()) {
                this.targetX = this.main.simon.x - 160;
              } else {
                this.targetX = this.main.simon.x + 128;
              }
              if (this.targetX < 64) {
                this.targetX = 64;
              } else if (this.targetX > 367) {
                this.targetX = 367;
              }
              this.flyTime = trunc(Math.abs(this.targetX - this.x));

              let targetY: number = this.main.simon.y - 40;
              this.angleInc = (0.5 * Math.PI / this.flyTime);
              this.startY = this.y;
              this.dy = targetY - this.y;
              this.angle = 0;
            }
          }
          if (this.sickles > 0) {
            this.sickles--;
            this.main.pushThing(new Sickle(this.main, this.x + 24, this.y + (this.main.random.nextInt(3) << 5), this.direction, this));
          }
        }
        break;
      case GrimReaper.STATE_FLYING:
        if (--this.flyTime > 0) {
          if (this.targetX < this.x) {
            this.x -= 1;
          } else {
            this.x += 1;
          }
          this.angle += this.angleInc;
          this.y = this.startY + this.dy * FastTrig.sin(this.angle);
        } else {
          this.state = GrimReaper.STATE_THROWING;
          this.throwDelay = 0;
          this.hoverAngle = 0;
          this.Y = this.y;
        }
        break;
    }

    return true;
  
    }
    public render(gc: GameContainer, g: Graphics): void {
    if (this.state != GrimReaper.STATE_DEAD) {
      if (this.fadeIn >= this.fadeTime) {
        this.main.draw(this.main.grimReaperBoss[this.direction], this.x, this.y);
      } else {
        this.main.drawFaded(this.main.grimReaperBoss[this.direction], this.x, this.y, this.fadeIn * this.FADE_FRACTION);
      }
    }
  
    }
}
