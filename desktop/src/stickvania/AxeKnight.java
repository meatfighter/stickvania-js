package stickvania;

import org.newdawn.slick.*;

public class AxeKnight extends Thing {

  private static final int STATE_INACTIVE = 0;
  private static final int STATE_WALKING = 1;
  private static final int STATE_STANDING = 2;
  private static final float SHIELD_BOOMERANG_RADIUS = 13f;
  private static final float SHIELD_LEFT_X = 5f;
  private static final float SHIELD_RIGHT_X = 42f;
  private static final float SHIELD_TOP = 0f;
  private static final float SHIELD_BOTTOM = 63f;

  private static final class ShieldContact {
    final Boomerang boomerang;
    final float x;
    final float y;

    ShieldContact(Boomerang boomerang, float x, float y) {
      this.boomerang = boomerang;
      this.x = x;
      this.y = y;
    }
  }

  public int hits = 3;
  public int shieldReflectionsRemaining = 3;
  public int stunned;
  private int direction;
  private int displayDirection;
  private int spriteIndex;
  private int spriteIndexIncrementor;
  private int standingDelay;
  private int state = STATE_INACTIVE;
  private int walkedDistance;
  private int throwDelay;
  private boolean hasAxe = true;
  public boolean dead;

  public AxeKnight(Main main, float x, float y) {
    super(main, 48, 64);
    this.x = x;
    this.y = y;

    hits = main.adjustEnemyHits(hits);
    shieldReflectionsRemaining = main.adjustEnemyHits(shieldReflectionsRemaining);
    throwDelay = main.adjustEnemyCooldown(main.random.nextInt(273));
  }

  public void axeGone() {
    hasAxe = true;
    throwDelay = main.adjustEnemyCooldown(main.random.nextInt(273));
  }

  private void updateDisplayDirection() {
    if (main.simon.x + 8 < x) {
      displayDirection = Main.LEFT;
    } else {
      displayDirection = Main.RIGHT;
    }
  }

  private float shieldX() {
    return x + (displayDirection == Main.LEFT
        ? SHIELD_LEFT_X : SHIELD_RIGHT_X);
  }

  private float shieldTop() {
    return y + SHIELD_TOP;
  }

  private float shieldBottom() {
    return y + SHIELD_BOTTOM;
  }

  private int shieldOutwardDirection() {
    return displayDirection == Main.LEFT ? -1 : 1;
  }

  private boolean isBoomerangProtectedOnShieldApproach(Boomerang boomerang) {
    if (kill || boomerang.kill || boomerang.shieldBlockedBy != null) {
      return false;
    }

    float velocityX = boomerang.getActualHorizontalVelocity();
    float centerX = boomerang.x + 16;
    float centerY = boomerang.y + 16;
    float shieldX = shieldX();
    boolean withinShieldHeight = centerY >= shieldTop() - SHIELD_BOOMERANG_RADIUS
        && centerY <= shieldBottom() + SHIELD_BOOMERANG_RADIUS;
    if (!withinShieldHeight) {
      return false;
    }

    return displayDirection == Main.LEFT
        ? velocityX >= 0 && centerX <= shieldX
        : velocityX <= 0 && centerX >= shieldX;
  }

  private ShieldContact getShieldContactForBoomerang(Boomerang boomerang) {
    return getShieldContactForBoomerang(boomerang, true);
  }

  private ShieldContact getShieldContactForBoomerang(
      Boomerang boomerang, boolean requireDurability) {
    if (kill
        || (requireDurability && shieldReflectionsRemaining <= 0)
        || boomerang.kill
        || boomerang.shieldBlockedBy != null) {
      return null;
    }

    float shieldX = shieldX();
    float shieldY1 = shieldTop();
    float shieldY2 = shieldBottom();
    float bodyCenterX = x + 24;
    float velocityX = boomerang.getActualHorizontalVelocity();
    float centerX = boomerang.x + 16;
    float centerY = boomerang.y + 16;
    boolean approachesFromFront = displayDirection == Main.LEFT
        ? velocityX >= 0 && centerX <= bodyCenterX
        : velocityX <= 0 && centerX >= bodyCenterX;
    if (!approachesFromFront) {
      return null;
    }

    float closestY = Math.max(shieldY1, Math.min(shieldY2, centerY));
    float dx = centerX - shieldX;
    float dy = centerY - closestY;
    if (dx * dx + dy * dy
        > SHIELD_BOOMERANG_RADIUS * SHIELD_BOOMERANG_RADIUS) {
      return null;
    }

    return new ShieldContact(boomerang, shieldX, closestY);
  }

  private ShieldContact findShieldContact() {
    Thing[] weapons = main.weaponsStack.things;
    for (int i = main.weaponsStack.top; i >= 0; i--) {
      Thing weapon = weapons[i];
      if (!(weapon instanceof Boomerang)) {
        continue;
      }
      ShieldContact contact = getShieldContactForBoomerang((Boomerang)weapon);
      if (contact != null) {
        return contact;
      }
    }
    return null;
  }

