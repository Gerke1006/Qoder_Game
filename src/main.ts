import './styles/main.css';
import * as Phaser from 'phaser';
import { gameConfig } from './game/config/gameConfig';

/**
 * 应用入口。
 *
 * 这里只做三件事：引入全局样式、读取游戏配置、创建 Phaser.Game 实例。
 * 任何玩法、场景、系统逻辑都不要写进本文件。
 */
const game = new Phaser.Game(gameConfig);

// 仅开发环境暴露实例，方便在浏览器控制台检查场景与状态；构建产物不含此句柄。
if (import.meta.env.DEV) {
  (window as unknown as { game: Phaser.Game }).game = game;
}
