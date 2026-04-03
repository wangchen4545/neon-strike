/** @format */

// 精灵类
/**
 * 精灵图像对象，用于简单的图像渲染。
 */
class Sprite {
	/**
	 * @param {HTMLImageElement} img 图像资源
	 * @param {number} x X 坐标
	 * @param {number} y Y 坐标
	 */
	constructor(img, x, y) {
		this.img = img;
		this.x = x;
		this.y = y;
	}

	/**
	 * 在指定上下文中绘制精灵
	 * @param {CanvasRenderingContext2D} ctx 绘图上下文
	 */
	draw(ctx) {
		ctx.drawImage(this.img, this.x, this.y);
	}
}

export { Sprite };
