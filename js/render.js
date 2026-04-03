/** @format */

// 渲染模块
/**
 * 渲染模块，用于绘制游戏画面。
 */
class Render {
	/**
	 * @param {HTMLCanvasElement} canvas 渲染画布
	 */
	constructor(canvas) {
		this.canvas = canvas;
		this.ctx = canvas.getContext("2d");
	}

	/**
	 * 清空画布
	 */
	clear() {
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
	}

	/**
	 * 绘制当前帧内容
	 */
	draw() {
		// 绘制逻辑
	}
}

export { Render };
