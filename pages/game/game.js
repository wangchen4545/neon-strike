// ============================================
// NEON STRIKE - 霓虹战机 微信小游戏
// 游戏页面入口
// ============================================

const Game = require('./game-core.js');

Page({
    data: {
        // 页面数据
    },

    canvas: null,
    game: null,

    onLoad: function (options) {
        console.log('游戏页面加载');
    },

    onReady: function () {
        const _this = this;

        // 使用 SelectorQuery 获取 canvas 节点
        wx.createSelectorQuery()
            .select('#gameCanvas')
            .node()
            .exec(function (res) {
                const canvas = res[0].node;
                const ctx = canvas.getContext('2d');

                // 获取屏幕尺寸
                const systemInfo = wx.getSystemInfoSync();

                // 设置 canvas 尺寸（需要考虑 devicePixelRatio）
                const dpr = systemInfo.pixelRatio;
                canvas.width = systemInfo.windowWidth * dpr;
                canvas.height = systemInfo.windowHeight * dpr;
                ctx.scale(dpr, dpr);

                // 保存 canvas 引用
                _this.canvas = canvas;

                // 创建并启动游戏
                _this.game = new Game(canvas, ctx, systemInfo.windowWidth, systemInfo.windowHeight);
            });
    },

    onUnload: function () {
        // 页面卸载
    },

    onShow: function () {
        // 页面显示
    },

    onHide: function () {
        // 页面隐藏
    }
});
