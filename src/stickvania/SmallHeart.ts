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

export class SmallHeart extends Thing {
    public static readonly FRACTION: number = 1 / 91;
    public X: number = 0;
    public angle: number = 0;
    public lifeTime: number = 728;
    public constructor(main: Main, x: number, y: number) {
    super(main, 16, 16);

    this.x = this.X = x;
    this.y = y;
  
    }
    public update(gc: GameContainer): boolean {

    if (this.main.intersectsSimon(trunc(this.x), trunc(this.y), 15 + trunc(this.x), 15 + trunc(this.y))) {
      this.main.addHearts(1);
      this.main.playSound(this.main.bleep);
      return false;
    }

    this.supported = false;

    let targetY: number = this.y + 0.5;

    let y1: number = trunc(this.y + this.ry2);
    let y2: number = trunc(targetY + this.ry2);

    let x1: number = trunc(this.x + this.rx1);
    let x2: number = trunc(this.x + this.rx2);

    for (let i: number = y1; i <= y2; i++) {
      for (let j: number = x1; j <= x2; j += 4) {
        if (this.main.isEmpty(j, i) && this.main.isSupportive(j, i + 1)) {
          this.y = i - this.ry2;
          this.vy = 0;
          this.supported = true;

          if (--this.lifeTime == 0) {
            return false;
          }

          return true;
        }
      }
    }

    this.y = targetY;

    let targetX: number = this.X + 32 * FastTrig.sin(this.angle);
    if (this.moveX(targetX - this.x)) {
      this.angle += 0.03;
    }

    return true;
  
    }
    public render(gc: GameContainer, g: Graphics): void {
    if (this.lifeTime > 90) {
      this.main.draw(this.main.smallHeart, this.x, this.y);
    } else {
      this.main.drawFaded(this.main.smallHeart, this.x, this.y, this.lifeTime * SmallHeart.FRACTION);
    }
  
    }
}
