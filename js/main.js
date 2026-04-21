/** @format */

// ============================================
// start STRIKE - 星渊战机 微信小游戏
// 技术架构: Canvas 2D + 对象池 + 空间网格
// ============================================

// ---------------- 配置常量 ----------------
const CONFIG = {
	TARGET_FPS: 60,
	PLAYER_HP: 3,
	PLAYER_BOMB_COUNT: 1,
	PLAYER_INVINCIBLE_TIME: 2000,
	PLAYER_HITBOX_RADIUS: 6,
	PLAYER_GRAZE_RADIUS: 25,
	BULLET_POOL_SIZE: 500,
	PLAYER_BULLET_SPEED: 800,
	ENEMY_BULLET_SPEED: 250,
	ENEMY_POOL_SIZE: 50,
	SPAWN_INTERVAL_BASE: 1500,
	ITEM_POOL_SIZE: 30,
	ITEM_DROP_SPEED: 80,
	PARTICLE_POOL_SIZE: 200,
	GRID_CELL_SIZE: 80,
	INVINCIBLE_SCORE_THRESHOLDS: [3000, 8000, 15000, 25000],
	INVINCIBLE_DURATION: 5000,
	COLORS: {
		PLAYER: "#00F2FF",
		PLAYER_TRAIL: "#0051FF",
		PLAYER_BULLET: "#FFFF00",
		ENEMY_SCOUT: "#FF0055",
		ENEMY_FIGHTER: "#FF6600",
		ENEMY_ELITE: "#9D00FF",
		ENEMY_BULLET: "#FF0000",
		BOSS: "#FF9900",
		ITEM_POWER: "#00FF9D",
		ITEM_BOMB: "#FFFF00",
		ITEM_SHIELD: "#00FFFF",
		ITEM_SCORE: "#FF66FF",
		GRAZE: "#FFFFFF",
	},
	// 副武器配置
	SECONDARY_ENABLED: true,
	SECONDARY_COOLDOWN: 2000,
	SECONDARY_WEAPON_THRESHOLDS: [100000, 500000],
	MISSILE_SPEED: 400,
	MISSILE_DAMAGE: 50,
	SCATTER_BOMB_COUNT: 8,
	SCATTER_BOMB_SPEED: 250,
	SCATTER_BOMB_RADIUS: 6,
	SCATTER_BOMB_RANGE: 80,
	HOMING_MISSILE_SPEED: 300,
	HOMING_TURN_RATE: 4,
};

// ---------------- 对象池 ----------------
/**
 * 对象池：复用实体对象以减少频繁 GC。
 */
class ObjectPool {
	/**
	 * @param {Function} createFn 创建对象函数
	 * @param {Function} resetFn 复用对象重置函数
	 * @param {number} initialSize 初始对象池大小
	 */
	constructor(createFn, resetFn, initialSize = 10) {
		this.createFn = createFn;
		this.resetFn = resetFn;
		this.pool = [];
		this.active = [];
		for (let i = 0; i < initialSize; i++) {
			this.pool.push(createFn());
		}
	}
	/**
	 * 从对象池获取对象
	 */
	get() {
		const obj = this.pool.pop() || this.createFn();
		this.active.push(obj);
		return obj;
	}
	/**
	 * 归还对象到对象池
	 */
	release(obj) {
		const index = this.active.indexOf(obj);
		if (index > -1) {
			this.active.splice(index, 1);
			this.resetFn(obj);
			this.pool.push(obj);
		}
	}
	/**
	 * 归还所有激活对象
	 */
	releaseAll() {
		while (this.active.length > 0) {
			const obj = this.active.pop();
			this.resetFn(obj);
			this.pool.push(obj);
		}
	}
	/**
	 * 获取当前激活对象列表
	 */
	getActive() {
		return this.active;
	}
}

// ---------------- 空间网格 ----------------
/**
 * 空间网格类，用于快速检索邻近实体，提高碰撞检测性能。
 */
class SpatialGrid {
	/**
	 * 创建空间网格
	 * @param {number} width 画布宽度
	 * @param {number} height 画布高度
	 * @param {number} cellSize 单元格大小
	 */
	constructor(width, height, cellSize) {
		this.cellSize = cellSize;
		this.cells = new Map();
	}

	/**
	 * 清空所有网格数据
	 */
	clear() {
		this.cells.clear();
	}

	/**
	 * 根据列/行获取键
	 */
	getKey(col, row) {
		return `${col},${row}`;
	}

	/**
	 * 在网格中插入实体
	 */
	insert(entity) {
		const col = Math.floor(entity.x / this.cellSize);
		const row = Math.floor(entity.y / this.cellSize);
		const key = this.getKey(col, row);
		if (!this.cells.has(key)) {
			this.cells.set(key, []);
		}
		this.cells.get(key).push(entity);
		for (let dx = -1; dx <= 1; dx++) {
			for (let dy = -1; dy <= 1; dy++) {
				if (dx === 0 && dy === 0) continue;
				const nKey = this.getKey(col + dx, row + dy);
				if (!this.cells.has(nKey)) {
					this.cells.set(nKey, []);
				}
				this.cells.get(nKey).push(entity);
			}
		}
	}

	/**
	 * 查询指定位置半径内的实体列表
	 */
	query(x, y, radius) {
		const results = [];
		const minCol = Math.floor((x - radius) / this.cellSize);
		const maxCol = Math.floor((x + radius) / this.cellSize);
		const minRow = Math.floor((y - radius) / this.cellSize);
		const maxRow = Math.floor((y + radius) / this.cellSize);
		for (let col = minCol; col <= maxCol; col++) {
			for (let row = minRow; row <= maxRow; row++) {
				const key = this.getKey(col, row);
				const cell = this.cells.get(key);
				if (cell) {
					results.push(...cell);
				}
			}
		}
		return results;
	}
}

// ---------------- 基础实体 ----------------
/**
 * 基础实体类，提供位置、大小和激活状态的公共扩展。
 */
class Entity {
	/**
	 * 创建实体并重置初始状态
	 */
	constructor() {
		this.reset();
	}
	/**
	 * 重置实体状态
	 */
	reset() {
		this.x = 0;
		this.y = 0;
		this.vx = 0;
		this.vy = 0;
		this.width = 0;
		this.height = 0;
		this.active = false;
		this.rotation = 0;
	}
	/**
	 * 获取中心 X 坐标
	 */
	getCenterX() {
		return this.x + this.width / 2;
	}
	/**
	 * 获取中心 Y 坐标
	 */
	getCenterY() {
		return this.y + this.height / 2;
	}
	/**
	 * 获取近似半径
	 */
	getRadius() {
		return Math.max(this.width, this.height) / 2;
	}
}

// ---------------- 玩家 ----------------
/**
 * 玩家实体类，负责玩家状态与行为。
 */
