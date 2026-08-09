package stickvania;

import org.newdawn.slick.*;

public class Bone extends Thing {

  private float angle;
  private float vAngle;

  public Bone(Main main, float x, float y, float vx, float vy) {
    super(main, 32, 32);
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;

    vAngle = vx > 0 ? 6 : -6;
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {

    if (main.intersectsSimon(this)) {
      main.hurtSimon(2);
      kill = true;
    }

    if (main.intersectsWhip(this) || main.intersectsWeapon(this) || kill) {
      main.pushThing(new Spark(main, this));
      main.pushThing(new Flame(main, x + 4, y, 0, 0, -0.05f, 0, 10));
      main.addPoints(100);
      main.playSound(main.snuffed);
      return false;
    }

    if (main.timeFrozen == 0) {
      angle += vAngle;
      x += vx;
      y += vy;
      vy += Main.GRAVITY;
      if (y > 352 || x < main.camera - 96 || x > main.camera + 576) {
        return false;
      }
    }

    return true;
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {
    main.draw(main.bone, x + 8, y, angle);
  }
}
