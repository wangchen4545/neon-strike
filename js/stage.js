import { CONFIG } from './config.js';

// ---------------- 关卡数据定义 ----------------
const STAGE_DATA = [
	// Stage 1: 前线突击 (30s) — 教学关，Scout 为主
	{
		id: 1,
		name: "前线突击",
		bossType: "boss",
		bossHP: 3000,
		isFinalBoss: false,
		phases: {
			prelude: { dur: 8000, interval: 1200, pool: ["scout"], countMin: 1, countMax: 2 },
			push:    { dur: 10000, interval: 900, pool: ["scout"], countMin: 2, countMax: 3 },
			climax:  { dur: 12000, interval: 600, pool: ["scout", "scout", "scout", "fighter"], countMin: 2, countMax: 4 },
		},
	},
	// Stage 2: 小行星带 (30s) — Scout + Fighter
	{
		id: 2,
		name: "小行星带",
		bossType: "boss",
		bossHP: 8000,
		isFinalBoss: false,
		phases: {
			prelude: { dur: 8000, interval: 1200, pool: ["scout", "scout", "scout", "fighter"], countMin: 1, countMax: 2 },
			push:    { dur: 10000, interval: 900, pool: ["scout", "scout", "fighter"], countMin: 2, countMax: 3 },
			climax:  { dur: 12000, interval: 600, pool: ["scout", "fighter"], countMin: 3, countMax: 5 },
		},
	},
	// Stage 3: 敌方要塞 (30s) — 三类型混搭 + 中Boss
	{
		id: 3,
		name: "敌方要塞",
		bossType: "boss",
		bossHP: 20000,
		isFinalBoss: false,
		midBossHP: 5000,
		phases: {
			prelude: { dur: 8000, interval: 1200, pool: ["scout", "scout", "fighter"], countMin: 1, countMax: 2 },
			push:    { dur: 10000, interval: 900, pool: ["scout", "scout", "fighter", "fighter", "elite"], countMin: 2, countMax: 3 },
			climax:  { dur: 12000, interval: 600, pool: ["fighter", "fighter", "elite"], countMin: 3, countMax: 5 },
		},
	},
	// Stage 4: 深渊舰队 (30s) — Fighter + Elite，双Boss
	{
		id: 4,
		name: "深渊舰队",
		bossType: "boss",
		bossHP: 30000,
		isFinalBoss: false,
		isDualBoss: true,
		bossHP2: 15000,
		phases: {
			prelude: { dur: 8000, interval: 1200, pool: ["fighter", "fighter", "fighter", "elite"], countMin: 1, countMax: 2 },
			push:    { dur: 10000, interval: 900, pool: ["fighter", "fighter", "elite"], countMin: 2, countMax: 4 },
			climax:  { dur: 12000, interval: 600, pool: ["fighter", "elite"], countMin: 3, countMax: 5 },
		},
	},
	// Stage 5: 最终决战 (30s) — Elite 为主 + 终极Boss
	{
		id: 5,
		name: "最终决战",
		bossType: "finalBoss",
		bossHP: 60000,
		isFinalBoss: true,
		phases: {
			prelude: { dur: 8000, interval: 1200, pool: ["elite", "elite", "fighter"], countMin: 1, countMax: 2 },
			push:    { dur: 10000, interval: 900, pool: ["elite", "elite", "fighter"], countMin: 2, countMax: 4 },
			climax:  { dur: 12000, interval: 600, pool: ["elite"], countMin: 3, countMax: 6 },
		},
	},
];

// 无限模式配置
const ENDLESS_CONFIG = {
	bossInterval: 50000, // 每50000分触发Boss
};

// ---------------- 关卡管理器 ----------------
class StageManager {
	constructor() {
		this.currentStage = 0;       // 0=未激活, 1-5=关卡, -1=无限模式
		this.phase = "inactive";     // prelude | push | climax | boss | clear | inactive
		this.phaseTimer = 0;
		this.spawnTimer = 0;
		this.bossSpawned = false;
		this.bossDefeated = false;
		this.bossWarning = false;
		this.bossWarningTimer = 0;
		this.midBossSpawned = false;
		this.dualBossSecondSpawned = false;
		this.cleared = false;
		this.clearTimer = 0;
		this.stageClearText = "";
		this.bossName = "";
		this.endlessNextBossScore = 0;
		this.stageData = null;
	}

