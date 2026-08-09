package stickvania;

import org.newdawn.slick.GameContainer;
import org.newdawn.slick.Graphics;
import org.newdawn.slick.SlickException;

public class Snakes extends Thing {

  public int spriteIndex;
  public int spriteIndexIncrementor;

  public Snakes(Main main, float x, float y, float vx, float vy) {
    super(main, 3, 0, 34, 20);
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
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
      if (supported) {
        if (++spriteIndexIncrementor == 35) {
          spriteIndexIncrementor = 0;
          if (++spriteIndex == 2) {
            spriteIndex = 0;
          }
        }
      }

      if (!moveX(vx)) {
        vx = -vx;
      }
      applyGravity();
      if (y > 352 || x > main.camera + 576 || x < main.camera - 64) {
        return false;
      }
    }

    return true;
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {
    if (vx < 0) {
      main.draw(main.snakes[Main.LEFT][spriteIndex], x, y);
    } else {
      main.draw(main.snakes[Main.RIGHT][spriteIndex], x, y);
    }
  }
}
