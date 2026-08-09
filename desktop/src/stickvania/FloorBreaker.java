package stickvania;

import org.newdawn.slick.*;

public class FloorBreaker extends Thing {

  private int breakDelay = 91;
  private int X = 159;
  private int delay = 1;

  public FloorBreaker(Main main) {
    super(main);
  }

  private void removeBlock(int a, int b) {
    main.removeBlock(a, b);
    int x = a << 5;
    int y = b << 5;
    main.pushThing(new BrickFragment(main, x, y, -1f, -2f));
    main.pushThing(new BrickFragment(main, x + 8, y, 1f, -3f));
    main.pushThing(new BrickFragment(main, x, y + 8, -1f, -4f));
    main.pushThing(new BrickFragment(main, x + 8 + 8, y, 1f, -5f));
    main.playSound(main.breaks_wall);
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {

    if (breakDelay <= 0) {
      breakDelay = 23;
      if (main.walls[6][144] != Main.WALL_EMPTY) {
        removeBlock(144, 6);
      } else if (main.walls[6][145] != Main.WALL_EMPTY) {
        removeBlock(145, 6);
      } else if (main.walls[7][146] != Main.WALL_EMPTY) {
        removeBlock(146, 7);
      } else if (main.walls[8][147] != Main.WALL_EMPTY) {
        removeBlock(147, 8);
      } else if (X != 143) {
        removeBlock(X, 10);
        X--;
      } else if (delay > 0) {
        delay--;
      } else {
        main.floorBreaking = false;
        main.fadeState = Main.FADE_OUT;
        main.fadeReason = Main.FADE_REASON_SHOW_MAP;
        return false;
      }
    } else {
      breakDelay--;
    }

    return true;
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {
  }
}
