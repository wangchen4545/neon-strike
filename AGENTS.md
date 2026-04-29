# Neon Strike — 星空战机微信小游戏

## 项目概述
微信小游戏，Canvas 2D 竖版弹幕射击游戏，玩家控制战机击败敌人。

## 技术栈
- 微信小游戏 API (wx.createCanvas, wx.onTouchStart 等)
- 纯 JavaScript，模块化 ES Module
- 对象池模式 (ObjectPool) — 复用子弹/敌机/道具/粒子
- 空间网格碰撞检测 (SpatialGrid, 80px 单元)

## 文件结构
```
js/
├── main.js          # 入口，初始化 Game 并启动循环
├── game.js          # 游戏主类（~1500行）— 状态/循环/UI/碰撞/刷敌/炸弹
├── entities.js      # 实体类 — Player, Enemy, Wingman, Item, Particle, Starfield
├── weapons.js       # 武器类 — Bullet, Laser, WingmanLaser
├── stage.js         # 关卡系统 — StageManager, STAGE_DATA
├── config.js        # 配置常量 — CONFIG, WEAPONS
└── utils.js         # 工具类 — ObjectPool, SpatialGrid
```

## 武器系统

### 主武器（Player.shoot, 100ms 间隔 = 10发/秒）
| 类型 | Lv.1 | Lv.2 | Lv.3 | Lv.4 | 伤害 |
|------|------|------|------|------|------|
| standard | 2发直射 | 5发扇形 | 10发扇形 | 追踪激光×2 | 10/发, 激光 2/tick |
| pierce | 2发直射 | 4发直射 | 6发直射 | 8发直射 | 8/发, 穿透不销毁 |
| ricochet | — | — | — | — | 空壳 |
| orbital | — | — | — | — | 空壳 |

### 穿透弹实现细节
- **spawnPlayerBullet** (game.js:639): 检查 `this.selectedWeapon === "pierce"`，设置 `isPierce=true`, `hitEnemies=[]`, `damage=8`
- **碰撞检测** (game.js:905): 穿透弹命中后检查 `hitEnemies.includes(entity)`，未命中才伤害，命中后 push 进数组，子弹不销毁
- **shootPierce** (entities.js:115): 根据 `powerLevel` 发射 2/4/6/8 枚直射弹
- **Bullet 类** (weapons.js:31): `this.isPierce`, `this.hitEnemies`

### 副武器 (2s CD), 僚机 (分数解锁), 炸弹
- 副武器 Lv.1 普通导弹(50), Lv.2 散射高爆弹, Lv.3 追踪导弹(50)
- 僚机：50000/250000/500000 分三档，2架，激光伤害 5
- 炸弹：弱效(50)/完全(秒杀)/核弹(200)

## 敌机系统
| 类型 | HP | 分数 | 移动 |
|------|----|------|------|
| Scout | 50 | 100 | 直线 |
| Fighter | 150 | 300 | 蛇形 |
| Elite | 750 | 1000 | 追踪 |
| Boss | 25000 (base) | 5000 | 8字形 |

## 关卡系统 (StageManager)
- 5 主题关卡 + 无限模式
- 每关 30s: prelude(8s) → push(10s) → climax(12s) → boss → clear
- 刷敌间隔: prelude 1200ms / push 900ms / climax 600ms
- Boss HP: Stage1=3000 / Stage2=8000 / Stage3=20000 / Stage4=30000+15000 / Stage5=60000
- 分数 ≥ 1000 激活，`stageManager.update(dt, this)` 驱动

## 当前问题
- Boss 阶段不刷敌（`return; // Boss战期间不刷敌`），待改为大量刷敌
- `app.json`, `game.json` 文件内容为空
- 双 Boss 第二个用 setTimeout 异步，可能有时序问题
