package stickvania;

import org.newdawn.slick.*;

public class MovingPlatform extends Thing {

  public static final int STATE_RIGHT_ACCELERATING = 0;
  public static final int STATE_RIGHT_CONSTANT = 1;
  public static final int STATE_LEFT_ACCELERATING = 2;
  public static final int STATE_LEFT_CONSTANT = 3;

  public static final float ACCELERATION_DISTANCE = 16f;
  public static final int ACCELERATION_TIME = 45;
  public static final float VELOCITY = 1f;

  public static final float A = 2 * ACCELERATION_DISTANCE
      / (ACCELERATION_TIME * ACCELERATION_TIME);

  public int state = STATE_RIGHT_ACCELERATING;
  public float x1;
  public float x2;
  
  public MovingPlatform(Main main, float x1, float x2, float y) {
    super(main, 64, 16);
    this.x = x1;
    this.y = y;
    this.x1 = x1;
    this.x2 = x2;
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {

    x += vx;

    switch(state) {
      case STATE_RIGHT_ACCELERATING:
        vx += A;
        if (vx >= VELOCITY) {
          vx = VELOCITY;
          state = STATE_RIGHT_CONSTANT;
        }
        break;
      case STATE_RIGHT_CONSTANT:
        if (x >= x2 - 2 * ACCELERATION_DISTANCE) {
          state = STATE_LEFT_ACCELERATING;
        }
        break;
      case STATE_LEFT_ACCELERATING:
        vx -= A;
        if (vx <= -VELOCITY) {
          vx = -VELOCITY;
          state = STATE_LEFT_CONSTANT;
        }
        break;
      case STATE_LEFT_CONSTANT:
        if (x <= x1 + 2 * ACCELERATION_DISTANCE) {
          state = STATE_RIGHT_ACCELERATING;
        }
        break;
    }

    return true;
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {
    main.draw(main.platform, x, y);
  }
}
