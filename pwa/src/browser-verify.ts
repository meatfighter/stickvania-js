import { AppGameContainer, BasicGame, Display, Image, ResourceLoader, type GameContainer, type Graphics } from "slick2d-ts";
import { StickvaniaBufferedGame } from "./stickvania/StickvaniaBufferedGame.js";

const result = document.querySelector<HTMLElement>("#result");
const host = document.querySelector<HTMLElement>("#game-host");
if (result === null || host === null) {
    throw new Error("Browser verification fixture is missing required elements.");
}

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

class StickvaniaSmokeGame extends BasicGame {
    public rendered = false;

    public constructor(private readonly titleImage: Image) {
        super("Stickvania browser verification");
    }

    public init(_gc: GameContainer): void {}

    public update(_gc: GameContainer, _delta: number): void {}

    public render(_gc: GameContainer, g: Graphics): void {
        g.drawImage(this.titleImage, 0, 0);
        this.rendered = true;
    }
}

async function waitForRender(game: StickvaniaSmokeGame): Promise<void> {
    const deadline = performance.now() + 5000;
    while (!game.rendered && performance.now() < deadline) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    assert(game.rendered, "Buffered Stickvania fixture did not render a browser frame.");
}

async function verify(): Promise<void> {
    ResourceLoader.clearCache();
    ResourceLoader.removeAllResourceLocations();
    ResourceLoader.addResourceLocation(new URL("./", window.location.href));
    ResourceLoader.setCacheBust(null);
    await ResourceLoader.preloadResources(["images/title_screen.png"], { concurrency: 2 });

    const title = new Image("images/title_screen.png");
    await ResourceLoader.waitForAll();
    assert(title.getWidth() > 0 && title.getHeight() > 0, "Stickvania title image did not decode.");

    Display.setParent(host);
    const game = new StickvaniaSmokeGame(title);
    const buffered = new StickvaniaBufferedGame(game, "crisp");
    const container = new AppGameContainer(buffered, 1024, 832, false);
    container.setLoopSuspended(false);
    container.setHighDpiEnabled(true);
    container.setMaxDevicePixelRatio(2);
    try {
        await container.start();
        await waitForRender(game);
        assert(buffered.getPresentationInfo().physicalWidth > 0, "Buffered presentation did not acquire a physical width.");
        buffered.setScalingPreference("smooth");
        buffered.setScalingPreference("pixel-perfect");
        buffered.setScalingPreference("crisp");
    } finally {
        container.destroy();
        title.destroy();
        Display.setParent(null);
    }
}

void verify().then(
    () => {
        result.dataset.status = "passed";
        result.textContent = "Stickvania browser verification passed.";
    },
    (error: unknown) => {
        console.error(error);
        result.dataset.status = "failed";
        result.textContent = error instanceof Error ? (error.stack ?? error.message) : String(error);
    }
);
