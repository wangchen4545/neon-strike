/** @format */

// 简化的 TinyEmitter
/**
 * 事件发布/订阅简易实现。
 */
class TinyEmitter {
	/**
	 * 构造函数，初始化事件存储。
	 */
	constructor() {
		this.events = {};
	}

	/**
	 * 订阅事件
	 * @param {string} event 事件名
	 * @param {Function} handler 事件处理器
	 */
	on(event, handler) {
		if (!this.events[event]) this.events[event] = [];
		this.events[event].push(handler);
	}

	/**
	 * 触发事件
	 * @param {string} event 事件名
	 * @param  {...any} args 传递给处理器的参数
	 */
	emit(event, ...args) {
		if (this.events[event]) {
			this.events[event].forEach((handler) => handler(...args));
		}
	}
}

export { TinyEmitter };
