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
