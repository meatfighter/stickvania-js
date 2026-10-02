export const PIT_DESPAWN_Y = 352;

export function isDescendingBelowStage(thing: { readonly y: number; readonly vy: number }): boolean {
    return thing.vy > 0 && thing.y > PIT_DESPAWN_Y;
}
