import { GL11, Game, GameContainer, Graphics, InputListener, SlickCallable } from "slick2d-ts";
import { javaFloat } from "./JavaMath.js";

function isInputListener(value: unknown): value is InputListener {
    const candidate = value as Partial<InputListener> | null;
    return (
        !!candidate &&
        typeof candidate.setInput === "function" &&
        typeof candidate.isAcceptingInput === "function" &&
        typeof candidate.keyPressed === "function" &&
        typeof candidate.mousePressed === "function" &&
        typeof candidate.controllerButtonPressed === "function"
    );
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
    private xoffset = 0;
    private yoffset = 0;

    public constructor(held: Game, normalWidth: number, normalHeight: number);
    public constructor(held: Game, normalWidth: number, normalHeight: number, maintainAspect: boolean);
    public constructor(held: Game, normalWidth: number, normalHeight: number, maintainAspect: boolean = false) {
        this.held = held;
        this.normalWidth = javaFloat(normalWidth);
        this.normalHeight = javaFloat(normalHeight);
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
        this.calculateOffsets(container);
        const xoffset = this.xoffset;
        const yoffset = this.yoffset;
        const xscale = javaFloat(this.targetWidth / ScalableGame2.VIEWPORT_WIDTH);
        const yscale = javaFloat(this.targetHeight / ScalableGame2.VIEWPORT_HEIGHT);

        SlickCallable.enterSafeBlock();
        g.setClip(xoffset, yoffset, this.targetWidth, this.targetHeight);
        GL11.glTranslatef(
            javaFloat(xoffset - javaFloat(ScalableGame2.VIEWPORT_X * xscale)),
            javaFloat(yoffset - javaFloat(ScalableGame2.VIEWPORT_Y * yscale)),
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

    protected renderOverlay(_container: GameContainer, _g: Graphics): void {}

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
            const viewportAspect = javaFloat(ScalableGame2.VIEWPORT_WIDTH / ScalableGame2.VIEWPORT_HEIGHT);
            const containerAspect = javaFloat(this.targetWidth / this.targetHeight);
            if (containerAspect > viewportAspect) {
                this.targetWidth = Math.trunc(javaFloat(this.targetHeight * viewportAspect));
            } else {
                this.targetHeight = Math.trunc(javaFloat(this.targetWidth / viewportAspect));
            }
        }
    }

    private applyInputTransform(container: GameContainer): void {
        this.calculateOffsets(container);
        const xoffset = this.xoffset;
        const yoffset = this.yoffset;
        const xscale = javaFloat(ScalableGame2.VIEWPORT_WIDTH / this.targetWidth);
        const yscale = javaFloat(ScalableGame2.VIEWPORT_HEIGHT / this.targetHeight);
        container.getInput().setScale(xscale, yscale);
        container
            .getInput()
            .setOffset(javaFloat(ScalableGame2.VIEWPORT_X - javaFloat(xoffset * xscale)), javaFloat(ScalableGame2.VIEWPORT_Y - javaFloat(yoffset * yscale)));
    }

    private calculateOffsets(container: GameContainer): void {
        this.xoffset = 0;
        this.yoffset = 0;
        if (this.targetHeight < container.getHeight()) {
            this.yoffset = Math.trunc((container.getHeight() - this.targetHeight) / 2);
        }
        if (this.targetWidth < container.getWidth()) {
            this.xoffset = Math.trunc((container.getWidth() - this.targetWidth) / 2);
        }
    }

    public getNormalWidth(): number {
        return this.normalWidth;
    }

    public getNormalHeight(): number {
        return this.normalHeight;
    }
}
