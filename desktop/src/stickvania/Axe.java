package stickvania;

import org.newdawn.slick.*;

public class Axe extends Thing {

  public float angle;
  public float vAngle;
  public int soundDelay;

  public Axe(Main main, float x, float y, int direction) {
    super(main, 32, 32);
    this.x = x;
    this.y = y;
    this.vx = direction == Main.RIGHT ? 3 : -3;
    this.vAngle = direction == Main.RIGHT ? 6 : -6;
    this.vy = -6.5f;
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {

    if (soundDelay > 0) {
      soundDelay--;
    } else {
      soundDelay = 20;
      main.playSound(main.spinning);
    }

    angle += vAngle;
    x += vx;
    y += vy;
    vy += Main.GRAVITY;
    if (x < main.camera - 96 || x > main.camera + 576 || y > 352) {
      return false;
    }
    return true;
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {
    main.draw(main.axe, x, y, angle);
  }
}
