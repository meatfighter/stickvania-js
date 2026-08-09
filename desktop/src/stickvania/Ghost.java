package stickvania;

import org.newdawn.slick.*;

public class Ghost extends Thing {

  private static final float FRACTION = 1f / 91f;
  public boolean active;
  private int fadeIn;
  private int direction;
  private int spriteIndex;
  private float targetX;
  public int hits = 2;
  private int stunned;

  public Ghost(Main main, float x, float y) {
    super(main, 32, 32);
    this.x = x;
    this.y = y;    
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {

    if (fadeIn == 91) {
      if (kill) {
        hits = 0;
        stunned = 0;
      }

      if (stunned > 0) {
        stunned--;
      } else if (main.intersectsWhip(this)
          || main.intersectsWeapon(this) || kill) {
        main.pushThing(new Spark(main, this));
        if (--hits <= 0) {
          if (main.random.nextBoolean()) {
            main.pushThing(main.createCandleItem((int)x, (int)y, 'h'));
          }
          main.pushThing(new Flame(main, x, y, 0, 0, -0.05f, 0, 10));
          main.addPoints(300);
          main.playSound(main.killed_4);
          return false;
        } else {
          stunned = 45;
          main.playSound(main.stunned);
        }
      }

      if (main.intersectsSimon(this)) {
        main.hurtSimon(2);
      }
    }

    if (main.timeFrozen == 0) {
      if (active) {
        if (fadeIn < 91) {
          fadeIn++;
        } else {
          if (direction == Main.LEFT) {
            x -= 0.75f;
            if (x <= targetX) {              
              targetX = main.simon.x + 96f;
              direction = targetX < x ? Main.LEFT : Main.RIGHT;
            }
          } else {
            x += 0.75f;
            if (x >= targetX) {              
              targetX = main.simon.x - 64f;
              direction = targetX < x ? Main.LEFT : Main.RIGHT;
            }
          }
          if (main.simon.y + 12 < y) {
            y -= 0.25f;
          } else if (main.simon.y + 12 > y) {
            y += 0.25f;
          }
        }
      } else if (main.intersectsSimon(this)) {
        active = true;
        y += 64f;
        if (main.simon.direction == Main.LEFT) {
          x += 128f;
          direction = Main.LEFT;
          targetX = main.simon.x - 64f;
        } else {
          x -= 128f;
          direction = Main.RIGHT;
          targetX = main.simon.x + 96f;
        }
      }
    }

    return true;
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {
    if (fadeIn > 90) {
      main.draw(main.ghosts[direction][spriteIndex], x, y);
    } else {
      main.drawFaded(main.ghosts[direction][spriteIndex],
        x, y, fadeIn * FRACTION);
    }
  }
}
