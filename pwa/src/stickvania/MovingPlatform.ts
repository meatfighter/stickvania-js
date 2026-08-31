import { GameContainer, Graphics } from "slick2d-ts";
import { Main } from "./Main.js";
import { Thing } from "./Thing.js";
import { javaFloat } from "./JavaMath.js";

export class MovingPlatform extends Thing {
    public static readonly STATE_RIGHT_ACCELERATING: number = 0;
    public static readonly STATE_RIGHT_CONSTANT: number = 1;
    public static readonly STATE_LEFT_ACCELERATING: number = 2;
    public static readonly STATE_LEFT_CONSTANT: number = 3;
    public static readonly ACCELERATION_DISTANCE: number = javaFloat(16);
    public static readonly ACCELERATION_TIME: number = 45;
    public static readonly VELOCITY: number = javaFloat(1);
    public static readonly A: number = javaFloat(
        javaFloat(2 * MovingPlatform.ACCELERATION_DISTANCE) / (MovingPlatform.ACCELERATION_TIME * MovingPlatform.ACCELERATION_TIME)
    );

    public state: number = MovingPlatform.STATE_RIGHT_ACCELERATING;
    public x1: number = javaFloat(0);
    public x2: number = javaFloat(0);

    public constructor(main: Main, x1: number, x2: number, y: number) {
        x1 = javaFloat(x1);
        x2 = javaFloat(x2);
        y = javaFloat(y);
        super(main, 64, 16);
        this.x = javaFloat(x1);
        this.y = javaFloat(y);
        this.x1 = javaFloat(x1);
        this.x2 = javaFloat(x2);
    }

    public override update(gc: GameContainer): boolean {
        this.x = javaFloat(this.x + this.vx);

        switch (this.state) {
            case MovingPlatform.STATE_RIGHT_ACCELERATING:
                this.vx = javaFloat(this.vx + MovingPlatform.A);
                if (this.vx >= MovingPlatform.VELOCITY) {
                    this.vx = javaFloat(MovingPlatform.VELOCITY);
                    this.state = MovingPlatform.STATE_RIGHT_CONSTANT;
                }
                break;
            case MovingPlatform.STATE_RIGHT_CONSTANT:
                if (this.x >= javaFloat(this.x2 - javaFloat(2 * MovingPlatform.ACCELERATION_DISTANCE))) {
                    this.state = MovingPlatform.STATE_LEFT_ACCELERATING;
                }
                break;
            case MovingPlatform.STATE_LEFT_ACCELERATING:
                this.vx = javaFloat(this.vx - MovingPlatform.A);
                if (this.vx <= -MovingPlatform.VELOCITY) {
                    this.vx = javaFloat(-MovingPlatform.VELOCITY);
                    this.state = MovingPlatform.STATE_LEFT_CONSTANT;
                }
                break;
            case MovingPlatform.STATE_LEFT_CONSTANT:
                if (this.x <= javaFloat(this.x1 + javaFloat(2 * MovingPlatform.ACCELERATION_DISTANCE))) {
                    this.state = MovingPlatform.STATE_RIGHT_ACCELERATING;
                }
                break;
        }

        return true;
    }

    public override render(gc: GameContainer, g: Graphics): void {
        this.main.draw(this.main.platform, this.x, this.y);
    }
}
