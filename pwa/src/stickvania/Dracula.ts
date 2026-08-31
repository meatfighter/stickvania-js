import { GameContainer, Graphics } from "slick2d-ts";
import { DieBat } from "./DieBat.js";
import { DraculaBat } from "./DraculaBat.js";
import { Fireball } from "./Fireball.js";
import { FoodOrb } from "./FoodOrb.js";
import { Ghost } from "./Ghost.js";
import { javaFloat, makeArray, trunc } from "./JavaMath.js";
import { Main } from "./Main.js";
import { Orb } from "./Orb.js";
import { Spark } from "./Spark.js";
import { Thing } from "./Thing.js";

export class Dracula extends Thing {
    public static readonly RISE_FADE_FRACTION: number = javaFloat(1.0 / 80.0);
    public static readonly FADE_IN_FRACTION: number = javaFloat(1.0 / 91.0);
    public static readonly FADE_TO_BATS_FRACTION: number = javaFloat(1.0 / 45.0);
    public static readonly ANGLE_SCALE: number = javaFloat(Math.PI / 182);
    public static readonly JUMP_VELOCITY: number = -javaFloat(Math.sqrt(javaFloat(Main.GRAVITY * 256)));
    public static readonly JUMP_TIME: number = 71;
    public static readonly DIE_FRACTION: number = javaFloat(1 / 910.0);
    public static readonly STATE_RESTING: number = 0;
    public static readonly STATE_HEAD_RISING: number = 1;
    public static readonly STATE_BODY_FADE_IN: number = 2;
    public static readonly STATE_FIRING: number = 3;
    public static readonly STATE_FADE_TO_BATS: number = 4;
    public static readonly STATE_BATS_MOVING: number = 5;
    public static readonly STATE_FADE_TO_DRACULA: number = 6;
    public static readonly STATE_FADE_TO_MONSTER: number = 7;
    public static readonly STATE_FADE_TO_BATS_2: number = 8;
    public static readonly STATE_CROUCHED: number = 9;
    public static readonly STATE_STANDING_UP: number = 10;
    public static readonly STATE_STANDING: number = 11;
    public static readonly STATE_JUMPING: number = 12;
    public static readonly STATE_DYING: number = 13;
    private draculaBats: DraculaBat[] = makeArray<DraculaBat>(16, () => null!);
    private state: number = Dracula.STATE_RESTING;
    private direction: number = Main.LEFT;
    private headY: number = javaFloat(0);
    private fadeIn: number = 0;
    private capeOpen: boolean = false;
    private firingDelay: number = 0;
    private fadeToBats: number = 0;
    private targetX: number = javaFloat(0);
    private batVx: number = javaFloat(0);
    private batsMoving: number = 0;
    private fadeToDracula: number = 0;
    private stunned: number = 0;
    private hits: number = 32;
    private releasedFoodOrb: boolean = false;
    private releasedFoodOrb2: boolean = false;
    private monsterForm: boolean = false;
    private monsterDelay: number = 0;
    private dying: number = 0;
    private dieBatDelay: number = 0;
    public constructor(main: Main, x: number, y: number) {
        x = javaFloat(x);
        y = javaFloat(y);
        super(main, 48, 96);
        this.x = javaFloat(x);
        this.y = javaFloat(y);

        this.headY = javaFloat(y + 64);

        for (let i: number = this.draculaBats.length - 1; i >= 0; i--) {
            this.draculaBats[i] = new DraculaBat(main);
        }
    }

    private headHit(): boolean {
        if (this.direction == Main.LEFT) {
            let x1: number = trunc(this.x) + 11;
            let y1: number = trunc(this.y) - 16;
            let x2: number = trunc(this.x) + 26;
            let y2: number = trunc(this.y) + 15;
            return this.main.intersectsWhip(x1, y1, x2, y2) || this.main.intersectsWeapon(x1, y1, x2, y2);
        } else {
            let x1: number = trunc(this.x) + 21;
            let y1: number = trunc(this.y) - 16;
            let x2: number = trunc(this.x) + 36;
            let y2: number = trunc(this.y) + 15;
            return this.main.intersectsWhip(x1, y1, x2, y2) || this.main.intersectsWeapon(x1, y1, x2, y2);
        }
    }