class Player extends Entity {
	/**
	 * 初始化玩家状态
	 */
	constructor() {
		super();
		this.width = 40;
		this.height = 50;
		this.hp = CONFIG.PLAYER_HP;
		this.bombs = CONFIG.PLAYER_BOMB_COUNT;
		this.powerLevel = 1;
		this.invincible = false;
		this.invincibleTimer = 0;
		this.shield = false;
		this.lastShotTime = 0;
		this.fireRate = 100;
	}
	/**
	 * 重置玩家状态
	 */
	reset() {
		super.reset();
		this.hp = CONFIG.PLAYER_HP;
		this.bombs = CONFIG.PLAYER_BOMB_COUNT;
		this.powerLevel = 1;
		this.invincible = false;
		this.invincibleTimer = 0;
		this.shield = false;
		this.lastShotTime = 0;
		this.secondaryWeaponLevel = 1;
		this.secondaryWeaponCooldown = 0;
	}
	/**
	 * 每帧更新玩家状态
	 * @param {number} dt 时间增量（秒）
	 * @param {Game} game 游戏主对象
	 */
	update(dt, game) {
		if (this.invincible) {
			this.invincibleTimer -= dt * 1000;
			if (this.invincibleTimer <= 0) {
				this.invincible = false;
				this.invincibleTimer = 0;
			}
		}
		const now = Date.now();
		if (now - this.lastShotTime >= this.fireRate) {
			this.shoot(game);
			this.lastShotTime = now;
		}
		// 副武器自动发射
		if (CONFIG.SECONDARY_ENABLED) {
			this.secondaryWeaponCooldown -= dt * 1000;
			if (this.secondaryWeaponCooldown <= 0) {
				this.fireSecondaryWeapon(game);
				this.secondaryWeaponCooldown = CONFIG.SECONDARY_COOLDOWN;
			}
		}
	}
	/**
	 * 根据当前火力等级发射子弹
	 * @param {Game} game 游戏主对象
	 */
	shoot(game) {
		const cx = this.getCenterX();
		const cy = this.getCenterY();
		switch (this.powerLevel) {
			case 1:
				game.spawnPlayerBullet(cx - 8, cy - 20, 0, -1);
				game.spawnPlayerBullet(cx + 8, cy - 20, 0, -1);
				break;
			case 2:
				for (let angle = -20; angle <= 20; angle += 10) {
					const rad = (angle * Math.PI) / 180;
					game.spawnPlayerBullet(cx, cy - 20, Math.sin(rad) * 0.3, -Math.cos(rad));
				}
				break;
			case 3:
				for (let angle = -30; angle <= 30; angle += 15) {
					const rad = (angle * Math.PI) / 180;
					game.spawnPlayerBullet(cx - 10, cy - 20, Math.sin(rad) * 0.35, -Math.cos(rad));
					game.spawnPlayerBullet(cx + 10, cy - 20, Math.sin(rad) * 0.35, -Math.cos(rad));
				}
				break;
			default:
				const nearest = game.findNearestEnemy(cx, cy);
				if (nearest) {
					game.spawnLaser(cx - 20, cy - 25, nearest);
					game.spawnLaser(cx + 20, cy - 25, nearest);
				} else {
					game.spawnLaser(cx - 20, cy - 25);
					game.spawnLaser(cx + 20, cy - 25);
				}
				break;
		}
	}
	/**
	 * 根据副武器等级发射副武器
	 * @param {Game} game 游戏主对象
	 */
	fireSecondaryWeapon(game) {
		const cx = this.getCenterX();
		const cy = this.getCenterY();
		switch (this.secondaryWeaponLevel) {
			case 1: // 普通导弹
				game.spawnNormalMissile(cx, cy - 20, 0, -1);
				break;
			case 2: // 散射高爆弹
				for (let i = 0; i < CONFIG.SCATTER_BOMB_COUNT; i++) {
					const angle = (i / CONFIG.SCATTER_BOMB_COUNT) * Math.PI * 2;
					game.spawnScatterBomb(cx, cy, angle);
				}
				break;
			case 3: // 追踪导弹
				const nearest = game.findNearestEnemy(cx, cy);
				game.spawnHomingMissile(cx, cy - 25, nearest);
				break;
		}
	}
	/**
	 * 绘制玩家图形
	 * @param {CanvasRenderingContext2D} ctx 画布上下文
	 */
	draw(ctx, game) {
		if (this.invincible && !game.scoreInvincible && Math.floor(Date.now() / 100) % 2 === 0) {
			return;
		}
		const cx = this.getCenterX();
		const cy = this.getCenterY();
		const now = Date.now();
		if (this.shield) {
			ctx.beginPath();
			ctx.arc(cx, cy, 30, 0, Math.PI * 2);
			ctx.strokeStyle = CONFIG.COLORS.ITEM_SHIELD;
			ctx.lineWidth = 2;
			ctx.globalAlpha = 0.5 + Math.sin(now / 200) * 0.3;
			ctx.stroke();
			ctx.globalAlpha = 1;
		}

		if (!Player.shipImage) {
			Player.shipImage = wx.createImage();
			Player.shipImage.src = "images/zhanji.png";
		}

		if (!Game.bombImage) {
			Game.bombImage = wx.createImage();
			Game.bombImage.src = "images/bomb_btn.png";
		}

		const img = Player.shipImage;
		if (img.complete && img.naturalWidth !== 0) {
			const w = 50;
			const h = 50;
			ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
		} else {
			// 备用：如果图片未加载，仍夹带原始向量绘制
			ctx.save();
			ctx.translate(cx, cy);
			ctx.beginPath();
			ctx.moveTo(0, -25);
			ctx.lineTo(-15, 20);
			ctx.lineTo(-5, 15);
			ctx.lineTo(0, 22);
			ctx.lineTo(5, 15);
			ctx.lineTo(15, 20);
			ctx.closePath();
			const gradient = ctx.createLinearGradient(0, -25, 0, 22);
			gradient.addColorStop(0, CONFIG.COLORS.PLAYER);
			gradient.addColorStop(1, CONFIG.COLORS.PLAYER_TRAIL);
			ctx.fillStyle = gradient;
			ctx.fill();
			const flameLength = 10 + Math.random() * 8;
			ctx.beginPath();
			ctx.moveTo(-6, 20);
			ctx.lineTo(0, 20 + flameLength);
			ctx.lineTo(6, 20);
			ctx.closePath();
			ctx.fillStyle = "#FF6600";
			ctx.fill();
			ctx.restore();
		}
	}
	/**
	 * 处理玩家被击中（扣血与无敌切换）
	 * @param {Game} game 游戏主对象
	 */
	hit(game) {
		if (this.invincible || this.shield || game.scoreInvincible) {
			if (this.shield) this.shield = false;
			return;
		}
		this.hp--;
		this.invincible = true;
		this.invincibleTimer = CONFIG.PLAYER_INVINCIBLE_TIME;
		game.spawnExplosion(this.getCenterX(), this.getCenterY(), 30);
		if (this.hp <= 0) {
			game.gameOver();
		}
	}
	/**
	 * 使用炸弹，清除敌弹并伤害所有敌人
	 * @param {Game} game 游戏主对象
	 */
	useBomb(game) {
		if (this.bombs <= 0) return;
		this.bombs--;
		game.clearEnemyBullets();
		game.damageAllEnemies(50);
		game.screenFlash = 1;
		for (let i = 0; i < 10; i++) {
			const angle = (i / 10) * Math.PI * 2;
			game.spawnExplosion(game.player.getCenterX() + Math.cos(angle) * 200, game.player.getCenterY() + Math.sin(angle) * 200, 20);
		}
	}
}

// ---------------- 子弹 ----------------
/**
 * 子弹实体，玩家与敌人共用，支持移动与绘制。
 */
class Bullet extends Entity {
	constructor() {
		super();
		this.isPlayerBullet = true;
		this.damage = 10;
		this.radius = 4;
	}
	reset() {
		super.reset();
		this.isPlayerBullet = true;
		this.damage = 10;
		this.radius = 4;
		this.isScatterBomb = false;
		this.isMissile = false;
		this.isHomingMissile = false;
		this.bombTimer = 0;
		this.explodeRange = 0;
		this.willSplit = false;
		this.startX = 0;
		this.startY = 0;
		this.explodeDistance = 0;
		this.target = null;
		this.trail = null;
	}
	/**
	 * 更新子弹位置并检查边界
	 * @param {number} dt 时间增量（秒）
	 * @param {Game} game 游戏主对象
	 */
	update(dt, game) {
		this.x += this.vx * dt;
		this.y += this.vy * dt;

		// 追踪导弹：实时调整方向
		if (this.isHomingMissile && this.target && this.target.active) {
			const dx = this.target.getCenterX() - this.x;
			const dy = this.target.getCenterY() - this.y;
			const dist = Math.sqrt(dx * dx + dy * dy);
			if (dist > 5) {
				const targetAngle = Math.atan2(dx, -dy);
				const currentAngle = Math.atan2(this.vx, -this.vy);
				let angleDiff = targetAngle - currentAngle;
				const maxTurn = CONFIG.HOMING_TURN_RATE * dt;
				angleDiff = Math.max(-maxTurn, Math.min(maxTurn, angleDiff));
				const newAngle = currentAngle + angleDiff;
				this.vx = Math.sin(newAngle) * CONFIG.HOMING_MISSILE_SPEED;
				this.vy = -Math.cos(newAngle) * CONFIG.HOMING_MISSILE_SPEED;
			}
			// 记录尾迹
			if (!this.trail) this.trail = [];
			this.trail.push({ x: this.x, y: this.y });
			if (this.trail.length > 10) this.trail.shift();
		}

		// 散射炸弹：按距离或时间爆炸
		if (this.isScatterBomb) {
			if (this.willSplit) {
				// 主炸弹：飞行到屏幕1/2距离后散开
				const dx = this.x - this.startX;
				const dy = this.y - this.startY;
				const dist = Math.sqrt(dx * dx + dy * dy);
				if (dist >= this.explodeDistance) {
					this.explode(game);
					this.active = false;
				}
			} else {
				// 子炸弹：延时爆炸
				this.bombTimer -= dt * 1000;
				if (this.bombTimer <= 0) {
					this.explode(game);
					this.active = false;
				}
			}
		}

		if (this.y < -50 || this.y > game.canvas.height + 50 || this.x < -50 || this.x > game.canvas.width + 50) {
			this.active = false;
		}
	}
	/**
	 * 绘制子弹
	 * @param {CanvasRenderingContext2D} ctx 绘制上下文
	 */
	draw(ctx) {
		if (this.isMissile || this.isHomingMissile) {
			this.drawMissile(ctx);
		} else {
			this.drawBullet(ctx);
		}
	}

	/**
	 * 绘制导弹（带形状和尾烟）
	 * @param {CanvasRenderingContext2D} ctx 绘制上下文
	 */
	drawMissile(ctx) {
		const angle = Math.atan2(this.vy, this.vx);

		ctx.save();
		ctx.translate(this.x, this.y);
		ctx.rotate(angle);

		// 导弹颜色
		const color = this.isHomingMissile ? "#FF00FF" : "#FF6600";

		// 绘制尾烟拖影（仅追踪导弹）
		if (this.isHomingMissile && this.trail) {
			for (let i = 0; i < this.trail.length; i++) {
				const t = this.trail[i];
				const alpha = (i / this.trail.length) * 0.5;
				const size = 3 + (i / this.trail.length) * 3;
				ctx.save();
				ctx.rotate(-angle);
				ctx.translate(t.x - this.x, t.y - this.y);
				ctx.beginPath();
				ctx.arc(0, 0, size, 0, Math.PI * 2);
				ctx.fillStyle = `rgba(255, 100, 255, ${alpha})`;
				ctx.fill();
				ctx.restore();
			}
		}

		// 导弹主体（向量绘制）
		ctx.beginPath();
		// 头部（朝前）
		ctx.moveTo(15, 0);
		// 右侧
		ctx.lineTo(-5, -6);
		ctx.lineTo(-8, -4);
		// 尾部
		ctx.lineTo(-10, -6);
		ctx.lineTo(-10, 6);
		// 左侧
		ctx.lineTo(-8, 4);
		ctx.lineTo(-5, 6);
		ctx.closePath();
		ctx.fillStyle = color;
		ctx.fill();

		// 引擎火焰
		const flameLength = 5 + Math.sin(Date.now() / 50) * 3;
		ctx.beginPath();
		ctx.moveTo(-10, -3);
		ctx.lineTo(-10 - flameLength, 0);
		ctx.lineTo(-10, 3);
		ctx.closePath();
		ctx.fillStyle = "#FFFF00";
		ctx.fill();

		ctx.restore();
	}

