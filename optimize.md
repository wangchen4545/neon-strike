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

---

### 7. [2026-04-27] 武器系统重构 + 解锁机制
**文件**: `js/config.js`, `js/weapons.js`, `js/game.js`
**改动**:
- 删除 ricochet（弹射弹）/ orbital（护身弹）两个空壳
- 新增 **雷电弹** （lightning）：白色电弧球，命中后连锁 4 个敌机，1.5x 速度跳跃，伤害 12
- 新增 **折射弹** （refract）：亮线光束+尾迹绘制，命中折射 3 次，每次附带屏幕闪光+雷电音效
- 新增 `WEAPON_UNLOCK` 分数阈值：pierce 30,000 / lightning 80,000 / refract 150,000
- 武器弹窗 UI：未解锁显示灰色+🔒+需分数，解锁后彩色可点击
- `handlePopupTouch` 增加解锁检查，未解锁不可切换
- `findNearestEnemy` 支持 excludeEnemies 排除参数

**武器总览**:

| 武器 | 解锁分数 | 视觉 | 伤害 | 行为 |
|------|---------|------|------|------|
| standard | 0 | 蓝色圆形 | 10 | Lv.1~3 扇形弹，Lv.4 追踪激光 |
| pierce | 30,000 | 绿色圆形 | 8 | 穿透不销毁 |
| lightning | 80,000 | ⚡白色电弧球 | 12 | 命中连锁4跳，1.5x速度 |
| refract | 150,000 | 亮线光束+尾迹 | 10 | 命中折射3次，雷电特效 |

---

### 8. [2026-05-06] 战机主题色系统完善

**文件**: `js/entities.js`, `js/weapons.js`, `js/game.js`

**问题**:
- `Player.draw()` 中引用了 `f` 和 `hexToRgba` 但未定义，战机切换后机体颜色不跟随
- 玩家子弹颜色硬编码为 `CONFIG.COLORS.PLAYER_BULLET`，不跟随战机
- UI 全部使用硬编码颜色（`#00F2FF` / `#FF9900` / `#00FF9D` / `#FF00FF` / `#FFD700` / `#FF0055`），切换战机关联弱

**修复**:

1. **Player.draw() 补全变量** (`entities.js:256-262`)
   - 添加 `f` (当前战机) 和 `hexToRgba` (hex→rgba 转换) 定义
   - 机体向量绘制、引擎火焰、驾驶舱、护盾全部跟随选中战机

2. **子弹颜色接入主题** (`game.js:972-973`, `weapons.js:37,273`)
   - `Bullet.reset()` 新增 `this.color` 属性
   - `spawnPlayerBullet` 从 `fighter.bullet` 设置子弹颜色
   - `drawBullet` 优先使用 `this.color`

3. **主题调色板系统** (`game.js:1178-1216`)
   - `lightenColor(hex, factor)`: hex 与白色混合，返回亮色
   - `darkenColor(hex, factor)`: hex 与黑色混合，返回暗色
   - `getThemePalette()`: 返回 `{ primary, accent, primaryDim, accentDim, accentLight }`
   - `drawUI` / `drawGameOverScreen` / `drawStartScreen` / `drawFighterPopup` / `drawWeaponPopup` 全部使用调色板

4. **UI 颜色映射**

   | 元素 | 旧颜色 | 新颜色 |
   |------|--------|--------|
   | 得分 | `#00F2FF` | `palette.primary` |
   | 连击 | `#FF9900` | `palette.accent` |
   | 生命值 ❤ | `#FF0055` | `palette.accent` |
   | 火力 Lv | `#00FF9D` | `palette.primaryDim` |
   | 副武器 Lv | `#FF00FF` | `palette.accentDim` |
   | 无敌 | `#FFD700` | `palette.accentLight` |
   | GAME OVER | `#FF0055` | `palette.accent` |
   | 最高分 | `#FF9900` | `palette.accentDim` |
   | 重新开始 | `#00F2FF` | `palette.primaryDim` |
   | 弹窗关闭按钮 | `#FF0055` | `palette.accent` |
   | 武器选择标题 | `#00F2FF` | `palette.primary` |

5. **首页 UI 位置调整**
   - 标题 `H/2-130`、副标题 `H/2-92`、删除参考来源
   - 更换战机按钮 `H/2+90`、开始按钮 `H/2+140`
   - 游戏内战机按钮 `y: 125`、武器按钮 `(10, H-120)`

**效果**: 切换战机后，玩家机体、子弹、首页 UI、HUD、弹窗、结算画面统一变色，主题色感知完整