	/**
	 * 获取当前阶段刷敌配置
	 * @returns {Object|null}
	 */
	getPhaseConfig() {
		if (!this.stageData || this.phase === "boss" || this.phase === "clear" || this.phase === "inactive") {
			return null;
		}
		return this.stageData.phases[this.phase] || null;
	}

	/**
	 * 激活关卡系统
	 */
	activate() {
		this.currentStage = 1;
		this.startStage(1);
	}

	/**
	 * 开始指定关卡
	 * @param {number} stageId
	 */
	startStage(stageId) {
		this.currentStage = stageId;
		this.stageData = STAGE_DATA[stageId - 1];
		this.phase = "prelude";
		this.phaseTimer = this.stageData.phases.prelude.dur;
		this.spawnTimer = 0;
		this.bossSpawned = false;
		this.bossDefeated = false;
		this.bossWarning = false;
		this.bossWarningTimer = 0;
		this.midBossSpawned = false;
		this.dualBossSecondSpawned = false;
		this.cleared = false;
		this.clearTimer = 0;
		this.stageClearText = "";
	}

	/**
	 * 进入下一关
	 * @param {Game} game
	 */
	nextStage(game) {
		if (this.currentStage < 5) {
			this.startStage(this.currentStage + 1);
			// 显示关卡标题
			this.stageClearText = "STAGE " + this.currentStage + " — " + this.stageData.name;
			this.clearTimer = 2000;
		} else {
			this.startEndless();
		}
	}

	/**
	 * 进入无限模式
	 */
	startEndless() {
		this.currentStage = -1;
		this.stageData = null;
		this.phase = "prelude";
		this.phaseTimer = 15000; // 15秒一轮
		this.bossSpawned = false;
		this.bossDefeated = false;
		this.bossWarning = false;
		this.cleared = false;
		this.endlessNextBossScore = ENDLESS_CONFIG.bossInterval;
		this.stageClearText = "无限模式";
		this.clearTimer = 2000;
	}

	/**
	 * 重置到初始状态
	 */
	reset() {
		this.currentStage = 0;
		this.phase = "inactive";
		this.phaseTimer = 0;
		this.spawnTimer = 0;
		this.bossSpawned = false;
		this.bossDefeated = false;
		this.bossWarning = false;
		this.bossWarningTimer = 0;
		this.midBossSpawned = false;
		this.dualBossSecondSpawned = false;
		this.cleared = false;
		this.clearTimer = 0;
		this.stageClearText = "";
		this.stageData = null;
	}

	/**
	 * 每帧更新，驱动阶段切换与刷敌
	 * @param {number} dt 时间增量（秒）
	 * @param {Game} game 游戏主对象
	 */
	update(dt, game) {
		const dtMs = dt * 1000;

		// 处理关卡标题显示计时
		if (this.clearTimer > 0) {
			this.clearTimer -= dtMs;
			if (this.clearTimer <= 0) {
				this.stageClearText = "";
			}
		}

		// 如果未激活，使用旧版分数驱动逻辑
		if (this.phase === "inactive") {
			this._updateLegacy(dtMs, game);
			return;
		}

		// Boss警告倒计时
		if (this.bossWarning) {
			this.bossWarningTimer -= dtMs;
			if (this.bossWarningTimer <= 0) {
				this.bossWarning = false;
				this.spawnBoss(game);
			}
			return; // 警告期间暂停刷敌
		}

		// 检查Boss是否被击败
		if (this.phase === "boss" && this.bossSpawned && !this.bossDefeated) {
			if (this.isBossDefeated(game)) {
				this.bossDefeated = true;
				this.onBossDefeated(game);
			}
			return; // Boss战期间不刷敌
		}

		// Clear阶段倒计时
		if (this.phase === "clear") {
			this.phaseTimer -= dtMs;
			if (this.phaseTimer <= 0) {
				this.nextStage(game);
			}
			return;
		}

		// 阶段计时器
		if (this.phase !== "boss") {
			this.phaseTimer -= dtMs;
		}

		// 生成中Boss (Stage 3 climax开始时)
		if (this.currentStage === 3 && this.phase === "climax" && !this.midBossSpawned && this.stageData.midBossHP) {
			this.midBossSpawned = true;
			this.spawnMidBoss(game);
		}

		// 刷敌逻辑
		const cfg = this.getPhaseConfig();
		if (cfg) {
			this.spawnTimer += dtMs;
			if (this.spawnTimer >= cfg.interval) {
				this.spawnTimer = 0;
				this.spawnByPhase(game, cfg);
			}
		}

		// 阶段切换
		if (this.phaseTimer <= 0 && this.phase !== "boss" && this.phase !== "clear") {
			this.advancePhase(game);
		}
	}

