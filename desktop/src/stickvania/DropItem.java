package stickvania;

import org.newdawn.slick.*;

public class DropItem extends Thing {

  public static final int TYPE_AXE = 0;
  public static final int TYPE_CHEST = 1;
  public static final int TYPE_BOOMERANG = 2;
  public static final int TYPE_CROWN = 3;
  public static final int TYPE_DAGGER = 4;
  public static final int TYPE_DOUBLE = 5;
  public static final int TYPE_HOLY_WATER = 6;
  public static final int TYPE_KILL_ALL = 7;
  public static final int TYPE_LARGE_HEART = 8;
  public static final int TYPE_MEAT = 9;
  public static final int TYPE_MONEY_BAG = 10;
  public static final int TYPE_1UP = 11;
  public static final int TYPE_POTION = 12;
  public static final int TYPE_STOP_WATCH = 13;
  public static final int TYPE_TRIPLE = 14;
  public static final int TYPE_WHIP = 15;

  public static final float FRACTION = 1f / 91f;

  public int type;
  public boolean disappears = true;
  public int lifeTime = 728;

  public DropItem(Main main, int x, int y, int type) {
    super(main, 32, 32);
    this.x = x;
    this.y = y;
    this.type = main.weaponType == Main.WEAPON_TYPE_STOP_WATCH
        && (type == TYPE_DOUBLE || type == TYPE_TRIPLE)
            ? TYPE_LARGE_HEART
            : type;
  }

  @Override
  public boolean update(GameContainer gc) throws SlickException {
    applyGravity();

    if (main.intersectsSimon((int)x, (int)y, 31 + (int)x, 31 + (int)y)) {

      switch(type) {
        case TYPE_CHEST:
        case TYPE_MONEY_BAG:
        case TYPE_CROWN:
          main.playSound(main.got_money);
          break;
        case TYPE_1UP:
          break;
        case TYPE_WHIP:
          break;
        case TYPE_POTION:
          main.playSound(main.gain_potion);
          break;
        case TYPE_KILL_ALL:
          main.playSound(main.kill_all_sfx);
          break;
        case TYPE_DOUBLE:
        case TYPE_TRIPLE:
          break;
        case TYPE_AXE:
        case TYPE_BOOMERANG:
        case TYPE_HOLY_WATER:
        case TYPE_DAGGER:
        case TYPE_STOP_WATCH:
        case TYPE_MEAT:
        default:
          main.playSound(main.got_weapon);
          break;
      }

      switch(type) {
        case TYPE_AXE:
          collectWeapon(Main.WEAPON_TYPE_AXE);
          break;
        case TYPE_CHEST:
          main.addPoints(this);
          break;
        case TYPE_BOOMERANG:
          collectWeapon(Main.WEAPON_TYPE_BOOMERANG);
          break;
        case TYPE_CROWN:
          main.addPoints(this);
          break;
        case TYPE_DAGGER:
          collectWeapon(Main.WEAPON_TYPE_DAGGER);
          break;
        case TYPE_DOUBLE:
          collectRepeatUpgrade(Main.WEAPON_REPEATS_DOUBLE);
          break;
        case TYPE_HOLY_WATER:
          collectWeapon(Main.WEAPON_TYPE_HOLY_WATER);
          break;
        case TYPE_KILL_ALL:
          main.fireSparks(x, y);
          main.killAll();
          break;
        case TYPE_LARGE_HEART:
          main.addHearts(5);
          break;
        case TYPE_MEAT:
          main.restoreHealth();
          break;
        case TYPE_MONEY_BAG:
          main.addPoints(this);
          break;
        case TYPE_1UP:
          main.addPlayers(1);
          break;
        case TYPE_POTION:
          main.simon.invincible = 728;
          main.simon.drankPotion = true;
          break;
        case TYPE_STOP_WATCH:
          collectWeapon(Main.WEAPON_TYPE_STOP_WATCH);
          break;
        case TYPE_TRIPLE:
          collectRepeatUpgrade(Main.WEAPON_REPEATS_TRIPLE);
          break;
        case TYPE_WHIP:
          // Whip-upgrade flashing bypasses normal Simon updates temporarily;
          // never resume a pre-upgrade windup after that presentation state.
          PlayerActionPolicy.cancelSimonAction(main);
          main.advanceWhip();
          break;
      }

      return false;
    }

    if (disappears && --lifeTime == 0) {
      if (type == TYPE_WHIP) {
        main.whipDestroyed();
      }
      return false;
    }

    return true;
  }

  private void collectWeapon(int weaponType) {
    // If a different weapon is collected before frame 20 of a queued throw,
    // cancel instead of silently morphing the pending throw into the new weapon.
    if (main.simon.throwing
        && main.simon.whipIncrementor < 20
        && main.weaponType != weaponType) {
      PlayerActionPolicy.cancelSimonAction(main);
    }
    main.setWeapon(weaponType);
  }

  private void collectRepeatUpgrade(int weaponRepeats) {
    if (main.weaponType == Main.WEAPON_TYPE_STOP_WATCH) {
      // This repeat item existed before StopWatch was equipped. Consume it
      // normally and preserve pickup feedback, but never expose repeat state
      // that has no useful StopWatch meaning.
      main.weaponRepeats = Main.WEAPON_REPEATS_SINGLE;
      main.repeatsFlashing = 0;
      main.playSound(main.got_double);
      return;
    }
    if (weaponRepeats < main.weaponRepeats) {
      // Preserve pickup feedback for a stale lower-tier item without allowing
      // it to downgrade a newer repeat upgrade.
      main.playSound(main.got_double);
      return;
    }
    main.setWeaponRepeats(weaponRepeats);
  }

  @Override
  public void render(GameContainer gc, Graphics g) throws SlickException {
    if (lifeTime > 90) {
      main.draw(main.dropItems[type], x, y);
    } else {
      main.drawFaded(main.dropItems[type], x, y, lifeTime * FRACTION);
    }
  }
}
