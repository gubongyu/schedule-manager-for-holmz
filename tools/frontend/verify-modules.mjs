// 각 모듈의 문법과, 참조하는 공용 이름이 import/정의되어 있는지 검사한다.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

const ROOT = 'frontend/dist/js';
const files = [];
(function walk(d) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') && files.push(p);
  }
})(ROOT);

// 모듈별 export 목록
const exportsOf = new Map();
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const names = new Set();
  for (const m of src.matchAll(/^export\s+(?:async\s+)?(?:function|const|let|var)\s+([A-Za-z0-9_$]+)/gm)) names.add(m[1]);
  exportsOf.set(resolve(f), names);
}

let problems = 0;
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const imported = new Set();

  // import 검사: 경로 존재 + 대상 모듈이 실제로 export 하는지
  for (const m of src.matchAll(/import\s*\{([^}]+)\}\s*from\s*'([^']+)'/g)) {
    const target = resolve(dirname(f), m[2]);
    if (!exportsOf.has(target)) { console.log(`❌ ${f}: 없는 모듈 ${m[2]}`); problems++; continue; }
    for (let n of m[1].split(',')) {
      n = n.trim().split(/\s+as\s+/)[0].trim();
      if (!n) continue;
      imported.add(n.split(/\s+as\s+/).pop());
      if (!exportsOf.get(target).has(n)) { console.log(`❌ ${f}: ${m[2]} 가 ${n} 를 export 하지 않음`); problems++; }
    }
  }

  // 지역 정의 목록
  const local = new Set();
  for (const m of src.matchAll(/^(?:export\s+)?(?:async\s+)?(?:function|const|let|var)\s+([A-Za-z0-9_$]+)/gm)) local.add(m[1]);
  for (const m of src.matchAll(/^\s+(?:const|let)\s+([A-Za-z0-9_$]+)/gm)) local.add(m[1]);

  // 공용 이름을 쓰면서 import/정의하지 않은 경우 탐지
  const shared = ['api', '$view', 'esc', 'toast', 'ok', 'showError', 'showModal', 'fmtTime',
    'localDateStr', 'todayStr', 'elapsedSince', 'fmtBytes', 'fmtDateTime', 'fileBaseName',
    'DAY_LABELS', 'todayWeekday', 'hourOptions', 'showNoticeIfAny', 'navigate', 'refresh',
    'selectedEmployee', 'ensureEmployeeVerified', 'ensureAdminVerified', 'refreshEmployees',
    'applySession', 'session', 'employees', 'currentSession', 'knownEmployees',
    'missedHours', 'historyTable', 'setPlayerFatal', 'verifiedEmployees'];
  for (const name of shared) {
    const used = new RegExp(`(?<![A-Za-z0-9_$.'"\`])${name.replace('$', '\\$')}\\b`).test(
      src.replace(/^import[^;]+;$/gm, '')      // import 줄 제외
         .replace(/'[^'\n]*'|"[^"\n]*"/g, "''")); // 문자열 리터럴 제외 (클래스명 등 오탐 방지)
    if (used && !imported.has(name) && !local.has(name)) {
      console.log(`❌ ${f}: '${name}' 를 쓰지만 import/정의 없음`);
      problems++;
    }
  }
}
console.log(problems === 0 ? `✅ 모듈 ${files.length}개 참조 검사 통과` : `\n총 ${problems}건`);
process.exit(problems ? 1 : 0);
