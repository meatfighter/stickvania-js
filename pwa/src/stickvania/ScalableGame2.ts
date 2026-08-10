import {
    GL11,
    Game,
    GameContainer,
    Graphics,
    InputListener,
    SlickCallable
} from "slick2d-ts";

function isInputListener(value: unknown): value is InputListener {
    const candidate = value as Partial<InputListener> | null;
    return !!candidate
        && typeof candidate.setInput === "function"
        && typeof candidate.isAcceptingInput === "function"
        && typeof candidate.keyPressed === "function"
        && typeof candidate.mousePressed === "function"
        && typeof candidate.controllerButtonPressed === "function";
}

export class ScalableGame2 implements Game {
    private static readonly VIEWPORT_X = 64;
    private static readonly VIEWPORT_Y = 32;
    private static readonly VIEWPORT_WIDTH = 512;
    private static readonly VIEWPORT_HEIGHT = 416;

    private readonly held: Game;
    private readonly normalWidth: number;
    private readonly normalHeight: number;
    private readonly maintainAspect: boolean;
    private targetWidth = 0;
    private targetHeight = 0;

    public constructor(held: Game, normalWidth: number, normalHeight: number, maintainAspect: boolean = true) {
        this.held = held;
        this.normalWidth = normalWidth;
        this.normalHeight = normalHeight;
        this.maintainAspect = maintainAspect;
    }

    public init(container: GameContainer): void | Promise<void> {
        this.calculateTargetSize(container);
        if (isInputListener(this.held)) {
            container.getInput().addListener(this.held);
        }
        this.applyInputTransform(container);
        return this.held.init(container);
    }

    public update(container: GameContainer, delta: number): void {
        this.held.update(container, delta);
    }

    public render(container: GameContainer, g: Graphics): void {
        const { xoffset, yoffset } = this.calculateOffsets(container);
        const xscale = this.targetWidth / ScalableGame2.VIEWPORT_WIDTH;
        const yscale = this.targetHeight / ScalableGame2.VIEWPORT_HEIGHT;

        SlickCallable.enterSafeBlock();
        g.setClip(xoffset, yoffset, this.targetWidth, this.targetHeight);
        GL11.glTranslatef(
            xoffset - ScalableGame2.VIEWPORT_X * xscale,
            yoffset - ScalableGame2.VIEWPORT_Y * yscale,
            0
        );
        GL11.glScalef(xscale, yscale, 0);
        GL11.glPushMatrix();
        this.held.render(container, g);
        GL11.glPopMatrix();
        g.clearClip();
        SlickCallable.leaveSafeBlock();

        this.renderOverlay(container, g);
    }

    protected renderOverlay(_container: GameContainer, _g: Graphics): void {
    }

    public closeRequested(): boolean {
        return this.held.closeRequested();
    }

    public getTitle(): string {
        return this.held.getTitle();
    }

    public containerSizeChanged(container: GameContainer): void {
        this.calculateTargetSize(container);
        this.applyInputTransform(container);
    }

    private calculateTargetSize(container: GameContainer): void {
        this.targetWidth = container.getWidth();
        this.targetHeight = container.getHeight();
        if (this.maintainAspect) {
            const viewportAspect = ScalableGame2.VIEWPORT_WIDTH / ScalableGame2.VIEWPORT_HEIGHT;
            const containerAspect = this.targetWidth / this.targetHeight;
            if (containerAspect > viewportAspect) {
                this.targetWidth = Math.trunc(this.targetHeight * viewportAspect);
            } else {
                this.targetHeight = Math.trunc(this.targetWidth / viewportAspect);
            }
        }
    }

    private applyInputTransform(container: GameContainer): void {
        const { xoffset, yoffset } = this.calculateOffsets(container);
        const xscale = ScalableGame2.VIEWPORT_WIDTH / this.targetWidth;
        const yscale = ScalableGame2.VIEWPORT_HEIGHT / this.targetHeight;
        container.getInput().setScale(xscale, yscale);
        container.getInput().setOffset(
            ScalableGame2.VIEWPORT_X - xoffset * xscale,
            ScalableGame2.VIEWPORT_Y - yoffset * yscale
        );
    }

    private calculateOffsets(container: GameContainer): { xoffset: number; yoffset: number } {
        let xoffset = 0;
        let yoffset = 0;
        if (this.targetHeight < container.getHeight()) {
            yoffset = Math.trunc((container.getHeight() - this.targetHeight) / 2);
        }
        if (this.targetWidth < container.getWidth()) {
            xoffset = Math.trunc((container.getWidth() - this.targetWidth) / 2);
        }
        return { xoffset, yoffset };
    }

    public getNormalWidth(): number {
        return this.normalWidth;
    }

    public getNormalHeight(): number {
        return this.normalHeight;
    }
}
