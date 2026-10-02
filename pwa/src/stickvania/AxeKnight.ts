import { isDescendingBelowStage } from "./PitLifecycle.js";
import { GameContainer, Graphics } from "slick2d-ts";
import { Boomerang } from "./Boomerang.js";
import { BoomerangAxe } from "./BoomerangAxe.js";
import { Flame } from "./Flame.js";
import { javaFloat, cc, trunc } from "./JavaMath.js";
import { Main } from "./Main.js";
import { Spark } from "./Spark.js";
import { Thing } from "./Thing.js";

type ShieldContact = {
    boomerang: Boomerang;
    x: number;
    y: number;
};

export class AxeKnight extends Thing {
    private static readonly STATE_INACTIVE: number = 0;
    private static readonly STATE_WALKING: number = 1;
    private static readonly STATE_STANDING: number = 2;
    private static readonly SHIELD_BOOMERANG_RADIUS: number = 13;
    private static readonly SHIELD_LEFT_X: number = 5;
    private static readonly SHIELD_RIGHT_X: number = 42;
    // The shield occupies the full height of the 48x64 AxeKnight sprite. The
    // source frames face left, with the shield plane 5px from the left edge;
    // the right-facing frame mirrors that plane to local x=42.
    private static readonly SHIELD_TOP: number = 0;
    private static readonly SHIELD_BOTTOM: number = 63;
    public hits: number = 3;
    public shieldReflectionsRemaining: number = 3;
    public stunned: number = 0;
    private direction: number = 0;
    private displayDirection: number = 0;
    private spriteIndex: number = 0;
    private spriteIndexIncrementor: number = 0;
    private standingDelay: number = 0;
    private state: number = AxeKnight.STATE_INACTIVE;
    private walkedDistance: number = 0;
    private throwDelay: number = 0;
    private hasAxe: boolean = true;
    public dead: boolean = false;

    public constructor(main: Main, x: number, y: number) {
        x = javaFloat(x);
        y = javaFloat(y);
        super(main, 48, 64);
        this.x = javaFloat(x);
        this.y = javaFloat(y);

        this.hits = main.adjustEnemyHits(this.hits);
        this.shieldReflectionsRemaining = main.adjustEnemyHits(this.shieldReflectionsRemaining);
        this.throwDelay = main.adjustEnemyCooldown(main.random.nextInt(273));
    }

    public axeGone(): void {
        if (this.dead) return;
        this.hasAxe = true;
        this.throwDelay = this.main.adjustEnemyCooldown(this.main.random.nextInt(273));
    }

    private updateDisplayDirection(): void {
        if (javaFloat(this.main.simon!.x + 8) < this.x) {
            this.displayDirection = Main.LEFT;
        } else {
            this.displayDirection = Main.RIGHT;
        }
    }

    private shieldX(): number {
        return javaFloat(this.x + (this.displayDirection == Main.LEFT ? AxeKnight.SHIELD_LEFT_X : AxeKnight.SHIELD_RIGHT_X));
    }

    private shieldTop(): number {
        return javaFloat(this.y + AxeKnight.SHIELD_TOP);
    }

    private shieldBottom(): number {
        return javaFloat(this.y + AxeKnight.SHIELD_BOTTOM);
    }

    private shieldOutwardDirection(): number {
        return this.displayDirection == Main.LEFT ? -1 : 1;
    }

    private isBoomerangProtectedOnShieldApproach(boomerang: Boomerang): boolean {
        if (this.kill || boomerang.kill || boomerang.shieldBlockedBy !== null) {
            return false;
        }

        const vx = boomerang.getActualHorizontalVelocity();
        const centerX = javaFloat(boomerang.x + 16);
        const centerY = javaFloat(boomerang.y + 16);
        const shieldX = this.shieldX();
        const withinShieldHeight =
            centerY >= this.shieldTop() - AxeKnight.SHIELD_BOOMERANG_RADIUS && centerY <= this.shieldBottom() + AxeKnight.SHIELD_BOOMERANG_RADIUS;
        if (!withinShieldHeight) {
            return false;
        }

        return this.displayDirection == Main.LEFT ? vx >= 0 && centerX <= shieldX : vx <= 0 && centerX >= shieldX;
    }

