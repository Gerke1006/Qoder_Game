import './styles/main.css';
import * as Phaser from 'phaser';
import { gameConfig } from './game/config/gameConfig';
import { audio } from './game/systems/AudioSystem';

/**
 * 应用入口。
 *
 * 这里只做三件事：引入全局样式、创建 Phaser.Game、把首次用户手势接到音频解锁。
 * 任何玩法、场景、系统逻辑都不要写进本文件。
 */
const game = new Phaser.Game(gameConfig);

// 浏览器自动播放策略：首次手势后才能出声；之后每次手势顺带恢复被挂起的上下文。
const unlockAudio = (): void => audio.unlock();
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);

// 仅开发环境暴露实例，方便在浏览器控制台检查场景与状态；构建产物不含此句柄。
if (import.meta.env.DEV) {
  (window as unknown as { game: Phaser.Game }).game = game;
}
