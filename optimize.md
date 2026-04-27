# Neon Strike 优化记录

## 已修复

### 1. [2026-04-14] `Player.draw()` 缺少 game 参数
**文件**: `js/main.js`
**问题**: 调用 `this.player.draw(ctx)` 只传了一个参数，但 `Player.draw` 签名是 `draw(ctx, game)`，导致 `game.scoreInvincible` 为 undefined 报错
**修复**: 改为 `this.player.draw(ctx, this)`
**影响**: 游戏结束后报错崩溃，结算画面无法显示

---

### 2. [2026-04-14] `playThunderSound()` 重复定义
**文件**: `js/main.js`
**问题**: 函数定义了两次，后者覆盖前者，代码冗余
**修复**: 删除重复定义，保留原始版本
**影响**: 音频逻辑混乱

---

### 3. [2026-04-17] 音频对象无释放机制
**文件**: `js/main.js` initAudio()
**问题**: 音频上下文创建后无 destroy 释放，重启游戏时可能积累
**修复**: 添加 `destroyAudio()` 方法，在 `resetGame()` 中调用以清理并重新初始化音频上下文

---

### 4. [2026-04-17] 新增副武器系统
**文件**: `js/main.js`
**功能**:
- Lv.1 普通导弹：直线发射，1发
- Lv.2 散射高爆弹：发射1发后飞行300ms散开成8方向，伤害1
- Lv.3 追踪导弹：自动追踪敌人
- 分数达到阈值 [100000, 500000] 自动升级
- 每2秒自动发射一次
**修改**: CONFIG 新增配置、Player 新增属性和 fireSecondaryWeapon()、Bullet 新增属性和 explode()、Game 新增 spawn 方法

---

### 5. [2026-04-17] `useNuclearBomb()` 方法位置错误
**文件**: `js/main.js`
**问题**: `useNuclearBomb()` 方法被添加到 Player 类（第445-472行），但从 Game 类（第1519行）调用 `this.useNuclearBomb()`，导致 `TypeError: _this7.useNuclearBomb is not a function`
**修复**: 将 `useNuclearBomb()` 方法从 Player 类移到 Game 类
**状态**: ✅ 已修复

---

### 6. [2026-04-27] main.js 模块化拆分
**文件**: `js/main.js` → 7 个文件
**问题**: 单文件 3362 行，武器/实体/渲染/配置全部混在一起，定位和修改困难
**拆分方案**:

```
js/
├── config.js      90行    CONFIG + WEAPONS（纯数据，零依赖）
├── utils.js      132行    ObjectPool + SpatialGrid（基础设施，零依赖）
├── entity.js      45行    Entity 基类（零依赖）
├── weapons.js    416行    Bullet + Laser + WingmanLaser（依赖 config, entity）
├── entities.js  1159行    Player + Enemy + Wingman + Item + Particle + Starfield
├── game.js      1530行    Game 主类（依赖以上全部）
└── main.js        14行    统一导出入口（兼容 game.js 入口）
```

**依赖链**（零循环）:
```
config → utils → entity → weapons / entities → game → main
```
**关键设计**:
- 实体类不拆散 update() 和 draw()，按类聚合
- 实体间不直接引用，通过 Game 实例的 spawn* 方法中介
- game.js 根入口 `import { Game } from "./js/main.js"` 保持不变

**收益**: 单文件最大 1530 行（从 3362 降 54%），武器系统独立可单独修改
