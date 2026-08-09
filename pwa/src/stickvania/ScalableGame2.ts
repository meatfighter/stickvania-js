import { Game, ScalableGame2 as SlickScalableGame2 } from "slick2d-ts";

export class ScalableGame2 extends SlickScalableGame2 {
    public constructor(held: Game, normalWidth: number, normalHeight: number, maintainAspect: boolean = true) {
        super(held, normalWidth, normalHeight, maintainAspect);
    }
}
