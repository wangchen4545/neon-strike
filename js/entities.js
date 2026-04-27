import { CONFIG } from './config.js';
import { Entity } from './entity.js';

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

		// 使用精细的向量绘制
		{
			ctx.save();
			ctx.translate(cx, cy);

			// 引擎火焰（动态）
			const flameLength = 12 + Math.random() * 6;
			const flamePulse = 0.7 + Math.sin(now / 50) * 0.3;
			// 左引擎火焰
			ctx.beginPath();
			ctx.moveTo(-8, 15);
			ctx.lineTo(-12, 15 + flameLength);
			ctx.lineTo(-4, 15);
			ctx.closePath();
			ctx.fillStyle = `rgba(255, 100, 0, ${flamePulse})`;
			ctx.fill();
			// 右引擎火焰
			ctx.beginPath();
			ctx.moveTo(8, 15);
			ctx.lineTo(4, 15 + flameLength);
			ctx.lineTo(12, 15);
			ctx.closePath();
			ctx.fillStyle = `rgba(255, 100, 0, ${flamePulse})`;
			ctx.fill();
			// 中引擎火焰
			ctx.beginPath();
			ctx.moveTo(-3, 18);
			ctx.lineTo(0, 25 + flameLength * 0.8);
			ctx.lineTo(3, 18);
			ctx.closePath();
			ctx.fillStyle = `rgba(255, 200, 50, ${flamePulse})`;
			ctx.fill();

			// 主体机翼背景
			ctx.beginPath();
			ctx.moveTo(0, -28); // 机头
			ctx.lineTo(-25, 5); // 左翼尖
			ctx.lineTo(-20, 12); // 左翼后缘
			ctx.lineTo(-8, 8); // 左翼内侧
			ctx.lineTo(-5, 18); // 左后缘
			ctx.lineTo(0, 15); // 尾部
			ctx.lineTo(5, 18); // 右后缘
			ctx.lineTo(8, 8); // 右翼内侧
			ctx.lineTo(20, 12); // 右翼后缘
			ctx.lineTo(25, 5); // 右翼尖
			ctx.closePath();
			const bodyGradient = ctx.createLinearGradient(0, -28, 0, 18);
			bodyGradient.addColorStop(0, "#0088FF");
			bodyGradient.addColorStop(0.5, "#00CCFF");
			bodyGradient.addColorStop(1, "#0055AA");
			ctx.fillStyle = bodyGradient;
			ctx.fill();
			ctx.strokeStyle = "#00FFFF";
			ctx.lineWidth = 1.5;
			ctx.stroke();

			// 左翼细节
			ctx.beginPath();
			ctx.moveTo(-12, -5);
			ctx.lineTo(-22, 3);
			ctx.lineTo(-18, 8);
			ctx.lineTo(-10, 2);
			ctx.closePath();
			ctx.fillStyle = "#0066CC";
			ctx.fill();
			// 右翼细节
			ctx.beginPath();
			ctx.moveTo(12, -5);
			ctx.lineTo(22, 3);
			ctx.lineTo(18, 8);
			ctx.lineTo(10, 2);
			ctx.closePath();
			ctx.fillStyle = "#0066CC";
			ctx.fill();

			// 驾驶舱（椭圆形）
			ctx.beginPath();
			ctx.ellipse(0, -8, 5, 10, 0, 0, Math.PI * 2);
			const cockpitGradient = ctx.createLinearGradient(0, -18, 0, 2);
			cockpitGradient.addColorStop(0, "#00FFFF");
			cockpitGradient.addColorStop(0.5, "#0088AA");
			cockpitGradient.addColorStop(1, "#004466");
			ctx.fillStyle = cockpitGradient;
			ctx.fill();
			ctx.strokeStyle = "#00FFFF";
			ctx.lineWidth = 1;
			ctx.stroke();

			// 驾驶舱高光
			ctx.beginPath();
			ctx.ellipse(-2, -12, 2, 4, -0.3, 0, Math.PI * 2);
			ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
			ctx.fill();

			// 机头装饰线
			ctx.beginPath();
			ctx.moveTo(0, -28);
			ctx.lineTo(0, -5);
			ctx.strokeStyle = "#00FFFF";
			ctx.lineWidth = 2;
			ctx.stroke();

			// 机身中线
			ctx.beginPath();
			ctx.moveTo(0, -5);
			ctx.lineTo(0, 15);
			ctx.strokeStyle = "rgba(0, 255, 255, 0.3)";
			ctx.lineWidth = 1;
			ctx.stroke();

			// 引擎口
			ctx.beginPath();
			ctx.ellipse(-8, 16, 4, 3, 0, 0, Math.PI * 2);
			ctx.fillStyle = "#FF6600";
			ctx.fill();
			ctx.beginPath();
			ctx.ellipse(8, 16, 4, 3, 0, 0, Math.PI * 2);
			ctx.fillStyle = "#FF6600";
			ctx.fill();
			ctx.beginPath();
			ctx.ellipse(0, 18, 3, 2, 0, 0, Math.PI * 2);
			ctx.fillStyle = "#FFAA00";
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
	 * - 分数 >= 50000：完全清屏效果，扣除 50000 积分
	 * - 分数 >= 10000：弱效清屏效果，扣除 10000 积分
	 * - 分数 < 10000：无法使用
	 * @param {Game} game 游戏主对象
	 */
	useBomb(game) {
		if (this.bombs <= 0) return;

		// 分数不足 10000 无法使用炸弹
		if (game.score < CONFIG.BOMB_WEAK_THRESHOLD) {
			return;
		}

		this.bombs--;

		// 分数达到完全清屏门槛时执行清屏效果
		if (game.score >= CONFIG.BOMB_CLEAR_THRESHOLD) {
			game.score -= CONFIG.BOMB_CLEAR_THRESHOLD; // 扣除 50000 积分

			// 清屏效果
			game.screenFlash = 1; // 屏幕闪烁
			if (wx.vibrateLong) wx.vibrateLong({ success: () => {} }); // 震动

			// 清除所有敌机子弹
			game.clearEnemyBullets();

			// 清除所有敌机并生成爆炸效果
			const enemies = game.enemyPool.getActive();
			for (const enemy of enemies) {
				if (enemy.active) {
					game.spawnExplosion(enemy.getCenterX(), enemy.getCenterY(), enemy.width);
					enemy.active = false;
					game.enemyPool.release(enemy);
				}
			}

			// 清除所有道具
			const items = game.itemPool.getActive();
			for (const item of items) {
				if (item.active) {
					item.active = false;
					game.itemPool.release(item);
				}
			}

			// 生成巨大爆炸效果
			for (let i = 0; i < 30; i++) {
				const x = Math.random() * game.canvas.width;
				const y = Math.random() * game.canvas.height;
				game.spawnExplosion(x, y, 20 + Math.random() * 20);
			}
		} else {
			// 弱效清屏：分数 >= 10000 但 < 50000
			game.score -= CONFIG.BOMB_WEAK_THRESHOLD; // 扣除 10000 积分

			// 只清除敌弹并造成伤害
			game.clearEnemyBullets();
			game.damageAllEnemies(50);
			game.screenFlash = 0.5;

			// 以玩家为中心生成爆炸效果
			for (let i = 0; i < 10; i++) {
				const angle = (i / 10) * Math.PI * 2;
				game.spawnExplosion(game.player.getCenterX() + Math.cos(angle) * 200, game.player.getCenterY() + Math.sin(angle) * 200, 20);
			}
		}
	}
}

