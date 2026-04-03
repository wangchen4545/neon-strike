/** @format */

// 数据总线
/**
 * 全局数据总线，存储游戏共享状态。
 */
class DataBus {
  /**
   * DataBus 构造函数
   */
  constructor() {
    this.reset();
  }

  /**
   * 重置数据总线中的所有数据
   */
  reset() {
    // 重置数据
  }
}

const databus = new DataBus();

export { databus };
