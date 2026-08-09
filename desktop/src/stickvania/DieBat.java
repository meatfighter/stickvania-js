package stickvania;

import org.newdawn.slick.*;

public class DieBat extends Thing {

  private static final int[] spriteSequence = { 1, 2, 3, 2 };

  private int direction;
  private int spriteIndex;
  private int spriteDelay;
  private int timeToLive = 91;

  public DieBat(Main main, float x, float y) {
    super(main, 32, 32);
    this.x = x;
    this.y = y;
    this.direction = main.random.nextBoolean() ? Main.LEFT : Main.RIGHT;
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {

    if (spriteDelay == 0) {
      spriteDelay = 10;
      if (spriteIndex == 0) {
        spriteIndex = 3;
      } else {
        spriteIndex--;
      }
    } else {
      spriteDelay--;
    }

    y -= 1f;
    if (timeToLive-- == 0) {
      main.pushThing(new Flame(main, x, y, 0, 0, -0.05f, 0, 10));
      main.playSound(main.bat_killed);
      return false;
    }

    return true;
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {
    main.draw(main.bats[direction][spriteSequence[spriteIndex]], x, y);
  }
}

