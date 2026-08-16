import { FastTrig, GameContainer, Graphics } from "slick2d-ts";
import { BoneDragonVertebra } from "./BoneDragonVertebra.js";
import { Fireball } from "./Fireball.js";
import { Flame } from "./Flame.js";
import { makeArray, trunc } from "./JavaMath.js";
import { Main } from "./Main.js";
import { Spark } from "./Spark.js";
import { Thing } from "./Thing.js";

export class BoneDragon extends Thing {
    private readonly A0: number = 0;
    private readonly A1: number = 0;
    private readonly A2: number = 0;
    private static readonly A3: number = 1 / (Math.PI / 3);
    private static readonly A4: number = 360 / (2 * Math.PI);
    private static readonly dAngle2: number = 0.01;
    private static readonly dAngle3: number = 0.03;
    private static readonly dAngle4: number = 0.04;
    private vertebrae: BoneDragonVertebra[] = makeArray<BoneDragonVertebra>(6, () => null);
    private active: boolean = false;
    private radius: number = 32;
    private item: number = 0;
    private angle: number = 0;
    private angle2: number = Math.PI;
    private angle3: number = Math.PI;
    private angle4: number = 0;
    private X: number = 0;
    private Y: number = 0;
    private tx: number = 0;
    private ty: number = 0;
    private shootDelay: number = 0;
    private mouthOpen: number = 0;
    public hits: number = 5;
    public stunned: number = 0;
    public dead: boolean = false;
    private minIndex: number = 0;
    private deadDelay: number = 23;
    public constructor(main: Main, x: number, y: number, item: number, avoidFloor: boolean) {
        super(main, 32, 32);
        this.x = x;
        this.y = y;
        this.item = item;
        this.hits = main.adjustEnemyHits(this.hits);

        this.X = x + 32;
        this.Y = y;

        for (let i: number = 0; i < this.vertebrae.length; i++) {
            this.vertebrae[i] = new BoneDragonVertebra(main, x + 16, y);
        }

        if (avoidFloor) {
            this.A0 = Math.PI / 12;
            this.A1 = Math.PI + Math.PI / 8;
            this.A2 = Math.PI / 14;
        } else {
            this.A0 = Math.PI / 6;
            this.A1 = Math.PI;
            this.A2 = Math.PI / 7;
        }
    }

    public update(gc: GameContainer): boolean {
        if (this.dead) {
            if (--this.deadDelay == 0) {
                let vertebra: BoneDragonVertebra = this.vertebrae[this.minIndex];
                this.deadDelay = 23;
                this.main.pushThing(this.main.createCandleItem(trunc(vertebra.x - 8), trunc(vertebra.y), this.item));
                this.main.pushThing(new Flame(this.main, vertebra.x - 8, vertebra.y, 0, 0, -0.05, 0, 10));
                this.main.playSound(this.main.snuffed);
                if (++this.minIndex == 6) {
                    return false;
                }
            }
            return true;
        }

        if (this.kill) {
            this.hits = 0;
            this.stunned = 0;
        }

        if (this.stunned > 0) {
            this.stunned--;
        } else if (this.main.intersectsWhip(this) || this.main.intersectsWeapon(this) || this.kill) {
            this.main.pushThing(new Spark(this.main, this));
            if (--this.hits <= 0) {
                this.dead = true;
                this.main.pushThing(this.main.createCandleItem(trunc(this.x), trunc(this.y), this.item));
                this.main.pushThing(new Flame(this.main, this.x, this.y, 0, 0, -0.05, 0, 10));
                this.main.addPoints(1000);
                this.main.playSound(this.main.crumble_sfx);
                return true;
            } else {
                this.stunned = 45;
                this.main.playSound(this.main.stunned);
            }
        }

        if (this.main.intersectsSimon(this)) {
            this.main.hurtSimon(2);
        }

        if (this.main.timeFrozen == 0) {
            if (this.active) {
                if (this.mouthOpen > 0) {
                    this.mouthOpen--;
                }

                if (this.radius < 128) {
                    this.radius += 1;
                } else if (this.shootDelay == 0) {
                    this.shootDelay = this.main.adjustEnemyCooldown(91 + this.main.random.nextInt(273));
                    this.mouthOpen = 46;
                    this.main.pushThing(new Fireball(this.main, this.x + 8, this.y + 8, -1.5, 0));
                    this.main.playSound(this.main.fire_ball_shot);
                } else {
                    this.shootDelay--;
                }

                this.angle = this.A1 + this.A0 * FastTrig.sin(this.angle2) + this.A2 * FastTrig.sin(this.angle3);
                this.angle2 += BoneDragon.dAngle2;
                this.angle3 += BoneDragon.dAngle3;

                let angle5: number = this.angle + this.angle4;
                this.angle4 += BoneDragon.dAngle4;

                let cos: number = FastTrig.cos(this.angle);
                let sin: number = FastTrig.sin(this.angle);
                let rInc: number = this.radius * 0.125;
                let r: number = rInc;
                this.tx = this.X + this.radius * cos;
                this.ty = this.Y + this.radius * sin;

                this.moveX(this.tx - this.x);
                this.moveY(this.ty - this.y);

                let ux: number = cos;
                let uy: number = sin;
                let vx: number = -uy;
                let vy: number = ux;
                let offset: number = 12 * FastTrig.sin(angle5);

                let ang: number = BoneDragon.A4 * this.angle;

                for (let i: number = 5; i >= 0; i--, r += rInc) {
                    let vertebra: BoneDragonVertebra = this.vertebrae[i];

                    if (this.main.intersectsSimon(vertebra)) {
                        this.main.hurtSimon(2);
                    }

                    vertebra.angle = ang;

                    let u: number = r;
                    let v: number = 12 * FastTrig.sin(angle5) - offset;
                    angle5 += BoneDragon.A3;

                    vertebra.tx = this.X + u * ux + v * vx;
                    vertebra.ty = this.Y + u * uy + v * vy;

                    vertebra.moveX(vertebra.tx - vertebra.x);
                    vertebra.moveY(vertebra.ty - vertebra.y);
                }
            } else if (Math.abs(this.main.simon.x - this.x) < 256) {
                this.active = true;
            }
        }

        return true;
    }

    public render(gc: GameContainer, g: Graphics): void {
        if (!this.dead) {
            this.main.draw(this.mouthOpen > 0 ? this.main.boneDragons[1] : this.main.boneDragons[0], this.x, this.y);
        }
        for (let i: number = 5; i >= this.minIndex; i--) {
            this.vertebrae[i].render(gc, g);
        }
    }
}
