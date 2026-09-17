package stickvania;

import org.newdawn.slick.*;

public class Boomerang extends Thing {

  public static final int STATE_FOWARD = 0;
  public static final int STATE_REVERSING = 1;
  public static final int STATE_REVERSE = 2;
  public static final int STATE_REFLECTED = 3;
  public static final float G = -0.13988657844990548204158790170132f;

  public int direction;
  public int state;
  public float angle;
  public float g;
  public int soundDelay;
  public AxeKnight shieldBlockedBy;

  public Boomerang(Main main, float x, float y, int direction) {
    super(main, 32, 32);
    this.x = x;
    this.y = y;
    this.direction = direction;
    this.state = STATE_FOWARD;
    if (!PlayerActionPolicy.canSimonActionContinue(main)) {
      // Main.throwWeapon() performs the one-heart debit immediately after
      // construction. Keep this rejected object inert and pre-refund it.
      kill = true;
      this.x = main.camera - 10000;
      this.y = 10000;
      main.hearts++;
      PlayerActionPolicy.cancelSimonAction(main);
      return;
    }
    this.vx = direction == Main.RIGHT ? 3 : -3;
    this.g = direction == Main.RIGHT ? G : -G;
  }

  float getActualHorizontalVelocity() {
    switch(state) {
      case STATE_FOWARD:
        return direction == Main.RIGHT ? 3 : -3;
      case STATE_REVERSING:
      case STATE_REFLECTED:
        return vx;
      case STATE_REVERSE:
        return direction == Main.RIGHT ? -3 : 3;
      default:
        return vx;
    }
  }

  boolean isShieldBlockedBy(AxeKnight axeKnight) {
    return shieldBlockedBy == axeKnight;
  }

  boolean reflectFromAxeKnight(
      AxeKnight axeKnight, int outwardDirection) {
    if (kill || shieldBlockedBy != null
        || (outwardDirection != -1 && outwardDirection != 1)) {
      return false;
    }

    float incomingVx = getActualHorizontalVelocity();
    if (Float.isNaN(incomingVx) || Float.isInfinite(incomingVx)) {
      return false;
    }

    float speedMagnitude = Math.min(3f, Math.abs(incomingVx));
    vx = outwardDirection * speedMagnitude;
    g = outwardDirection * Math.abs(G);
    state = STATE_REFLECTED;
    shieldBlockedBy = axeKnight;
    return true;
  }

  private void refreshShieldBlock() {
    AxeKnight axeKnight = shieldBlockedBy;
    if (axeKnight == null) {
      return;
    }
    if (axeKnight.dead || axeKnight.kill || !main.intersects(this, axeKnight)) {
      shieldBlockedBy = null;
    }
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {

    refreshShieldBlock();
    if (kill) {
      return false;
    }
    if (soundDelay > 0) {
      soundDelay--;
    } else {
      soundDelay = 20;
      main.playSound(main.spinning);
    }

    switch(state) {
      case STATE_FOWARD:
        if (direction == Main.RIGHT) {
          x += 3;
          angle += 3;
          if (x >= main.camera + 448) {
            state = STATE_REVERSING;
          }
        } else {
          x -= 3;
          angle -= 3;
          if (x <= main.camera + 32) {
            state = STATE_REVERSING;
          }
        }
        break;
      case STATE_REVERSING:
        vx += g;
        x += vx;
        angle += vx;
        if (Math.abs(vx) >= 3) {
          state = STATE_REVERSE;
        }
        break;
      case STATE_REVERSE:
        if (direction == Main.RIGHT) {
          x -= 3;
          angle -= 3;
        } else {
          x += 3;
          angle += 3;
        }
        if (main.intersectsSimon(this)) {
          return false;
        }
        break;
      case STATE_REFLECTED:
        int outwardDirection = g < 0 ? -1 : g > 0 ? 1 : vx < 0 ? -1 : 1;
        float nextSpeed = Math.min(3f, Math.abs(vx) + Math.abs(g));
        vx = outwardDirection * nextSpeed;
        x += vx;
        angle += vx;
        if (main.intersectsSimon(this)) {
          return false;
        }
        break;
    }

    // Region objects update before weapons. Clearing after movement makes the
    // next region-update phase see true post-move separation rather than one
    // extra tick of stale contact ownership.
    refreshShieldBlock();
    if (x < main.camera - 96 || x > main.camera + 576) {
      return false;
    }
    return true;
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {
    main.draw(main.boomerang, x, y, angle);
  }
}
