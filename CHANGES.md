# CHANGES.md — 与 21_DESIGN_SPEC_V2 的偏离说明

构建日期：2026-07-07（Claude 于 claude.ai 对话内构建）

## 2026-07-08：客户资料库 V1

1. 新增客户资料库页面：`zh-CN/client-portal/index.html`。页面沿用现有公共页的页头、页脚、字体、颜色和留白体系，仅新增客户区所需的登录与月报下载组件。
2. 新增管理员后台：`zh-CN/client-portal/admin/index.html`。后台用于上传每月三语 PDF，并在三种语言版本齐备后发布。
3. 新增 Supabase 配置与初始化脚本：`scripts/portal-config.js`、`scripts/portal.js`、`scripts/portal-admin.js`、`supabase/schema.sql`。PDF 存放在私有 bucket，不放入公开网页目录。
4. 更新合规契约检查：允许客户区真实邮箱登录表单，但仍禁止密码输入、公开注册、收益承诺、认购赎回等敏感内容。

1. 字体（规范 5 节）：因构建环境无法下载字体文件，未打包 woff2 本地字体，
   采用系统字体回退栈（Noto Serif SC → Songti SC → SimSun 等）。
   待确认 20_OPEN_QUESTIONS B2 后，二选一：本地托管 woff2，或在 <head> 加入 Google Fonts 链接。
2. 图片（规范 9 节）：无可用摄影素材，首页 Hero 使用规范允许的纯色面板占位
   （--bg-alt + 金棕细线），二级页 Hero 使用纯文字版。摄影素材到位后按规范第 9 节替换。
3. 路径策略：全站使用相对路径，因此无需 BASE_PATH 注入，
   同一份文件可同时工作于 GitHub Pages 子路径、正式域名与本地预览。
   原 BASE_PATH 技术债就此消除。
4. 其余无偏离：4 页结构、导航（无团队页）、MHB 仅精神释义、新版免责声明（决策 26）、
   合规契约测试（tests/check.mjs，已在 CI 中前置于部署）均按规范执行。
