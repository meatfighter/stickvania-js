package stickvania;

/** Production configuration methods; no display, audio, input polling, or preference writes. */
public final class ModeConfigurationTest {
  private static void check(boolean ok, String label) {
    if (!ok) throw new AssertionError(label);
  }

  private static int delay(int base, float multiplier, boolean hard) {
    return hard && base > 0 ? Math.max(1, (int)(base * multiplier)) : base;
  }

  public static void main(String[] args) throws Throwable {
    Main main = new Main();
    main.simon = new Simon(main);
    Door sentinel = new Door(main, 0, 0, Main.RIGHT, true);
    int[] modes = { Main.MODE_TITLE_SCREEN, Main.MODE_DEMO, Main.MODE_CONTINUE_SCREEN,
        Main.MODE_PLAYING, Main.MODE_INTRO, Main.MODE_MAP, Main.MODE_CASTLE_FALLS,
        Main.MODE_CREDITS, Main.MODE_INPUT_CONFIG };
    int cases = 0;
    for (int mode : modes) for (int difficulty : new int[] { Main.DIFFICULTY_NORMAL, Main.DIFFICULTY_HARD }) {
      boolean recorded = mode == Main.MODE_DEMO || mode == Main.MODE_CREDITS;
      boolean hard = difficulty == Main.DIFFICULTY_HARD && !recorded;
      for (int mask = 0; mask < 128; mask++) {
        main.mode = mode;
        main.difficulty = difficulty;
        main.stageIndex = 2;
        main.time = 0;
        main.playerPower = (mask & 1) != 0 ? 0 : 16;
        main.door = (mask & 2) != 0 ? sentinel : null;
        main.beatStage = (mask & 4) != 0;
        main.floorBreaking = (mask & 8) != 0;
        main.simon.dead = (mask & 16) != 0 ? 1 : 0;
        main.simon.hurt = (mask & 32) != 0;
        main.simon.supported = (mask & 64) != 0;
        main.simon.G = 123f;
        main.simon.jumpVelocity = 456f;
        main.simon.vx = 3.25f;
        main.simon.vy = -1.5f;
        main.syncSimonPhysicsProfile();
        check(main.simon.G == (recorded ? Main.GRAVITY : Main.PLAYER_CONTROLLED_GRAVITY), "G");
        check(main.simon.jumpVelocity == (recorded ? Main.SIMON_JUMP_VELOCITY : Main.PLAYER_CONTROLLED_JUMP_VELOCITY), "jumpVelocity");
        check(main.simon.vx == 3.25f && main.simon.vy == -1.5f, "momentum changed");
        check(main.difficulty == difficulty, "selection changed");
        check(main.adjustEnemyHits(3) == (hard ? 4 : 3), "enemy hits");
        check(main.adjustEnemyActiveCap(2) == (hard ? 3 : 2), "active cap");
        for (int power : new int[] { 1, 2, 3, 16 })
          check(main.adjustSimonDamage(power) == (hard && power < 16 ? power + 1 : power), "damage");
        for (int base : new int[] { 0, 1, 43, 90, 91, 273 }) {
          check(main.adjustEnemySpawnDelay(base) == delay(base, 0.66f, hard), "spawn delay");
          check(main.adjustEnemyCooldown(base) == delay(base, 0.7f, hard), "cooldown");
          check(main.adjustEnemyBehaviorDelay(base) == delay(base, 0.75f, hard), "behavior delay");
        }
        cases++;
      }
    }
    main.simon = null;
    main.syncSimonPhysicsProfile();
    System.out.println("ModeConfigurationTest passed " + cases + " production configuration cases.");
  }
}