	/**
	 * 绘制普通子弹
	 * @param {CanvasRenderingContext2D} ctx 绘制上下文
	 */
	drawBullet(ctx) {
		let color;
		if (this.isHomingMissile) {
			color = "#FF00FF"; // 紫色
		} else if (this.isMissile) {
			color = "#FF6600"; // 橙色
		} else if (this.isScatterBomb) {
			color = "#00FF00"; // 绿色
			const pulse = Math.sin(Date.now() / 30) * 0.3 + 0.7;
			ctx.globalAlpha = pulse;
		} else {
			color = this.isPlayerBullet ? CONFIG.COLORS.PLAYER_BULLET : CONFIG.COLORS.ENEMY_BULLET;
		}

		ctx.beginPath();
		ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
		ctx.fillStyle = color;
		ctx.fill();
		ctx.beginPath();
		ctx.arc(this.x, this.y, this.radius * 2, 0, Math.PI * 2);
		ctx.globalAlpha = 0.3;
		ctx.fill();
		ctx.globalAlpha = 1;
	}
	/**
	 * 散射炸弹爆炸，对范围内敌人造成伤害
	 * @param {Game} game 游戏主对象
	 */
	explode(game) {
		// 只有 willSplit 的炸弹才会散开成8个
		if (this.willSplit) {
			for (let i = 0; i < CONFIG.SCATTER_BOMB_COUNT; i++) {
				const angle = (i / CONFIG.SCATTER_BOMB_COUNT) * Math.PI * 2;
				game.spawnSplitBomb(this.x, this.y, angle);
			}
		}
		// 所有散射炸弹都会造成伤害
		const enemies = game.enemyPool.getActive();
		for (const enemy of enemies) {
			if (!enemy.active) continue;
			const dx = enemy.getCenterX() - this.x;
			const dy = enemy.getCenterY() - this.y;
			const dist = Math.sqrt(dx * dx + dy * dy);
			if (dist < 30) {
				enemy.takeDamage(this.damage, game);
			}
		}
	}
}

// ---------------- 激光 ----------------
/**
 * 激光实体，持续存在并按时间衰减。
 */
class Laser extends Entity {
	constructor() {
		super();
		this.width = 8;
		this.height = 0;
		this.lifeTime = 0;
		this.maxLifeTime = 200;
		this.damage = 2;
		this.endX = 0;
		this.endY = 0;
		this.target = null;
	}
	reset() {
		super.reset();
		this.height = 0;
		this.lifeTime = 0;
		this.maxLifeTime = 200;
		this.damage = 2;
		this.endX = 0;
		this.endY = 0;
		this.target = null;
	}
	/**
	 * 更新激光状态（长度、生命周期）
	 * @param {number} dt 时间增量（秒）
	 */
	update(dt) {
		this.lifeTime += dt * 1000;
		if (this.target && this.target.active) {
			this.endX = this.target.getCenterX();
			this.endY = this.target.getCenterY();
		} else if (!this.target) {
			this.height += 15;
			this.endX = this.x;
			this.endY = this.y + this.height;
		}
		if (this.lifeTime >= this.maxLifeTime) {
			this.active = false;
		}
	}
	/**
	 * 绘制激光效果
	 * @param {CanvasRenderingContext2D} ctx 绘制上下文
	 */
	draw(ctx) {
		const alpha = 1 - this.lifeTime / this.maxLifeTime;
		ctx.save();
		ctx.globalAlpha = alpha;
		if (this.target) {
			this.drawLightning(ctx, this.x, this.y, this.endX, this.endY);
		} else {
			ctx.fillStyle = "#FFFFFF";
			ctx.fillRect(this.x - 2, this.y, 4, this.height);
			const gradient = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.height);
			gradient.addColorStop(0, "rgba(0, 255, 157, 0.8)");
			gradient.addColorStop(0.5, "rgba(0, 255, 157, 0.3)");
			gradient.addColorStop(1, "rgba(0, 255, 157, 0)");
			ctx.fillStyle = gradient;
			ctx.fillRect(this.x - 10, this.y, this.width + 20, this.height);
		}
		ctx.restore();
	}
	/**
	 * 绘制闪电效果
	 * @param {CanvasRenderingContext2D} ctx 绘制上下文
	 * @param {number} startX 起始X
	 * @param {number} startY 起始Y
	 * @param {number} endX 结束X
	 * @param {number} endY 结束Y
	 */
	drawLightning(ctx, startX, startY, endX, endY) {
		const dx = endX - startX;
		const dy = endY - startY;
		const dist = Math.sqrt(dx * dx + dy * dy);
		const steps = Math.max(5, Math.floor(dist / 20));
		ctx.beginPath();
		ctx.moveTo(startX, startY);
		for (let i = 1; i < steps; i++) {
			const t = i / steps;
			const px = startX + dx * t;
			const py = startY + dy * t;
			const offset = (Math.random() - 0.5) * 15;
			const perpX = (-dy / dist) * offset;
			const perpY = (dx / dist) * offset;
			ctx.lineTo(px + perpX, py + perpY);
		}
		ctx.lineTo(endX, endY);
		ctx.strokeStyle = "#FFFFFF";
		ctx.lineWidth = 3;
		ctx.stroke();
		const gradient = ctx.createLinearGradient(startX, startY, endX, endY);
		gradient.addColorStop(0, "rgba(0, 255, 157, 0.8)");
		gradient.addColorStop(1, "rgba(0, 255, 157, 0.3)");
		ctx.strokeStyle = gradient;
		ctx.lineWidth = 6;
		ctx.stroke();
	}
	checkCollision(enemy) {
		if (!this.active || !enemy.active) return false;
		if (this.target) {
			// 简单距离检查
			const dist = this.distanceToLine(enemy.getCenterX(), enemy.getCenterY(), this.x, this.y, this.endX, this.endY);
			return dist < 15;
		} else {
			return this.x > enemy.x && this.x < enemy.x + enemy.width && this.y < enemy.y + enemy.height;
		}
	}

	/**
	 * 计算点到线段的距离
	 * @param {number} px 点X
	 * @param {number} py 点Y
	 * @param {number} x1 线段起点X
	 * @param {number} y1 线段起点Y
	 * @param {number} x2 线段终点X
	 * @param {number} y2 线段终点Y
	 * @returns {number} 距离
	 */
	distanceToLine(px, py, x1, y1, x2, y2) {
		const dx = x2 - x1;
		const dy = y2 - y1;
		const length = Math.sqrt(dx * dx + dy * dy);
		if (length === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
		const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (length * length)));
		const closestX = x1 + t * dx;
		const closestY = y1 + t * dy;
		return Math.sqrt((px - closestX) ** 2 + (py - closestY) ** 2);
	}
}

// ---------------- 敌机 ----------------
/**
 * 敌机实体，包含多种类型和行为模式。
 */
