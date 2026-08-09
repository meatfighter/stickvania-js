package stickvania;

import org.newdawn.slick.*;

public class DraculaBat extends Thing {

  private static final int[] spriteSequence = { 1, 2, 3, 2 };

  public int direction;
  private int spriteIndex;
  private int spriteDelay;
  public float amplitude;
  public float Y;

  public DraculaBat(Main main) {
    super(main, 32, 32);
    spriteDelay = main.random.nextInt(11);
    spriteIndex = main.random.nextInt(4);
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

    return true;
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {
    main.draw(main.bats[direction][spriteSequence[spriteIndex]], x, y);
  }

  public void render(GameContainer gc, Graphics g, float fade) throws SlickException {
    main.drawFaded(main.bats[direction][spriteSequence[spriteIndex]],
        x, y, fade);
  }
}

