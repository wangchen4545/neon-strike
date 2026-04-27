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
	// 炸弹清屏配置
	BOMB_WEAK_THRESHOLD: 10000, // 弱效清屏所需分数
	BOMB_CLEAR_THRESHOLD: 50000, // 完全清屏所需分数
	MISSILE_SPEED: 400,
	MISSILE_DAMAGE: 50,
	SCATTER_BOMB_COUNT: 8,
	SCATTER_BOMB_SPEED: 250,
	SCATTER_BOMB_RADIUS: 6,
	SCATTER_BOMB_RANGE: 80,
	HOMING_MISSILE_SPEED: 300,
	HOMING_TURN_RATE: 4,
	// 僚机配置
	WINGMAN_SCORE_THRESHOLDS: [100000, 500000, 1000000],
	WINGMAN_FOLLOW_DELAY: 100,
	WINGMAN_LASER_WIDTH: 3,
	WINGMAN_LASER_INTERVALS: [333, 143, 100], // 3次/秒, 7次/秒, 10次/秒
	WINGMAN_LASER_DURATION: 600,
};

// ---------------- 可选武器定义 ----------------
const WEAPONS = [
	{
		id: "standard",
		name: "标准弹",
		desc: "2~10发扇形弹 / Lv.4追踪激光",
		color: "#00F2FF",
		icon: "bullet",
	},
	{
		id: "pierce",
		name: "穿透弹",
		desc: "子弹穿透多个敌人，伤害8",
		color: "#00FF9D",
		icon: "pierce",
	},
	{
		id: "ricochet",
		name: "弹射弹",
		desc: "碰壁反弹2次，伤害递增",
		color: "#FF9900",
		icon: "ricochet",
	},
	{
		id: "orbital",
		name: "护身弹",
		desc: "4颗能量球环绕旋转",
		color: "#FF00FF",
		icon: "orbital",
	},
];

export { CONFIG, WEAPONS };