	/**
	 * 旧版分数驱动逻辑（关卡系统激活前的过渡）
	 */
	_updateLegacy(dtMs, game) {
		// 分数达到1000且关卡未激活时，自动激活
		if (game.score >= 1000 && this.currentStage === 0) {
			this.activate();
			return;
		}
		// 否则使用旧版spawnWave逻辑
		game.spawnTimer += dtMs;
		if (game.spawnTimer >= game.spawnInterval && !game.bossWarning) {
			game.spawnWave();
			game.spawnTimer = 0;
		}
	}

	/**
	 * 切换到下一阶段
	 */
	advancePhase(game) {
		const phases = this.stageData ? this.stageData.phases : null;
		if (!phases) return;

		switch (this.phase) {
			case "prelude":
				this.phase = "push";
				this.phaseTimer = phases.push.dur;
				break;
			case "push":
				this.phase = "climax";
				this.phaseTimer = phases.climax.dur;
				this.midBossSpawned = false;
				break;
			case "climax":
				this.phase = "boss";
				this.phaseTimer = Infinity;
				this.bossWarning = true;
				this.bossWarningTimer = 2000;
				game.screenFlash = 0.5;
				break;
		}
	}

	/**
	 * 根据阶段配置刷敌
	 */
	spawnByPhase(game, cfg) {
		const count = cfg.countMin + Math.floor(Math.random() * (cfg.countMax - cfg.countMin + 1));
		for (let i = 0; i < count; i++) {
			const type = cfg.pool[Math.floor(Math.random() * cfg.pool.length)];
			const x = 50 + Math.random() * (game.canvas.width - 100);
			const y = -50 - Math.random() * 100;
			game.spawnEnemy(type, x, y);
		}
	}

	/**
	 * 生成Boss
	 */
	spawnBoss(game) {
		const sd = this.stageData;
		if (!sd) return;

		const cx = game.canvas.width / 2 - 60;
		if (sd.bossType === "finalBoss") {
			game.spawnEnemy("finalBoss", cx, -80);
			} else {
				game.spawnEnemy("boss", cx, -80);
			}
			// 覆盖Boss的血量（所有类型）
			const enemies = game.enemyPool.getActive();
			for (const e of enemies) {
				if ((e.type === "boss" || e.type === "finalBoss") && e.active && e.y < 0) {
					e.hp = sd.bossHP;
					e.maxHp = sd.bossHP;
					break;
				}
			}
		// 双Boss: Stage 4 额外生成第二个Boss
		if (sd.isDualBoss && !this.dualBossSecondSpawned) {
			this.dualBossSecondSpawned = true;
			setTimeout(() => {
				game.spawnEnemy("boss", game.canvas.width / 2 + 30, -100);
				const enemies = game.enemyPool.getActive();
				let count = 0;
				for (const e of enemies) {
					if (e.type === "boss" && e.active && e.y < 0) {
						count++;
						if (count === 2) {
							e.hp = sd.bossHP2;
							e.maxHp = sd.bossHP2;
							break;
						}
					}
				}
			}, 1500);
		}

		this.bossSpawned = true;
	}

