import { GameContainer, Graphics } from "slick2d-ts";
import { Flame } from "./Flame.js";
import { Igor } from "./Igor.js";
import { Main } from "./Main.js";
import { Orb } from "./Orb.js";
import { Spark } from "./Spark.js";
import { Thing } from "./Thing.js";

export class Frankenstein extends Thing {
    public static readonly IGOR_JUMP_VELOCITY: number = -Math.sqrt(384 * 0.21);
    public static readonly FLY_TIME: number = (2 * Math.abs(Frankenstein.IGOR_JUMP_VELOCITY)) / 0.21;
    public static readonly DYING_FADE: number = 1 / 455;
    public static readonly STATE_INACTIVE: number = 0;
    public static readonly STATE_WALKING: number = 1;
    public static readonly STATE_PAUSED: number = 2;
    public static readonly STATE_DEAD: number = 3;
    private state: number = Frankenstein.STATE_INACTIVE;
    private direction: number = Main.LEFT;
    private spriteIndex: number = 0;
    private spriteIndexIncrementor: number = 0;
    private walkSteps: number = 0;
    private maxWalkSteps: number = 0;
    private paused: number = 0;
    private stunned: number = 0;
    private throwDelay: number = 0;
    private deadCount: number = 0;
    public constructor(main: Main, x: number, y: number) {
        super(main, 32, 96);
        this.x = x;
        this.y = y;
        this.maxWalkSteps = main.random.nextInt(91) + 91;
    }

    public update(gc: GameContainer): boolean {
        if (this.state == Frankenstein.STATE_WALKING || this.state == Frankenstein.STATE_PAUSED) {
            this.direction = this.main.simon.x + 16 < this.x ? Main.LEFT : Main.RIGHT;

            if (this.main.intersectsSimon(this)) {
                this.main.hurtSimon(2);
            }

            if (this.stunned == 0) {
                if (this.main.intersectsWhip(this) || this.main.intersectsWeapon(this)) {
                    this.main.pushThing(new Spark(this.main, this));
                    this.stunned = 45;
                    this.main.playSound(this.main.boss_hurt);

                    if (--this.main.enemyPower <= 0) {
                        this.main.enemyPower = 0;
                        this.state = Frankenstein.STATE_DEAD;
                        this.main.fireSparks(this.x, this.y + 32);
                        this.main.killAll();
                        this.main.playSound(this.main.boss_killed_1);
                        this.main.stopSong();
                        this.main.addPoints(5000);
                    }
                }
            } else {
                this.stunned--;
            }
        }

        switch (this.state) {
            case Frankenstein.STATE_INACTIVE:
                if (this.main.simon.xMax - this.main.simon.x < 250) {
                    this.main.killAll();
                    this.main.requestSong(this.main.boss_2);
                    this.main.simon.xMin = this.main.simon.xMax - 512;
                    this.state = Frankenstein.STATE_WALKING;
                }
                break;
            case Frankenstein.STATE_WALKING:
                if (this.throwDelay > 0) {
                    this.throwDelay--;
                } else {
                    this.throwDelay = this.main.random.nextInt(273) + 91;
                    let igor: Igor = new Igor(this.main, this.x, this.y - 32);
                    igor.vx = (this.main.simon.x + 16 - this.x) / Frankenstein.FLY_TIME;
                    if (igor.vx < 0) {
                        igor.direction = Main.LEFT;
                    } else {
                        igor.direction = Main.RIGHT;
                    }
                    igor.vy = Frankenstein.IGOR_JUMP_VELOCITY;
                    this.main.pushThing(igor);
                }
                if (this.walkSteps++ == 0) {
                    if (this.direction == Main.LEFT) {
                        let targetX: number = this.main.simon.x + 48 + this.main.random.nextInt(128);
                        if (targetX > this.main.simon.xMax - 32) {
                            targetX = this.main.simon.xMax - 32;
                        }
                        this.vx = (targetX - this.x) / this.maxWalkSteps;
                    } else {
                        let targetX: number = this.main.simon.x - 16 - this.main.random.nextInt(128);
                        if (targetX < this.main.simon.xMin) {
                            targetX = this.main.simon.xMin;
                        }
                        this.vx = (targetX - this.x) / this.maxWalkSteps;
                    }
                } else if (this.walkSteps == this.maxWalkSteps) {
                    this.paused = 1 + this.main.random.nextInt(91);
                    this.state = Frankenstein.STATE_PAUSED;
                } else {
                    this.x += this.vx;
                    if (++this.spriteIndexIncrementor == 20) {
                        this.spriteIndexIncrementor = 0;
                        if (++this.spriteIndex == 3) {
                            this.spriteIndex = 0;
                        }
                    }
                }
                break;
            case Frankenstein.STATE_PAUSED:
                if (--this.paused == 0) {
                    this.state = Frankenstein.STATE_WALKING;
                    this.walkSteps = 0;
                    this.maxWalkSteps = this.main.random.nextInt(91) + 91;
                }
                break;
            case Frankenstein.STATE_DEAD:
                if (this.deadCount < 455) {
                    if ((this.deadCount & 7) == 0) {
                        this.main.pushThing(
                            new Flame(
                                this.main,
                                this.x,
                                this.y + this.main.random.nextInt(80),
                                this.main.random.nextFloat() * 2 - 1,
                                this.main.random.nextFloat() * 2 - 1,
                                this.main.random.nextFloat() * 0.1 - 0.05,
                                90,
                                91
                            )
                        );
                    }
                    this.deadCount++;
                } else {
                    this.main.pushThing(new Orb(this.main, this.main.simon.xMin + 240, 96, 273));
                    return false;
                }
                break;
        }

        return true;
    }

    public render(gc: GameContainer, g: Graphics): void {
        if (this.state == Frankenstein.STATE_DEAD) {
            this.main.drawFaded(this.main.frankensteinBoss[this.direction][this.spriteIndex], this.x, this.y, 1 - this.deadCount * Frankenstein.DYING_FADE);
        } else {
            this.main.draw(this.main.frankensteinBoss[this.direction][this.spriteIndex], this.x, this.y);
        }
    }
}