    public override update(gc: GameContainer): boolean {
        if (this.state != Dracula.STATE_DYING) {
            this.direction = this.x > javaFloat(this.main.simon!.x + 8) ? Main.LEFT : Main.RIGHT;
        }
        if (this.stunned > 0) {
            this.stunned--;
        }

        if (this.state >= Dracula.STATE_CROUCHED && this.state <= Dracula.STATE_JUMPING) {
            if (this.main.intersectsSimon(this)) {
                this.main.hurtSimon(2);
            }
            if (this.stunned == 0 && (this.main.intersectsWhip(this) || this.main.intersectsWeapon(this))) {
                this.stunned = 100;
                this.main.playSound(this.main.boss_hurt);
                this.main.pushThing(new Spark(this.main, this));
                if (this.hits > 0) {
                    this.hits--;
                    this.main.enemyPower = this.hits >> 1;
                    if (this.hits == 0) {
                        this.main.playRumble("bossFinalHit");
                    }
                    if (this.hits == 1) {
                        this.main.enemyPower = 1;
                    }
                }
            }
            if (this.hits == 0 && this.state == Dracula.STATE_STANDING) {
                this.main.killAll();
                this.state = Dracula.STATE_FADE_TO_BATS_2;
                this.main.playSound(this.main.dracula_to_bats);
                this.monsterForm = false;
                this.fadeToBats = 0;
                this.targetX = javaFloat(232);
                this.batVx = javaFloat(javaFloat(200 - this.x) / 182);
                let batDirection: number = this.batVx > 0 ? Main.RIGHT : Main.LEFT;
                for (let i: number = this.draculaBats.length - 1; i >= 0; i--) {
                    let draculaBat: DraculaBat = this.draculaBats[i];
                    draculaBat.direction = batDirection;
                }
            }
        }

        switch (this.state) {
            case Dracula.STATE_RESTING:
                if (javaFloat(this.main.simon!.x - this.main.simon!.xMin) < 150) {
                    this.main.killAll();
                    this.main.simon!.xMax = 512;
                    this.state = Dracula.STATE_HEAD_RISING;
                }
                break;
            case Dracula.STATE_HEAD_RISING:
                if (this.headY > javaFloat(this.y - 16)) {
                    this.headY = javaFloat(this.headY - 0.5);
                } else {
                    this.state = Dracula.STATE_BODY_FADE_IN;
                }
                break;
            case Dracula.STATE_BODY_FADE_IN:
                if (++this.fadeIn == 91) {
                    this.firingDelay = 0;
                    this.state = Dracula.STATE_FIRING;
                }
                break;
            case Dracula.STATE_FIRING:
                if (this.main.intersectsSimon(this)) {
                    this.main.hurtSimon(2);
                }
                if (this.firingDelay++ == 0) {
                    this.capeOpen = true;
                    if (!this.releasedFoodOrb2 && this.hits <= 16) {
                        this.monsterForm = true;
                        this.releasedFoodOrb2 = true;
                        this.main.pushThing(new FoodOrb(this.main, javaFloat(this.x + 24), javaFloat(this.y + 24)));
                        this.main.playSound(this.main.thunder);
                        this.main.requestSong(this.main.stage_1_2);
                    } else if (!this.releasedFoodOrb && this.hits <= 24) {
                        this.releasedFoodOrb = true;
                        this.main.pushThing(new FoodOrb(this.main, javaFloat(this.x + 24), javaFloat(this.y + 24)));
                        this.main.playSound(this.main.thunder);
                    } else {
                        this.main.pushThing(
                            new Fireball(
                                this.main,
                                javaFloat(this.x + 24),
                                javaFloat(this.main.random.nextBoolean() ? javaFloat(this.y + 70) : javaFloat(this.y + 48)),
                                this.direction == Main.LEFT ? -1.5 : 1.5,
                                0
                            )
                        );
                        this.main.playRumble("fireProjectile");
                        if (this.hits <= 24) {
                            this.main.playSound(this.main.thunder);
                            let ghost: Ghost = new Ghost(this.main, javaFloat(this.x - 96), javaFloat(this.y + 64));
                            ghost.active = true;
                            ghost.hits = 1;
                            this.main.pushThing(ghost);
                            ghost = new Ghost(this.main, javaFloat(this.x + 112), javaFloat(this.y + 64));
                            ghost.active = true;
                            ghost.hits = 1;
                            this.main.pushThing(ghost);
                        }
                    }

                    if (this.x < 224) {
                        this.targetX = javaFloat(224 + this.main.random.nextInt(208));
                    } else {
                        this.targetX = javaFloat(16 + this.main.random.nextInt(208));
                    }
                    this.batVx = javaFloat(javaFloat(this.targetX - this.x) / 182);
                    let batDirection: number = this.batVx > 0 ? Main.RIGHT : Main.LEFT;
                    for (let i: number = this.draculaBats.length - 1; i >= 0; i--) {
                        let draculaBat: DraculaBat = this.draculaBats[i];
                        draculaBat.direction = batDirection;
                    }
                } else if (this.firingDelay == 91) {
                    this.fadeToBats = 0;
                    this.state = Dracula.STATE_FADE_TO_BATS;
                    this.main.playSound(this.main.dracula_to_bats);
                } else {
                    if (this.stunned == 0 && this.headHit()) {
                        this.stunned = 100;
                        this.main.playSound(this.main.boss_hurt);
                        this.main.pushThing(new Spark(this.main, javaFloat(this.x + 11), javaFloat(this.y - 16), 16, 32));
                        if (this.hits > 0) {
                            this.hits--;
                            this.main.enemyPower = this.hits >> 1;
                            if (this.hits == 1) {
                                this.main.enemyPower = 1;
                            }
                        }
                    }
                }
                break;
            case Dracula.STATE_FADE_TO_BATS:
                if (this.fadeToBats++ == 0) {
                    for (let i: number = this.draculaBats.length - 1; i >= 0; i--) {
                        let draculaBat: DraculaBat = this.draculaBats[i];
                        draculaBat.x = javaFloat(javaFloat(this.x + this.main.random.nextInt(96)) - 48);
                        draculaBat.Y = javaFloat((draculaBat.y = javaFloat(javaFloat(this.y - 16) + this.main.random.nextInt(80))));
                        draculaBat.amplitude = javaFloat(this.main.random.nextInt(352) - 176);
                    }
                } else if (this.fadeToBats < 45) {
                    for (let i: number = this.draculaBats.length - 1; i >= 0; i--) {
                        this.draculaBats[i].update(gc);
                    }
                } else {
                    this.state = Dracula.STATE_BATS_MOVING;
                    this.x = javaFloat(this.targetX);
                    if (this.monsterForm) {
                        this.y = javaFloat(this.y - 64);
                    }
                    this.batsMoving = 0;
                }
                break;
            case Dracula.STATE_FADE_TO_BATS_2:
                if (this.fadeToBats++ == 0) {
                    for (let i: number = this.draculaBats.length - 1; i >= 0; i--) {
                        let draculaBat: DraculaBat = this.draculaBats[i];
                        draculaBat.x = javaFloat(javaFloat(this.x + this.main.random.nextInt(96)) - 16);
                        draculaBat.Y = javaFloat((draculaBat.y = javaFloat(javaFloat(48 + this.y) + this.main.random.nextInt(80))));
                        draculaBat.amplitude = javaFloat(this.main.random.nextInt(352) - 176);
                    }
                } else if (this.fadeToBats < 45) {
                    for (let i: number = this.draculaBats.length - 1; i >= 0; i--) {
                        this.draculaBats[i].update(gc);
                    }
                } else {
                    this.state = Dracula.STATE_BATS_MOVING;
                    this.x = javaFloat(this.targetX);
                    this.y = javaFloat(this.y + 64);
                    this.batsMoving = 0;
                }
                break;
            case Dracula.STATE_BATS_MOVING:
                if (++this.batsMoving < 182) {
                    for (let i: number = this.draculaBats.length - 1; i >= 0; i--) {
                        let draculaBat: DraculaBat = this.draculaBats[i];
                        draculaBat.x = javaFloat(draculaBat.x + this.batVx);
                        const batAngle = javaFloat(Dracula.ANGLE_SCALE * this.batsMoving);
                        const batOffset = javaFloat(draculaBat.amplitude * Math.sin(batAngle));
                        draculaBat.y = javaFloat(draculaBat.Y + batOffset);
                        this.draculaBats[i].update(gc);
                    }
                } else {
                    if (this.monsterForm) {
                        this.state = Dracula.STATE_FADE_TO_MONSTER;
                    } else {
                        this.state = Dracula.STATE_FADE_TO_DRACULA;
                    }
                    this.fadeToDracula = 0;
                }
                break;
            case Dracula.STATE_FADE_TO_DRACULA:
                if (++this.fadeToDracula < 45) {
                    for (let i: number = this.draculaBats.length - 1; i >= 0; i--) {
                        this.draculaBats[i].update(gc);
                    }
                } else {
                    if (this.hits == 0) {
                        this.state = Dracula.STATE_DYING;
                        this.main.requestMusic(this.main.dracula_dead);
                    } else {
                        this.firingDelay = 0;
                        this.state = Dracula.STATE_FIRING;
                    }
                }
                break;
            case Dracula.STATE_FADE_TO_MONSTER:
                if (++this.fadeToDracula < 45) {
                    for (let i: number = this.draculaBats.length - 1; i >= 0; i--) {
                        this.draculaBats[i].update(gc);
                    }
                } else {
                    this.firingDelay = 0;
                    this.state = Dracula.STATE_CROUCHED;
                    this.monsterDelay = 45;
                }
                break;
            case Dracula.STATE_CROUCHED:
                this.rx1 = 0;
                this.rx2 = 95;
                this.ry1 = 64;
                this.ry2 = 157;
                if (--this.monsterDelay == 0) {
                    this.rx1 = 0;
                    this.rx2 = 95;
                    this.ry1 = 32;
                    this.ry2 = 159;
                    this.state = Dracula.STATE_STANDING_UP;
                    this.monsterDelay = 45;
                    this.vy = javaFloat(-4);
                }
                break;
            case Dracula.STATE_STANDING_UP:
                this.applyGravity();
                if (this.supported) {
                    this.monsterDelay = 45;
                    this.state = Dracula.STATE_STANDING;
                }
                break;
            case Dracula.STATE_STANDING:
                if (--this.monsterDelay == 0) {
                    this.state = Dracula.STATE_JUMPING;
                    this.vy = javaFloat(Dracula.JUMP_VELOCITY);
                    this.targetX = javaFloat(javaFloat(this.main.simon!.x + this.main.random.nextInt(128)) - 80);
                    this.vx = javaFloat(javaFloat(this.targetX - this.x) / Dracula.JUMP_TIME);
                }
                break;
            case Dracula.STATE_JUMPING:
                this.moveX(this.vx);
                this.applyGravity();
                if (this.supported) {
                    this.main.playSound(this.main.lands);
                    this.main.playRumble("draculaLand");
                    this.state = Dracula.STATE_CROUCHED;
                    this.monsterDelay = 45;
                }
                break;
            case Dracula.STATE_DYING:
                if (++this.dying == 910) {
                    this.main.addPoints(50000);
                    this.main.pushThing(new Orb(this.main, this.main.simon!.xMin + 240, 96, 91));
                    return false;
                }
                if (this.dieBatDelay == 0) {
                    this.dieBatDelay = 45;
                    this.main.pushThing(
                        new DieBat(
                            this.main,
                            javaFloat(javaFloat(this.x + this.main.random.nextInt(80)) - 32),
                            javaFloat(this.y + this.main.random.nextInt(64))
                        )
                    );
                } else {
                    this.dieBatDelay--;
                }
                break;
        }

        return true;
    }

