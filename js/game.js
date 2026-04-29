import { CONFIG, WEAPONS } from './config.js';
import { ObjectPool, SpatialGrid } from './utils.js';

import { Bullet, Laser, WingmanLaser } from './weapons.js';
import { Player, Enemy, Wingman, Item, Particle, Starfield } from './entities.js';
import { StageManager } from './stage.js';

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

		// 关卡管理器
		this.stageManager = new StageManager();

		// 敌机生成（旧版过渡用，stage系统激活前）
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

		// 僚机
		this.wingmanEnabled = false;
		this.wingmanLevel = 1;

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

		// 武器切换按钮（底部右侧）
		this.weaponBtn = {
			x: 60,
			y: this.height - 110,
			width: 55,
			height: 60,
		};

		// 武器弹窗状态
		this.weaponPopupOpen = false;
		this.selectedWeapon = "standard";

		// 核弹按钮（右下角，距离底部60px）
		this.nuclearBombBtn = {
			x: this.width - 70,
			y: this.height - 120,
			width: 60,
			height: 60,
		};
		this.hasNuclearBomb = false;
		this.nuclearBombFlash = 0;
		this.bombBtnScale = 1; // 炸弹按钮缩放
		this.bombBtnScaleVel = 0; // 缩放动画速度

		// 图片文字字典（已禁用，全部使用 Canvas 文字绘制）
		Game.textImages = {};

		// 加载自定义字体
		Game.loadedFont = "Arial"; // 默认字体
		try {
			const fontFamily = wx.loadFont("images/game_font.ttf");
			if (fontFamily) {
				Game.loadedFont = fontFamily;
				console.log("字体加载成功", fontFamily);
			}
		} catch (err) {
			console.log("字体加载失败，使用默认字体", err);
		}

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
		this.wingmanPool = new ObjectPool(
			() => new Wingman(),
			(w) => w.reset(),
			2,
		);
		this.wingmanLaserPool = new ObjectPool(
			() => new WingmanLaser(),
			(l) => l.reset(),
			20,
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
				// 如果武器弹窗打开，优先处理弹窗触摸
				if (this.weaponPopupOpen) {
					const touch = res.touches[0];
					this.handlePopupTouch(touch.clientX, touch.clientY);
					return;
				}

				this.touching = true; // 标记正在触摸

				// 获取触摸点坐标
				const touch = res.touches[0];

				// 微信小游戏使用 clientX/clientY，不是 x/y
				console.log("touch.clientX:", touch.clientX, "touch.clientY:", touch.clientY);

				// 武器按钮区域检测（优先）
				const wbtn = this.weaponBtn;
				if (touch.clientX >= wbtn.x && touch.clientX <= wbtn.x + wbtn.width && touch.clientY >= wbtn.y && touch.clientY <= wbtn.y + wbtn.height) {
					console.log("打开武器弹窗!");
					this.weaponPopupOpen = !this.weaponPopupOpen;
					return;
				}

				// -------------------------------------------------------
				// 炸弹按钮区域检测
				// 位于画布右上角 20% 宽度范围 + 上方 30% 高度范围
				// 用于判断是否触发炸弹清屏技能
				// -------------------------------------------------------
				const bombZoneX = this.canvas.width * 0.8; // X > 80% 宽度
				const bombZoneY = this.canvas.height * 0.3; // Y < 30% 高度

				console.log("bombZoneX:", bombZoneX, "bombZoneY:", bombZoneY);

				if (this.score >= 100000) {
					// 核弹按钮区域优先检测
					const nbtn = this.nuclearBombBtn;
					const dx = touch.clientX - (nbtn.x + nbtn.width / 2);
					const dy = touch.clientY - (nbtn.y + nbtn.height / 2);
					if (Math.sqrt(dx * dx + dy * dy) < nbtn.width / 2) {
						console.log("触发核弹!");
						this.bombBtnScale = 0.8;
						this.bombBtnScaleVel = 0;
						this.useNuclearBomb();
					} else {
						this.handleTouch({ x: touch.clientX, y: touch.clientY });
					}
				} else if (touch.clientX > bombZoneX && touch.clientY < bombZoneY) {
					// 炸弹区域（分数<100000时）
					console.log("触发炸弹!");
					this.player.useBomb(this);
				} else {
					// 正常移动区域
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
		this.bgmAudio.autoplay = true;

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
	 * 处理武器弹窗内的触摸事件
	 * @param {number} touchX 触摸X坐标
	 * @param {number} touchY 触摸Y坐标
	 */
	handlePopupTouch(touchX, touchY) {
		// 检查关闭按钮
		const closeBtn = this.popupCloseBtn;
		if (closeBtn && touchX >= closeBtn.x && touchX <= closeBtn.x + closeBtn.width && touchY >= closeBtn.y && touchY <= closeBtn.y + closeBtn.height) {
			this.weaponPopupOpen = false;
			return;
		}

		// 检查武器卡片
		if (this.popupCards) {
			for (const card of this.popupCards) {
				if (touchX >= card.x && touchX <= card.x + card.width && touchY >= card.y && touchY <= card.y + card.height) {
					this.selectedWeapon = card.id;
					this.weaponPopupOpen = false;
					return;
				}
			}
		}

		// 点击弹窗外区域 → 关闭弹窗
		this.weaponPopupOpen = false;
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
		this.drawText(ctx, "NEON STRIKE", this.canvas.width / 2, this.canvas.height / 2 - 80, "#00F2FF", "bold 30px");

		this.drawText(ctx, "星渊战机", this.canvas.width / 2, this.canvas.height / 2 - 40, "#FF0055", "30px");

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
		this.drawText(ctx, "开始游戏", this.width / 2, btn.y + btn.height / 2, "#00F2FF", "bold 22px");

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
		this.wingmanPool.releaseAll();
		this.wingmanLaserPool.releaseAll();

		this.stageManager.reset();

		this.spawnTimer = 0;
		this.spawnInterval = CONFIG.SPAWN_INTERVAL_BASE;
		this.waveCount = 0;
		this.bossSpawned = false;
		this.bossWarning = false;

		this.scoreInvincible = false;
		this.scoreInvincibleTimer = 0;
		this.invincibleThresholdIndex = 0;
		this.nextInvincibleThreshold = CONFIG.INVINCIBLE_SCORE_THRESHOLDS[0];

		this.wingmanEnabled = false;
		this.wingmanLevel = 1;
		this.weaponPopupOpen = false;
		this.selectedWeapon = "standard";

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

		// 检查僚机触发
		if (!this.wingmanEnabled && this.score >= CONFIG.WINGMAN_SCORE_THRESHOLDS[0]) {
			this.wingmanEnabled = true;
			this.wingmanLevel = 1;
			this.spawnWingmen(1);
			this.screenFlash = 0.3;
		} else if (this.wingmanEnabled && this.wingmanLevel < 3) {
			const threshold = CONFIG.WINGMAN_SCORE_THRESHOLDS[this.wingmanLevel];
			if (this.score >= threshold) {
				this.wingmanLevel++;
				this.updateWingmenLevel(this.wingmanLevel);
				this.screenFlash = 0.3;
			}
		}
	}

	updateWingmenLevel(level) {
		const wingmen = this.wingmanPool.getActive();
		for (const wingman of wingmen) {
			if (wingman.active) {
				wingman.level = level;
			}
		}
	}

	spawnWingmen(level) {
		// 僚机1：左侧
		const wingman1 = this.wingmanPool.get();
		wingman1.reset();
		wingman1.init(this.player.getCenterX() - 40, this.player.getCenterY(), -40, 0, level);

		// 僚机2：右侧
		const wingman2 = this.wingmanPool.get();
		wingman2.reset();
		wingman2.init(this.player.getCenterX() + 40, this.player.getCenterY(), 40, 0, level);
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
		if (this.selectedWeapon === "pierce") {
				bullet.damage = 8;
				bullet.isPierce = true;
				bullet.hitEnemies = [];
			} else {
				bullet.damage = 10;
			}
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

	spawnWingmanLaser(x, y) {
		const laser = this.wingmanLaserPool.get();
		laser.reset();
		laser.init(x, y);
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
	 * 绘制圆角矩形路径
	 */
	roundRect(ctx, x, y, w, h, r) {
		ctx.beginPath();
		ctx.moveTo(x + r, y);
		ctx.lineTo(x + w - r, y);
		ctx.arcTo(x + w, y, x + w, y + r, r);
		ctx.lineTo(x + w, y + h - r);
		ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
		ctx.lineTo(x + r, y + h);
		ctx.arcTo(x, y + h, x, y + h - r, r);
		ctx.lineTo(x, y + r);
		ctx.arcTo(x, y, x + r, y, r);
		ctx.closePath();
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
						if (bullet.isPierce) {
							if (!bullet.hitEnemies.includes(entity)) {
								entity.takeDamage(bullet.damage, this);
								bullet.hitEnemies.push(entity);
							}
						} else {
							entity.takeDamage(bullet.damage, this);
							bullet.active = false;
							this.bulletPool.release(bullet);
							break;
						}
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

		// 僚机激光 vs 敌机
		if (this.wingmanEnabled) {
			const wingmanLasers = this.wingmanLaserPool.getActive();
			for (const laser of wingmanLasers) {
				if (!laser.active) continue;
				for (const enemy of enemies) {
					if (enemy.active && laser.checkCollision(enemy)) {
						enemy.takeDamage(laser.damage, this);
					}
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

		this.stageManager.update(dt, this);

		const bullets = this.bulletPool.getActive();
		for (const bullet of bullets) {
			if (bullet.active) bullet.update(dt, this);
		}

		const lasers = this.laserPool.getActive();
		for (const laser of lasers) {
			if (laser.active) laser.update(dt);
		}

		// 僚机更新
		if (this.wingmanEnabled) {
			const wingmen = this.wingmanPool.getActive();
			for (const wingman of wingmen) {
				if (wingman.active) wingman.update(dt, this);
			}
			const wingmanLasers = this.wingmanLaserPool.getActive();
			for (const laser of wingmanLasers) {
				if (laser.active) laser.update(dt);
			}
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

		// 炸弹按钮缩放动画
		if (this.bombBtnScale !== 1 || this.bombBtnScaleVel !== 0) {
			const spring = 0.3;
			const damping = 0.7;
			this.bombBtnScaleVel += (1 - this.bombBtnScale) * spring;
			this.bombBtnScaleVel *= damping;
			this.bombBtnScale += this.bombBtnScaleVel;
			if (Math.abs(this.bombBtnScale - 1) < 0.01 && Math.abs(this.bombBtnScaleVel) < 0.01) {
				this.bombBtnScale = 1;
				this.bombBtnScaleVel = 0;
			}
		}
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
		const wingmanLasers = this.wingmanLaserPool.getActive();
		for (const laser of wingmanLasers) {
			if (!laser.active) this.wingmanLaserPool.release(laser);
		}
	}

	/**
	 * 绘制武器选择弹窗
	 * @param {CanvasRenderingContext2D} ctx 绘图上下文
	 */
	drawWeaponPopup(ctx) {
		const w = this.width;
		const h = this.height;

		// 半透明遮罩
		ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
		ctx.fillRect(0, 0, w, h);

		// 弹窗面板
		const panelW = w * 0.82;
		const panelH = h * 0.55;
		const panelX = (w - panelW) / 2;
		const panelY = (h - panelH) / 2;

		// 面板背景
		ctx.fillStyle = "rgba(10, 10, 30, 0.95)";
		ctx.strokeStyle = "#00F2FF";
		ctx.lineWidth = 2;
		ctx.shadowColor = "#00F2FF";
		ctx.shadowBlur = 15;
		ctx.beginPath();
		this.roundRect(ctx, panelX, panelY, panelW, panelH, 12);
		ctx.fill();
		ctx.stroke();
		ctx.shadowBlur = 0;

		// 标题
		this.drawText(ctx, "武器选择", panelX + panelW / 2, panelY + 28, "#00F2FF", "bold 20px");

		// 关闭按钮（右上角，距右边15px，距顶部15px）
		const closeX = panelX + panelW - 25;
		const closeY = panelY + 25;
		this.popupCloseBtn = { x: closeX - 14, y: closeY - 14, width: 28, height: 28 };
		ctx.beginPath();
		ctx.arc(closeX, closeY, 14, 0, Math.PI * 2);
		ctx.fillStyle = "rgba(255, 0, 85, 0.2)";
		ctx.fill();
		ctx.strokeStyle = "#FF0055";
		ctx.lineWidth = 2;
		ctx.stroke();
		ctx.fillStyle = "#FF0055";
		ctx.font = `bold 16px ${Game.loadedFont || "Arial"}`;
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText("✕", closeX, closeY);

		// 武器卡片
		const cardW = panelW - 30;
		const cardH = 42;
		const startY = panelY + 55;
		const gap = 8;
		this.popupCards = [];

		for (let i = 0; i < WEAPONS.length; i++) {
			const weapon = WEAPONS[i];
			const cardX = panelX + 15;
			const cardY = startY + i * (cardH + gap);
			const isSelected = this.selectedWeapon === weapon.id;

			// 存储卡片区域供触摸检测
			this.popupCards.push({ x: cardX, y: cardY, width: cardW, height: cardH, id: weapon.id });

			// 卡片背景
			ctx.fillStyle = isSelected ? "rgba(0, 242, 255, 0.15)" : "rgba(255, 255, 255, 0.05)";
			ctx.strokeStyle = isSelected ? weapon.color : "rgba(255, 255, 255, 0.2)";
			ctx.lineWidth = isSelected ? 2 : 1;
			ctx.beginPath();
			this.roundRect(ctx, cardX, cardY, cardW, cardH, 8);
			ctx.fill();
			ctx.stroke();

			// 武器图标（小圆点+图形）
			const iconCX = cardX + 25;
			const iconCY = cardY + cardH / 2;
			ctx.beginPath();
			ctx.arc(iconCX, iconCY, 10, 0, Math.PI * 2);
			ctx.fillStyle = weapon.color;
			ctx.globalAlpha = 0.3;
			ctx.fill();
			ctx.globalAlpha = 1;
			ctx.strokeStyle = weapon.color;
			ctx.lineWidth = 2;
			ctx.stroke();
			// 图标内符号
			const iconSymbol = weapon.id === "standard" ? "◆" : weapon.id === "pierce" ? "➤" : weapon.id === "ricochet" ? "↗" : weapon.id === "orbital" ? "◎" : "?";
			ctx.fillStyle = weapon.color;
			ctx.font = `12px ${Game.loadedFont || "Arial"}`;
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.fillText(iconSymbol, iconCX, iconCY);

			// 武器名称
			ctx.fillStyle = weapon.color;
			ctx.font = `bold 16px ${Game.loadedFont || "Arial"}`;
			ctx.textAlign = "left";
			ctx.fillText(weapon.name, iconCX + 20, cardY + 16);

			// 描述
			ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
			ctx.font = `11px ${Game.loadedFont || "Arial"}`;
			ctx.fillText(weapon.desc, iconCX + 20, cardY + 32);

			// 选中标记
			if (isSelected) {
				ctx.fillStyle = weapon.color;
				ctx.font = `bold 14px ${Game.loadedFont || "Arial"}`;
				ctx.textAlign = "right";
				ctx.fillText("✓", cardX + cardW - 15, iconCY);
			}
		}
	}

	/**
	 * 绘制武器切换按钮（导弹图标）
	 * @param {CanvasRenderingContext2D} ctx 绘图上下文
	 */
	drawWeaponButton(ctx) {
		const btn = this.weaponBtn;
		const cx = btn.x + btn.width / 2;
		const cy = btn.y + btn.height / 2;
		const pulse = Math.sin(Date.now() / 200) * 0.15 + 0.85;

		ctx.save();
		ctx.translate(cx, cy);

		// 背景圆形光晕
		ctx.beginPath();
		ctx.arc(0, 0, 24, 0, Math.PI * 2);
		ctx.fillStyle = `rgba(255, 102, 0, ${0.1 * pulse})`;
		ctx.fill();
		ctx.strokeStyle = `rgba(255, 102, 0, ${pulse})`;
		ctx.lineWidth = 2;
		ctx.shadowColor = "#FF6600";
		ctx.shadowBlur = 10 * pulse;
		ctx.stroke();
		ctx.shadowBlur = 0;

		// 导弹朝上（逆时针旋转90°）
		ctx.rotate(-Math.PI / 2);
		ctx.scale(1.5, 1.5);

		// 导弹主体
		ctx.beginPath();
		ctx.moveTo(15, 0); // 弹头
		ctx.lineTo(-5, -6);
		ctx.lineTo(-8, -4);
		ctx.lineTo(-10, -6); // 尾翼
		ctx.lineTo(-10, 6);
		ctx.lineTo(-8, 4);
		ctx.lineTo(-5, 6);
		ctx.closePath();
		const missileGrad = ctx.createLinearGradient(-10, 0, 15, 0);
		missileGrad.addColorStop(0, "#FF4400");
		missileGrad.addColorStop(0.5, "#FF8800");
		missileGrad.addColorStop(1, "#FFCC00");
		ctx.fillStyle = missileGrad;
		ctx.fill();
		ctx.strokeStyle = "#FFDD88";
		ctx.lineWidth = 0.8;
		ctx.stroke();

		// 引擎火焰
		const flameLen = 5 + Math.sin(Date.now() / 50) * 3;
		ctx.beginPath();
		ctx.moveTo(-10, -3);
		ctx.lineTo(-10 - flameLen, 0);
		ctx.lineTo(-10, 3);
		ctx.closePath();
		ctx.fillStyle = "#FFFF00";
		ctx.fill();

		ctx.restore();
	}

	/**
	 * 绘制游戏界面元素（分数、连击、生命等）
	 * @param {CanvasRenderingContext2D} ctx 绘图上下文
	 */
	drawUI(ctx) {
		// 得分（左对齐）
		this.drawText(ctx, `得分: ${this.score}`, 60, 60, "#00F2FF", "16px");

		// 连击（左对齐，第二行）
		if (this.combo > 1) {
			this.drawText(ctx, `连击 x${this.combo}`, 60, 85, "#FF9900", "16px");
		}

		// 生命值（往右下方移动30px）
		ctx.fillStyle = "#FF0055";
		ctx.textAlign = "right";
		ctx.font = `30px ${Game.loadedFont || "Arial"}`;
		let lives = "";
		for (let i = 0; i < Math.max(0, this.player.hp); i++) lives += "❤";
		ctx.fillText(lives, this.canvas.width - 20, 90);

		// 火力
		this.drawText(ctx, `火力 Lv.${this.player.powerLevel}`, 60, this.canvas.height - 60, "#00FF9D", "16px");

		// 副武器（沿 Y 轴与火力对齐）
		this.drawText(ctx, `副武器 Lv.${this.player.secondaryWeaponLevel}`, 150, this.canvas.height - 60, "#FF00FF", "16px");

		// 武器切换按钮
		this.drawWeaponButton(ctx);

		// 无敌状态显示
		if (this.scoreInvincible) {
			const timeLeft = Math.ceil(this.scoreInvincibleTimer / 1000);
			this.drawText(ctx, `无敌 ${timeLeft}s`, this.canvas.width / 2, 60, "#FFD700", "16px");
		}

		// 核弹按钮（分数达到100000时显示）
		if (this.score >= 100000) {
			const btn = this.nuclearBombBtn;
			const pulse = Math.sin(Date.now() / 150) * 0.3 + 0.7;
			const cx = btn.x + btn.width / 2;
			const cy = btn.y + btn.height / 2;
			const radius = btn.width / 2;

			ctx.save();

			// 应用缩放动画
			ctx.translate(cx, cy);
			ctx.scale(this.bombBtnScale, this.bombBtnScale);
			ctx.translate(-cx, -cy);

			// 裁剪为圆形区域
			ctx.beginPath();
			ctx.arc(cx, cy, radius, 0, Math.PI * 2);
			ctx.clip();

			// 核弹按钮黄黑配色
			// 黑色背景
			ctx.fillStyle = "#1a1a1a";
			ctx.fill();

			// 黄色放射性条纹
			for (let i = 0; i < 8; i++) {
				const angle = (i / 8) * Math.PI * 2 + Date.now() / 2000;
				ctx.beginPath();
				ctx.moveTo(cx, cy);
				ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
				ctx.lineTo(cx + Math.cos(angle + 0.3) * radius, cy + Math.sin(angle + 0.3) * radius);
				ctx.closePath();
				ctx.fillStyle = `rgba(255, 200, 0, ${0.15 + Math.random() * 0.1})`;
				ctx.fill();
			}

			// 黄色边框
			ctx.strokeStyle = "#FFCC00";
			ctx.lineWidth = 3;
			ctx.shadowColor = "#FFCC00";
			ctx.shadowBlur = 8 * pulse;
			ctx.beginPath();
			ctx.arc(cx, cy, radius - 2, 0, Math.PI * 2);
			ctx.stroke();

			// 内部黄色圆环
			ctx.beginPath();
			ctx.arc(cx, cy, radius - 8, 0, Math.PI * 2);
			ctx.strokeStyle = `rgba(255, 200, 0, ${0.5 + pulse * 0.3})`;
			ctx.lineWidth = 2;
			ctx.shadowBlur = 5;
			ctx.stroke();

			// 绘制核弹图标
			// 中心圆（裂变符号）
			ctx.beginPath();
			ctx.arc(cx, cy, 12, 0, Math.PI * 2);
			ctx.fillStyle = "#FFCC00";
			ctx.shadowColor = "#FFCC00";
			ctx.shadowBlur = 15;
			ctx.fill();

			// 裂变符号 - 三个弧形
			ctx.strokeStyle = "#1a1a1a";
			ctx.lineWidth = 3;
			ctx.shadowBlur = 0;
			for (let i = 0; i < 3; i++) {
				const angle = (i / 3) * Math.PI * 2 - Math.PI / 2;
				ctx.beginPath();
				ctx.arc(cx + Math.cos(angle) * 5, cy + Math.sin(angle) * 5, 6, angle - 0.5, angle + 0.5);
				ctx.stroke();
			}

			// 周围四个小圆（辐射警告点）
			const dotRadius = 3;
			const dotDist = 18;
			for (let i = 0; i < 4; i++) {
				const angle = (i / 4) * Math.PI * 2 - Math.PI / 2;
				const dotX = cx + Math.cos(angle) * dotDist;
				const dotY = cy + Math.sin(angle) * dotDist;
				ctx.beginPath();
				ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
				ctx.fillStyle = "#FFCC00";
				ctx.shadowColor = "#FFCC00";
				ctx.shadowBlur = 5 * pulse;
				ctx.fill();
			}

			ctx.restore();
		}
	}

	/**
	 * 渲染当前帧画面
	 */
	draw(dt) {
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
				if (item.active) item.draw(ctx, this);
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
				if (item.active) item.draw(ctx, this);
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

			// 绘制僚机
			if (this.wingmanEnabled) {
				const wingmen = this.wingmanPool.getActive();
				for (const wingman of wingmen) {
					if (wingman.active) wingman.draw(ctx);
				}
				const wingmanLasers = this.wingmanLaserPool.getActive();
				for (const laser of wingmanLasers) {
					if (laser.active) laser.draw(ctx);
				}
			}

			// 绘制UI
			this.drawUI(ctx);
			this.stageManager.drawHUD(ctx, this.width, this.height);

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

			// 武器选择弹窗（最顶层）
			if (this.weaponPopupOpen) {
				this.drawWeaponPopup(ctx);
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