    private getShieldContactForBoomerang(boomerang: Boomerang, requireDurability: boolean = true): ShieldContact | null {
        if (this.kill || (requireDurability && this.shieldReflectionsRemaining <= 0) || boomerang.kill || boomerang.shieldBlockedBy !== null) {
            return null;
        }

        const shieldX = this.shieldX();
        const shieldY1 = this.shieldTop();
        const shieldY2 = this.shieldBottom();
        const bodyCenterX = javaFloat(this.x + 24);
        const vx = boomerang.getActualHorizontalVelocity();
        const centerX = javaFloat(boomerang.x + 16);
        const centerY = javaFloat(boomerang.y + 16);
        const approachesFromFront = this.displayDirection == Main.LEFT ? vx >= 0 && centerX <= bodyCenterX : vx <= 0 && centerX >= bodyCenterX;
        if (!approachesFromFront) {
            return null;
        }

        const closestY = javaFloat(Math.max(shieldY1, Math.min(shieldY2, centerY)));
        const dx = javaFloat(centerX - shieldX);
        const dy = javaFloat(centerY - closestY);
        if (javaFloat(javaFloat(dx * dx) + javaFloat(dy * dy)) > AxeKnight.SHIELD_BOOMERANG_RADIUS * AxeKnight.SHIELD_BOOMERANG_RADIUS) {
            return null;
        }

        return { boomerang, x: shieldX, y: closestY };
    }

    private findShieldContact(): ShieldContact | null {
        const weapons = this.main.weaponsStack.things;
        for (let j: number = this.main.weaponsStack.top; j >= 0; j--) {
            const weapon = weapons[j];
            if (!(weapon instanceof Boomerang)) {
                continue;
            }
            const contact = this.getShieldContactForBoomerang(weapon);
            if (contact !== null) {
                return contact;
            }
        }
        return null;
    }

    private tryReflectBoomerang(): Boomerang | null {
        const contact = this.findShieldContact();
        if (contact === null || !contact.boomerang.reflectFromAxeKnight(this, this.shieldOutwardDirection())) {
            return null;
        }

        this.shieldReflectionsRemaining--;
        this.main.pushThing(new Spark(this.main, contact.x, contact.y, 1, 1));
        this.main.playSound(this.main.ching);
        this.main.playRumble("weaponImpactLight");
        return contact.boomerang;
    }

    private intersectsDamageWeapon(reflectedBoomerang: Boomerang | null): boolean {
        const weapons = this.main.weaponsStack.things;
        for (let j: number = this.main.weaponsStack.top; j >= 0; j--) {
            const weapon = weapons[j]!;
            if (weapon instanceof Boomerang) {
                // A shield reflection owns this projectile until it has fully
                // separated from the reflector. During that unresolved contact,
                // no AxeKnight may reinterpret the projectile as body damage.
                // Also exclude the exact projectile reflected earlier in this
                // update even if the lock is mutated before this scan.
                if (weapon === reflectedBoomerang || weapon.shieldBlockedBy !== null) {
                    continue;
                }
                // Ordinary Boomerang body collision is a forgiving 32x32 AABB,
                // wider than the radius-13 circle used for the visible shield.
                // Protect a frontal trajectory during that pre-contact overlap,
                // then let the circle produce the actual reflection when it
                // reaches the shield plane. This prevents body damage from
                // occurring several ticks before the visible bounce.
                if (
                    (this.shieldReflectionsRemaining > 0 || reflectedBoomerang !== null) &&
                    (this.isBoomerangProtectedOnShieldApproach(weapon) || this.getShieldContactForBoomerang(weapon, false) !== null)
                ) {
                    continue;
                }
            }
            if (this.main.intersects(weapon, this)) {
                this.main.playRumble("weaponImpactLight");
                weapon.intersected = true;
                return true;
            }
        }
        return false;
    }