// ---------------- 僚机 ----------------
/**
 * 僚机实体，跟随玩家并发射直线激光。
 */
class Wingman extends Entity {
	constructor() {
		super();
		this.width = 30;
		this.height = 30;
		this.offsetX = 0;
		this.offsetY = 0;
		this.targetX = 0;
		this.targetY = 0;
		this.lastLaserTime = 0;
		this.laserActive = false;
		this.laserTimer = 0;
	}
	reset() {
		super.reset();
		this.active = false;
		this.offsetX = 0;
		this.offsetY = 0;
		this.targetX = 0;
		this.targetY = 0;
		this.lastLaserTime = 0;
		this.laserActive = false;
		this.laserTimer = 0;
		this.level = 1;
	}
	init(x, y, offsetX, offsetY, level = 1) {
		this.active = true;
		this.x = x;
		this.y = y;
		this.targetX = x;
		this.targetY = y;
		this.offsetX = offsetX;
		this.offsetY = offsetY;
		this.level = level;
	}
	/**
	 * 更新僚机状态（延迟跟随与激光发射）
	 * @param {number} dt 时间增量（秒）
	 * @param {Game} game 游戏主对象
	 */
	update(dt, game) {
		// 计算目标位置（玩家位置 + 偏移量）
		const player = game.player;
		this.targetX = player.getCenterX() + this.offsetX;
		this.targetY = player.getCenterY() + this.offsetY;

		// 延迟跟随（100ms）
		const delay = CONFIG.WINGMAN_FOLLOW_DELAY / 1000;
		this.x += (this.targetX - this.x) * Math.min(1, dt / delay);
		this.y += (this.targetY - this.y) * Math.min(1, dt / delay);

		// 激光发射逻辑：根据等级确定发射间隔
		const now = Date.now();
		const interval = CONFIG.WINGMAN_LASER_INTERVALS[this.level - 1];

		if (now - this.lastLaserTime >= interval) {
			this.laserActive = true;
			this.laserTimer = CONFIG.WINGMAN_LASER_DURATION;
			this.lastLaserTime = now;

			// 发射激光
			this.fireLaser(game);
		}

		// 更新激光持续时间
		if (this.laserActive) {
			this.laserTimer -= dt * 1000;
			if (this.laserTimer <= 0) {
				this.laserActive = false;
			}
		}
	}
	/**
	 * 僚机发射直线激光
	 * @param {Game} game 游戏主对象
	 */
	fireLaser(game) {
		const cx = this.getCenterX();
		const cy = this.getCenterY();
		game.spawnWingmanLaser(cx, cy);
	}
	/**
	 * 绘制僚机
	 * @param {CanvasRenderingContext2D} ctx 绘制上下文
	 */
	draw(ctx) {
		const cx = this.getCenterX();
		const cy = this.getCenterY();

		ctx.save();
		ctx.translate(cx, cy);

		// 僚机主体（小型战机形状）
		ctx.beginPath();
		ctx.moveTo(0, -15);
		ctx.lineTo(-10, 12);
		ctx.lineTo(0, 8);
		ctx.lineTo(10, 12);
		ctx.closePath();
		ctx.fillStyle = "#00FFFF";
		ctx.fill();

		// 发光效果
		ctx.shadowColor = "#00FFFF";
		ctx.shadowBlur = 10;
		ctx.strokeStyle = "#00FFFF";
		ctx.lineWidth = 1;
		ctx.stroke();

		ctx.restore();
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
		ctx.scale(1, -1); // 翻转，让敌机朝向玩家（屏幕下方）
		if (this.type === "scout") {
			// Scout（侦察机）- 小型快速三角战机
			// 引擎火焰
			const scoutFlame = 6 + Math.random() * 4;
			ctx.beginPath();
			ctx.moveTo(-4, 12);
			ctx.lineTo(0, 12 + scoutFlame);
			ctx.lineTo(4, 12);
			ctx.closePath();
			ctx.fillStyle = "#FF6600";
			ctx.fill();
			// 主体
			ctx.beginPath();
			ctx.moveTo(0, -18); // 机头
			ctx.lineTo(-12, 8); // 左翼尖
			ctx.lineTo(-6, 5); // 左翼后缘
			ctx.lineTo(-3, 12); // 左尾翼
			ctx.lineTo(0, 10); // 尾部
			ctx.lineTo(3, 12); // 右尾翼
			ctx.lineTo(6, 5); // 右翼后缘
			ctx.lineTo(12, 8); // 右翼尖
			ctx.closePath();
			const scoutGrad = ctx.createLinearGradient(0, -18, 0, 12);
			scoutGrad.addColorStop(0, "#FF0055");
			scoutGrad.addColorStop(1, "#AA0033");
			ctx.fillStyle = scoutGrad;
			ctx.fill();
			ctx.strokeStyle = "#FF3377";
			ctx.lineWidth = 1;
			ctx.stroke();
			// 驾驶舱
			ctx.beginPath();
			ctx.ellipse(0, -5, 3, 6, 0, 0, Math.PI * 2);
			ctx.fillStyle = "#FF6699";
			ctx.fill();
			// 机头线
			ctx.beginPath();
			ctx.moveTo(0, -18);
			ctx.lineTo(0, 2);
			ctx.strokeStyle = "#FF99AA";
			ctx.lineWidth = 1;
			ctx.stroke();
		} else if (this.type === "fighter") {
			// Fighter（战斗机）- 中型战机，带侧翼
			// 引擎火焰
			const fighterFlame = 8 + Math.random() * 5;
			ctx.beginPath();
			ctx.moveTo(-5, 15);
			ctx.lineTo(0, 15 + fighterFlame);
			ctx.lineTo(5, 15);
			ctx.closePath();
			ctx.fillStyle = "#FF8800";
			ctx.fill();
			// 主体
			ctx.beginPath();
			ctx.moveTo(0, -22); // 机头
			ctx.lineTo(-18, 5); // 左外翼尖
			ctx.lineTo(-22, 10); // 左前缘
			ctx.lineTo(-12, 8); // 左翼连接
			ctx.lineTo(-8, 15); // 左后缘
			ctx.lineTo(0, 12); // 尾部
			ctx.lineTo(8, 15); // 右后缘
			ctx.lineTo(12, 8); // 右翼连接
			ctx.lineTo(22, 10); // 右前缘
			ctx.lineTo(18, 5); // 右外翼尖
			ctx.closePath();
			const fighterGrad = ctx.createLinearGradient(0, -22, 0, 15);
			fighterGrad.addColorStop(0, "#FF6600");
			fighterGrad.addColorStop(0.5, "#FF9900");
			fighterGrad.addColorStop(1, "#CC5500");
			ctx.fillStyle = fighterGrad;
			ctx.fill();
			ctx.strokeStyle = "#FFAA33";
			ctx.lineWidth = 1.5;
			ctx.stroke();
			// 机翼细节
			ctx.beginPath();
			ctx.moveTo(-15, 2);
			ctx.lineTo(-8, 6);
			ctx.lineTo(-5, 10);
			ctx.strokeStyle = "#FFCC66";
			ctx.lineWidth = 1;
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(15, 2);
			ctx.lineTo(8, 6);
			ctx.lineTo(5, 10);
			ctx.stroke();
			// 驾驶舱
			ctx.beginPath();
			ctx.ellipse(0, -8, 4, 8, 0, 0, Math.PI * 2);
			const cockpitGrad = ctx.createLinearGradient(0, -16, 0, 0);
			cockpitGrad.addColorStop(0, "#FFCC00");
			cockpitGrad.addColorStop(1, "#FF8800");
			ctx.fillStyle = cockpitGrad;
			ctx.fill();
			// 机头中线
			ctx.beginPath();
			ctx.moveTo(0, -22);
			ctx.lineTo(0, -2);
			ctx.strokeStyle = "#FFDD88";
			ctx.lineWidth = 2;
			ctx.stroke();
		} else if (this.type === "elite") {
			// Elite（精英机）- 圆形核心+旋转臂
			// 旋转臂
			const eliteAngle = Date.now() / 500;
			for (let i = 0; i < 4; i++) {
				const angle = (i / 4) * Math.PI * 2 + eliteAngle;
				ctx.beginPath();
				ctx.moveTo(0, 0);
				ctx.lineTo(Math.cos(angle) * 28, Math.sin(angle) * 28);
				ctx.strokeStyle = "#AA00FF";
				ctx.lineWidth = 4;
				ctx.stroke();
				// 臂端
				ctx.beginPath();
				ctx.arc(Math.cos(angle) * 28, Math.sin(angle) * 28, 5, 0, Math.PI * 2);
				ctx.fillStyle = "#DD00FF";
				ctx.fill();
			}
			// 核心圆
			ctx.beginPath();
			ctx.arc(0, 0, 14, 0, Math.PI * 2);
			const eliteGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 14);
			eliteGrad.addColorStop(0, "#DD00FF");
			eliteGrad.addColorStop(0.7, "#9900CC");
			eliteGrad.addColorStop(1, "#660099");
			ctx.fillStyle = eliteGrad;
			ctx.fill();
			ctx.strokeStyle = "#EE66FF";
			ctx.lineWidth = 2;
			ctx.stroke();
			// 核心高光
			ctx.beginPath();
			ctx.arc(-3, -3, 4, 0, Math.PI * 2);
			ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
			ctx.fill();
		} else if (this.type === "boss") {
			// Boss - 大型战机，多炮台
			// 引擎火焰（多个）
			const bossFlame = 10 + Math.random() * 6;
			for (let i = -2; i <= 2; i++) {
				ctx.beginPath();
				ctx.moveTo(i * 12 - 3, 35);
				ctx.lineTo(i * 12, 35 + bossFlame);
				ctx.lineTo(i * 12 + 3, 35);
				ctx.closePath();
				ctx.fillStyle = i === 0 ? "#FFFF00" : "#FF8800";
				ctx.fill();
			}
			// 主体机甲
			ctx.beginPath();
			ctx.moveTo(0, -45); // 机头
			ctx.lineTo(-25, -20); // 左前缘
			ctx.lineTo(-55, 10); // 左外翼前
			ctx.lineTo(-50, 25); // 左外翼后
			ctx.lineTo(-30, 20); // 左内翼
			ctx.lineTo(-20, 35); // 左后缘
			ctx.lineTo(0, 30); // 尾部
			ctx.lineTo(20, 35); // 右后缘
			ctx.lineTo(30, 20); // 右内翼
			ctx.lineTo(50, 25); // 右外翼后
			ctx.lineTo(55, 10); // 右外翼前
			ctx.lineTo(25, -20); // 右前缘
			ctx.closePath();
			const bossGrad = ctx.createLinearGradient(0, -45, 0, 35);
			bossGrad.addColorStop(0, "#FFAA00");
			bossGrad.addColorStop(0.3, "#FF9900");
			bossGrad.addColorStop(0.7, "#CC6600");
			bossGrad.addColorStop(1, "#994400");
			ctx.fillStyle = bossGrad;
			ctx.fill();
			ctx.strokeStyle = "#FFCC33";
			ctx.lineWidth = 2;
			ctx.stroke();
			// 驾驶舱罩
			ctx.beginPath();
			ctx.ellipse(0, -25, 12, 18, 0, Math.PI, Math.PI * 2);
			ctx.fillStyle = "#8800FF";
			ctx.fill();
			ctx.strokeStyle = "#AA55FF";
			ctx.lineWidth = 1.5;
			ctx.stroke();
			// 机翼装饰线
			ctx.beginPath();
			ctx.moveTo(-40, 5);
			ctx.lineTo(-30, 15);
			ctx.moveTo(40, 5);
			ctx.lineTo(30, 15);
			ctx.strokeStyle = "#FFDD88";
			ctx.lineWidth = 2;
			ctx.stroke();
			// 炮台（两侧）
			ctx.beginPath();
			ctx.arc(-45, 25, 8, 0, Math.PI * 2);
			ctx.fillStyle = "#FF4400";
			ctx.fill();
			ctx.strokeStyle = "#FF6600";
			ctx.lineWidth = 2;
			ctx.stroke();
			ctx.beginPath();
			ctx.arc(45, 25, 8, 0, Math.PI * 2);
			ctx.fillStyle = "#FF4400";
			ctx.fill();
			ctx.stroke();
			// 炮管
			ctx.beginPath();
			ctx.moveTo(-45, 33);
			ctx.lineTo(-45, 45);
			ctx.moveTo(45, 33);
			ctx.lineTo(45, 45);
			ctx.strokeStyle = "#CC3300";
			ctx.lineWidth = 4;
			ctx.stroke();
			// 核心装饰
			ctx.beginPath();
			ctx.arc(0, 10, 6, 0, Math.PI * 2);
			ctx.fillStyle = "#FFDD00";
			ctx.fill();
			// 血条
			const hpPercent = this.hp / this.maxHp;
			ctx.fillStyle = "#333";
			ctx.fillRect(-50, -58, 100, 10);
			ctx.fillStyle = hpPercent > 0.5 ? "#00FF00" : hpPercent > 0.25 ? "#FFFF00" : "#FF0000";
			ctx.fillRect(-50, -58, 100 * hpPercent, 10);
			ctx.strokeStyle = "#FFF";
			ctx.lineWidth = 1;
			ctx.strokeRect(-50, -58, 100, 10);
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
		ctx.font = `bold 12px ${Game.loadedFont || "Arial"}`;
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

export { Player, Enemy, Wingman, Item, Particle, Starfield };