class Enemy extends Entity {
	constructor() {
		super();
		this.type = "scout";
		this.hp = 1;
		this.maxHp = 1;
		this.score = 100;
		this.damage = 1;
		this.shootInterval = 0;
		this.shootTimer = 0;
		this.movePattern = "straight";
		this.patternTime = 0;
		this.angle = 0;
	}
	reset() {
		super.reset();
		this.type = "scout";
		this.hp = 1;
		this.maxHp = 1;
		this.score = 100;
		this.damage = 1;
		this.shootInterval = 0;
		this.shootTimer = 0;
		this.movePattern = "straight";
		this.patternTime = 0;
		this.angle = 0;
	}
	init(type, x, y) {
		this.active = true;
		this.x = x;
		this.y = y;
		this.type = type;
		this.patternTime = 0;
		this.angle = 0;
		switch (type) {
			case "scout":
				this.width = 30;
				this.height = 30;
				this.hp = this.maxHp = 1;
				this.score = 100;
				this.vx = 0;
				this.vy = 150;
				this.movePattern = "straight";
				break;
			case "fighter":
				this.width = 40;
				this.height = 40;
				this.hp = this.maxHp = 3;
				this.score = 300;
				this.vx = 0;
				this.vy = 180;
				this.shootInterval = 1500;
				this.shootTimer = 0;
				this.movePattern = "zigzag";
				break;
			case "elite":
				this.width = 50;
				this.height = 50;
				this.hp = this.maxHp = 15;
				this.score = 1000;
				this.vx = 0;
				this.vy = 100;
				this.shootInterval = 800;
				this.shootTimer = 0;
				this.movePattern = "track";
				break;
			case "boss":
				this.width = 120;
				this.height = 80;
				this.hp = this.maxHp = 500;
				this.score = 5000;
				this.vx = 80;
				this.vy = 30;
				this.shootInterval = 500;
				this.shootTimer = 0;
				this.movePattern = "boss";
				this.phase = 1;
				break;
		}
	}
	/**
	 * 更新敌机行为与射击
	 * @param {number} dt 时间增量（秒）
	 * @param {Game} game 游戏主对象
	 */
	update(dt, game) {
		this.patternTime += dt * 1000;
		switch (this.movePattern) {
			case "straight":
				this.y += this.vy * dt;
				break;
			case "zigzag":
				this.x += Math.sin(this.patternTime / 500) * 100 * dt;
				this.y += this.vy * dt;
				break;
			case "track":
				if (this.patternTime < 2000) {
					const dx = game.player.getCenterX() - this.getCenterX();
					const dy = game.player.getCenterY() - this.getCenterY();
					const dist = Math.sqrt(dx * dx + dy * dy);
					if (dist > 0) {
						this.vx = (dx / dist) * 150;
						this.vy = (dy / dist) * 100;
					}
				}
				this.x += this.vx * dt;
				this.y += this.vy * dt;
				break;
			case "boss":
				this.x += Math.sin(this.patternTime / 2000) * this.vx * dt;
				this.y += Math.cos(this.patternTime / 3000) * this.vy * dt * 0.5;
				const hpPercent = this.hp / this.maxHp;
				if (hpPercent < 0.25 && this.phase < 3) {
					this.phase = 3;
				} else if (hpPercent < 0.5 && this.phase < 2) {
					this.phase = 2;
				}
				break;
		}
		this.shootTimer += dt * 1000;
		if (this.shootTimer >= this.shootInterval) {
			this.shoot(game);
			this.shootTimer = 0;
		}
		if (this.y > game.canvas.height + 100) {
			this.active = false;
		}
		this.x = Math.max(0, Math.min(game.canvas.width - this.width, this.x));
	}
	/**
	 * 发射子弹逻辑，根据敌机类型不同实现不同弹幕
	 * @param {Game} game 游戏主对象
	 */
	shoot(game) {
		const cx = this.getCenterX();
		const cy = this.getCenterY();
		if (this.type === "fighter") {
			for (let angle = -30; angle <= 30; angle += 30) {
				const rad = (angle * Math.PI) / 180;
				game.spawnEnemyBullet(cx, cy, Math.sin(rad) * CONFIG.ENEMY_BULLET_SPEED, Math.cos(rad) * CONFIG.ENEMY_BULLET_SPEED);
			}
		} else if (this.type === "elite") {
			const dx = game.player.getCenterX() - cx;
			const dy = game.player.getCenterY() - cy;
			const dist = Math.sqrt(dx * dx + dy * dy);
			if (dist > 0) {
				game.spawnEnemyBullet(cx, cy, (dx / dist) * 350, (dy / dist) * 350);
			}
		} else if (this.type === "boss") {
			if (this.phase === 1) {
				for (let i = 0; i < 12; i++) {
					const angle = (i / 12) * Math.PI * 2 + this.patternTime / 1000;
					game.spawnEnemyBullet(cx, cy, Math.sin(angle) * 200, Math.cos(angle) * 200);
				}
			} else if (this.phase === 2) {
				for (let i = 0; i < 8; i++) {
					const angle = Math.PI / 2 + (i - 4) * 0.2;
					game.spawnEnemyBullet(cx, cy, Math.sin(angle) * 300, Math.cos(angle) * 300);
				}
			} else {
				for (let i = 0; i < 16; i++) {
					const angle = (i / 16) * Math.PI * 2 + this.patternTime / 500;
					game.spawnEnemyBullet(cx, cy, Math.sin(angle) * 250, Math.cos(angle) * 250);
				}
			}
		}
	}
	draw(ctx) {
		const cx = this.getCenterX();
		const cy = this.getCenterY();
		ctx.save();
		ctx.translate(cx, cy);
		let color;
		switch (this.type) {
			case "scout":
				color = CONFIG.COLORS.ENEMY_SCOUT;
				break;
			case "fighter":
				color = CONFIG.COLORS.ENEMY_FIGHTER;
				break;
			case "elite":
				color = CONFIG.COLORS.ENEMY_ELITE;
				break;
			case "boss":
				color = CONFIG.COLORS.BOSS;
				break;
		}
		if (this.type === "scout") {
			ctx.beginPath();
			ctx.moveTo(0, 15);
			ctx.lineTo(-15, -15);
			ctx.lineTo(15, -15);
			ctx.closePath();
			ctx.fillStyle = color;
			ctx.fill();
		} else if (this.type === "fighter") {
			ctx.beginPath();
			ctx.moveTo(0, 20);
			ctx.lineTo(-20, -10);
			ctx.lineTo(-8, -5);
			ctx.lineTo(0, -15);
			ctx.lineTo(8, -5);
			ctx.lineTo(20, -10);
			ctx.closePath();
			ctx.fillStyle = color;
			ctx.fill();
		} else if (this.type === "elite") {
			ctx.beginPath();
			ctx.arc(0, 0, 20, 0, Math.PI * 2);
			ctx.fillStyle = color;
			ctx.fill();
			for (let i = 0; i < 4; i++) {
				const angle = (i / 4) * Math.PI * 2;
				ctx.beginPath();
				ctx.moveTo(0, 0);
				ctx.lineTo(Math.cos(angle) * 30, Math.sin(angle) * 30);
				ctx.strokeStyle = color;
				ctx.lineWidth = 3;
				ctx.stroke();
			}
		} else if (this.type === "boss") {
			ctx.beginPath();
			ctx.moveTo(0, -40);
			ctx.lineTo(-60, 40);
			ctx.lineTo(-20, 40);
			ctx.lineTo(-20, 20);
			ctx.lineTo(20, 20);
			ctx.lineTo(20, 40);
			ctx.lineTo(60, 40);
			ctx.closePath();
			ctx.fillStyle = color;
			ctx.fill();
			const hpPercent = this.hp / this.maxHp;
			ctx.fillStyle = "#333";
			ctx.fillRect(-40, -55, 80, 8);
			ctx.fillStyle = hpPercent > 0.5 ? "#00FF00" : hpPercent > 0.25 ? "#FFFF00" : "#FF0000";
			ctx.fillRect(-40, -55, 80 * hpPercent, 8);
		}
		ctx.restore();
	}
	takeDamage(damage, game) {
		this.hp -= damage;
		game.spawnSparkles(this.getCenterX(), this.getCenterY(), 5);
		if (this.hp <= 0) {
			this.die(game);
		}
	}
	die(game) {
		this.active = false;
		game.spawnExplosion(this.getCenterX(), this.getCenterY(), this.type === "boss" ? 60 : 30);
		game.addScore(this.score);
		if (this.type === "boss") {
			game.playBossDeathSound();
		} else {
			game.playExplodeSound();
		}
		if (Math.random() < (this.type === "elite" ? 0.5 : this.type === "boss" ? 1 : 0.1)) {
			const itemType = this.type === "boss" ? ["power", "bomb", "shield", "score"][Math.floor(Math.random() * 4)] : Math.random() < 0.3 ? "power" : "score";
			game.spawnItem(this.getCenterX(), this.getCenterY(), itemType);
		}
	}
}

// ---------------- 道具 ----------------
/**
 * 道具实体，用于玩家拾取和触发效果。
 */
class Item extends Entity {
	constructor() {
		super();
		this.width = 25;
		this.height = 25;
		this.type = "power";
		this.vx = 0;
		this.vy = CONFIG.ITEM_DROP_SPEED;
	}
	reset() {
		super.reset();
		this.vx = 0;
		this.vy = CONFIG.ITEM_DROP_SPEED;
		this.type = "power";
	}
	init(x, y, type) {
		this.active = true;
		this.x = x;
		this.y = y;
		this.type = type;
	}
	/**
	 * 更新道具移动逻辑（吸附与下落）
	 * @param {number} dt 时间增量（秒）
	 * @param {Game} game 游戏主对象
	 */
	update(dt, game) {
		const dx = game.player.getCenterX() - this.x;
		const dy = game.player.getCenterY() - this.y;
		const dist = Math.sqrt(dx * dx + dy * dy);
		if (dist < 150) {
			this.vx = (dx / dist) * 300;
			this.vy = (dy / dist) * 300;
		} else {
			this.vx = Math.sin(this.y / 100) * 50;
			this.vy = CONFIG.ITEM_DROP_SPEED;
		}
		this.x += this.vx * dt;
		this.y += this.vy * dt;
		if (this.x < 0 || this.x > game.canvas.width - this.width) {
			this.vx *= -1;
			this.x = Math.max(0, Math.min(game.canvas.width - this.width, this.x));
		}
		if (this.y > game.canvas.height + 50) {
			this.active = false;
		}
	}
	/**
	 * 绘制道具
	 * @param {CanvasRenderingContext2D} ctx 绘制上下文
	 */
	draw(ctx) {
		const cx = this.getCenterX();
		const cy = this.getCenterY();
		let color, icon;
		switch (this.type) {
			case "power":
				color = CONFIG.COLORS.ITEM_POWER;
				icon = "P";
				break;
			case "bomb":
				color = CONFIG.COLORS.ITEM_BOMB;
				icon = "B";
				break;
			case "shield":
				color = CONFIG.COLORS.ITEM_SHIELD;
				icon = "S";
				break;
			case "score":
				color = CONFIG.COLORS.ITEM_SCORE;
				icon = "2";
				break;
		}
		ctx.save();
		ctx.translate(cx, cy);
		ctx.beginPath();
		ctx.arc(0, 0, 12, 0, Math.PI * 2);
		ctx.fillStyle = color;
		ctx.globalAlpha = 0.3;
		ctx.fill();
		ctx.globalAlpha = 1;
		ctx.strokeStyle = color;
		ctx.lineWidth = 2;
		ctx.stroke();
		ctx.fillStyle = color;
		ctx.font = "bold 12px Arial";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText(icon, 0, 0);
		ctx.restore();
	}
	/**
	 * 玩家拾取道具逻辑
	 * @param {Game} game 游戏主对象
	 */
	collect(game) {
		this.active = false;
		switch (this.type) {
			case "power":
				if (game.player.powerLevel < 4) {
					game.player.powerLevel++;
				}
				game.addScore(500);
				break;
			case "bomb":
				if (game.player.bombs < 3) {
					game.player.bombs++;
				}
				game.addScore(500);
				break;
			case "shield":
				game.player.shield = true;
				game.addScore(500);
				break;
			case "score":
				game.scoreMultiplier = 2;
				game.scoreMultiplierTimer = 10000;
				game.addScore(1000);
				break;
		}
	}
}

// ---------------- 粒子 ----------------
/**
 * 粒子效果，负责瞬时爆炸和光效
 */
class Particle extends Entity {
	constructor() {
		super();
		this.radius = 3;
		this.lifeTime = 0;
		this.maxLifeTime = 500;
		this.color = "#FFFFFF";
	}
	reset() {
		super.reset();
		this.lifeTime = 0;
		this.maxLifeTime = 500;
		this.color = "#FFFFFF";
		this.radius = 3;
	}
	init(x, y, vx, vy, color, lifeTime = 500) {
		this.active = true;
		this.x = x;
		this.y = y;
		this.vx = vx;
		this.vy = vy;
		this.color = color;
		this.maxLifeTime = lifeTime;
		this.lifeTime = 0;
	}
	/**
	 * 更新粒子运动与生命周期
	 * @param {number} dt 时间增量（秒）
	 */
	update(dt) {
		this.x += this.vx * dt;
		this.y += this.vy * dt;
		this.vx *= 0.98;
		this.vy *= 0.98;
		this.lifeTime += dt * 1000;
		if (this.lifeTime >= this.maxLifeTime) {
			this.active = false;
		}
	}
	/**
	 * 绘制粒子效果
	 * @param {CanvasRenderingContext2D} ctx 绘制上下文
	 */
	draw(ctx) {
		const alpha = 1 - this.lifeTime / this.maxLifeTime;
		ctx.beginPath();
		ctx.arc(this.x, this.y, this.radius * alpha, 0, Math.PI * 2);
		ctx.fillStyle = this.color;
		ctx.globalAlpha = alpha;
		ctx.fill();
		ctx.globalAlpha = 1;
	}
}

