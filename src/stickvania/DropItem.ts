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

export class DropItem extends Thing {
    public static readonly TYPE_AXE: number = 0;
    public static readonly TYPE_CHEST: number = 1;
    public static readonly TYPE_BOOMERANG: number = 2;
    public static readonly TYPE_CROWN: number = 3;
    public static readonly TYPE_DAGGER: number = 4;
    public static readonly TYPE_DOUBLE: number = 5;
    public static readonly TYPE_HOLY_WATER: number = 6;
    public static readonly TYPE_KILL_ALL: number = 7;
    public static readonly TYPE_LARGE_HEART: number = 8;
    public static readonly TYPE_MEAT: number = 9;
    public static readonly TYPE_MONEY_BAG: number = 10;
    public static readonly TYPE_1UP: number = 11;
    public static readonly TYPE_POTION: number = 12;
    public static readonly TYPE_STOP_WATCH: number = 13;
    public static readonly TYPE_TRIPLE: number = 14;
    public static readonly TYPE_WHIP: number = 15;
    public static readonly FRACTION: number = 1 / 91;
    public type: number = 0;
    public disappears: boolean = true;
    public lifeTime: number = 728;
    public constructor(main: Main, x: number, y: number, type: number) {
    super(main, 32, 32);
    this.x = x;
    this.y = y;
    this.type = type;
  
    }
    public update(gc: GameContainer): boolean {
    this.applyGravity();

    if (this.main.intersectsSimon(trunc(this.x), trunc(this.y), 31 + trunc(this.x), 31 + trunc(this.y))) {

      switch(this.type) {
        case DropItem.TYPE_CHEST:
        case DropItem.TYPE_MONEY_BAG:
        case DropItem.TYPE_CROWN:
          this.main.playSound(this.main.got_money);
          break;
        case DropItem.TYPE_1UP:
          break;
        case DropItem.TYPE_WHIP:
          break;
        case DropItem.TYPE_POTION:
          this.main.playSound(this.main.gain_potion);
          break;
        case DropItem.TYPE_KILL_ALL:
          this.main.playSound(this.main.kill_all_sfx);
          break;
        case DropItem.TYPE_DOUBLE:
        case DropItem.TYPE_TRIPLE:                  
          break;
        case DropItem.TYPE_AXE:
        case DropItem.TYPE_BOOMERANG:
        case DropItem.TYPE_HOLY_WATER:
        case DropItem.TYPE_DAGGER:
        case DropItem.TYPE_STOP_WATCH:
        case DropItem.TYPE_MEAT:
        default:
          this.main.playSound(this.main.got_weapon);
          break;
      }

      switch(this.type) {
        case DropItem.TYPE_AXE:
          this.main.setWeapon(Main.WEAPON_TYPE_AXE);
          break;
        case DropItem.TYPE_CHEST:
          this.main.addPoints(this);
          break;
        case DropItem.TYPE_BOOMERANG:
          this.main.setWeapon(Main.WEAPON_TYPE_BOOMERANG);
          break;
        case DropItem.TYPE_CROWN:
          this.main.addPoints(this);
          break;
        case DropItem.TYPE_DAGGER:
          this.main.setWeapon(Main.WEAPON_TYPE_DAGGER);
          break;
        case DropItem.TYPE_DOUBLE:
          this.main.setWeaponRepeats(Main.WEAPON_REPEATS_DOUBLE);
          break;
        case DropItem.TYPE_HOLY_WATER:
          this.main.setWeapon(Main.WEAPON_TYPE_HOLY_WATER);
          break;
        case DropItem.TYPE_KILL_ALL:
          this.main.fireSparks(this.x, this.y);
          this.main.killAll();
          break;
        case DropItem.TYPE_LARGE_HEART:
          this.main.addHearts(5);
          break;
        case DropItem.TYPE_MEAT:
          this.main.restoreHealth();
          break;
        case DropItem.TYPE_MONEY_BAG:
          this.main.addPoints(this);
          break;
        case DropItem.TYPE_1UP:
          this.main.addPlayers(1);
          break;
        case DropItem.TYPE_POTION:
          this.main.simon.invincible = 728;
          this.main.simon.drankPotion = true;
          break;
        case DropItem.TYPE_STOP_WATCH:
          this.main.setWeapon(Main.WEAPON_TYPE_STOP_WATCH);
          break;
        case DropItem.TYPE_TRIPLE:
          this.main.setWeaponRepeats(Main.WEAPON_REPEATS_TRIPLE);
          break;
        case DropItem.TYPE_WHIP:
          this.main.advanceWhip();
          break;
      }

      return false;
    }

    if (this.disappears && --this.lifeTime == 0) {
      if (this.type == DropItem.TYPE_WHIP) {
        this.main.whipDestroyed();
      }
      return false;
    }

    return true;
  
    }
    public render(gc: GameContainer, g: Graphics): void {
    if (this.lifeTime > 90) {
      this.main.draw(this.main.dropItems[this.type], this.x, this.y);
    } else {
      this.main.drawFaded(this.main.dropItems[this.type], this.x, this.y, this.lifeTime * DropItem.FRACTION);
    }
  
    }
}
