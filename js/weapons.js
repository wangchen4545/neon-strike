import { CONFIG } from './config.js';
import { Entity } from './entity.js';

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
		this.isPierce = false;
		this.isRefract = false;
		this.refractCount = 0;
		this.isLightning = false;
		this.lightningChains = 0;
		this.hitEnemies = null;
		this.color = null;
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
		} else if (this.isRefract) {
			this.drawRefractBeam(ctx);
		} else if (this.isLightning) {
			this.drawLightningBullet(ctx);
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
	 * 绘制折射弹（亮线光束 + 尾迹）
	 * @param {CanvasRenderingContext2D} ctx 绘制上下文
	 */
	drawRefractBeam(ctx) {
		const now = Date.now();
		const tailLen = 120;
		const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
		if (speed > 0) {
			const dx = -(this.vx / speed) * tailLen;
			const dy = -(this.vy / speed) * tailLen;
			const tx = this.x + dx;
			const ty = this.y + dy;
			// 外层光晕
			const outerGlow = ctx.createLinearGradient(tx, ty, this.x, this.y);
			outerGlow.addColorStop(0, "rgba(255, 100, 0, 0)");
			outerGlow.addColorStop(0.3, "rgba(255, 150, 0, 0.15)");
			outerGlow.addColorStop(0.7, "rgba(255, 180, 0, 0.4)");
			outerGlow.addColorStop(1, "rgba(255, 220, 0, 0.7)");
			ctx.beginPath();
			ctx.moveTo(tx, ty);
			ctx.lineTo(this.x, this.y);
			ctx.strokeStyle = outerGlow;
			ctx.lineWidth = 6;
			ctx.stroke();
			// 中层光束
			const midGlow = ctx.createLinearGradient(tx, ty, this.x, this.y);
			midGlow.addColorStop(0, "rgba(255, 200, 50, 0)");
			midGlow.addColorStop(0.4, "rgba(255, 200, 50, 0.5)");
			midGlow.addColorStop(1, "#FFAA00");
			ctx.beginPath();
			ctx.moveTo(tx, ty);
			ctx.lineTo(this.x, this.y);
			ctx.strokeStyle = midGlow;
			ctx.lineWidth = 2.5;
			ctx.stroke();
			// 核心白线
			const flicker = 0.7 + Math.sin(now / 30) * 0.3;
			ctx.beginPath();
			ctx.moveTo(tx, ty);
			ctx.lineTo(this.x, this.y);
			ctx.strokeStyle = `rgba(255, 255, 255, ${flicker})`;
			ctx.lineWidth = 1;
			ctx.stroke();
		}

	}

	/**
	 * 绘制雷电弹（白色电弧球）
	 * @param {CanvasRenderingContext2D} ctx 绘制上下文
	 */
	drawLightningBullet(ctx) {
		const now = Date.now();
		const flicker = 0.4 + Math.random() * 0.6;
		// 外电弧光晕
		for (let i = 0; i < 3; i++) {
			const angle = (now / 100 + i * Math.PI * 2 / 3) % (Math.PI * 2);
			const arcLen = 8 + Math.random() * 6;
			const startX = this.x + Math.cos(angle) * this.radius;
			const startY = this.y + Math.sin(angle) * this.radius;
			ctx.beginPath();
			ctx.moveTo(startX, startY);
			ctx.lineTo(
				startX + Math.cos(angle) * arcLen + (Math.random() - 0.5) * 8,
				startY + Math.sin(angle) * arcLen + (Math.random() - 0.5) * 8
			);
			ctx.strokeStyle = `rgba(200, 220, 255, ${flicker * 0.8})`;
			ctx.lineWidth = 1;
			ctx.stroke();
		}
		// 核心球
		ctx.beginPath();
		ctx.arc(this.x, this.y, this.radius + 2, 0, Math.PI * 2);
		ctx.fillStyle = `rgba(255, 255, 255, ${0.4 + Math.sin(now / 30) * 0.3})`;
		ctx.fill();
		ctx.beginPath();
		ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
		ctx.fillStyle = "#FFFFFF";
		ctx.fill();
		// 内核
		ctx.beginPath();
		ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
		ctx.fillStyle = `rgba(180, 210, 255, ${flicker})`;
		ctx.fill();
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
			color = this.color || (this.isPlayerBullet ? CONFIG.COLORS.PLAYER_BULLET : CONFIG.COLORS.ENEMY_BULLET);
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

/**
 * 僚机激光实体，白色直线激光。
 */
class WingmanLaser extends Entity {
	constructor() {
		super();
		this.width = CONFIG.WINGMAN_LASER_WIDTH;
		this.height = 0;
		this.lifeTime = 0;
		this.maxLifeTime = CONFIG.WINGMAN_LASER_DURATION;
		this.damage = 5;
		this.startX = 0;
		this.startY = 0;
	}
	reset() {
		super.reset();
		this.height = 0;
		this.lifeTime = 0;
		this.maxLifeTime = CONFIG.WINGMAN_LASER_DURATION;
		this.damage = 5;
		this.startX = 0;
		this.startY = 0;
	}
	init(x, y) {
		this.active = true;
		this.x = x;
		this.y = y;
		this.startX = x;
		this.startY = y;
		this.height = 0;
	}
	update(dt) {
		this.lifeTime += dt * 1000;
		this.height -= 1500 * dt; // 向上延伸（负值）
		if (this.lifeTime >= this.maxLifeTime) {
			this.active = false;
		}
	}
	draw(ctx) {
		const alpha = 1 - this.lifeTime / this.maxLifeTime;
		ctx.save();
		ctx.globalAlpha = alpha;
		ctx.strokeStyle = "#FFFFFF";
		ctx.lineWidth = CONFIG.WINGMAN_LASER_WIDTH;
		ctx.beginPath();
		ctx.moveTo(this.x, this.y);
		ctx.lineTo(this.x, this.y + this.height); // height为负值，向上画
		ctx.stroke();
		// 发光效果
		ctx.shadowColor = "#FFFFFF";
		ctx.shadowBlur = 10;
		ctx.stroke();
		ctx.restore();
	}
	checkCollision(enemy) {
		if (!this.active || !enemy.active) return false;
		// 激光是垂直向上的线段（height为负值），检查是否与敌人相交
		const laserTop = Math.min(this.y, this.y + this.height); // this.y是起点，this.y + this.height是终点
		const laserBottom = Math.max(this.y, this.y + this.height);
		const enemyTop = enemy.y;
		const enemyBottom = enemy.y + enemy.height;
		// 检查X坐标是否在敌人范围内
		if (this.x < enemy.x || this.x > enemy.x + enemy.width) return false;
		// 检查Y范围是否有重叠
		return laserBottom > enemyTop && laserTop < enemyBottom;
	}
}

export { Bullet, Laser, WingmanLaser };
