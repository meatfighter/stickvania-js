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

export class Flame extends Thing {
    private static readonly STATE_HIDDEN: number = 0;
    private static readonly STATE_FLAME_UP: number = 1;
    private static readonly STATE_FLAMING: number = 2;
    private static readonly STATE_FLAME_DOWN: number = 3;
    private g: number = 0;
    private appearanceDelay: number = 0;
    private lifetime: number = 0;
    private state: number = Flame.STATE_HIDDEN;
    private spriteIndex: number = 0;
    private delay: number = 5;
    public constructor(main: Main, x: number, y: number, vx: number, vy: number, g: number, appearanceDelay: number, lifetime: number) {
    super(main, 32, 32);
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.g = g;
    this.appearanceDelay = appearanceDelay;
    this.lifetime = lifetime;

    if (appearanceDelay == 0) {
      this.state = Flame.STATE_FLAME_UP;
    }
  
    }
    public update(gc: GameContainer): boolean {

    if (this.state != Flame.STATE_HIDDEN) {
      this.x += this.vx;
      this.y += this.vy;
      this.vy += this.g;
    }

    switch(this.state) {
      case Flame.STATE_HIDDEN:
        if (--this.appearanceDelay <= 0) {
          this.state = Flame.STATE_FLAME_UP;
          this.spriteIndex = 0;
          this.delay = 5;
        }
        break;
      case Flame.STATE_FLAME_UP:
        if (--this.delay == 0) {
          this.delay = 5;
          this.spriteIndex++;
          if (this.spriteIndex == 3) {
            this.state = Flame.STATE_FLAMING;
            this.delay = 5;
          }
        }
        break;
      case Flame.STATE_FLAMING:
        if (--this.lifetime == 0) {
          this.spriteIndex = 3;
          this.state = Flame.STATE_FLAME_DOWN;
          this.delay = 5;
        } else {
          if (--this.delay == 0) {
            this.spriteIndex = (this.spriteIndex == 3) ? 4 : 3;
            this.delay = 5;
          }
        }
        break;
      case Flame.STATE_FLAME_DOWN:
        if (--this.delay == 0) {
          this.delay = 5;
          this.spriteIndex--;
          if (this.spriteIndex == -1) {
            this.spriteIndex = 0;
            return false;
          }
        }
        break;
    }

    return true;
  
    }
    public render(gc: GameContainer, g: Graphics): void {
    if (this.state != Flame.STATE_HIDDEN) {
      this.main.draw(this.main.fires[this.spriteIndex], this.x, this.y);
    }
  
    }
}
