package stickvania;

import org.newdawn.slick.*;
import org.newdawn.slick.util.*;

public class Wrapping extends Thing {

  private int direction;
  private int spriteIndex;
  private int spriteIndexIncrementor;
  private float Y;
  private float angle;

  public Wrapping(Main main, float x, float y, int direction) {
    super(main, 32, 32);
    this.x = x;
    this.Y = this.y = y;
    this.direction = direction;
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {

    if (main.intersectsSimon(this)) {
      main.hurtSimon(2);
      kill = true;
    }

    if (main.intersectsWhip(this) || main.intersectsWeapon(this) || kill) {
      main.pushThing(new Spark(main, this));
      main.pushThing(new Flame(main, x, y, 0, 0, -0.05f, 0, 10));
      main.addPoints(100);
      main.playSound(main.snuffed);
      return false;
    }

    if (main.timeFrozen == 0) {
      if (++spriteIndexIncrementor == 35) {
        spriteIndexIncrementor = 0;
        if (++spriteIndex == 2) {
          spriteIndex = 0;
        }
      }

      y = Y + 20f * (float)FastTrig.sin(angle);
      angle += 0.03f;
      float targetY = main.simon.y + 16f;
      if (Y > targetY) {
        Y -= 1f;
      } else if (Y < targetY) {
        Y += 1f;
      }

      if (direction == Main.RIGHT) {
        x += 1;
        if (x > main.camera + 576) {
          return false;
        }
      } else {
        x -= 1;
        if (x < main.camera - 64) {
          return false;
        }
      }
    }

    return true;
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {
    main.draw(main.wrappings[direction][spriteIndex], x, y);
  }
}