  private Boomerang tryReflectBoomerang() {
    ShieldContact contact = findShieldContact();
    if (contact == null
        || !contact.boomerang.reflectFromAxeKnight(
            this, shieldOutwardDirection())) {
      return null;
    }

    shieldReflectionsRemaining--;
    main.pushThing(new Spark(main, contact.x, contact.y, 1, 1));
    main.playSound(main.ching);
    return contact.boomerang;
  }

  private boolean intersectsDamageWeapon(Boomerang reflectedBoomerang) {
    Thing[] weapons = main.weaponsStack.things;
    for (int i = main.weaponsStack.top; i >= 0; i--) {
      Thing weapon = weapons[i];
      if (weapon instanceof Boomerang) {
        Boomerang boomerang = (Boomerang)weapon;
        // A shield reflection owns this projectile until it has fully separated
        // from the reflector. During that unresolved contact, no AxeKnight may
        // reinterpret the projectile as body damage. Also exclude the exact
        // projectile reflected earlier in this update even if the lock changes.
        if (boomerang == reflectedBoomerang
            || boomerang.shieldBlockedBy != null) {
          continue;
        }
        // The ordinary 32x32 Boomerang body box overlaps before the radius-13
        // shield circle reaches the plane. Protect a valid frontal trajectory
        // through that pre-contact interval, then let the circle reflect it.
        if ((shieldReflectionsRemaining > 0 || reflectedBoomerang != null)
            && (isBoomerangProtectedOnShieldApproach(boomerang)
                || getShieldContactForBoomerang(boomerang, false) != null)) {
          continue;
        }
      }
      if (main.intersects(weapon, this)) {
        weapon.intersected = true;
        return true;
      }
    }
    return false;
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {

    if (kill) {
      hits = 0;
      stunned = 0;
    }

    // The shield follows the side actually rendered. Stopwatch freezes that
    // display direction along with the rest of the AxeKnight presentation.
    if (main.timeFrozen == 0) {
      updateDisplayDirection();
    }

    // Shielding is passive physical behavior and remains active while the body
    // is stunned. Reflection itself does not start or refresh body stun.
    Boomerang reflectedBoomerang = tryReflectBoomerang();

    if (stunned > 0) {
      stunned--;
    } else if (main.intersectsWhip(this)
        || intersectsDamageWeapon(reflectedBoomerang) || kill) {
      main.pushThing(new Spark(main, this));
      if (--hits <= 0) {
        if (main.random.nextBoolean()) {
          main.pushThing(main.createCandleItem((int)x, (int)y, 'h'));
        }
        main.pushThing(new Flame(main, x, y + 24, 0, 0, -0.08f, 0, 10));
        main.pushThing(new Flame(main, x + 16, y + 32, 0, 0, -0.08f, 0, 10));
        main.addPoints(500);
        main.playSound(main.killed_4);
        dead = true;
        return false;
      } else {
        main.playSound(main.stunned);
        stunned = 45;
      }
    }

    if (main.intersectsSimon(this)) {
      main.hurtSimon(2);
    }

    if (main.timeFrozen == 0) {

      applyGravity();

      if (state != STATE_INACTIVE && hasAxe) {
        if (throwDelay <= 0) {
          throwDelay = main.adjustEnemyCooldown(main.random.nextInt(273));
          main.pushThing(new BoomerangAxe(
              main, x + 8,
              main.random.nextBoolean() ? y : y + 32, displayDirection, this));
          hasAxe = false;
        } else {
          throwDelay--;
        }
      }

      switch(state) {
        case STATE_INACTIVE:
          if (x >= main.camera - 96 && x <= main.camera + 576) {
            state = STATE_WALKING;
          }
          break;
        case STATE_WALKING:
          if (direction == Main.LEFT) {
            if (!moveX(-.5f) || !main.isSupportive((int)x, (int)(y + 64))) {
              direction = Main.RIGHT;
            }
          } else {
            if (!moveX(.5f)
                || !main.isSupportive((int)(x + 47), (int)(y + 64))) {
              direction = Main.LEFT;
            }
          }

          if (++spriteIndexIncrementor == 20) {
            spriteIndexIncrementor = 0;
            if (++spriteIndex == 2) {
              spriteIndex = 0;
            }
          }

          if (++walkedDistance >= 96) {
            walkedDistance = main.random.nextInt(43);
            state = STATE_STANDING;
          }
          break;
        case STATE_STANDING:
          if (++standingDelay >= main.adjustEnemyBehaviorDelay(43)) {
            standingDelay = main.adjustEnemyBehaviorDelay(
                main.random.nextInt(43));
            state = STATE_WALKING;
            float distance = main.simon.x + 8 - x;
            float aDist = Math.abs(distance);
            if (aDist < 128) {
              if (distance < 0) {
                direction = Main.RIGHT;
              } else {
                direction = Main.LEFT;
              }
            } else if (aDist > 256) {
              if (distance < 0) {
                direction = Main.LEFT;
              } else {
                direction = Main.RIGHT;
              }
            }
          }
          break;
      }
    }

    return true;
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {
    main.draw(main.axeKnights[displayDirection][spriteIndex], x, y);
  }
}
