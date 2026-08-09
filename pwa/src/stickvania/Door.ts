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

export class Door extends Thing {
    public static readonly STATE_CLOSED: number = 0;
    public static readonly STATE_SCROLL_1: number = 1;
    public static readonly STATE_DIAGONAL_1: number = 2;
    public static readonly STATE_OPEN: number = 3;
    public static readonly STATE_WALKING: number = 4;
    public static readonly STATE_DIAGONAL_2: number = 5;
    public static readonly STATE_SCROLL_2: number = 6;
    public state: number = Door.STATE_CLOSED;
    public direction: number = 0;
    public doorScroll1: number = 0;
    public doorScroll2: number = 0;
    public doorDelay: number = 0;
    public active: boolean = false;
    public constructor(main: Main, x: number, y: number, direction: number, active: boolean) {
    super(main, 16, 96);

    this.x = x;
    this.y = y;
    this.direction = direction;
    this.active = active;
  
    }
    public update(gc: GameContainer): boolean {

    if (!this.active) {
      return true;
    }

    if (this.direction == Main.RIGHT) {
      switch(this.state) {
        case Door.STATE_CLOSED:
          if (this.main.simon.supported
              && (trunc(this.main.simon.y)) - 32 == trunc(this.y)
              && (trunc(Math.abs(this.main.simon.x - this.x + 24))) <= 32
              && !this.main.simon.hurt && this.main.playerPower > 0) {
            this.main.enterNextRegion(this);
          }
          break;
        case Door.STATE_SCROLL_1:
          this.main.camera += 2;
          if (this.main.camera >= this.doorScroll1) {
            this.state = Door.STATE_DIAGONAL_1;
            this.doorDelay = 10;
            this.main.playSound(this.main.door_opens_1);
          }
          break;
        case Door.STATE_DIAGONAL_1:
          if (--this.doorDelay == 0) {
            this.state = Door.STATE_OPEN;
            this.doorDelay = 70;
          }
          break;
        case Door.STATE_OPEN:
          this.main.simon.walkRight();
          if (--this.doorDelay == 0) {
            this.state = Door.STATE_DIAGONAL_2;
            this.doorDelay = 10;
          }
          break;
        case Door.STATE_DIAGONAL_2:
          if (--this.doorDelay == 0) {
            this.state = Door.STATE_SCROLL_2;
          }
          break;
        case Door.STATE_SCROLL_2:
          this.main.camera += 2;
          if (this.main.camera >= this.doorScroll2) {
            this.state = Door.STATE_CLOSED;
            this.main.door = null;
            this.main.oldThingStack.clear();
            this.main.simon.xMin = this.main.camera;
          }
          break;
      }
    } else {
      switch(this.state) {
        case Door.STATE_CLOSED:
          if (this.main.simon.supported
              && (trunc(this.main.simon.y)) - 32 == trunc(this.y)
              && (trunc(Math.abs(this.main.simon.x - this.x + 24))) <= 32
              && !this.main.simon.hurt && this.main.playerPower > 0) {
            this.main.enterNextRegion(this);
          }
          break;
        case Door.STATE_SCROLL_1:
          this.main.camera -= 2;
          if (this.main.camera <= this.doorScroll1) {
            this.state = Door.STATE_DIAGONAL_1;
            this.doorDelay = 10;
            this.main.playSound(this.main.door_opens_2);
          }
          break;
        case Door.STATE_DIAGONAL_1:
          if (--this.doorDelay == 0) {
            this.state = Door.STATE_OPEN;
            this.doorDelay = 70;
          }
          break;
        case Door.STATE_OPEN:
          this.main.simon.walkLeft();
          if (--this.doorDelay == 0) {
            this.state = Door.STATE_DIAGONAL_2;
            this.doorDelay = 10;
          }
          break;
        case Door.STATE_DIAGONAL_2:
          if (--this.doorDelay == 0) {
            this.state = Door.STATE_SCROLL_2;
          }
          break;
        case Door.STATE_SCROLL_2:
          this.main.camera -= 2;
          if (this.main.camera <= this.doorScroll2) {
            this.state = Door.STATE_CLOSED;
            this.main.door = null;
            this.main.oldThingStack.clear();
            this.main.moveCamera();
          }
          break;
      }
    }
    return true;
  
    }
    public render(gc: GameContainer, g: Graphics): void {
    if (this.direction == Main.RIGHT) {
      if (this.state == Door.STATE_OPEN) {
        this.main.draw(this.main.doors[Main.RIGHT][2], this.x, this.y);
      } else if (this.state == Door.STATE_DIAGONAL_1 || this.state == Door.STATE_DIAGONAL_2) {
        this.main.draw(this.main.doors[Main.RIGHT][1], this.x, this.y);
      } else {
        this.main.draw(this.main.doors[Main.RIGHT][0], this.x, this.y);
      }
    } else {
      if (this.state == Door.STATE_OPEN) {
        this.main.draw(this.main.doors[Main.LEFT][2], this.x - 32, this.y);
      } else if (this.state == Door.STATE_DIAGONAL_1 || this.state == Door.STATE_DIAGONAL_2) {
        this.main.draw(this.main.doors[Main.LEFT][1], this.x - 16, this.y);
      } else {
        this.main.draw(this.main.doors[Main.LEFT][0], this.x, this.y);
      }
    }
  
    }
}
