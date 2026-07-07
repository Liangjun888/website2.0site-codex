# CHANGES.md — 与 21_DESIGN_SPEC_V2 的偏离说明

构建日期：2026-07-07（Claude 于 claude.ai 对话内构建）

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
