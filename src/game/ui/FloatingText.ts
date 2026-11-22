import * as Phaser from 'phaser';
import { FontKeys, UiKeys } from '../types';
import { prefersReducedMotion } from './Theme';

type FloatTarget = Phaser.GameObjects.BitmapText | Phaser.GameObjects.Container;

function floatUp(scene: Phaser.Scene, obj: FloatTarget, rise: number, life: number): void {
  obj.setDepth(70);
  if (prefersReducedMotion()) {
    scene.time.delayedCall(life * 0.55, () => obj.setAlpha(0));
    scene.time.delayedCall(life, () => obj.destroy());
    return;
  }
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
    .bitmapText(0, 0, crit ? FontKeys.Crit : FontKeys.Normal, `${amount}`)
    .setOrigin(0.5)
    .setFontSize(crit ? 40 : 26);
  const parts: Phaser.GameObjects.GameObject[] = [text];
  if (crit) {
    parts.unshift(scene.add.image(0, 0, UiKeys.DmgCritBurst).setDisplaySize(120, 80));
  }
  const group = scene.add.container(x + Phaser.Math.Between(-8, 8), y, parts);
  if (!prefersReducedMotion()) {
    group.setScale(crit ? 0.6 : 0.7);
    scene.tweens.add({
      targets: group,
      scale: 1,
      duration: crit ? 180 : 120,
      ease: crit ? 'Back.easeOut' : 'Quad.easeOut'
    });
  }
  floatUp(scene, group, crit ? 62 : 44, crit ? 900 : 700);
}

export function spawnBaseHitFloat(scene: Phaser.Scene, x: number, y: number, amount: number): void {
  const text = scene.add.bitmapText(0, 0, FontKeys.Hit, `-${amount}`).setOrigin(0.5).setFontSize(32);
  const arrow = scene.add.image(0, text.height / 2 + 8, UiKeys.DmgTakenArrow).setDisplaySize(30, 12);
  const group = scene.add.container(x, y, [text, arrow]);
  if (!prefersReducedMotion()) {
    group.setScale(0.6);
    scene.tweens.add({ targets: group, scale: 1, duration: 140, ease: 'Back.easeOut' });
  }
  floatUp(scene, group, -34, 900);
}

export function spawnGoldFloat(scene: Phaser.Scene, x: number, y: number, amount: number): void {
  const icon = scene.add.image(-16, 0, UiKeys.IconGold).setDisplaySize(22, 22);
  const text = scene.add.bitmapText(4, 0, FontKeys.Normal, `${amount}`).setOrigin(0, 0.5);
  text.setFontSize(22);
  const group = scene.add.container(x, y, [icon, text]);
  if (!prefersReducedMotion()) {
    group.setScale(0.7);
    scene.tweens.add({ targets: group, scale: 1, duration: 130, ease: 'Quad.easeOut' });
  }
  floatUp(scene, group, 40, 800);
}
