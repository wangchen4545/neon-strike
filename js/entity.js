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

export { Entity };
