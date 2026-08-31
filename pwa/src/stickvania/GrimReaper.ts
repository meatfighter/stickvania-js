import { FastTrig, GameContainer, Graphics } from "slick2d-ts";
import { Flame } from "./Flame.js";
import { javaFloat, trunc } from "./JavaMath.js";
import { Main } from "./Main.js";
import { Orb } from "./Orb.js";
import { Sickle } from "./Sickle.js";
import { Spark } from "./Spark.js";
import { Thing } from "./Thing.js";

export class GrimReaper extends Thing {
    public static readonly STATE_INACTIVE: number = 0;
    public static readonly STATE_FADE_IN: number = 1;
    public static readonly STATE_DEAD: number = 2;
    public static readonly STATE_THROWING: number = 3;
    public static readonly STATE_FLYING: number = 4;
    public readonly FADE_FRACTION: number = javaFloat(0);
    public dead: boolean = false;
    public direction: number = 0;
    private state: number = GrimReaper.STATE_INACTIVE;
    private fadeIn: number = 0;
    private fadeTime: number = 0;
    private throwDelay: number = 0;
    private sickles: number = 3;
    private throwCount: number = 0;
    private Y: number = javaFloat(0);
    private hoverAngle: number = javaFloat(0);
    private targetX: number = javaFloat(0);
    private flyTime: number = 0;
    private angleInc: number = javaFloat(0);
    private startY: number = javaFloat(0);
    private dy: number = javaFloat(0);
    private angle: number = javaFloat(0);
    private stunned: number = 0;
    private power: number = 32;
    private shouldMove: boolean = false;
    public constructor(main: Main, x: number, y: number) {
        x = javaFloat(x);
        y = javaFloat(y);
        super(main, 80, 96);

        y = javaFloat(y - 8);
        this.x = javaFloat(x);
        this.y = javaFloat(-97);

        this.G = javaFloat(0.05);

        let t: number = javaFloat(Math.sqrt(javaFloat(javaFloat(2 * javaFloat(y - this.y)) / this.G)));
        this.fadeTime = trunc(t);
        this.FADE_FRACTION = javaFloat(1 / t);
        this.vy = javaFloat(this.G * t);
    }

    public sickleGone(): void {
        this.sickles++;
    }

