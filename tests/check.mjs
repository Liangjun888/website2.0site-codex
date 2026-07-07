// 合规契约检查（对应 21_DESIGN_SPEC_V2 第 13 节）
// 用法：node tests/check.mjs
import { readFileSync, existsSync } from 'node:fs';

const pages = [
  'zh-CN/index.html',
  'zh-CN/about/index.html',
  'zh-CN/approach/index.html',
  'zh-CN/client-portal/index.html',
];

const forbidden = [
  '<form', 'type="password"', "type='password'", '<input',
  '注册', '找回密码',
  '保证收益', '必然获得', '稳获', '高收益', '无风险', '确定性回报',
];

const mustContain = { 'zh-CN/client-portal/index.html': '仅向受邀客户开放' };
const disclaimerKey = '不构成，亦不应被视为';

let failures = 0;
for (const p of pages) {
  if (!existsSync(p)) { console.error(`FAIL 页面缺失: ${p}`); failures++; continue; }
  const html = readFileSync(p, 'utf8');
  for (const f of forbidden) {
    if (html.includes(f)) { console.error(`FAIL ${p} 出现禁止内容: ${f}`); failures++; }
  }
  if (!html.includes(disclaimerKey)) { console.error(`FAIL ${p} 缺少免责声明`); failures++; }
  if (mustContain[p] && !html.includes(mustContain[p])) {
    console.error(`FAIL ${p} 缺少必需文案: ${mustContain[p]}`); failures++;
  }
}
if (failures) { console.error(`\n${failures} 项检查未通过`); process.exit(1); }
console.log(`${pages.length} 个页面全部通过合规契约检查`);
