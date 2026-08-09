package stickvania;

import org.newdawn.slick.*;

public class BonePillar extends Thing {

  private int direction;
  private int stunned;
  private int hits = 3;
  private int delay;
  private int bullets = 2;

  public BonePillar(Main main, float x, float y) {
    super(main, 32, 64);
    this.x = x;
    this.y = y;
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {

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
        main.pushThing(new Flame(main, x, y, -1f, 0, -0.08f, 0, 10));
        main.pushThing(new Flame(main, x, y + 32, 1, 0, -0.08f, 0, 10));
        main.addPoints(400);
        main.playSound(main.torch_breaks);
        return false;
      } else {
        stunned = 45;
        main.playSound(main.stunned);
      }
    }

    if (main.timeFrozen == 0 && Math.abs(main.simon.x - x) < 512) {
      direction = main.simon.x < x ? Main.LEFT : Main.RIGHT;

      if (delay == 0) {
        if (--bullets == 0) {
          bullets = 2;
          delay = 60;
        } else {
          delay = 364;
        }
        main.pushThing(new Fireball(main, x + 8, y + 18,
            (direction == Main.LEFT) ? -1.5f : 1.5f, 0));
        main.playSound(main.fire_ball_shot);
      } else {
        delay--;
      }
    }

    if (main.intersectsSimon(this)) {
      main.hurtSimon(2);
    }

    return true;
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {
    main.draw(main.bonePillars[direction], x, y);
  }
}
