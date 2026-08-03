import { GameContainer, SlickException } from "slick2d-ts";

export class AppletGameContainer2 {
    public getContainer(): GameContainer {
        throw new SlickException("AppletGameContainer2 is not available in the browser PWA shell.");
    }
}
