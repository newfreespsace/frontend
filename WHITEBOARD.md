# NSOJ 画板

入口是登录后的 `/draw`，导航栏显示“画板”。首版固定使用 Excalidraw 0.18.1，中文界面，支持 `.excalidraw` 导入/导出及 PNG、SVG 导出。

## 使用和数据保存

左侧“画板”入口提供名称、保存状态和文件操作。鼠标移入展开，移开约 650 ms 后自动隐藏；编辑名称、选择导出格式及键盘操作时保持展开。触屏可点击展开，使用收起按钮或 Esc 关闭，也可点击“固定显示”。

- 编辑后约 300 ms 写入 IndexedDB，约 1.8 s 自动上传云端，也可以点击“保存到云端”。状态栏分别显示本机和云端保存结果。
- “我的画板”列出当前账号的云端画板和此浏览器的恢复草稿。云端画板可以跨设备打开；本地草稿按账号隔离，但仍属于该浏览器的本地数据。
- 导入文件创建新画板，保留上一份本机草稿。每次打开画板创建独立恢复记录，避免多个窗口覆盖彼此的本地未上传内容。旧恢复记录可以在列表中手动删除。
- 云端使用版本号进行原子更新。发现其他设备的新版本后暂停自动上传，可以另存副本，或在“我的画板”打开云端版本。本地未上传内容仍可从恢复列表找回。
- 断网时继续保存到本机，网络恢复后重试。响应丢失后的相同请求可以安全重试。浏览器存储失败时显示错误，并在未保存时提示离开风险。
- 单个画板的 UTF-8 场景 JSON 上限为 10 MiB，包含图片。后端 MariaDB 的 `whiteboard` 表保存元信息及完整快照，图片随场景原子保存。首版不需要独立 Excalidraw 服务，也不使用 MinIO 存储画板附件。
- 画板不公开分享；读、写、删除均校验当前登录用户。现有比赛访问限制继续生效，比赛锁定期间不开放画板页面和接口。

## 构建与部署

使用 Node.js 20.19 或更高版本（本次验证使用 20.20.2）及 Yarn 1。

```sh
# frontend/
yarn install --frozen-lockfile
yarn build

# backend/
yarn install --frozen-lockfile
yarn build
```

发布 `frontend/dist` 及后端构建产物并重启后端。当前项目的 TypeORM 设置为 `synchronize: true`，重启时会创建 `whiteboard` 表；如果生产环境关闭了同步，需要先通过受控数据库变更创建该表。

Vite 会从固定版本依赖的 `dist/prod/fonts` 自动复制字体到 `public/static/excalidraw/fonts`，并随构建输出发布到 `dist/static/excalidraw/fonts`。这部分生成资源不提交 Git。画板路由加载组件前设置 `EXCALIDRAW_ASSET_PATH`，沿用站点的 `window.publicPath`，部署时必须发布整个 `dist`。若静态资源放在另一域名，字体响应应允许站点跨域访问。

保留现有前端的动态公共路径替换、`/api/` 反向代理配置，并确保 `/draw` 的直接访问和刷新回退到前端 `index.html`。反向代理的请求体限制建议至少为 24 MiB，容纳 10 MiB 场景经过 JSON 字符串转义后的请求；例如 Nginx 在相关 API location 配置 `client_max_body_size 24m;`。MariaDB 的 `max_allowed_packet` 也应至少为 24 MiB。

Excalidraw 及其 CSS 由 `/draw` 路由动态加载。为处理其依赖的新类型语法，前端 TypeScript 升级为 5.9.3；后端编译器保持原配置。`vite/excalidrawLegacy.ts` 在现有旧浏览器构建的 regenerator 转换前降低表达式语法，避免 TemplateLiteral/SpreadElement 构建错误。

## 验证

```sh
# frontend/: React 保存流程及 IndexedDB 测试
npm run test:whiteboard

# backend/: 构建、权限、版本冲突、DTO 和保存数据测试
npm run test:whiteboard
```

前端测试使用真实 React 和 IndexedDB 模拟器，替换 Excalidraw 渲染及网络边界；它们验证保存流程，不替代真实 Canvas 的浏览器测试。

本次还验证了真实 MariaDB 临时表的中文/图片往返、并发更新和归属权限，以及独立浏览器验证环境中的真实 Excalidraw 中文绘图、保存和刷新恢复。完整前后端构建通过。前端全量 `tsc --noEmit` 有原有的 24 项诊断，与同编译器下未修改源码的基线相比没有新增诊断。