// ---------------- 星空背景 ----------------
/**
 * 星空背景类，负责背景星光移动效果。
 */
class Starfield {
	/**
	 * @param {number} width 画布宽度
	 * @param {number} height 画布高度
	 */
	constructor(width, height) {
		this.stars = [];
		this.canvasWidth = width;
		this.canvasHeight = height;
		this.init(width, height);
	}
	/**
	 * 初始化星空
	 */
	init(width, height) {
		this.stars = [];
		this.canvasWidth = width;
		this.canvasHeight = height;
		for (let i = 0; i < 100; i++) {
			this.stars.push({
				x: Math.random() * width,
				y: Math.random() * height,
				speed: 50 + Math.random() * 150,
				size: 1 + Math.random() * 2,
				brightness: 0.3 + Math.random() * 0.7,
			});
		}
	}
	resize(width, height) {
		this.init(width, height);
	}
	/**
	 * 更新星空移动
	 * @param {number} dt 时间增量（秒）
	 */
	update(dt) {
		for (const star of this.stars) {
			star.y += star.speed * dt;
			if (star.y > this.canvasHeight) {
				star.y = 0;
				star.x = Math.random() * this.canvasWidth;
			}
		}
	}
	/**
	 * 绘制星空
	 * @param {CanvasRenderingContext2D} ctx 绘制上下文
	 */
	draw(ctx) {
		for (const star of this.stars) {
			ctx.beginPath();
			ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
			ctx.fillStyle = `rgba(255, 255, 255, ${star.brightness})`;
			ctx.fill();
		}
	}
}

// ---------------- 游戏主类 ----------------
/**
 * 游戏核心类，管理游戏循环、状态与逻辑。
 */
export class Game {
	/**
	 * 初始化游戏
	 */
	constructor() {
		// 获取系统信息，用于设置画布尺寸和触摸坐标映射
		const sysInfo = wx.getSystemInfoSync();

		// 创建画布
		this.canvas = wx.createCanvas();

		// -------------------------------------------------------
		// 重要：设置画布尺寸为屏幕尺寸
		// -------------------------------------------------------
		// wx.createCanvas() 创建的画布默认尺寸很小(300x150)，
		// 需要显式设置为屏幕尺寸，否则触摸坐标与画布坐标不匹配
		// 导致玩家飞机无法跟随手指移动
		this.canvas.width = sysInfo.screenWidth; // 屏幕宽度(逻辑像素)
		this.canvas.height = sysInfo.screenHeight; // 屏幕高度(逻辑像素)

		this.ctx = this.canvas.getContext("2d");

		// 保存画布尺寸到实例属性，后续用于碰撞检测和渲染边界计算
		this.width = this.canvas.width;
		this.height = this.canvas.height;

		// 保存屏幕尺寸和设备像素比，用于触摸坐标转换
		this.screenWidth = sysInfo.screenWidth;
		this.screenHeight = sysInfo.screenHeight;
		this.devicePixelRatio = sysInfo.devicePixelRatio || 1;

		// 游戏状态
		this.state = "menu";
		this.score = 0;
		this.highScore = parseInt(wx.getStorageSync("neonStrikeHighScore") || "0");
		this.combo = 0;
		this.comboTimer = 0;
		this.scoreMultiplier = 1;
		this.scoreMultiplierTimer = 0;

		// 游戏对象
		this.player = new Player();
		this.starfield = new Starfield(this.width, this.height);

		// 敌机生成
		this.spawnTimer = 0;
		this.spawnInterval = CONFIG.SPAWN_INTERVAL_BASE;
		this.waveCount = 0;
		this.bossSpawned = false;
		this.bossWarning = false;

		// 空间网格
		this.spatialGrid = new SpatialGrid(this.width, this.height, CONFIG.GRID_CELL_SIZE);

		// 分数无敌
		this.scoreInvincible = false;
		this.scoreInvincibleTimer = 0;
		this.nextInvincibleThreshold = CONFIG.INVINCIBLE_SCORE_THRESHOLDS[0];
		this.invincibleThresholdIndex = 0;

		// 屏幕特效
		this.screenFlash = 0;

		// 输入状态
		this.touching = false;

		// 开始按钮
		this.startBtn = {
			x: this.width / 2 - 80,
			y: this.height / 2 + 40,
			width: 160,
			height: 50,
		};

		// 核弹按钮（右下角）
		this.nuclearBombBtn = {
			x: this.width - 70,
			y: this.height - 70,
			width: 60,
			height: 60,
		};
		this.hasNuclearBomb = false;
		this.nuclearBombFlash = 0;

		// 图片文字字典
		Game.textImages = {
			"星空战机": { src: "images/icon_title_36px.png", width: 120, height: 36 },
			"开始游戏": { src: "images/icon_start_26px.png", width: 80, height: 26 },
			"最高分": { src: "images/icon_highscore_16px.png", width: 48, height: 16 },
			"GAME OVER": { src: "images/icon_GAME_OVER_36px.png", width: 160, height: 36 },
			"得分": { src: "images/icon_score_36px.png", width: 48, height: 36 },
			"得分16": { src: "images/icon_score_16px.png", width: 32, height: 16 },
			"点击重新开始": { src: "images/icon_restart_18px.png", width: 120, height: 18 },
			"连击": { src: "images/icon_combo_16px.png", width: 48, height: 16 },
			"火力": { src: "images/icon_power_16px.png", width: 48, height: 16 },
			"副武器": { src: "images/icon_secondary_16px.png", width: 64, height: 16 },
		};

		// 加载图片文字
		for (const key in Game.textImages) {
			const info = Game.textImages[key];
			info.image = wx.createImage();
			info.image.src = info.src;
		}

		// 加载自定义字体
		Game.loadedFont = null;
		wx.loadFont({
			source: "data:text/css;base64," + wx.arrayBufferToBase64(wx.fileSystemManager.readFileSync("images/star_depth_font.ttf")),
			family: "StarDepthFont",
			success: (res) => {
				Game.loadedFont = "StarDepthFont";
				console.log("字体加载成功");
			},
			fail: (err) => {
				console.log("字体加载失败，使用默认字体", err);
				Game.loadedFont = "Arial";
			}
		});

		// 初始化
		this.initPools();
		this.initInput();
		this.initAudio();

		// 最后一帧时间
		this.lastTime = 0;

		// 显示开始界面
		this.showStartUI();

		// 启动游戏循环
		this.gameLoop(0);
	}

	/**
	 * 初始化对象池
	 */
	initPools() {
		this.bulletPool = new ObjectPool(
			() => new Bullet(),
			(b) => b.reset(),
			CONFIG.BULLET_POOL_SIZE,
		);
		this.enemyPool = new ObjectPool(
			() => new Enemy(),
			(e) => e.reset(),
			CONFIG.ENEMY_POOL_SIZE,
		);
		this.itemPool = new ObjectPool(
			() => new Item(),
			(i) => i.reset(),
			CONFIG.ITEM_POOL_SIZE,
		);
		this.particlePool = new ObjectPool(
			() => new Particle(),
			(p) => p.reset(),
			CONFIG.PARTICLE_POOL_SIZE,
		);
		this.laserPool = new ObjectPool(
			() => new Laser(),
			(l) => l.reset(),
			10,
		);
	}

	/**
	 * 初始化触摸输入处理
	 *
	 * 触摸事件说明：
	 * - touch.x/y 是相对于画布左上角的坐标（已转换为逻辑像素）
	 * - 画布尺寸必须与屏幕尺寸一致，否则坐标映射错误
	 * - 触摸区域划分为：
	 *   右上角 20% 宽度 + 上方 30% 高度 = 炸弹按钮区域
	 *   其余区域 = 移动控制区域
	 */
	initInput() {
		// 手指按下事件
		wx.onTouchStart((res) => {
			console.log("=== TouchStart ===");
			console.log("state:", this.state);
			console.log("touches:", res.touches);
			console.log("canvas size:", this.canvas.width, this.canvas.height);

			if (this.state === "playing") {
				this.touching = true; // 标记正在触摸

				// 获取触摸点坐标
				// res.touches[0] 包含：
				//   - clientX/clientY: 触摸点相对于屏幕视口的坐标
				//   - pageX/pageY: 触摸点相对于页面的坐标
				// 在微信小游戏环境中，这些值等于相对于画布的坐标
				const touch = res.touches[0];

				// 微信小游戏使用 clientX/clientY，不是 x/y
				console.log("touch.clientX:", touch.clientX, "touch.clientY:", touch.clientY);

				// -------------------------------------------------------
				// 炸弹按钮区域检测
				// 位于画布右上角 20% 宽度范围 + 上方 30% 高度范围
				// 用于判断是否触发炸弹清屏技能
				// -------------------------------------------------------
				const bombZoneX = this.canvas.width * 0.8; // X > 80% 宽度
				const bombZoneY = this.canvas.height * 0.3; // Y < 30% 高度

				console.log("bombZoneX:", bombZoneX, "bombZoneY:", bombZoneY);

				if (touch.clientX > bombZoneX && touch.clientY < bombZoneY) {
					// 在炸弹区域，触发炸弹技能
					console.log("触发炸弹!");
					this.player.useBomb(this);
				} else if (this.score >= 100000) {
					// 核弹按钮区域检测
					const nbtn = this.nuclearBombBtn;
					const dx = touch.clientX - (nbtn.x + nbtn.width / 2);
					const dy = touch.clientY - (nbtn.y + nbtn.height / 2);
					if (Math.sqrt(dx * dx + dy * dy) < nbtn.width / 2) {
						console.log("触发核弹!");
						this.useNuclearBomb();
					} else {
						this.handleTouch({ x: touch.clientX, y: touch.clientY });
					}
				} else {
					// 正常移动区域，更新玩家位置
					console.log("调用 handleTouch");
					this.handleTouch({ x: touch.clientX, y: touch.clientY });
				}
			} else if (this.state === "menu") {
				// 菜单状态：点击开始按钮开始游戏
				const touch = res.touches[0];
				const btn = this.startBtn;
				if (touch.clientX >= btn.x && touch.clientX <= btn.x + btn.width && touch.clientY >= btn.y && touch.clientY <= btn.y + btn.height) {
					console.log("点击开始按钮，开始游戏");
					this.startGame();
				}
			} else if (this.state === "gameover") {
				// 游戏结束状态：点击重新开始
				console.log("游戏结束状态，重新开始");
				this.restartGame();
			}
		});

		// 手指移动事件
		// 仅当处于 playing 状态且有手指按在屏幕上时处理
		// 持续跟踪手指位置，实现拖动控制
		wx.onTouchMove((res) => {
			console.log("=== TouchMove ===");
			console.log("state:", this.state, "touching:", this.touching);

			if (this.state === "playing" && this.touching) {
				const touch = res.touches[0];
				console.log("touch.clientX:", touch.clientX, "touch.clientY:", touch.clientY);
				// 持续更新玩家飞机位置，实现跟随手指拖动
				this.handleTouch({ x: touch.clientX, y: touch.clientY });
			}
		});

		// 手指离开事件
		wx.onTouchEnd(() => {
			console.log("=== TouchEnd ===");
			this.touching = false; // 取消触摸状态
		});
	}

