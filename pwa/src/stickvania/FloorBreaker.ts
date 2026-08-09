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

export class FloorBreaker extends Thing {
    private breakDelay: number = 91;
    private X: number = 159;
    private delay: number = 1;
    public constructor(main: Main) {
    super(main);
  
    }
    private removeBlock(a: number, b: number): void {
    this.main.removeBlock(a, b);
    let x: number = a << 5;
    let y: number = b << 5;
    this.main.pushThing(new BrickFragment(this.main, x, y, -1, -2));
    this.main.pushThing(new BrickFragment(this.main, x + 8, y, 1, -3));
    this.main.pushThing(new BrickFragment(this.main, x, y + 8, -1, -4));
    this.main.pushThing(new BrickFragment(this.main, x + 8 + 8, y, 1, -5));
    this.main.playSound(this.main.breaks_wall);
  
    }
    public update(gc: GameContainer): boolean {

    if (this.breakDelay <= 0) {
      this.breakDelay = 23;
      if (this.main.walls[6][144] != Main.WALL_EMPTY) {
        this.removeBlock(144, 6);
      } else if (this.main.walls[6][145] != Main.WALL_EMPTY) {
        this.removeBlock(145, 6);
      } else if (this.main.walls[7][146] != Main.WALL_EMPTY) {
        this.removeBlock(146, 7);
      } else if (this.main.walls[8][147] != Main.WALL_EMPTY) {
        this.removeBlock(147, 8);
      } else if (this.X != 143) {
        this.removeBlock(this.X, 10);
        this.X--;
      } else if (this.delay > 0) {
        this.delay--;
      } else {
        this.main.floorBreaking = false;
        this.main.fadeState = Main.FADE_OUT;
        this.main.fadeReason = Main.FADE_REASON_SHOW_MAP;
        return false;
      }
    } else {
      this.breakDelay--;
    }

    return true;
  
    }
    public render(gc: GameContainer, g: Graphics): void {
  
    }
}
