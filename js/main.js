/** @format */

// ============================================
// start STRIKE - 星渊战机 微信小游戏
// 技术架构: Canvas 2D + 对象池 + 空间网格
// ============================================

// 统一导出入口
export { CONFIG, WEAPONS } from './config.js';
export { ObjectPool, SpatialGrid } from './utils.js';
export { Entity } from './entity.js';
export { Bullet, Laser, WingmanLaser } from './weapons.js';
export { Player, Enemy, Wingman, Item, Particle, Starfield } from './entities.js';
export { Game } from './game.js';