    public override update(gc: GameContainer): boolean {
        if (isDescendingBelowStage(this)) {
            this.dead = true;
            return false;
        }
        if (this.kill) {
            this.hits = 0;
            this.stunned = 0;
        }

        // The shield is tied to the side rendered this frame. During Stopwatch
        // freeze, preserve the already frozen facing rather than tracking Simon.
        if (this.main.timeFrozen == 0) {
            this.updateDisplayDirection();
        }

        // Shielding is passive physical behavior. It remains active while the
        // body is stunned and does not itself start/reset the 45-tick body stun.
        const reflectedBoomerang = this.tryReflectBoomerang();

        if (this.stunned > 0) {
            this.stunned--;
        } else if (this.main.intersectsWhip(this) || this.intersectsDamageWeapon(reflectedBoomerang) || this.kill) {
            this.main.pushThing(new Spark(this.main, this));
            if (--this.hits <= 0) {
                if (this.main.random.nextBoolean()) {
                    this.main.pushThing(this.main.createCandleItem(trunc(this.x), trunc(this.y), cc("h"))!);
                }
                this.main.pushThing(new Flame(this.main, this.x, javaFloat(this.y + 24), 0, 0, -0.08, 0, 10));
                this.main.pushThing(new Flame(this.main, javaFloat(this.x + 16), javaFloat(this.y + 32), 0, 0, -0.08, 0, 10));
                this.main.addPoints(500);
                this.main.playSound(this.main.killed_4);
                this.dead = true;
                return false;
            } else {
                this.main.playSound(this.main.stunned);
                this.stunned = 45;
            }
        }

        if (this.main.intersectsSimon(this)) {
            this.main.hurtSimon(2);
        }

        if (this.main.timeFrozen == 0) {
            this.applyGravity();
            if (isDescendingBelowStage(this)) {
                this.dead = true;
                return false;
            }

            if (this.state != AxeKnight.STATE_INACTIVE && this.hasAxe) {
                if (this.throwDelay <= 0) {
                    this.throwDelay = this.main.adjustEnemyCooldown(this.main.random.nextInt(273));
                    this.main.pushThing(
                        new BoomerangAxe(
                            this.main,
                            javaFloat(this.x + 8),
                            javaFloat(this.main.random.nextBoolean() ? this.y : javaFloat(this.y + 32)),
                            this.displayDirection,
                            this
                        )
                    );
                    this.hasAxe = false;
                } else {
                    this.throwDelay--;
                }
            }

            switch (this.state) {
                case AxeKnight.STATE_INACTIVE:
                    if (this.x >= this.main.camera - 96 && this.x <= this.main.camera + 576) {
                        this.state = AxeKnight.STATE_WALKING;
                    }
                    break;
                case AxeKnight.STATE_WALKING:
                    if (this.direction == Main.LEFT) {
                        if (!this.moveX(-0.5) || !this.main.isSupportive(trunc(this.x), trunc(javaFloat(this.y + 64)))) {
                            this.direction = Main.RIGHT;
                        }
                    } else {
                        if (!this.moveX(0.5) || !this.main.isSupportive(trunc(javaFloat(this.x + 47)), trunc(javaFloat(this.y + 64)))) {
                            this.direction = Main.LEFT;
                        }
                    }

                    if (++this.spriteIndexIncrementor == 20) {
                        this.spriteIndexIncrementor = 0;
                        if (++this.spriteIndex == 2) {
                            this.spriteIndex = 0;
                        }
                    }

                    if (++this.walkedDistance >= 96) {
                        this.walkedDistance = this.main.random.nextInt(43);
                        this.state = AxeKnight.STATE_STANDING;
                    }
                    break;
                case AxeKnight.STATE_STANDING:
                    if (++this.standingDelay >= this.main.adjustEnemyBehaviorDelay(43)) {
                        this.standingDelay = this.main.adjustEnemyBehaviorDelay(this.main.random.nextInt(43));
                        this.state = AxeKnight.STATE_WALKING;
                        let distance: number = javaFloat(javaFloat(this.main.simon!.x + 8) - this.x);
                        let aDist: number = javaFloat(Math.abs(distance));
                        if (aDist < 128) {
                            if (distance < 0) {
                                this.direction = Main.RIGHT;
                            } else {
                                this.direction = Main.LEFT;
                            }
                        } else if (aDist > 256) {
                            if (distance < 0) {
                                this.direction = Main.LEFT;
                            } else {
                                this.direction = Main.RIGHT;
                            }
                        }
                    }
                    break;
            }
        }

        return true;
    }

    public override render(gc: GameContainer, g: Graphics): void {
        this.main.draw(this.main.axeKnights[this.displayDirection][this.spriteIndex], this.x, this.y);
    }
}