	/**
	 * 初始化背景音乐
	 */
	initAudio() {
		this.bgmAudio = wx.createInnerAudioContext();
		this.bgmAudio.src = "audio/back-music.mp3";
		this.bgmAudio.loop = true;
		this.bgmAudio.volume = 0.5;

		this.shootAudio = wx.createInnerAudioContext();
		this.shootAudio.src = "audio/biu.mp3";
		this.shootAudio.volume = 0.3;

		this.thunderAudio = wx.createInnerAudioContext();
		this.thunderAudio.src = "audio/zizi.mp3";
		this.thunderAudio.volume = 0.4;

		this.explodeAudio = wx.createInnerAudioContext();
		this.explodeAudio.src = "audio/zhai.mp3";
		this.explodeAudio.volume = 0.5;

		this.bossDeathAudio = wx.createInnerAudioContext();
		this.bossDeathAudio.src = "audio/boss.mp3";
		this.bossDeathAudio.volume = 0.6;
	}

	/**
	 * 停止并销毁所有音频上下文
	 */
	destroyAudio() {
		const audios = [this.bgmAudio, this.shootAudio, this.thunderAudio, this.explodeAudio, this.bossDeathAudio];
		for (const audio of audios) {
			if (audio) {
				audio.stop();
				audio.destroy();
			}
		}
		this.bgmAudio = null;
		this.shootAudio = null;
		this.thunderAudio = null;
		this.explodeAudio = null;
		this.bossDeathAudio = null;
	}

	/**
	 * 播放射击音效
	 */
	playShootSound() {
		if (this.shootAudio) {
			this.shootAudio.currentTime = 0;
			this.shootAudio.play();
		}
	}

	/**
	 * 播放雷电音效
	 */
	playThunderSound() {
		if (this.thunderAudio) {
			this.thunderAudio.currentTime = 0;
			this.thunderAudio.play();
		}
	}

	/**
	 * 播放爆炸音效
	 */
	playExplodeSound() {
		if (this.explodeAudio) {
			this.explodeAudio.currentTime = 0;
			this.explodeAudio.play();
		}
	}

	/**
	 * 播放Boss死亡音效
	 */
	playBossDeathSound() {
		if (this.bossDeathAudio) {
			this.bossDeathAudio.currentTime = 0;
			this.bossDeathAudio.play();
		}
	}

	/**
	 * 处理触摸点，更新玩家飞机位置
	 *
	 * 坐标转换说明：
	 * - touch.x/y 是手指在画布上的坐标（由 clientX/clientY 转换而来）
	 * - 玩家飞机位置 (player.x, player.y) 是飞机左上角在画布上的坐标
	 * - 需要将手指位置转换为飞机中心点，再偏移回飞机左上角
	 *
	 * 边界约束：
	 * - 使用 Math.max/Math.min 限制飞机不能移出画布边界
	 * - this.canvas.width - this.player.width 为 X 轴最大位置
	 * - this.canvas.height - this.player.height 为 Y 轴最大位置
	 *
	 * @param {Object} touch - 触摸点对象，包含 x, y 坐标（已从 clientX/clientY 转换）
	 */
	handleTouch(touch) {
		const x = touch.x;
		const y = touch.y;

		// 将触摸点设为飞机中心点，再偏移半个飞机尺寸，得到左上角坐标
		// 同时限制在画布边界内，防止飞机移出屏幕
		this.player.x = Math.max(0, Math.min(this.canvas.width - this.player.width, x - this.player.width / 2));
		this.player.y = Math.max(0, Math.min(this.canvas.height - this.player.height, y - this.player.height / 2));
	}

	showStartUI() {
		// 绘制开始界面
		this.drawStartScreen();
	}

	drawStartScreen() {
		const ctx = this.ctx;
		ctx.fillStyle = "#050510";
		ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
		this.starfield.draw(ctx);

		// 标题
		this.drawText(ctx, "NEON STRIKE", this.canvas.width / 2, this.canvas.height / 2 - 80, "#00F2FF", "bold 36px");

		this.drawText(ctx, "星渊战机", this.canvas.width / 2, this.canvas.height / 2 - 40, "#FF0055", "20px");

		// 绘制开始按钮
		const btn = this.startBtn;
		const pulse = Math.sin(Date.now() / 300) * 0.1 + 0.9;

		// 按钮发光效果
		ctx.save();
		ctx.shadowColor = "#00F2FF";
		ctx.shadowBlur = 5;
		ctx.shadowOffsetX = 0;
		ctx.shadowOffsetY = 0;

		// 按钮背景
		ctx.fillStyle = `rgba(0, 242, 255, ${pulse * 0.2})`;
		ctx.fillRect(btn.x, btn.y, btn.width, btn.height);

		// 按钮边框
		ctx.strokeStyle = `rgba(0, 242, 255, ${pulse})`;
		ctx.lineWidth = 2;
		ctx.strokeRect(btn.x, btn.y, btn.width, btn.height);

		ctx.restore();

		// 按钮文字
		this.drawText(ctx, "开始游戏", this.width / 2, btn.y + btn.height / 2, "#00F2FF", "bold 20px");

		// 最高分
		if (this.highScore > 0) {
			this.drawText(ctx, `最高分: ${this.highScore}`, this.canvas.width / 2, this.canvas.height / 2 + 120, "#FF9900", "16px");
		}
	}

	drawGameOverScreen() {
		const ctx = this.ctx;
		ctx.fillStyle = "rgba(5, 5, 16, 0.9)";
		ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

		this.drawText(ctx, "GAME OVER", this.canvas.width / 2, this.canvas.height / 2 - 60, "#FF0055", "bold 36px");

		this.drawText(ctx, `得分: ${this.score}`, this.canvas.width / 2, this.canvas.height / 2, "#00F2FF", "24px");

		this.drawText(ctx, `最高分: ${this.highScore}`, this.canvas.width / 2, this.canvas.height / 2 + 40, "#FF9900", "18px");

		this.drawText(ctx, "点击重新开始", this.canvas.width / 2, this.canvas.height / 2 + 90, "#00F2FF", "16px");
	}

	/**
	 * 开始游戏，切换到播放状态并重置游戏数据
	 */
	startGame() {
		this.state = "playing";
		this.resetGame();
		this.bgmAudio.play();
	}

	/**
	 * 重新开始游戏（与 startGame 等价）
	 */
	restartGame() {
		this.state = "playing";
		this.resetGame();
		this.bgmAudio.play();
	}

	/**
	 * 重置游戏状态与对象，准备新一局。
	 */
	resetGame() {
		this.score = 0;
		this.combo = 0;
		this.comboTimer = 0;
		this.scoreMultiplier = 1;
		this.scoreMultiplierTimer = 0;

		this.player.reset();
		this.player.x = this.canvas.width / 2 - this.player.width / 2;
		this.player.y = this.canvas.height - 100;

		this.bulletPool.releaseAll();
		this.enemyPool.releaseAll();
		this.itemPool.releaseAll();
		this.particlePool.releaseAll();
		this.laserPool.releaseAll();

		this.spawnTimer = 0;
		this.spawnInterval = CONFIG.SPAWN_INTERVAL_BASE;
		this.waveCount = 0;
		this.bossSpawned = false;
		this.bossWarning = false;

		this.scoreInvincible = false;
		this.scoreInvincibleTimer = 0;
		this.invincibleThresholdIndex = 0;
		this.nextInvincibleThreshold = CONFIG.INVINCIBLE_SCORE_THRESHOLDS[0];

		this.destroyAudio();
		this.initAudio();
	}

	gameOver() {
		this.state = "gameover";
		this.bgmAudio.stop();
		if (this.score > this.highScore) {
			this.highScore = this.score;
			wx.setStorageSync("neonStrikeHighScore", this.highScore.toString());
		}
	}

