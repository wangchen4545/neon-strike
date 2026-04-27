// ---------------- 对象池 ----------------
/**
 * 对象池：复用实体对象以减少频繁 GC。
 */
class ObjectPool {
	/**
	 * @param {Function} createFn 创建对象函数
	 * @param {Function} resetFn 复用对象重置函数
	 * @param {number} initialSize 初始对象池大小
	 */
	constructor(createFn, resetFn, initialSize = 10) {
		this.createFn = createFn;
		this.resetFn = resetFn;
		this.pool = [];
		this.active = [];
		for (let i = 0; i < initialSize; i++) {
			this.pool.push(createFn());
		}
	}
	/**
	 * 从对象池获取对象
	 */
	get() {
		const obj = this.pool.pop() || this.createFn();
		this.active.push(obj);
		return obj;
	}
	/**
	 * 归还对象到对象池
	 */
	release(obj) {
		const index = this.active.indexOf(obj);
		if (index > -1) {
			this.active.splice(index, 1);
			this.resetFn(obj);
			this.pool.push(obj);
		}
	}
	/**
	 * 归还所有激活对象
	 */
	releaseAll() {
		while (this.active.length > 0) {
			const obj = this.active.pop();
			this.resetFn(obj);
			this.pool.push(obj);
		}
	}
	/**
	 * 获取当前激活对象列表
	 */
	getActive() {
		return this.active;
	}
}

// ---------------- 空间网格 ----------------
/**
 * 空间网格类，用于快速检索邻近实体，提高碰撞检测性能。
 */
class SpatialGrid {
	/**
	 * 创建空间网格
	 * @param {number} width 画布宽度
	 * @param {number} height 画布高度
	 * @param {number} cellSize 单元格大小
	 */
	constructor(width, height, cellSize) {
		this.cellSize = cellSize;
		this.cells = new Map();
	}

	/**
	 * 清空所有网格数据
	 */
	clear() {
		this.cells.clear();
	}

	/**
	 * 根据列/行获取键
	 */
	getKey(col, row) {
		return `${col},${row}`;
	}

	/**
	 * 在网格中插入实体
	 */
	insert(entity) {
		const col = Math.floor(entity.x / this.cellSize);
		const row = Math.floor(entity.y / this.cellSize);
		const key = this.getKey(col, row);
		if (!this.cells.has(key)) {
			this.cells.set(key, []);
		}
		this.cells.get(key).push(entity);
		for (let dx = -1; dx <= 1; dx++) {
			for (let dy = -1; dy <= 1; dy++) {
				if (dx === 0 && dy === 0) continue;
				const nKey = this.getKey(col + dx, row + dy);
				if (!this.cells.has(nKey)) {
					this.cells.set(nKey, []);
				}
				this.cells.get(nKey).push(entity);
			}
		}
	}

	/**
	 * 查询指定位置半径内的实体列表
	 */
	query(x, y, radius) {
		const results = [];
		const minCol = Math.floor((x - radius) / this.cellSize);
		const maxCol = Math.floor((x + radius) / this.cellSize);
		const minRow = Math.floor((y - radius) / this.cellSize);
		const maxRow = Math.floor((y + radius) / this.cellSize);
		for (let col = minCol; col <= maxCol; col++) {
			for (let row = minRow; row <= maxRow; row++) {
				const key = this.getKey(col, row);
				const cell = this.cells.get(key);
				if (cell) {
					results.push(...cell);
				}
			}
		}
		return results;
	}
}

export { ObjectPool, SpatialGrid };
