import * as Phaser from 'phaser';

/**
 * 文本按钮工厂（UI 模块共用的最小控件）。
 *
 * 事件监听挂在文本对象自身，场景 shutdown 时随对象一起销毁，
 * 因此切场景不会残留重复的 pointerdown 回调。
 */
export function createTextButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onPointerDown: () => void
): Phaser.GameObjects.Text {
  const button = scene.add
    .text(x, y, label, {
      fontFamily: 'system-ui, "Microsoft YaHei", sans-serif',
      fontSize: '22px',
      color: '#e6e9ef',
      backgroundColor: '#2b3446',
      padding: { x: 24, y: 12 }
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true });

  button.on('pointerover', () => button.setBackgroundColor('#3c4a63'));
  button.on('pointerout', () => button.setBackgroundColor('#2b3446'));
  button.on('pointerdown', onPointerDown);

  return button;
}

/** 场景标题等静态文本统一走这里，保证字体一致。 */
export function createTitleText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  fontSize = '40px'
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, label, {
      fontFamily: 'system-ui, "Microsoft YaHei", sans-serif',
      fontSize,
      color: '#e6e9ef'
    })
    .setOrigin(0.5);
}
