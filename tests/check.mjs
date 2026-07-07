// Gold Summit Capital site contract checks.
// Usage: node tests/check.mjs
import { existsSync, readFileSync } from 'node:fs';

const publicPages = [
  'zh-CN/index.html',
  'zh-CN/about/index.html',
  'zh-CN/approach/index.html',
];

const portalPages = [
  'zh-CN/client-portal/index.html',
  'zh-CN/client-portal/admin/index.html',
];

const allHtmlPages = [...publicPages, ...portalPages];

const forbiddenEverywhere = [
  'type="password"',
  "type='password'",
  '注册',
  '找回密码',
  '保证收益',
  '必然获得',
  '稳赚',
  '高收益',
  '无风险',
  '确定性回报',
  '认购入口',
  '在线申购',
  '赎回申请',
];

const publicPageForbidden = [
  '<form',
  '<input',
  'supabase',
  'data-portal-app',
  'data-admin-app',
];

const requiredSnippets = {
  'zh-CN/client-portal/index.html': [
    'data-portal-app',
    '仅向受邀客户开放',
    '简体中文',
    '繁體中文',
    'English',
    '../../scripts/portal.js',
  ],
  'zh-CN/client-portal/admin/index.html': [
    'data-admin-app',
    '资料后台',
    '简体中文 PDF',
    '繁體中文 PDF',
    'English PDF',
    '../../../scripts/portal-admin.js',
  ],
  'scripts/portal.js': [
    'signInWithOtp',
    'shouldCreateUser: false',
    'createSignedUrl',
    'download_events',
    'monthly_reports',
  ],
  'scripts/portal-admin.js': [
    'signInWithOtp',
    'shouldCreateUser: false',
    'monthly_report_files',
    'client-documents',
    'type !== "application/pdf"',
  ],
  'supabase/schema.sql': [
    'enable row level security',
    'client-documents',
    'monthly_reports_publish_guard',
    "role in ('client', 'admin')",
    "public.current_user_role() = 'client'",
  ],
};

let failures = 0;

function fail(message) {
  console.error(`FAIL ${message}`);
  failures += 1;
}

function read(path) {
  if (!existsSync(path)) {
    fail(`missing file: ${path}`);
    return '';
  }
  return readFileSync(path, 'utf8');
}

for (const page of allHtmlPages) {
  const html = read(page);
  for (const term of forbiddenEverywhere) {
    if (html.includes(term)) fail(`${page} contains forbidden content: ${term}`);
  }
}

for (const page of publicPages) {
  const html = read(page);
  for (const term of publicPageForbidden) {
    if (html.includes(term)) fail(`${page} should not contain portal implementation detail: ${term}`);
  }
  if (!html.includes('不构成，亦不应被视为')) fail(`${page} missing disclaimer language`);
}

for (const [path, snippets] of Object.entries(requiredSnippets)) {
  const body = read(path);
  for (const snippet of snippets) {
    if (!body.includes(snippet)) fail(`${path} missing required snippet: ${snippet}`);
  }
}

const config = read('scripts/portal-config.js');
if (!config.includes('https://') || !config.includes('.supabase.co')) {
  fail('portal-config.js should include the Supabase project URL');
}
if (config.includes('/rest/v1')) fail('portal-config.js should use the project URL, not the REST API URL');
if (!config.includes('sb_publishable_') && !config.includes('eyJ')) {
  fail('portal-config.js should include a Supabase publishable or anon public key');
}
if (config.includes('service_role') || config.includes('sb_secret_')) {
  fail('portal-config.js must not include secret or service-role keys');
}

if (failures) {
  console.error(`\n${failures} checks failed`);
  process.exit(1);
}

console.log(`${allHtmlPages.length} HTML pages and portal assets passed contract checks.`);
