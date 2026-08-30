import { BufferedScalableGame, BufferedScalingMode, type Game, type GameContainer, type Graphics, type InputListener } from "slick2d-ts";

export const STICKVANIA_LOGICAL_WIDTH = 640;
export const STICKVANIA_LOGICAL_HEIGHT = 480;
export const STICKVANIA_VIEWPORT_X = 64;
export const STICKVANIA_VIEWPORT_Y = 32;
export const STICKVANIA_VIEWPORT_WIDTH = 512;
export const STICKVANIA_VIEWPORT_HEIGHT = 416;
export type StickvaniaScalingPreference = "smooth" | "crisp" | "pixel-perfect";

function getBufferedScalingMode(preference: StickvaniaScalingPreference): BufferedScalingMode {
    switch (preference) {
        case "crisp":
            return BufferedScalingMode.Nearest;
        case "pixel-perfect":
            return BufferedScalingMode.Integer;
        case "smooth":
        default:
            return BufferedScalingMode.Linear;
    }
}

function isInputListener(value: unknown): value is InputListener {
    const candidate = value as Partial<InputListener> | null;
    return (
        candidate !== null &&
        typeof candidate.setInput === "function" &&
        typeof candidate.isAcceptingInput === "function" &&
        typeof candidate.keyPressed === "function" &&
        typeof candidate.mousePressed === "function" &&
        typeof candidate.controllerButtonPressed === "function"
    );
}

class StickvaniaViewportGame implements Game {
    public constructor(private readonly held: Game) {}

    public init(container: GameContainer): void | Promise<void> {
        if (isInputListener(this.held)) {
            container.getInput().addListener(this.held);
        }
        return this.held.init(container);
    }

    public update(container: GameContainer, delta: number): void {
        this.held.update(container, delta);
    }

    public render(container: GameContainer, graphics: Graphics): void {
        graphics.pushTransform();
        try {
            graphics.translate(-STICKVANIA_VIEWPORT_X, -STICKVANIA_VIEWPORT_Y);
            this.held.render(container, graphics);
        } finally {
            graphics.popTransform();
        }
    }

    public closeRequested(): boolean {
        return this.held.closeRequested();
    }

    public getTitle(): string {
        return this.held.getTitle();
    }
}

export class StickvaniaBufferedGame extends BufferedScalableGame {
    public constructor(held: Game, scalingPreference: StickvaniaScalingPreference = "smooth") {
        super(new StickvaniaViewportGame(held), STICKVANIA_VIEWPORT_WIDTH, STICKVANIA_VIEWPORT_HEIGHT, {
            maintainAspect: true,
            scalingMode: getBufferedScalingMode(scalingPreference)
        });
    }

    public setScalingPreference(preference: StickvaniaScalingPreference): void {
        this.setScalingMode(getBufferedScalingMode(preference));
    }

    public override recalculateScale(): void {
        super.recalculateScale();

        const container = this.container;
        if (container === null || this.targetWidth <= 0 || this.targetHeight <= 0) {
            return;
        }

        const inputScaleX = STICKVANIA_VIEWPORT_WIDTH / this.targetWidth;
        const inputScaleY = STICKVANIA_VIEWPORT_HEIGHT / this.targetHeight;
        container.getInput().setScale(inputScaleX, inputScaleY);
        container.getInput().setOffset(STICKVANIA_VIEWPORT_X - this.xoffset * inputScaleX, STICKVANIA_VIEWPORT_Y - this.yoffset * inputScaleY);
    }
}
