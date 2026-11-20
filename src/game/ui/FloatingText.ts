import * as Phaser from 'phaser';
import { FontKeys, UiKeys } from '../types';

/**
 * 战斗飘字：直接使用交付美术的 BMFont 数字条。
 *
 * 普通伤害 = 琥珀数字，暴击 = 烈焰数字放大弹跳，基地受击 = 血红数字；
 * 金币飘字 = 金币图标 + 琥珀数字。全部 tween 结束即销毁，不留残留对象。
 */

type FloatTarget = Phaser.GameObjects.BitmapText | Phaser.GameObjects.Container;

function floatUp(scene: Phaser.Scene, obj: FloatTarget, rise: number, life: number): void {
  obj.setDepth(70);
  scene.tweens.add({
    targets: obj,
    y: obj.y - rise,
    duration: life,
    ease: 'Cubic.easeOut'
  });
  scene.tweens.add({
    targets: obj,
    alpha: 0,
    delay: life * 0.55,
    duration: life * 0.45,
    onComplete: () => obj.destroy()
  });
}

export function spawnDamageFloat(scene: Phaser.Scene, x: number, y: number, amount: number, crit: boolean): void {
  const text = scene.add
    .bitmapText(x + Phaser.Math.Between(-8, 8), y, crit ? FontKeys.Crit : FontKeys.Normal, `${amount}`)
    .setOrigin(0.5);
  text.setFontSize(crit ? 40 : 26);
  if (crit) {
    text.setScale(0.4);
    text.setAngle(Phaser.Math.Between(-8, 8));
    scene.tweens.add({
      targets: text,
      scale: 1.15,
      duration: 160,
      ease: 'Back.easeOut',
      yoyo: true,
      hold: 60
    });
    floatUp(scene, text, 62, 900);
  } else {
    text.setScale(0.7);
    scene.tweens.add({ targets: text, scale: 1, duration: 120, ease: 'Quad.easeOut' });
    floatUp(scene, text, 44, 700);
  }
}

export function spawnBaseHitFloat(scene: Phaser.Scene, x: number, y: number, amount: number): void {
  const text = scene.add.bitmapText(x, y, FontKeys.Hit, `-${amount}`).setOrigin(0.5);
  text.setFontSize(32);
  text.setScale(0.6);
  scene.tweens.add({ targets: text, scale: 1.1, duration: 140, ease: 'Back.easeOut' });
  floatUp(scene, text, 52, 850);
}

export function spawnGoldFloat(scene: Phaser.Scene, x: number, y: number, amount: number): void {
  const icon = scene.add.image(-16, 0, UiKeys.IconGold).setDisplaySize(22, 22);
  const text = scene.add.bitmapText(4, 0, FontKeys.Normal, `${amount}`).setOrigin(0, 0.5);
  text.setFontSize(22);
  const group = scene.add.container(x, y, [icon, text]);
  group.setScale(0.7);
  scene.tweens.add({ targets: group, scale: 1, duration: 130, ease: 'Quad.easeOut' });
  floatUp(scene, group, 40, 800);
}
