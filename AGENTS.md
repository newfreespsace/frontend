# 前端开发规则

完整 NSOJ 工作区先读 [根目录规则](../AGENTS.md) 和 [文档索引](../docs/INDEX.md)。页面入口见 [AppRouter](src/AppRouter.tsx)，请求入口见 [API 层](src/api.ts)。新增或修改功能同步更新功能文档与测试。

- 检查会话恢复、比赛限制、错误、加载及空态。客户端状态以服务端可访问的投影为准。页面有通知或实时订阅时覆盖切换账号、重连和过期数据。
- 使用既有路由、组件、样式与本地化模式。更新用户可见字符串时核对 `zh-CN`、`en-US`、`ja-JP`。API 生成与手写客户端约定见 [工程规范](../docs/global/engineering.md)。
- 代码交付前以 [Build 工作流](.github/workflows/build.yml) 为准，使用 Node 20.x，锁文件安装后运行构建和格式检查，再运行相关测试。涉及路由懒加载、旧浏览器、Excalidraw 和 Vite 转换时还要运行 `yarn test:legacy`。
