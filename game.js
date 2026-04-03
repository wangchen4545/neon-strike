/** @format */

// 游戏入口
import { Game as NeonGame } from "./js/main.js";

/**
 * 应用入口类
 */
class App {
	/**
	 * 初始化并创建主逻辑对象
	 */
	constructor() {
		this.game = new NeonGame();
	}

	/**
	 * 启动游戏
	 */
	start() {
		// 游戏类自动在构造函数中启动，因此可选保持兼容
	}
}

const game = new NeonGame();
// Root app 不需要再次 start，因为 NeonGame 内部已启动循环

