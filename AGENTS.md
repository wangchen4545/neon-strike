# Neon Strike - 霓虹战机微信小游戏

## 项目概述
微信小游戏，Canvas 2D 射击游戏，玩家控制战机击败敌人。

## 技术栈
- 微信小游戏 API (wx.createCanvas, wx.onTouchStart 等)
- 纯 JavaScript，无框架
- 对象池模式
- 空间网格碰撞检测

## 关键文件
- `js/main.js` - 游戏核心（1990行），包含 Player, Enemy, Bullet, Laser, Item, Particle, Starfield, Game 等类
- `js/databus.js` - 空壳，仅作占位
- `js/player/index.js` - 空壳，导出空 Player 类
- `js/npc/enemy.js` - 空壳，导出空 Enemy 类

## 游戏配置 (CONFIG)
- 目标 FPS: 60
- 玩家生命: 3, 炸弹: 1
- 玩家无敌时间: 2000ms
- 子弹池: 500, 敌机池: 50
- 分数无敌阈值: [3000, 8000, 15000, 25000]
- 副武器升级阈值: [100000, 500000]

## 已修复的 Bug
1. **[2026-04-14]** `Player.draw(ctx)` 缺少第二个参数 game，导致 `game.scoreInvincible` 为 undefined 报错
2. **[2026-04-14]** `playThunderSound()` 函数重复定义两次，后者覆盖前者

## 已完成功能
- **[2026-04-17]** 副武器系统：Lv.1 散射高爆弹 / Lv.2 普通导弹 / Lv.3 追踪导弹，分数达标自动升级

## 当前问题
- `app.json`, `game.json` 文件内容为空，可能影响微信开发者工具识别

## 已修复
- **[2026-04-17]** 音频对象无 destroy 释放机制 - 在 `resetGame()` 中调用 `destroyAudio()` + `initAudio()` 清理并重新初始化音频上下文

## 优化建议（未实施）
1. draw() 中 `if (this.state === "playing" || this.state === "gameover")` 永远不会在 gameover 时执行，可简化
2. laserPool 初始大小只有 10，高频激光场景可能不足
3. 玩家飞机图片路径 `assets/images/zhanji.png` 硬编码，建议提取为 CONFIG 常量