    public override render(gc: GameContainer, g: Graphics): void {
        switch (this.state) {
            case Dracula.STATE_RESTING:
                break;
            case Dracula.STATE_HEAD_RISING:
                this.main.drawFaded(
                    this.main.draculaBoss[this.direction][0],
                    javaFloat(this.x + 11),
                    this.headY,
                    javaFloat(1 - javaFloat(Dracula.RISE_FADE_FRACTION * javaFloat(this.headY - javaFloat(this.y - 16))))
                );
                break;
            case Dracula.STATE_BODY_FADE_IN:
                this.main.draw(this.main.draculaBoss[this.direction][0], javaFloat(this.x + 11), javaFloat(this.y - 16));
                this.main.drawFaded(this.main.draculaBoss[this.direction][1], this.x, this.y, javaFloat(this.fadeIn * Dracula.FADE_IN_FRACTION));
                break;
            case Dracula.STATE_FADE_TO_BATS: {
                let fade: number = javaFloat(this.fadeToBats * Dracula.FADE_TO_BATS_FRACTION);
                for (let i: number = this.draculaBats.length - 1; i >= 0; i--) {
                    this.draculaBats[i].render(gc, g, fade);
                }
                fade = javaFloat(1 - fade);
                if (this.direction == Main.LEFT) {
                    this.main.drawFaded(this.main.draculaBoss[this.direction][0], javaFloat(this.x + 11), javaFloat(this.y - 16), fade);
                    this.main.drawFaded(this.main.draculaBoss[this.direction][1], this.x, this.y, fade);
                } else {
                    this.main.drawFaded(this.main.draculaBoss[this.direction][0], javaFloat(this.x + 21), javaFloat(this.y - 16), fade);
                    this.main.drawFaded(this.main.draculaBoss[this.direction][1], this.x, this.y, fade);
                }
                break;
            }
            case Dracula.STATE_FADE_TO_BATS_2: {
                let fade: number = javaFloat(this.fadeToBats * Dracula.FADE_TO_BATS_FRACTION);
                for (let i: number = this.draculaBats.length - 1; i >= 0; i--) {
                    this.draculaBats[i].render(gc, g, fade);
                }
                this.main.drawFaded(this.main.draculaBoss[this.direction][4], this.x, this.y, javaFloat(1 - fade));
                break;
            }
            case Dracula.STATE_BATS_MOVING:
                for (let i: number = this.draculaBats.length - 1; i >= 0; i--) {
                    this.draculaBats[i].render(gc, g);
                }
                break;
            case Dracula.STATE_FADE_TO_DRACULA: {
                let fade: number = javaFloat(this.fadeToDracula * Dracula.FADE_TO_BATS_FRACTION);
                for (let i: number = this.draculaBats.length - 1; i >= 0; i--) {
                    this.draculaBats[i].render(gc, g, javaFloat(1 - fade));
                }
                if (this.direction == Main.LEFT) {
                    this.main.drawFaded(this.main.draculaBoss[this.direction][0], javaFloat(this.x + 11), javaFloat(this.y - 16), fade);
                    this.main.drawFaded(this.main.draculaBoss[this.direction][1], this.x, this.y, fade);
                } else {
                    this.main.drawFaded(this.main.draculaBoss[this.direction][0], javaFloat(this.x + 21), javaFloat(this.y - 16), fade);
                    this.main.drawFaded(this.main.draculaBoss[this.direction][1], this.x, this.y, fade);
                }
                break;
            }
            case Dracula.STATE_FADE_TO_MONSTER: {
                let fade: number = javaFloat(this.fadeToDracula * Dracula.FADE_TO_BATS_FRACTION);
                for (let i: number = this.draculaBats.length - 1; i >= 0; i--) {
                    this.draculaBats[i].render(gc, g, javaFloat(1 - fade));
                }
                this.main.drawFaded(this.main.draculaBoss[this.direction][6], this.x, javaFloat(this.y + 35), fade);
                break;
            }
            case Dracula.STATE_CROUCHED:
                this.main.draw(this.main.draculaBoss[this.direction][6], this.x, javaFloat(this.y + 35));
                break;
            case Dracula.STATE_STANDING_UP:
                this.main.draw(this.main.draculaBoss[this.direction][5], this.x, this.y);
                break;
            case Dracula.STATE_STANDING:
                this.main.draw(this.main.draculaBoss[this.direction][4], this.x, this.y);
                break;
            case Dracula.STATE_JUMPING:
                this.main.draw(this.main.draculaBoss[this.direction][3], this.x, this.y);
                break;
            case Dracula.STATE_DYING: {
                let fade: number = javaFloat(1 - javaFloat(this.dying * Dracula.DIE_FRACTION));
                if (this.direction == Main.LEFT) {
                    this.main.drawFaded(this.main.draculaBoss[this.direction][0], javaFloat(this.x + 11), javaFloat(this.y - 16), fade);
                    this.main.drawFaded(this.main.draculaBoss[this.direction][1], this.x, this.y, fade);
                } else {
                    this.main.drawFaded(this.main.draculaBoss[this.direction][0], javaFloat(this.x + 21), javaFloat(this.y - 16), fade);
                    this.main.drawFaded(this.main.draculaBoss[this.direction][1], this.x, this.y, fade);
                }
                break;
            }
            default:
                if (this.direction == Main.LEFT) {
                    if (this.capeOpen) {
                        this.main.draw(this.main.draculaBoss[this.direction][0], javaFloat(this.x + 12), javaFloat(this.y - 16));
                        this.main.draw(this.main.draculaBoss[this.direction][2], this.x, this.y);
                    } else {
                        this.main.draw(this.main.draculaBoss[this.direction][0], javaFloat(this.x + 11), javaFloat(this.y - 16));
                        this.main.draw(this.main.draculaBoss[this.direction][1], this.x, this.y);
                    }
                } else {
                    if (this.capeOpen) {
                        this.main.draw(this.main.draculaBoss[this.direction][0], javaFloat(this.x + 20), javaFloat(this.y - 16));
                        this.main.draw(this.main.draculaBoss[this.direction][2], javaFloat(this.x - 16), this.y);
                    } else {
                        this.main.draw(this.main.draculaBoss[this.direction][0], javaFloat(this.x + 21), javaFloat(this.y - 16));
                        this.main.draw(this.main.draculaBoss[this.direction][1], this.x, this.y);
                    }
                }
                break;
        }
    }
}
