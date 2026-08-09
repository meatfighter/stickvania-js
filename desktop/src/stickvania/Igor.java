package stickvania;

import org.newdawn.slick.*;

public class Igor extends Thing {

  public int direction;
  private int spriteIndex;
  private int spriteIndexIncrementor;
  private int delay;
  private boolean active;

  public Igor(Main main, float x, float y) {
    super(main, 32, 32);
    this.x = x;
    this.y = y;
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {

    if (main.intersectsWhip(this) || main.intersectsWeapon(this) || kill) {
      main.pushThing(new Spark(main, this));
      main.pushThing(new Flame(main, x, y, 0, 0, -0.05f, 0, 10));
      if (main.random.nextBoolean()) {
        main.pushThing(main.createCandleItem((int)x, (int)y, 'h'));
      }
      main.addPoints(500);
      main.playSound(main.killed_5);
      return false;
    }

    if (main.timeFrozen == 0) {

      if (active) {
        
        applyGravity();

        if (y > 352) {
          return false;
        }

        if (supported) {
          if (++spriteIndexIncrementor == 46) {
            spriteIndexIncrementor = 0;
            if (++spriteIndex == 2) {
              spriteIndex = 0;
            }
          }

          if (delay > 0) {
            delay--;
          } else {
            vy = main.random.nextBoolean() ? -3f : -8f;
            delay = 46 + main.random.nextInt(91);
            if (main.simon.x + 16 < x) {
              direction = Main.LEFT;
              vx = -1f;
            } else {
              direction = Main.RIGHT;
              vx = 1f;
            }
          }
        } else {
          if (!moveX(vx)) {
            vx = -vx;
            if (vx < 0) {
              direction = Main.LEFT;
            } else {
              direction = Main.RIGHT;
            }
          }
        }

        if (main.intersectsSimon(this)) {
          main.hurtSimon(3);
        }

      } else if (x >= main.camera - 32 && x <= main.camera + 544) {
        active = true;
      } else if (main.simon.x + 16 < x) {
        direction = Main.LEFT;
      } else {
        direction = Main.RIGHT;
      }
    }

    return true;
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {
    main.draw(main.igors[direction][spriteIndex], x, y);
  }
}
