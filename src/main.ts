import './styles/main.css';
import * as Phaser from 'phaser';
import { gameConfig } from './game/config/gameConfig';
import { audio } from './game/systems/AudioSystem';

/**
 * 应用入口。
 *
 * 这里只引入全局样式、创建 Phaser.Game，并管理音频的手势/可见性/销毁生命周期。
 * 任何玩法、场景、系统逻辑都不要写进本文件。
 */
const game = new Phaser.Game(gameConfig);

// capture 先于游戏点击处理解锁；后续手势也可重试被自动播放策略拒绝的恢复。
const unlockAudio = (): void => audio.unlock();
const updateAudioVisibility = (): void => audio.setHidden(document.hidden);
window.addEventListener('pointerdown', unlockAudio, true);
window.addEventListener('keydown', unlockAudio, true);
document.addEventListener('visibilitychange', updateAudioVisibility);
updateAudioVisibility();

game.events.once(Phaser.Core.Events.DESTROY, () => {
  window.removeEventListener('pointerdown', unlockAudio, true);
  window.removeEventListener('keydown', unlockAudio, true);
  document.removeEventListener('visibilitychange', updateAudioVisibility);
  audio.dispose();
});

// 仅开发环境暴露实例，方便在浏览器控制台检查场景与状态；构建产物不含此句柄。
if (import.meta.env.DEV) {
  (window as unknown as { game: Phaser.Game }).game = game;
}
