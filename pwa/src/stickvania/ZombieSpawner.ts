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
import { StopWatch } from "./StopWatch.js";
import { SwoopingBat } from "./SwoopingBat.js";
import { Thing } from "./Thing.js";
import { ThingStack } from "./ThingStack.js";
import { Torch } from "./Torch.js";
import { WhiteSkeleton } from "./WhiteSkeleton.js";
import { Wrapping } from "./Wrapping.js";
import { Zombie } from "./Zombie.js";

export class ZombieSpawner extends Thing {
    private static readonly BASE_ACTIVE_CAP: number = 3;
    private count: number = ZombieSpawner.BASE_ACTIVE_CAP;
    private activeCap: number = ZombieSpawner.BASE_ACTIVE_CAP;
    private delay: number = 0;
    private x1: number = 0;
    private x2: number = 0;
    public constructor(main: Main, x1: number, x2: number, y: number) {
    super(main);
    this.y = y;
    this.x1 = x1;
    this.x2 = x2;
  
    }
    public zombieDied(): void {
    this.syncActiveCap();
    if (this.count < this.activeCap) {
      this.count++;
    }
  
    }
    public update(gc: GameContainer): boolean {

    this.syncActiveCap();

    if (this.main.timeFrozen > 0) {
      return true;
    }

    if (this.main.simon.x < this.x1 || this.main.simon.x > this.x2) {
      return true;
    }

    if (this.delay == 0) {
      this.delay = this.main.adjustEnemySpawnDelay(273);

      for (let i: number = 0; i < 16 && this.count > 0; i++) {
        if (this.main.random.nextBoolean()) {
          let target: number = this.main.camera + 514 + ((this.count - 1) << 6);
          if (target >= this.x1 && target <= this.x2) {
            this.count--;
            this.main.pushThing(new Zombie(this.main, target, this.y, Main.LEFT, this));
          }
        } else {
          let target: number = this.main.camera - 66 - ((this.count - 1) << 6);
          if (target >= this.x1 && target <= this.x2) {
            this.count--;
            this.main.pushThing(new Zombie(this.main, target, this.y, Main.RIGHT, this));
          }
        }
      }
    } else {
      this.delay--;
    }

    return true;
  
    }
    public render(gc: GameContainer, g: Graphics): void {
  
    }
    private syncActiveCap(): void {
    if (!Number.isFinite(this.activeCap)) {
      this.activeCap = ZombieSpawner.BASE_ACTIVE_CAP;
    }
    if (!Number.isFinite(this.count)) {
      this.count = this.activeCap;
    }
    let activeCap: number = this.main.adjustEnemyActiveCap(ZombieSpawner.BASE_ACTIVE_CAP);
    if (activeCap == this.activeCap) {
      return;
    }
    this.count += activeCap - this.activeCap;
    if (this.count < 0) {
      this.count = 0;
    } else if (this.count > activeCap) {
      this.count = activeCap;
    }
    this.activeCap = activeCap;

    }
}
