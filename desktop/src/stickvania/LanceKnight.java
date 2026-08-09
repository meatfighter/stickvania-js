package stickvania;

import org.newdawn.slick.*;

public class LanceKnight extends Thing {

  private static final int[] walkSpriteIndexes = { 0, 1, 2, 1 };

  public int hits = 2;
  public int stunned;
  public int direction;
  public int spriteIndex;
  public int spriteIndexIncrementor;
  public boolean changeDirection = true;
  public int changeDirectionDelay;

  public LanceKnight(Main main, float x, float y) {
    super(main, 1, 0, 30, 64);
    this.x = x;
    this.y = y;

    direction = main.random.nextBoolean() ? Main.LEFT : Main.RIGHT;
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
        main.pushThing(new Flame(main, x, y + 24, 0, 0, -0.08f, 0, 10));
        main.addPoints(400);
        main.playSound(main.killed_3);
        return false;
      } else {
        stunned = 45;
        main.playSound(main.stunned);
      }
    }

    if (main.intersectsSimon(this)) {
      main.hurtSimon(2);
    }

    if (main.timeFrozen == 0) {

      if (++spriteIndexIncrementor == 32) {
        spriteIndexIncrementor = 0;
        if (++spriteIndex == 4) {
          spriteIndex = 0;
        }
      }

      if (changeDirectionDelay > 0) {
        if (--changeDirectionDelay == 0) {
          direction = (direction == Main.LEFT) ? Main.RIGHT : Main.LEFT;
        }
      }
      
      if (direction == Main.LEFT) {
        if (!moveX(-.5f) || !main.isSupportive((int)x, (int)(y + 64))) {
          direction = Main.RIGHT;
          if (changeDirection) {
            changeDirection = false;
            changeDirectionDelay = 91;
          } else {
            changeDirection = true;
          }
        }
      } else {
        if (!moveX(.5f) || !main.isSupportive((int)(x + 31), (int)(y + 64))) {
          direction = Main.LEFT;
          if (changeDirection) {
            changeDirection = false;
            changeDirectionDelay = 91;
          } else {
            changeDirection = true;
          }
        }
      }
    }

    return true;
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {
    main.draw(main.lanceKnight[direction][walkSpriteIndexes[spriteIndex]],
        x, y);
  }
}