	addScore(points) {
		const multiplier = this.scoreMultiplier * (1 + Math.floor(this.combo / 10) * 0.1);
		this.score += Math.floor(points * multiplier);
		this.combo++;
		this.comboTimer = 2000;

		// 检查分数无敌触发
		if (this.invincibleThresholdIndex < CONFIG.INVINCIBLE_SCORE_THRESHOLDS.length && this.score >= this.nextInvincibleThreshold) {
			this.scoreInvincible = true;
			this.scoreInvincibleTimer = CONFIG.INVINCIBLE_DURATION;
			this.invincibleThresholdIndex++;
			this.nextInvincibleThreshold = this.invincibleThresholdIndex < CONFIG.INVINCIBLE_SCORE_THRESHOLDS.length ? CONFIG.INVINCIBLE_SCORE_THRESHOLDS[this.invincibleThresholdIndex] : Infinity;
			this.screenFlash = 0.5;
		}

		// 检查副武器升级
		if (this.player.secondaryWeaponLevel < 3) {
			const threshold = CONFIG.SECONDARY_WEAPON_THRESHOLDS[this.player.secondaryWeaponLevel - 1];
			if (this.score >= threshold) {
				this.player.secondaryWeaponLevel++;
				this.screenFlash = 0.3;
			}
		}
	}

	spawnPlayerBullet(x, y, vx, vy) {
		const bullet = this.bulletPool.get();
		bullet.reset();
		bullet.active = true;
		bullet.isPlayerBullet = true;
		bullet.x = x;
		bullet.y = y;
		bullet.vx = vx * CONFIG.PLAYER_BULLET_SPEED;
		bullet.vy = vy * CONFIG.PLAYER_BULLET_SPEED;
		bullet.damage = 10;
		bullet.radius = 4;
		this.playShootSound();
	}

	spawnEnemyBullet(x, y, vx, vy) {
		const bullet = this.bulletPool.get();
		bullet.reset();
		bullet.active = true;
		bullet.isPlayerBullet = false;
		bullet.x = x;
		bullet.y = y;
		bullet.vx = vx;
		bullet.vy = vy;
		bullet.damage = 1;
		bullet.radius = 5;
	}

	spawnScatterBomb(x, y, angle) {
		const bullet = this.bulletPool.get();
		bullet.reset();
		bullet.active = true;
		bullet.isPlayerBullet = true;
		bullet.x = x;
		bullet.y = y;
		bullet.startX = x;
		bullet.startY = y;
		bullet.vx = Math.sin(angle) * CONFIG.SCATTER_BOMB_SPEED;
		bullet.vy = Math.cos(angle) * CONFIG.SCATTER_BOMB_SPEED;
		bullet.damage = 1;
		bullet.radius = CONFIG.SCATTER_BOMB_RADIUS;
		bullet.isScatterBomb = true;
		bullet.willSplit = true;
		bullet.explodeDistance = this.canvas.height / 2; // 屏幕1/2距离后爆炸
	}

	spawnSplitBomb(x, y, angle) {
		const bullet = this.bulletPool.get();
		bullet.reset();
		bullet.active = true;
		bullet.isPlayerBullet = true;
		bullet.x = x;
		bullet.y = y;
		bullet.vx = Math.sin(angle) * CONFIG.SCATTER_BOMB_SPEED;
		bullet.vy = Math.cos(angle) * CONFIG.SCATTER_BOMB_SPEED;
		bullet.damage = 1;
		bullet.radius = CONFIG.SCATTER_BOMB_RADIUS;
		bullet.isScatterBomb = true;
		bullet.willSplit = false;
		bullet.bombTimer = 200; // 子炸弹200ms后爆炸
	}

	spawnNormalMissile(x, y, vx, vy) {
		const bullet = this.bulletPool.get();
		bullet.reset();
		bullet.active = true;
		bullet.isPlayerBullet = true;
		bullet.x = x;
		bullet.y = y;
		bullet.vx = vx * CONFIG.MISSILE_SPEED;
		bullet.vy = vy * CONFIG.MISSILE_SPEED;
		bullet.damage = CONFIG.MISSILE_DAMAGE;
		bullet.radius = 5;
		bullet.isMissile = true;
	}

	spawnHomingMissile(x, y, target) {
		const bullet = this.bulletPool.get();
		bullet.reset();
		bullet.active = true;
		bullet.isPlayerBullet = true;
		bullet.x = x;
		bullet.y = y;
		bullet.vx = 0;
		bullet.vy = -CONFIG.HOMING_MISSILE_SPEED;
		bullet.damage = CONFIG.MISSILE_DAMAGE;
		bullet.radius = 5;
		bullet.isHomingMissile = true;
		bullet.target = target;
		bullet.trail = [];
	}

	spawnLaser(x, y, target = null) {
		const laser = this.laserPool.get();
		laser.reset();
		laser.active = true;
		laser.x = x;
		laser.y = y;
		laser.target = target;
		if (!target) {
			laser.endX = x;
			laser.endY = y + 100;
		}
		this.playThunderSound();
	}

	findNearestEnemy(playerX, playerY) {
		const enemies = this.enemyPool.getActive();
		let nearest = null;
		let minDist = Infinity;
		for (const enemy of enemies) {
			if (enemy.active) {
				const dx = enemy.getCenterX() - playerX;
				const dy = enemy.getCenterY() - playerY;
				const dist = Math.sqrt(dx * dx + dy * dy);
				if (dist < minDist) {
					minDist = dist;
					nearest = enemy;
				}
			}
		}
		return nearest;
	}

	spawnEnemy(type, x, y) {
		const enemy = this.enemyPool.get();
		enemy.reset();
		enemy.init(type, x, y);
	}

	spawnItem(x, y, type) {
		const item = this.itemPool.get();
		item.reset();
		item.init(x, y, type);
	}

	spawnExplosion(x, y, size) {
		for (let i = 0; i < 20; i++) {
			const angle = Math.random() * Math.PI * 2;
			const speed = 100 + Math.random() * 200;
			const particle = this.particlePool.get();
			particle.reset();
			particle.init(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, CONFIG.COLORS.ENEMY_SCOUT, 300 + Math.random() * 300);
		}
	}

	spawnSparkles(x, y, count) {
		for (let i = 0; i < count; i++) {
			const angle = Math.random() * Math.PI * 2;
			const speed = 50 + Math.random() * 100;
			const particle = this.particlePool.get();
			particle.reset();
			particle.init(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, "#FFFFFF", 200);
		}
	}

	clearEnemyBullets() {
		const bullets = this.bulletPool.getActive();
		for (const bullet of bullets) {
			if (!bullet.isPlayerBullet) {
				bullet.active = false;
				this.bulletPool.release(bullet);
			}
		}
	}

	damageAllEnemies(damage) {
		const enemies = this.enemyPool.getActive();
		for (const enemy of enemies) {
			if (enemy.active) {
				enemy.takeDamage(damage, this);
			}
		}
	}

	/**
	 * 绘制字体文字
	 * @param {CanvasRenderingContext2D} ctx
	 * @param {string} text 要绘制的文字
	 * @param {number} x 中心x坐标
	 * @param {number} y 中心y坐标
	 * @param {string} color 文字颜色
	 * @param {string} fontSize 字体大小，如 "20px"
	 */
	drawText(ctx, text, x, y, color = "#00F2FF", fontSize = "20px") {
		const fontFamily = Game.loadedFont || "Arial";
		ctx.font = `${fontSize} ${fontFamily}`;
		ctx.fillStyle = color;
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText(text, x, y);
	}

	/**
	 * 使用核弹，清除屏幕内一切
	 */
	useNuclearBomb() {
		// 闪光效果
		this.nuclearBombFlash = 1;

		// 震动效果
		if (wx.vibrateLong) {
			wx.vibrateLong({ success: () => {} });
		}

		// 清除所有敌机子弹
		this.clearEnemyBullets();

		// 对所有敌机造成大量伤害
		this.damageAllEnemies(200);

		// 生成巨大爆炸效果
		for (let i = 0; i < 50; i++) {
			const x = Math.random() * this.canvas.width;
			const y = Math.random() * this.canvas.height;
			this.spawnExplosion(x, y, 30 + Math.random() * 30);
		}

		// 屏幕特效
		this.screenFlash = 2;
	}

	checkCollisions() {
		this.spatialGrid.clear();
		const bullets = this.bulletPool.getActive();
		for (const bullet of bullets) {
			if (bullet.active) {
				this.spatialGrid.insert(bullet);
			}
		}
		const enemies = this.enemyPool.getActive();
		for (const enemy of enemies) {
			if (enemy.active) {
				this.spatialGrid.insert(enemy);
			}
		}

		// 玩家子弹 vs 敌机
		for (const bullet of bullets) {
			if (!bullet.active || !bullet.isPlayerBullet) continue;
			const nearby = this.spatialGrid.query(bullet.x, bullet.y, 50);
			for (const entity of nearby) {
				if (entity instanceof Enemy && entity.active) {
					const dx = bullet.x - entity.getCenterX();
					const dy = bullet.y - entity.getCenterY();
					const dist = Math.sqrt(dx * dx + dy * dy);
					if (dist < bullet.radius + entity.getRadius()) {
						entity.takeDamage(bullet.damage, this);
						bullet.active = false;
						this.bulletPool.release(bullet);
						break;
					}
				}
			}
		}

		// 激光 vs 敌机
		const lasers = this.laserPool.getActive();
		for (const laser of lasers) {
			if (!laser.active) continue;
			for (const enemy of enemies) {
				if (enemy.active && laser.checkCollision(enemy)) {
					enemy.takeDamage(laser.damage, this);
				}
			}
		}

		// 敌机子弹 vs 玩家
		for (const bullet of bullets) {
			if (!bullet.active || bullet.isPlayerBullet) continue;
			const grazeDx = bullet.x - this.player.getCenterX();
			const grazeDy = bullet.y - this.player.getCenterY();
			const grazeDist = Math.sqrt(grazeDx * grazeDx + grazeDy * grazeDy);
			if (grazeDist < CONFIG.PLAYER_GRAZE_RADIUS + bullet.radius) {
				this.addScore(50);
				this.spawnSparkles(bullet.x, bullet.y, 2);
			}
			if (grazeDist < CONFIG.PLAYER_HITBOX_RADIUS + bullet.radius) {
				this.player.hit(this);
				bullet.active = false;
				this.bulletPool.release(bullet);
			}
		}

		// 敌机 vs 玩家
		for (const enemy of enemies) {
			if (!enemy.active) continue;
			const dx = enemy.getCenterX() - this.player.getCenterX();
			const dy = enemy.getCenterY() - this.player.getCenterY();
			const dist = Math.sqrt(dx * dx + dy * dy);
			if (dist < enemy.getRadius() + CONFIG.PLAYER_HITBOX_RADIUS) {
				enemy.takeDamage(100, this);
				this.player.hit(this);
			}
		}

		// 道具 vs 玩家
		const items = this.itemPool.getActive();
		for (const item of items) {
			if (!item.active) continue;
			const dx = item.getCenterX() - this.player.getCenterX();
			const dy = item.getCenterY() - this.player.getCenterY();
			const dist = Math.sqrt(dx * dx + dy * dy);
			if (dist < 30) {
				item.collect(this);
			}
		}
	}

