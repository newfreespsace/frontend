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

## 账号素材库

Excalidraw 右侧的“素材库”与“我的画板”分别管理素材和完整画板。素材库按登录账号保存到云端，同一账号的所有画板共用；在另一设备上打开画板时会加载该账号的素材。切换账号会重新挂载编辑器，清除上一账号的内存状态。

- 公共素材目录的 `Add to Excalidraw` 回跳由 `useHandleLibrary` 处理，支持首次打开页面及页面内 `#addLibrary` 变化。保留官方的来源检查和导入确认。
- 使用官方素材库持久化适配器。添加、导入和删除先写入独立 IndexedDB `nsoj-whiteboard-libraries`，约 300 ms 后同步账号云端；画板菜单显示素材库保存状态，失败时提供重试按钮。素材库菜单仍可导入和导出 `.excalidrawlib` 文件。
- 离线修改按账号保留待同步操作，重新打开画板、网络恢复及短暂网络故障后会重试。尚未同步的数据只存在于当前浏览器；清理浏览器数据前应完成同步或导出备份。
- 后端 `whiteboard/library/get` 和 `whiteboard/library/save` 仅以登录身份确定账号。`whiteboard_library` 表每个账号一行，独立于画板场景。保存提交素材变更而非覆盖整个库；使用数据库版本条件更新并合并重试，保留其他设备对无关素材的修改。同一素材的冲突以服务端最后处理的操作为准。
- 单账号素材库的 UTF-8 JSON 上限为 10 MiB；拒绝无效素材及超限请求。旧版没有持久化的素材无法自动恢复，需要重新添加。

上线时需要同时发布前后端并重启后端。项目当前的 `synchronize: true` 会创建 `whiteboard_library` 表；若部署环境关闭自动同步，应先创建该表（`userId` 为关联用户的主键、`items` 为 LONGTEXT、`version` 为整数）。本次修复不改变已有画板数据。

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

该预处理必须保留 `compact: false`：Babel 默认会将超过 500,000 字符的分块紧凑输出为单行，导致 Vite 5 的 SystemJS 包装正则误给内层 `execute()` 添加参数，遮蔽模块导出函数和上下文，使兼容版首页白屏。此设置只保留中间代码的换行，最终产物仍由 Vite 压缩。

## 验证

```sh
# frontend/: React 保存流程、账号素材库同步及 IndexedDB 测试
npm run test:whiteboard

# frontend/: 大分块经过实际 Vite 构建后的 SystemJS 运行回归测试
npm run test:legacy

# backend/: 构建、权限、版本冲突、素材库并发合并、DTO 和保存数据测试
npm run test:whiteboard
```

前端测试使用真实 React 和 IndexedDB 模拟器，替换 Excalidraw 渲染及网络边界；它们验证保存流程，不替代真实 Canvas 的浏览器测试。

账号素材库修复新增验证：前端 16 项、后端 13 项测试通过；真实 MariaDB 临时表验证并发创建、增删合并、账号隔离和重复请求。独立浏览器验证环境使用真实 Excalidraw 和后端素材库服务，成功导入公共 Software Architecture 的 7 个素材，刷新/新建画板后恢复；另一个独立浏览器存储通过账号云端恢复相同素材，另一个账号保持空库。该环境使用独立测试数据，不写入线上账号。前端 TypeScript 全量检查仍为既有 24 项诊断，没有新增诊断。

本次还验证了真实 MariaDB 临时表的中文/图片往返、并发更新和归属权限，以及独立浏览器验证环境中的真实 Excalidraw 中文绘图、保存和刷新恢复。完整前后端构建通过。前端全量 `tsc --noEmit` 有原有的 24 项诊断，与同编译器下未修改源码的基线相比没有新增诊断。
