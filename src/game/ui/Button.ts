import * as Phaser from 'phaser';
import type { UiKey } from '../types';
import { audio } from '../systems/AudioSystem';
import { createPlaque, creamStyle, inkStyle, Palette } from './Theme';

/**
 * 美术按钮：交付素材的深色木底 plaque + 羊皮纸亮字（木底用亮字、纸底用墨字）。
 *
 * 四态反馈：常态 / 悬停放大提亮 / 按下收缩 / 禁用半透明；
 * 监听挂在容器上，随场景显示列表一起销毁，不需要手动解绑。
 */
export interface ArtButtonOptions {
  width?: number;
  height?: number;
  fontSize?: number;
  icon?: UiKey;
  disabled?: boolean;
}

export interface ArtButton {
  container: Phaser.GameObjects.Container;
  setLabel(label: string): void;
  setDisabled(disabled: boolean): void;
  setSelected(selected: boolean): void;
  destroy(): void;
}

export function createArtButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  options: ArtButtonOptions = {}
): ArtButton {
  const width = options.width ?? 240;
  const height = options.height ?? Math.round(Math.min(64, Math.max(40, width * 0.22)));
  const fontSize = options.fontSize ?? 20;
  const plaque = createPlaque(scene, 0, 0, width, height);

  const container = scene.add.container(x, y, [plaque]);
  container.setSize(width, height);

  const text = scene.add
    .text(options.icon ? 12 : 0, 1, label, creamStyle(fontSize, true))
    .setOrigin(0.5);
  container.add(text);

  if (options.icon) {
    const icon = scene.add.image(-width / 2 + 34, 0, options.icon).setDisplaySize(30, 30);
    container.add(icon);
    text.setX(14);
  }

  let disabled = options.disabled ?? false;
  let hovering = false;
  let selected = false;
  let pressed = false;

  const applyState = (): void => {
    container.setAlpha(disabled ? 0.55 : 1);
    const scale = disabled ? 1 : hovering ? 1.045 : 1;
    container.setScale(scale);
    plaque.setTint(disabled ? 0xffffff : selected ? 0xffdf9e : hovering ? 0xfff4dc : 0xffffff);
  };

  container.setInteractive({ useHandCursor: true });
  container.on(Phaser.Input.Events.POINTER_OVER, () => {
    hovering = true;
    applyState();
  });
  container.on(Phaser.Input.Events.POINTER_OUT, () => {
    hovering = false;
    pressed = false;
    applyState();
  });
  container.on(Phaser.Input.Events.POINTER_DOWN, () => {
    if (disabled) {
      return;
    }
    pressed = true;
    container.setScale(0.97);
    audio.play('click');
  });
  container.on(Phaser.Input.Events.POINTER_UP, () => {
    if (disabled || !pressed) {
      return;
    }
    pressed = false;
    applyState();
    onClick();
  });
  container.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, () => {
    pressed = false;
    applyState();
  });

  applyState();

  return {
    container,
    setLabel(next: string): void {
      text.setText(next);
    },
    setDisabled(next: boolean): void {
      disabled = next;
      applyState();
    },
    setSelected(next: boolean): void {
      selected = next;
      applyState();
    },
    destroy(): void {
      container.destroy();
    }
  };
}

/** 顶栏小按钮（静音 / 暂停）：同一套 plaque 语言，尺寸更紧凑。 */
export function createTopButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  width = 116
): ArtButton {
  return createArtButton(scene, x, y, label, onClick, { width, height: 34, fontSize: 15 });
}

/** 标题文字：羊皮纸上的大号墨字，带轻微投影。 */
export function createTitleText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  size = 40
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, label, {
      ...inkStyle(size, true),
      shadow: { offsetX: 0, offsetY: 2, color: Palette.parchmentDark, blur: 0, fill: true }
    })
    .setOrigin(0.5);
}
