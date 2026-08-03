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

export class Dog extends Thing {
    private readonly STATE_RESTING: number = 0;
    private readonly STATE_RUNNING: number = 1;
    private readonly STATE_JUMPING: number = 2;
    private state: number = this.STATE_RESTING;
    private direction: number = Main.LEFT;
    private spriteIndex: number = 1;
    private spriteIndexIncrementor: number = 0;
    public constructor(main: Main, x: number, y: number) {
    super(main, 64, 32);
    this.x = x;
    this.y = y;
  
    }
    public update(gc: GameContainer): boolean {

    if (this.main.intersectsWhip(this) || this.main.intersectsWeapon(this) || this.kill) {
      this.main.pushThing(new Spark(this.main, this));
      this.main.pushThing(new Flame(this.main, this.x, this.y, -1, 0, -0.08, 0, 10));
      this.main.pushThing(new Flame(this.main, this.x + 32, this.y, 1, 0, -0.08, 0, 10));
      this.main.addPoints(200);
      this.main.playSound(this.main.dog_killed);
      return false;
    }

    if (this.main.intersectsSimon(this)) {
      this.main.hurtSimon(2);
    }

    if (this.main.timeFrozen == 0) {
      if (this.state == this.STATE_RESTING) {
        if (Math.abs(this.main.simon.x - this.x) < 128) {
          this.state = this.STATE_RUNNING;
        }
      } else {

        this.applyGravity();

        if (this.state == this.STATE_RUNNING) {
          if (++this.spriteIndexIncrementor == 15) {
            this.spriteIndexIncrementor = 0;
            if (++this.spriteIndex == 4) {
              this.spriteIndex = 1;
            }
          }

          if (this.direction == Main.LEFT) {
            if (!this.main.isSupportive(trunc(this.x), trunc(this.y + 33))) {
              this.vy = Main.SIMON_JUMP_VELOCITY;
              this.state = this.STATE_JUMPING;
            } else if (!this.moveX(-3)) {
              this.direction = Main.RIGHT;
            }
          } else {
            if (!this.main.isSupportive(trunc(this.x + 63), trunc(this.y + 33))) {
              this.vy = Main.SIMON_JUMP_VELOCITY;
              this.state = this.STATE_JUMPING;
            } else if (!this.moveX(3)) {
              this.direction = Main.LEFT;
            }
          }

        } else {

          if (this.supported) {
            this.state = this.STATE_RUNNING;

            if (this.y > this.main.simon.y) {
              if (this.x + 32 > this.main.simon.x) {
                this.direction = Main.LEFT;
              } else {
                this.direction = Main.RIGHT;
              }
            }
          } else {
            if (this.direction == Main.LEFT) {
              this.moveX(-3);
            } else {
              this.moveX(3);
            }
          }
        }
      }
    }

    return true;
  
    }
    public render(gc: GameContainer, g: Graphics): void {
    switch(this.state) {
      case this.STATE_RESTING:
        this.main.draw(this.main.dogs[this.direction][0], this.x, this.y);
        break;
      case this.STATE_RUNNING:
        this.main.draw(this.main.dogs[this.direction][this.spriteIndex], this.x, this.y);
        break;
      case this.STATE_JUMPING:
        this.main.draw(this.main.dogs[this.direction][2], this.x, this.y);
        break;
    }
  
    }
}
