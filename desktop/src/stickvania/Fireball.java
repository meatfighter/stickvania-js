package stickvania;

import org.newdawn.slick.*;

public class Fireball extends Thing {
  
  private Image image;

  public Fireball(Main main, float x, float y, float vx, float vy) {
    super(main, 16, 16);

    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;

    if (vx < 0) {
      image = main.fireballs[Main.LEFT];
    } else {
      image = main.fireballs[Main.RIGHT];
    }
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {

    if (main.intersectsWhip(this) || main.intersectsWeapon(this) || kill) {
      main.pushThing(new Spark(main, this));
      main.pushThing(new Flame(main, x - 8, y, 0, 0, -0.05f, 0, 10));
      main.addPoints(100);
      main.playSound(main.snuffed);
      return false;
    }

    if (main.intersectsSimon(this)) {
      main.hurtSimon(2);
      return false;
    }

    if (main.timeFrozen == 0) {
      x += vx;
      y += vy;

      if (x < main.camera - 32 || x > main.camera + 544 || y < 0 || y > 532) {
        return false;
      }
    }

    return true;
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {
    main.draw(image, x, y);
  }
}
