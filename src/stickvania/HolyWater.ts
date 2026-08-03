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

export class HolyWater extends Thing {
    public static readonly STATE_DROPPING: number = 0;
    public static readonly STATE_FIRE: number = 1;
    public direction: number = 0;
    public state: number = 0;
    public cycle: number = 0;
    public spriteIndex: number = 0;
    public delay: number = 0;
    public constructor(main: Main, x: number, y: number, direction: number) {
    super(main, 32, 27);
    this.x = x;
    this.y = y;
    this.vx = direction == Main.RIGHT ? 3 : -3;
    this.vy = -1.5;
    this.direction = direction;
    this.state = HolyWater.STATE_DROPPING;
    main.playSound(main.threw_dagger);
  
    }
    public update(gc: GameContainer): boolean {
    if (this.state == HolyWater.STATE_DROPPING) {
      this.applyGravity();      
      if (this.supported || !this.moveX(this.vx) || this.intersected) {
        this.y -= 5;
        this.rx1 = 0;
        this.ry1 = 0;
        this.rx2 = 31;
        this.ry2 = 31;
        this.state = HolyWater.STATE_FIRE;
        this.main.playSound(this.main.used_holy_water);
      }
    } else {
      if (++this.delay == 15) {
        this.delay = 0;
        this.spriteIndex++;
        if (this.spriteIndex == 5) {
          this.spriteIndex = 0;
          this.cycle++;
          if (this.cycle == 2) {
            return false;
          }
        }
      }
    }

    if (this.x < this.main.camera - 96 || this.x > this.main.camera + 576 || this.y > 352) {
      return false;
    }
    
    return true;
  
    }
    public render(gc: GameContainer, g: Graphics): void {
    if (this.state == HolyWater.STATE_DROPPING) {
      this.main.draw(this.main.holyWaters[this.direction], this.x, this.y);
    } else {
      this.main.draw(this.main.fires[this.spriteIndex], this.x, this.y);
    }
  
    }
}