	/**
	 * 生成中Boss（精英机强化版）
	 */
	spawnMidBoss(game) {
		const cx = game.canvas.width / 2 - 25;
		game.spawnEnemy("elite", cx, -60);
		// 提升血量
		const enemies = game.enemyPool.getActive();
		for (const e of enemies) {
			if (e.type === "elite" && e.active && e.y < 0) {
				e.hp = this.stageData.midBossHP;
				e.maxHp = this.stageData.midBossHP;
				break;
			}
		}
	}

	/**
	 * 检查Boss是否已被击败
	 */
	isBossDefeated(game) {
		const enemies = game.enemyPool.getActive();
		for (const e of enemies) {
			if ((e.type === "boss" || e.type === "finalBoss") && e.active) {
				return false;
			}
		}
		return true;
	}

	/**
	 * Boss被击败后的处理
	 */
	onBossDefeated(game) {
		this.phase = "clear";
		this.phaseTimer = 3000;
		this.stageClearText = "STAGE " + this.currentStage + " CLEAR!";
		this.clearTimer = 3000;
		// 清屏
		game.clearEnemyBullets();
		game.screenFlash = 0.8;
	}

	/**
	 * 无限模式刷敌
	 */
	spawnEndless(game) {
		const difficulty = Math.floor(game.score / 10000);
		const pool = ["scout"];
		if (difficulty >= 2) pool.push("fighter");
		if (difficulty >= 5) pool.push("elite");
		const type = pool[Math.floor(Math.random() * pool.length)];
		const count = 1 + Math.floor(Math.random() * (1 + Math.floor(difficulty / 3)));
		for (let i = 0; i < count; i++) {
			const x = 50 + Math.random() * (game.canvas.width - 100);
			const y = -50 - Math.random() * 100;
			game.spawnEnemy(type, x, y);
		}
	}

	/**
	 * 绘制关卡HUD（阶段文字、Boss警告、清关提示）
	 * @param {CanvasRenderingContext2D} ctx
	 * @param {number} width 画布宽度
	 * @param {number} height 画布高度
	 */
	drawHUD(ctx, width, height) {
		if (this.phase === "inactive" && this.currentStage === 0) return;

		// 关卡名称（右上角）
		if (this.stageData && this.phase !== "clear") {
			ctx.save();
			ctx.font = "bold 14px Arial";
			ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
			ctx.textAlign = "right";
			ctx.textBaseline = "top";
			ctx.fillText("STAGE " + this.currentStage + " — " + this.stageData.name, width - 20, 20);
			ctx.restore();
		}

		if (this.currentStage === -1) {
			ctx.save();
			ctx.font = "bold 14px Arial";
			ctx.fillStyle = "rgba(255, 200, 0, 0.5)";
			ctx.textAlign = "right";
			ctx.textBaseline = "top";
			ctx.fillText("无限模式", width - 20, 20);
			ctx.restore();
		}

		// Boss警告
		if (this.bossWarning) {
			const pulse = Math.sin(Date.now() / 100) * 0.3 + 0.7;
			ctx.save();
			ctx.font = "bold 36px Arial";
			ctx.fillStyle = `rgba(255, 0, 0, ${pulse})`;
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.fillText("WARNING", width / 2, height / 2 - 30);
			ctx.font = "20px Arial";
			const bossLabel = this.stageData && this.stageData.isFinalBoss ? "最终Boss 接近中" : "Boss 接近中";
			ctx.fillText(bossLabel, width / 2, height / 2 + 20);
			ctx.restore();
		}

		// 清关/阶段提示
		if (this.stageClearText && this.clearTimer > 0) {
			const alpha = Math.min(1, this.clearTimer / 1000);
			ctx.save();
			ctx.globalAlpha = alpha;
			ctx.font = "bold 32px Arial";
			ctx.fillStyle = "#FFD700";
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.shadowColor = "#FFD700";
			ctx.shadowBlur = 20;
			ctx.fillText(this.stageClearText, width / 2, height / 2);
			ctx.restore();
		}
	}
}

export { StageManager, STAGE_DATA };
