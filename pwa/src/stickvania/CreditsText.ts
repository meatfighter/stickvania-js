/** Shared immutable text: runtime rendering and current-save validation must agree. */
export const CREDITS_TITLES = [
    "MAIN PROGRAMMER",
    "PLAYER PROGRAMMER",
    "ENEMY PROGRAMMER",
    "MAIN DESIGNER",
    "VRAM DESIGNER",
    "OBJECT DESIGNER",
    "TOTAL DIRECTOR",
    "PRODUCER",
    "TECHNICAL ADVISOR",
    "PLANNER",
    "CODE GUY",
    "INSPIRED BY",
    "PRESENTED BY"
] as const;
export const CREDITS_PERSON = "MICHAEL BIRKEN";
export const CREDITS_INSPIRATION = "THE BRILLIANT WORKS OF KONAMI";
export const CREDITS_PRESENTER = "MEATFIGHTER.COM";

export function creditsSecondLine(index: number): string {
    return index === 12 ? CREDITS_PRESENTER : index === 11 ? CREDITS_INSPIRATION : CREDITS_PERSON;
}
