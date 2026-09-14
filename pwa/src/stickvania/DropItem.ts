import { GameContainer, Graphics } from "slick2d-ts";
import { javaFloat, trunc } from "./JavaMath.js";
import { Main } from "./Main.js";
import { Thing } from "./Thing.js";

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
    public static readonly FRACTION: number = javaFloat(1 / 91);
    public type: number = 0;
    public disappears: boolean = true;
    public lifeTime: number = 728;
    public constructor(main: Main, x: number, y: number, type: number) {
        super(main, 32, 32);
        this.x = javaFloat(x);
        this.y = javaFloat(y);
        this.type =
            main.weaponType == Main.WEAPON_TYPE_STOP_WATCH && (type == DropItem.TYPE_DOUBLE || type == DropItem.TYPE_TRIPLE)
                ? DropItem.TYPE_LARGE_HEART
                : type;
    }

    public override update(gc: GameContainer): boolean {
        const wasSupported: boolean = this.supported;
        this.applyGravity();
        if (!wasSupported && this.supported) {
            this.main.playRumble("itemLand");
        }

        if (this.main.intersectsSimon(trunc(this.x), trunc(this.y), 31 + trunc(this.x), 31 + trunc(this.y))) {
            if (this.isMajorRumbleItem()) {
                this.main.playRumble("majorItemCollect");
            }
            switch (this.type) {
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

            switch (this.type) {
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
                    this.collectRepeatUpgrade(Main.WEAPON_REPEATS_DOUBLE);
                    break;
                case DropItem.TYPE_HOLY_WATER:
                    this.main.setWeapon(Main.WEAPON_TYPE_HOLY_WATER);
                    break;
                case DropItem.TYPE_KILL_ALL:
                    this.main.playRumble("rosary");
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
                    this.main.playRumble("invincibilityPotion");
                    this.main.simon!.invincible = 728;
                    this.main.simon!.drankPotion = true;
                    break;
                case DropItem.TYPE_STOP_WATCH:
                    this.main.setWeapon(Main.WEAPON_TYPE_STOP_WATCH);
                    break;
                case DropItem.TYPE_TRIPLE:
                    this.collectRepeatUpgrade(Main.WEAPON_REPEATS_TRIPLE);
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

    private collectRepeatUpgrade(weaponRepeats: number): void {
        if (this.main.weaponType == Main.WEAPON_TYPE_STOP_WATCH) {
            // This repeat item existed before StopWatch was equipped. Consume it
            // normally and preserve pickup feedback, but never expose repeat state
            // that has no useful StopWatch meaning.
            this.main.playSound(this.main.got_double);
            return;
        }
        this.main.setWeaponRepeats(weaponRepeats);
    }

    private isMajorRumbleItem(): boolean {
        switch (this.type) {
            case DropItem.TYPE_AXE:
            case DropItem.TYPE_BOOMERANG:
            case DropItem.TYPE_DAGGER:
            case DropItem.TYPE_DOUBLE:
            case DropItem.TYPE_HOLY_WATER:
            case DropItem.TYPE_MEAT:
            case DropItem.TYPE_1UP:
            case DropItem.TYPE_STOP_WATCH:
            case DropItem.TYPE_TRIPLE:
                return true;
            default:
                return false;
        }
    }

    public override render(gc: GameContainer, g: Graphics): void {
        if (this.lifeTime > 90) {
            this.main.draw(this.main.dropItems[this.type], this.x, this.y);
        } else {
            this.main.drawFaded(this.main.dropItems[this.type], this.x, this.y, javaFloat(this.lifeTime * DropItem.FRACTION));
        }
    }
}
