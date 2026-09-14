import { GameContainer, Graphics } from "slick2d-ts";
import { javaFloat, trunc } from "./JavaMath.js";
import { Main } from "./Main.js";
import { cancelSimonAction } from "./PlayerActionPolicy.js";
import { Thing } from "./Thing.js";

export class Door extends Thing {
    public static readonly STATE_CLOSED: number = 0;
    public static readonly STATE_SCROLL_1: number = 1;
    public static readonly STATE_DIAGONAL_1: number = 2;
    public static readonly STATE_OPEN: number = 3;
    public static readonly STATE_WALKING: number = 4;
    public static readonly STATE_DIAGONAL_2: number = 5;
    public static readonly STATE_SCROLL_2: number = 6;
    public state: number = Door.STATE_CLOSED;
    public direction: number = 0;
    public doorScroll1: number = 0;
    public doorScroll2: number = 0;
    public doorDelay: number = 0;
    public active: boolean = false;
    public constructor(main: Main, x: number, y: number, direction: number, active: boolean) {
        super(main, 16, 96);

        this.x = javaFloat(x);
        this.y = javaFloat(y);
        this.direction = direction;
        this.active = active;
    }

    public override update(gc: GameContainer): boolean {
        if (!this.active) {
            return true;
        }

        if (this.direction == Main.RIGHT) {
            switch (this.state) {
                case Door.STATE_CLOSED:
                    if (
                        this.main.simon!.supported &&
                        trunc(this.main.simon!.y) - 32 == trunc(this.y) &&
                        trunc(Math.abs(javaFloat(javaFloat(this.main.simon!.x - this.x) + 24))) <= 32 &&
                        !this.main.simon!.hurt &&
                        this.main.playerPower > 0
                    ) {
                        cancelSimonAction(this.main);
                        this.main.enterNextRegion(this);
                    }
                    break;
                case Door.STATE_SCROLL_1:
                    this.main.camera += 2;
                    if (this.main.camera >= this.doorScroll1) {
                        this.state = Door.STATE_DIAGONAL_1;
                        this.doorDelay = 10;
                        this.main.playSound(this.main.door_opens_1);
                        this.main.playRumble("doorOpen");
                    }
                    break;
                case Door.STATE_DIAGONAL_1:
                    if (--this.doorDelay == 0) {
                        this.state = Door.STATE_OPEN;
                        this.doorDelay = 70;
                    }
                    break;
                case Door.STATE_OPEN:
                    this.main.simon!.walkRight();
                    if (--this.doorDelay == 0) {
                        this.state = Door.STATE_DIAGONAL_2;
                        this.doorDelay = 10;
                    }
                    break;
                case Door.STATE_DIAGONAL_2:
                    if (--this.doorDelay == 0) {
                        this.state = Door.STATE_SCROLL_2;
                    }
                    break;
                case Door.STATE_SCROLL_2:
                    this.main.camera += 2;
                    if (this.main.camera >= this.doorScroll2) {
                        this.state = Door.STATE_CLOSED;
                        this.main.door = null;
                        this.main.oldThingStack.clear();
                        this.main.simon!.xMin = this.main.camera;
                    }
                    break;
            }
        } else {
            switch (this.state) {
                case Door.STATE_CLOSED:
                    if (
                        this.main.simon!.supported &&
                        trunc(this.main.simon!.y) - 32 == trunc(this.y) &&
                        trunc(Math.abs(javaFloat(javaFloat(this.main.simon!.x - this.x) + 24))) <= 32 &&
                        !this.main.simon!.hurt &&
                        this.main.playerPower > 0
                    ) {
                        cancelSimonAction(this.main);
                        this.main.enterNextRegion(this);
                    }
                    break;
                case Door.STATE_SCROLL_1:
                    this.main.camera -= 2;
                    if (this.main.camera <= this.doorScroll1) {
                        this.state = Door.STATE_DIAGONAL_1;
                        this.doorDelay = 10;
                        this.main.playSound(this.main.door_opens_2);
                        this.main.playRumble("doorOpen");
                    }
                    break;
                case Door.STATE_DIAGONAL_1:
                    if (--this.doorDelay == 0) {
                        this.state = Door.STATE_OPEN;
                        this.doorDelay = 70;
                    }
                    break;
                case Door.STATE_OPEN:
                    this.main.simon!.walkLeft();
                    if (--this.doorDelay == 0) {
                        this.state = Door.STATE_DIAGONAL_2;
                        this.doorDelay = 10;
                    }
                    break;
                case Door.STATE_DIAGONAL_2:
                    if (--this.doorDelay == 0) {
                        this.state = Door.STATE_SCROLL_2;
                    }
                    break;
                case Door.STATE_SCROLL_2:
                    this.main.camera -= 2;
                    if (this.main.camera <= this.doorScroll2) {
                        this.state = Door.STATE_CLOSED;
                        this.main.door = null;
                        this.main.oldThingStack.clear();
                        this.main.moveCamera();
                    }
                    break;
            }
        }
        return true;
    }

    public override render(gc: GameContainer, g: Graphics): void {
        if (this.direction == Main.RIGHT) {
            if (this.state == Door.STATE_OPEN) {
                this.main.draw(this.main.doors[Main.RIGHT][2], this.x, this.y);
            } else if (this.state == Door.STATE_DIAGONAL_1 || this.state == Door.STATE_DIAGONAL_2) {
                this.main.draw(this.main.doors[Main.RIGHT][1], this.x, this.y);
            } else {
                this.main.draw(this.main.doors[Main.RIGHT][0], this.x, this.y);
            }
        } else {
            if (this.state == Door.STATE_OPEN) {
                this.main.draw(this.main.doors[Main.LEFT][2], javaFloat(this.x - 32), this.y);
            } else if (this.state == Door.STATE_DIAGONAL_1 || this.state == Door.STATE_DIAGONAL_2) {
                this.main.draw(this.main.doors[Main.LEFT][1], javaFloat(this.x - 16), this.y);
            } else {
                this.main.draw(this.main.doors[Main.LEFT][0], this.x, this.y);
            }
        }
    }
}