    public override update(gc: GameContainer): boolean {
        this.direction = javaFloat(javaFloat(this.main.simon!.x - this.x) - 8) < 0 ? Main.LEFT : Main.RIGHT;

        if (this.state == GrimReaper.STATE_THROWING || this.state == GrimReaper.STATE_FLYING) {
            if (this.stunned <= 0) {
                if (this.main.intersectsWhip(this) || this.main.intersectsWeapon(this)) {
                    this.main.pushThing(new Spark(this.main, this));
                    this.stunned = 45;
                    this.main.playSound(this.main.boss_hurt);
                    this.shouldMove = true;
                    this.power--;
                    this.main.enemyPower = this.power >> 1;
                    if (this.power <= 0) {
                        this.main.fireSparks(javaFloat(this.x + 24), javaFloat(this.y + 32));
                        this.main.killAll();
                        this.main.playRumble("bossFinalHit");
                        this.main.playSound(this.main.boss_killed_1);
                        this.main.stopSong();
                        this.main.addPoints(7000);
                        this.state = GrimReaper.STATE_DEAD;
                        this.main.pushThing(new Orb(this.main, this.main.simon!.xMin + 240, 96, 546));
                        for (let i: number = 0; i < 4; i++) {
                            for (let j: number = 0; j < 3; j++) {
                                if ((i == 0 && j == 0) || (i == 0 && j == 2) || (i == 3 && j == 0) || (i == 3 && j == 2)) {
                                    continue;
                                }
                                this.main.pushThing(
                                    new Flame(
                                        this.main,
                                        javaFloat(javaFloat(this.x + (j << 5)) - 16),
                                        javaFloat(javaFloat(this.y + (i << 5)) + 16),
                                        0,
                                        0,
                                        -0.0004,
                                        0,
                                        455
                                    )
                                );
                            }
                        }
                        for (let i: number = 0; i < 4; i++) {
                            for (let j: number = 0; j < 3; j++) {
                                if ((i == 0 && j == 0) || (i == 0 && j == 2) || (i == 3 && j == 0) || (i == 3 && j == 2)) {
                                    continue;
                                }
                                this.main.pushThing(new Flame(this.main, javaFloat(this.x + (j << 5)), javaFloat(this.y + (i << 5)), 0, 0, -0.0002, 0, 455));
                                for (let k: number = 0; k < 5; k++) {
                                    this.main.pushThing(
                                        new Flame(
                                            this.main,
                                            javaFloat(javaFloat(this.x + 8) + this.main.random.nextInt(64)),
                                            javaFloat(this.y + this.main.random.nextInt(64)),
                                            javaFloat(javaFloat(this.main.random.nextFloat() * 4) - 2),
                                            -1,
                                            0.08,
                                            ((j << 2) + i) * 45 + (k << 2),
                                            35
                                        )
                                    );
                                }
                            }
                        }
                    } else if (this.main.enemyPower == 0) {
                        this.main.enemyPower = 1;
                    }
                }
            } else {
                this.stunned--;
            }

            if (this.main.intersectsSimon(this)) {
                this.main.hurtSimon(2);
            }
        }

        switch (this.state) {
            case GrimReaper.STATE_INACTIVE:
                if (javaFloat(this.main.simon!.x - this.main.simon!.xMin) < 220) {
                    this.main.killAll();
                    this.main.requestSong(this.main.boss_1);
                    this.main.simon!.xMax = 512;
                    this.state = GrimReaper.STATE_FADE_IN;
                }
                break;
            case GrimReaper.STATE_FADE_IN:
                this.y = javaFloat(this.y + this.vy);
                this.vy = javaFloat(this.vy - this.G);
                if (++this.fadeIn == this.fadeTime) {
                    this.state = GrimReaper.STATE_THROWING;
                    this.fadeIn = this.fadeTime;
                }
                this.Y = javaFloat(this.y);
                break;
            case GrimReaper.STATE_THROWING:
                this.y = javaFloat(this.Y + javaFloat(8 * javaFloat(FastTrig.sin(this.hoverAngle))));
                this.hoverAngle = javaFloat(this.hoverAngle + 0.02);
                if (--this.throwDelay <= 0) {
                    this.throwDelay = ++this.throwCount == 3 ? 182 : 23;
                    if (this.throwCount >= 3) {
                        this.throwCount = 0;
                        if (this.shouldMove || this.main.random.nextInt(3) == 1) {
                            this.shouldMove = false;
                            this.state = GrimReaper.STATE_FLYING;
                            if (this.main.random.nextBoolean()) {
                                this.targetX = javaFloat(this.main.simon!.x - 160);
                            } else {
                                this.targetX = javaFloat(this.main.simon!.x + 128);
                            }
                            if (this.targetX < 64) {
                                this.targetX = javaFloat(64);
                            } else if (this.targetX > 367) {
                                this.targetX = javaFloat(367);
                            }
                            this.flyTime = trunc(Math.abs(javaFloat(this.targetX - this.x)));

                            let targetY: number = javaFloat(this.main.simon!.y - 40);
                            this.angleInc = javaFloat((0.5 * Math.PI) / this.flyTime);
                            this.startY = javaFloat(this.y);
                            this.dy = javaFloat(targetY - this.y);
                            this.angle = javaFloat(0);
                        }
                    }
                    if (this.sickles > 0) {
                        this.sickles--;
                        this.main.pushThing(
                            new Sickle(this.main, javaFloat(this.x + 24), javaFloat(this.y + (this.main.random.nextInt(3) << 5)), this.direction, this)
                        );
                    }
                }
                break;
            case GrimReaper.STATE_FLYING:
                if (--this.flyTime > 0) {
                    if (this.targetX < this.x) {
                        this.x = javaFloat(this.x - 1);
                    } else {
                        this.x = javaFloat(this.x + 1);
                    }
                    this.angle = javaFloat(this.angle + this.angleInc);
                    this.y = javaFloat(this.startY + javaFloat(this.dy * javaFloat(FastTrig.sin(this.angle))));
                } else {
                    this.state = GrimReaper.STATE_THROWING;
                    this.throwDelay = 0;
                    this.hoverAngle = javaFloat(0);
                    this.Y = javaFloat(this.y);
                }
                break;
        }

        return true;
    }

    public override render(gc: GameContainer, g: Graphics): void {
        if (this.state != GrimReaper.STATE_DEAD) {
            if (this.fadeIn >= this.fadeTime) {
                this.main.draw(this.main.grimReaperBoss[this.direction], this.x, this.y);
            } else {
                this.main.drawFaded(this.main.grimReaperBoss[this.direction], this.x, this.y, javaFloat(this.fadeIn * this.FADE_FRACTION));
            }
        }
    }
}
