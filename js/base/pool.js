/** @format */

// 对象池
/**
 * Pool 用于对象复用，减少 GC 频率。
 */
class Pool {
	/**
	 * @param {Function} createFn 创建对象函数
	 * @param {Function} resetFn 重置对象状态函数
	 * @param {number} size 初始对象池大小
	 */
	constructor(createFn, resetFn, size = 10) {
		this.createFn = createFn;
		this.resetFn = resetFn;
		this.pool = [];
		for (let i = 0; i < size; i++) {
			this.pool.push(createFn());
		}
	}

	/**
	 * 获取一个可用对象
	 */
	get() {
		return this.pool.pop() || this.createFn();
	}

	/**
	 * 归还对象到池中
	 */
	put(obj) {
		this.resetFn(obj);
		this.pool.push(obj);
	}
}

export { Pool };
