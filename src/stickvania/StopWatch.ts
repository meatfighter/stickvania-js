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
import { SwoopingBat } from "./SwoopingBat.js";
import { Thing } from "./Thing.js";
import { ThingStack } from "./ThingStack.js";
import { Torch } from "./Torch.js";
import { WhiteSkeleton } from "./WhiteSkeleton.js";
import { Wrapping } from "./Wrapping.js";
import { Zombie } from "./Zombie.js";
import { ZombieSpawner } from "./ZombieSpawner.js";

export class StopWatch extends Thing {
    public static readonly FRACTION: number = 1 / 91;
    public static readonly ANGLE1: number = (2 * Math.PI / 3);
    public static readonly ANGLE2: number = (4 * Math.PI / 3);
    public lifeTime: number = 455;
    private angle: number = 0;
    private sx0: number = 0;
    private sy0: number = 0;
    private sx1: number = 0;
    private sy1: number = 0;
    private sx2: number = 0;
    private sy2: number = 0;
    private soundDelay: number = 0;
    public constructor(main: Main) {
    super(main, 0, -10000, 32, 32);
    main.timeFrozen += 455;
  
    }
    public update(gc: GameContainer): boolean {

    if (this.lifeTime > 0) {
      this.lifeTime--;
      this.main.timeFrozen--;
    } else {
      return false;
    }

    if (this.soundDelay > 0) {
      this.soundDelay--;
    } else {
      this.soundDelay = 68;
      this.main.playSound(this.main.watch_tick);
    }

    this.x = this.main.simon.x + 16;
    this.y = this.main.simon.y - 48;

    this.angle += 0.05;
    this.sx0 = this.x + 16 * FastTrig.cos(this.angle);
    this.sy0 = this.y + 16 * FastTrig.sin(this.angle);
    this.sx1 = this.x + 16 * FastTrig.cos(this.angle + StopWatch.ANGLE1);
    this.sy1 = this.y + 16 * FastTrig.sin(this.angle + StopWatch.ANGLE1);
    this.sx2 = this.x + 16 * FastTrig.cos(this.angle + StopWatch.ANGLE2);
    this.sy2 = this.y + 16 * FastTrig.sin(this.angle + StopWatch.ANGLE2);  

    return true;
  
    }
    public render(gc: GameContainer, g: Graphics): void {
    if (this.lifeTime > 90) {
      this.main.draw(this.main.dropItems[DropItem.TYPE_STOP_WATCH], this.x, this.y);
      this.main.draw(this.main.spark, this.sx0, this.sy0);
      this.main.draw(this.main.spark, this.sx1, this.sy1);
      this.main.draw(this.main.spark, this.sx2, this.sy2);
    } else {
      let fade: number = this.lifeTime * StopWatch.FRACTION;
      this.main.drawFaded(this.main.dropItems[DropItem.TYPE_STOP_WATCH], this.x, this.y, fade);
      this.main.drawFaded(this.main.spark, this.sx0, this.sy0, fade);
      this.main.drawFaded(this.main.spark, this.sx1, this.sy1, fade);
      this.main.drawFaded(this.main.spark, this.sx2, this.sy2, fade);
    }
  
    }
}
