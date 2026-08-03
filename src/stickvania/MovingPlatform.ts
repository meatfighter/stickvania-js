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

export class MovingPlatform extends Thing {
    public static readonly STATE_RIGHT_ACCELERATING: number = 0;
    public static readonly STATE_RIGHT_CONSTANT: number = 1;
    public static readonly STATE_LEFT_ACCELERATING: number = 2;
    public static readonly STATE_LEFT_CONSTANT: number = 3;
    public static readonly ACCELERATION_DISTANCE: number = 16;
    public static readonly ACCELERATION_TIME: number = 45;
    public static readonly VELOCITY: number = 1;
    public static readonly A: number = 2 * MovingPlatform.ACCELERATION_DISTANCE / (MovingPlatform.ACCELERATION_TIME * MovingPlatform.ACCELERATION_TIME);
    public state: number = MovingPlatform.STATE_RIGHT_ACCELERATING;
    public x1: number = 0;
    public x2: number = 0;
    public constructor(main: Main, x1: number, x2: number, y: number) {
    super(main, 64, 16);
    this.x = x1;
    this.y = y;
    this.x1 = x1;
    this.x2 = x2;
  
    }
    public update(gc: GameContainer): boolean {

    this.x += this.vx;

    switch(this.state) {
      case MovingPlatform.STATE_RIGHT_ACCELERATING:
        this.vx += MovingPlatform.A;
        if (this.vx >= MovingPlatform.VELOCITY) {
          this.vx = MovingPlatform.VELOCITY;
          this.state = MovingPlatform.STATE_RIGHT_CONSTANT;
        }
        break;
      case MovingPlatform.STATE_RIGHT_CONSTANT:
        if (this.x >= this.x2 - 2 * MovingPlatform.ACCELERATION_DISTANCE) {
          this.state = MovingPlatform.STATE_LEFT_ACCELERATING;
        }
        break;
      case MovingPlatform.STATE_LEFT_ACCELERATING:
        this.vx -= MovingPlatform.A;
        if (this.vx <= -MovingPlatform.VELOCITY) {
          this.vx = -MovingPlatform.VELOCITY;
          this.state = MovingPlatform.STATE_LEFT_CONSTANT;
        }
        break;
      case MovingPlatform.STATE_LEFT_CONSTANT:
        if (this.x <= this.x1 + 2 * MovingPlatform.ACCELERATION_DISTANCE) {
          this.state = MovingPlatform.STATE_RIGHT_ACCELERATING;
        }
        break;
    }

    return true;
  
    }
    public render(gc: GameContainer, g: Graphics): void {
    this.main.draw(this.main.platform, this.x, this.y);
  
    }
}
