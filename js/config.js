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
	SECONDARY_ENABLED: false,
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
	WINGMAN_SCORE_THRESHOLDS: [50000, 250000, 500000],
	WINGMAN_FOLLOW_DELAY: 100,
	WINGMAN_LASER_WIDTH: 3,
	WINGMAN_LASER_INTERVALS: [333, 143, 100], // 3次/秒, 7次/秒, 10次/秒
	WINGMAN_LASER_DURATION: 600,
	// 武器解锁分数
	WEAPON_UNLOCK: {
		standard: 0,
		pierce: 30000,
		lightning: 80000,
		refract: 150000,
	},
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
		id: "lightning",
		name: "雷电弹",
		desc: "命中后连锁4个敌人，电弧跳跃",
		color: "#FFFFFF",
		icon: "lightning",
	},
	{
		id: "refract",
		name: "折射弹",
		desc: "光束子弹，命中折射3次带雷电特效",
		color: "#FF9900",
		icon: "refract",
	},
];

// ---------------- 战机定义 ----------------
// primary: 主题色(UI边框/标题/选中标记)
// accent:  辅色(副标题/火焰)
// bullet:  子弹色
// bodyTop/Mid/Bot: 机体渐变(头→尾)
// cockpit: 驾驶舱色
// flame:   [左引擎, 右引擎]
const FIGHTERS = [
	{
		id: "neon",
		name: "星渊号",
		ref: "EVA初号机",
		desc: "均衡型",
		unlock: "初始拥有",
		primary: "#7B2FFF",
		accent: "#00FF44",
		bullet: "#C8FF00",
		bodyTop: "#6A1FD4",
		bodyMid: "#8B3FFF",
		bodyBot: "#4A0FA0",
		cockpit: "#00FF44",
		flame: ["#7B2FFF", "#00FF44"],
	},
	{
		id: "thunder",
		name: "雷神",
		ref: "高达",
		desc: "突击型",
		unlock: "通关 Stage 1",
		primary: "#FFFFFF",
		accent: "#0088FF",
		bullet: "#00CCFF",
		bodyTop: "#CCE0FF",
		bodyMid: "#FFFFFF",
		bodyBot: "#0066CC",
		cockpit: "#0088FF",
		flame: ["#0088FF", "#FFFFFF"],
	},
	{
		id: "ghost",
		name: "幽灵",
		ref: "黑紫",
		desc: "隐形型",
		unlock: "通关 Stage 3",
		primary: "#AA00FF",
		accent: "#1A0033",
		bullet: "#DD88FF",
		bodyTop: "#1A0033",
		bodyMid: "#7700CC",
		bodyBot: "#0D001A",
		cockpit: "#DD88FF",
		flame: ["#AA00FF", "#FFFFFF"],
	},
	{
		id: "blaze",
		name: "烈焰",
		ref: "钢铁侠",
		desc: "重装型",
		unlock: "通关 Stage 4",
		primary: "#CC0000",
		accent: "#FFAA00",
		bullet: "#FF4400",
		bodyTop: "#CC0000",
		bodyMid: "#FF4400",
		bodyBot: "#880000",
		cockpit: "#FFAA00",
		flame: ["#CC0000", "#FFAA00"],
	},
];

export { CONFIG, WEAPONS, FIGHTERS };