	spawnWave() {
		this.waveCount++;
		if (this.score >= 1000 && !this.bossSpawned) {
			this.bossSpawned = true;
			this.bossWarning = true;
			setTimeout(() => {
				this.bossWarning = false;
				this.spawnEnemy("boss", this.canvas.width / 2 - 60, -80);
			}, 2000);
			return;
		}
		const type = this.waveCount < 5 ? "scout" : this.waveCount < 15 ? "scout" : this.waveCount < 25 ? "fighter" : "elite";
		const count = 1 + Math.floor(this.waveCount / 10);
		for (let i = 0; i < count; i++) {
			const x = 50 + Math.random() * (this.canvas.width - 100);
			const y = -50 - Math.random() * 100;
			this.spawnEnemy(type, x, y);
		}
		this.spawnInterval = Math.max(500, CONFIG.SPAWN_INTERVAL_BASE - this.waveCount * 30);
	}

	/**
	 * 每帧更新游戏逻辑
	 * @param {number} dt 时间增量（秒）
	 */
	update(dt) {
		if (this.state === "menu") {
			this.starfield.update(dt);
			return;
		}
		if (this.state === "gameover") {
			this.starfield.update(dt);
			return;
		}
		if (this.state !== "playing") return;

		this.starfield.update(dt);
		this.player.update(dt, this);

		if (this.comboTimer > 0) {
			this.comboTimer -= dt * 1000;
			if (this.comboTimer <= 0) {
				this.combo = 0;
			}
		}
		if (this.scoreMultiplierTimer > 0) {
			this.scoreMultiplierTimer -= dt * 1000;
			if (this.scoreMultiplierTimer <= 0) {
				this.scoreMultiplier = 1;
			}
		}

		if (this.scoreInvincible) {
			this.scoreInvincibleTimer -= dt * 1000;
			if (this.scoreInvincibleTimer <= 0) {
				this.scoreInvincible = false;
				this.scoreInvincibleTimer = 0;
			}
		}

		this.spawnTimer += dt * 1000;
		if (this.spawnTimer >= this.spawnInterval && !this.bossWarning) {
			this.spawnWave();
			this.spawnTimer = 0;
		}

		const bullets = this.bulletPool.getActive();
		for (const bullet of bullets) {
			if (bullet.active) bullet.update(dt, this);
		}

		const lasers = this.laserPool.getActive();
		for (const laser of lasers) {
			if (laser.active) laser.update(dt);
		}

		const enemies = this.enemyPool.getActive();
		for (const enemy of enemies) {
			if (enemy.active) enemy.update(dt, this);
		}

		const items = this.itemPool.getActive();
		for (const item of items) {
			if (item.active) item.update(dt, this);
		}

		const particles = this.particlePool.getActive();
		for (const particle of particles) {
			if (particle.active) particle.update(dt);
		}

		this.checkCollisions();
		this.cleanup();
		if (this.screenFlash > 0) this.screenFlash -= dt * 3;
	}

	cleanup() {
		const bullets = this.bulletPool.getActive();
		for (const bullet of bullets) {
			if (!bullet.active) this.bulletPool.release(bullet);
		}
		const enemies = this.enemyPool.getActive();
		for (const enemy of enemies) {
			if (!enemy.active) this.enemyPool.release(enemy);
		}
		const items = this.itemPool.getActive();
		for (const item of items) {
			if (!item.active) this.itemPool.release(item);
		}
		const particles = this.particlePool.getActive();
		for (const particle of particles) {
			if (!particle.active) this.particlePool.release(particle);
		}
		const lasers = this.laserPool.getActive();
		for (const laser of lasers) {
			if (!laser.active) this.laserPool.release(laser);
		}
	}

	/**
	 * 绘制游戏界面元素（分数、连击、生命等）
	 * @param {CanvasRenderingContext2D} ctx 绘图上下文
	 */
	drawUI(ctx) {
		// 得分
		this.drawText(ctx, `得分: ${this.score}`, 50, 30, "#00F2FF", "16px");

		// 连击
		if (this.combo > 1) {
			this.drawText(ctx, `连击 x${this.combo}`, 40, 55, "#FF9900", "16px");
		}

		// 生命值
		ctx.fillStyle = "#FF0055";
		ctx.textAlign = "right";
		ctx.font = "16px Arial";
		let lives = "";
		for (let i = 0; i < Math.max(0, this.player.hp); i++) lives += "❤";
		ctx.fillText(lives, this.canvas.width - 20, 30);

		// 炸弹
		this.drawText(ctx, `炸弹 x${this.player.bombs}`, this.canvas.width - 20, this.canvas.height - 20, "#FFFF00", "16px");

		// 火力
		this.drawText(ctx, `火力 Lv.${this.player.powerLevel}`, 60, this.canvas.height - 20, "#00FF9D", "16px");

		// 副武器
		this.drawText(ctx, `副武器 Lv.${this.player.secondaryWeaponLevel}`, 85, this.canvas.height - 50, "#FF00FF", "16px");

		// 无敌状态显示
		if (this.scoreInvincible) {
			const timeLeft = Math.ceil(this.scoreInvincibleTimer / 1000);
			this.drawText(ctx, `无敌 ${timeLeft}s`, this.canvas.width / 2, 20, "#FFD700", "16px");
		}

		// 核弹按钮（分数达到100000时显示）
		if (this.score >= 100000) {
			const btn = this.nuclearBombBtn;
			const pulse = Math.sin(Date.now() / 200) * 0.2 + 0.8;

			ctx.save();

			// 裁剪为圆形区域
			ctx.beginPath();
			ctx.arc(btn.x + btn.width / 2, btn.y + btn.height / 2, btn.width / 2, 0, Math.PI * 2);
			ctx.clip();

			// 图片平铺按钮背景
			const bombImg = Game.bombImage;
			if (bombImg && bombImg.complete && bombImg.naturalWidth !== 0) {
				const pattern = ctx.createPattern(bombImg, "repeat");
				ctx.fillStyle = pattern;
				ctx.fill();
			} else {
				// 备用：纯色背景
				ctx.fillStyle = `rgba(255, 0, 0, ${pulse * 0.3})`;
				ctx.fill();
			}

			// 发光边框
			ctx.shadowColor = "#FF0000";
			ctx.shadowBlur = 5;
			ctx.strokeStyle = `rgba(255, 100, 100, ${pulse})`;
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.arc(btn.x + btn.width / 2, btn.y + btn.height / 2, btn.width / 2, 0, Math.PI * 2);
			ctx.stroke();

			ctx.restore();
		}
	}

	/**
	 * 渲染当前帧画面
	 */
	draw() {
		const ctx = this.ctx;
		ctx.fillStyle = "#050510";
		ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

		this.starfield.draw(ctx);

		if (this.state === "menu") {
			this.drawStartScreen();
			return;
		}

		if (this.state === "gameover") {
			// 绘制剩余游戏元素
			const items = this.itemPool.getActive();
			for (const item of items) {
				if (item.active) item.draw(ctx);
			}
			const enemies = this.enemyPool.getActive();
			for (const enemy of enemies) {
				if (enemy.active) enemy.draw(ctx);
			}
			this.drawGameOverScreen();
			return;
		}

		if (this.state === "playing" || this.state === "gameover") {
			const items = this.itemPool.getActive();
			for (const item of items) {
				if (item.active) item.draw(ctx);
			}

			const enemies = this.enemyPool.getActive();
			for (const enemy of enemies) {
				if (enemy.active) enemy.draw(ctx);
			}

			const lasers = this.laserPool.getActive();
			for (const laser of lasers) {
				if (laser.active) laser.draw(ctx);
			}

			const bullets = this.bulletPool.getActive();
			for (const bullet of bullets) {
				if (bullet.active) bullet.draw(ctx);
			}

			const particles = this.particlePool.getActive();
			for (const particle of particles) {
				if (particle.active) particle.draw(ctx);
			}

			if (this.state === "playing") {
				this.player.draw(ctx, this);
			}

			// 绘制UI
			this.drawUI(ctx);

			if (this.screenFlash > 0) {
				ctx.fillStyle = `rgba(255, 255, 255, ${this.screenFlash * 0.5})`;
				ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
			}

			// 核弹闪光效果
			if (this.nuclearBombFlash > 0) {
				ctx.fillStyle = `rgba(255, 255, 255, ${this.nuclearBombFlash})`;
				ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
				this.nuclearBombFlash -= dt * 5;
				if (this.nuclearBombFlash < 0) this.nuclearBombFlash = 0;
			}
		}
	}

	/**
	 * 游戏主循环
	 * @param {number} timestamp 当前时间戳
	 */
	gameLoop(timestamp) {
		const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
		this.lastTime = timestamp;

		this.update(dt);
		this.draw(dt);

		requestAnimationFrame((t) => this.gameLoop(t));
	}
}
