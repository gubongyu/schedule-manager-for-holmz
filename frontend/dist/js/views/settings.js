// 설정: Google 연동, 관리자 계정, 공지사항, 업무 항목, TTS 명령.
import { api } from '../api.js';
import { $view, esc, ok, showError } from '../ui.js';
import { setDisabledViews } from '../session.js';
import { showUpdate } from '../update.js';

export async function renderAdminSettings() {
  const [authorized, notice, taskOptions, adminName, ttsCommand, targets, features, appVersion] = await Promise.all([
    api().GoogleAuthorized(), api().GetNotice(), api().GetTaskOptions(), api().AdminName(), api().TTSCommand(),
    api().GetSyncTargets(), api().GetFeatures(), api().AppVersion()]);
  // 미연동이면 모든 항목이 꺼진 상태로 내려오고, 조작도 막는다.
  const t = targets || {};
  const anyOn = authorized && (t.worklog || t.master || t.desk);
  const f = features || {};
  const featItem = (key, on, title, desc) => `
    <label class="sync-item">
      <input type="checkbox" data-feature="${key}" ${on === false ? '' : 'checked'}>
      <span><b>${title}</b><br><span class="hint">${desc}</span></span>
    </label>`;
  const syncItem = (key, on, title, desc) => `
    <label class="sync-item${authorized ? '' : ' off'}">
      <input type="checkbox" data-sync="${key}" ${on ? 'checked' : ''} ${authorized ? '' : 'disabled'}>
      <span><b>${title}</b><br><span class="hint">${desc}</span></span>
    </label>`;
  $view.innerHTML = `
    <h2>설정 — Google 연동</h2>
    <div class="card">
      <h3>Google 계정 연동</h3>
      <p style="margin:8px 0">상태:
        <span class="status-badge">${authorized ? '연동됨' : '미연동'}</span></p>
      <p class="hint" style="margin:8px 0">
        Google Cloud Console에서 "데스크톱 앱" OAuth 클라이언트를 만들고,
        내려받은 credentials.json 을 <b>%APPDATA%\\HOLMZ\\credentials.json</b> 에 두세요.</p>
      <div class="row">
        <button id="btn-auth" class="small primary">Google 계정 인증</button>
      </div>
      <div id="auth-result"></div>
    </div>
    <div class="card">
      <h3>동기화 항목</h3>
      <p class="hint" style="margin:8px 0">${authorized
        ? '체크한 항목만 Drive로 올라갑니다. 동기화는 [지금 동기화]와 마감 스케줄에서 실행됩니다.'
        : '⚠️ Google 계정이 연동되지 않아 모든 동기화가 비활성화되어 있습니다. 위에서 계정을 인증하면 설정할 수 있습니다.'}</p>
      ${syncItem('worklog', t.worklog, '근로기록·체크리스트', '퇴근 완료된 미동기화 기록을 날짜별 스프레드시트로 업로드')}
      ${syncItem('master', t.master, '직원 명단·근무 스케줄', '학과/이름/학번/근로 종료일, 주간 근무 배치, 대타, 휴가·추가 근무')}
      <p class="hint" style="margin-top:10px">HDMI 대여·분실물은 아래 <b>기능 사용</b>에서 켜둔 경우에만 동기화됩니다${t.desk ? '' : ' (현재 모두 꺼져 있어 동기화하지 않습니다)'}.</p>
      <div class="row" style="margin-top:12px">
        <button id="btn-sync" class="small primary" ${anyOn ? '' : 'disabled'}>지금 동기화</button>
        <span id="sync-saved" class="hint"></span>
      </div>
      <div id="sync-result"></div>
    </div>
    <div class="card">
      <h3>기능 사용</h3>
      <p class="hint" style="margin:8px 0">끄면 해당 메뉴가 관리자·근무자 화면 모두에서 사라집니다. 기록해둔 데이터는 지워지지 않고, 다시 켜면 그대로 보입니다.</p>
      ${featItem('dashboard', f.dashboard, '대시보드', '오늘 근무·기록 현황·금주 스케줄 요약 화면')}
      ${featItem('rental', f.rental, 'HDMI 대여', '대여 등록과 반납 처리')}
      ${featItem('lostFound', f.lostFound, '분실물 습득', '주운 물건 등록과 회수 처리')}
      ${featItem('lostReported', f.lostReported, '분실물 접수', '학생 분실 신고 접수와 회수 처리')}
      ${featItem('subRequest', f.subRequest, '대타 신청', '근무자가 동료에게 근무를 넘기는 신청 화면 (관리자는 근로 스케줄에서 계속 등록 가능)')}
      <div class="row" style="margin-top:12px"><span id="feat-saved" class="hint"></span></div>
    </div>
    <div class="card">
      <h3>관리자 계정</h3>
      <p class="hint" style="margin:8px 0">
        앱 접속 화면에서 이 이름과 PIN으로 관리자 로그인합니다. 초기 계정은 admin / 0000000000이니 반드시 변경하세요.
        비워둔 항목은 그대로 유지됩니다.</p>
      <div class="row">
        <input type="password" id="pin-cur" placeholder="현재 PIN">
        <input type="text" id="admin-name-new" placeholder="관리자 이름" value="${esc(adminName)}">
        <input type="password" id="pin-new" placeholder="새 PIN">
        <button id="pin-save" class="small primary">저장</button>
      </div>
      <div id="pin-result"></div>
    </div>
    <div class="card">
      <h3>공지사항</h3>
      <p class="hint" style="margin:8px 0">근무자가 출근 버튼을 누르면 팝업으로 표시됩니다. 비워두면 표시되지 않습니다.</p>
      <textarea id="notice-text" rows="4">${esc(notice || '')}</textarea>
      <div class="row" style="margin-top:8px">
        <button id="notice-save" class="small primary">공지 저장</button><span id="notice-result" class="hint"></span>
      </div>
    </div>
    <div class="card">
      <h3>안내 방송 음성 (TTS)</h3>
      <p class="hint" style="margin:8px 0">
        안내 방송 문구를 음성으로 만드는 명령입니다. 기본값은 WSL의 tts_program(MeloTTS)을 호출합니다.
        자리표시자: {in_wsl}/{out_wsl}(WSL 경로), {in}/{out}(원본 경로), {speed}. 비워두면 기본값을 사용합니다.
        생성이 실패하면 Windows 내장 음성으로 대체 송출됩니다.</p>
      <textarea id="tts-cmd" rows="3" style="width:100%">${esc(ttsCommand || '')}</textarea>
      <div class="row" style="margin-top:8px">
        <button id="tts-save" class="small primary">TTS 명령 저장</button><span id="tts-result" class="hint"></span>
      </div>
    </div>
    <div class="card">
      <h3>업무 항목 (정각 기록용)</h3>
      <p class="hint" style="margin:8px 0">근무 중 매 정각 알림에서 선택하는 업무 목록입니다. 한 줄에 하나씩 입력하세요.</p>
      <textarea id="tasks-text" rows="5">${esc((taskOptions || []).join('\n'))}</textarea>
      <div class="row" style="margin-top:8px">
        <button id="tasks-save" class="small primary">업무 항목 저장</button><span id="tasks-result" class="hint"></span>
      </div>
    </div>
    <div class="card">
      <h3>프로그램 버전</h3>
      <p style="margin:8px 0">현재 버전: <span class="status-badge">${esc(appVersion || 'dev')}</span></p>
      <div class="row">
        <button id="btn-update" class="small primary">업데이트 확인</button><span id="update-result" class="hint"></span>
      </div>
    </div>`;
  // 체크 즉시 저장한다 (별도 저장 버튼 없이 바로 반영).
  $view.querySelectorAll('[data-sync]').forEach(box => box.onchange = () => {
    const next = {};
    $view.querySelectorAll('[data-sync]').forEach(b => { next[b.dataset.sync] = b.checked; });
    api().SetSyncTargets(next).then(() => {
      document.getElementById('sync-saved').textContent = '✅ 저장됨';
      document.getElementById('btn-sync').disabled = !(next.worklog || next.master || next.desk);
    }, err => { box.checked = !box.checked; showError(err); });
  });

  // 기능 토글도 즉시 저장하고, 메뉴에 바로 반영한다.
  $view.querySelectorAll('[data-feature]').forEach(box => box.onchange = () => {
    const next = {};
    $view.querySelectorAll('[data-feature]').forEach(b => { next[b.dataset.feature] = b.checked; });
    api().SetFeatures(next).then(() => {
      document.getElementById('feat-saved').textContent = '✅ 저장됨';
      setDisabledViews(Object.entries(next).filter(([, on]) => !on)
        .map(([k]) => ({
          dashboard: 'dashboard', rental: 'rental', lostFound: 'lost-found',
          lostReported: 'lost-reported', subRequest: 'sub-request',
        }[k])));
      renderAdminSettings();
    }, err => { box.checked = !box.checked; showError(err); });
  });

  document.getElementById('notice-save').onclick = () => {
    api().SetNotice(document.getElementById('notice-text').value)
      .then(() => { document.getElementById('notice-result').textContent = '✅ 저장됨'; }, showError);
  };
  document.getElementById('tts-save').onclick = () => {
    api().SetTTSCommand(document.getElementById('tts-cmd').value)
      .then(ok('TTS 명령이 저장되었습니다', renderAdminSettings), showError);
  };
  document.getElementById('tasks-save').onclick = () => {
    const lines = document.getElementById('tasks-text').value.split('\n').map(s => s.trim()).filter(Boolean);
    api().SetTaskOptions(lines)
      .then(() => { document.getElementById('tasks-result').textContent = '✅ 저장됨'; }, showError);
  };
  document.getElementById('pin-save').onclick = () => {
    api().SetAdminAccount(document.getElementById('pin-cur').value,
      document.getElementById('admin-name-new').value.trim(),
      document.getElementById('pin-new').value)
      .then(() => {
        document.getElementById('pin-result').innerHTML = '<p style="margin-top:8px">✅ 저장되었습니다.</p>';
        document.getElementById('pin-cur').value = '';
        document.getElementById('pin-new').value = '';
      }, err => { document.getElementById('pin-result').innerHTML = ''; showError(err); });
  };
  document.getElementById('btn-update').onclick = () => {
    const out = document.getElementById('update-result');
    out.textContent = '확인 중...';
    // 여기서는 사용자가 직접 누른 것이므로 실패를 숨기지 않는다.
    api().CheckUpdate().then(av => {
      out.textContent = av ? '' : '최신 버전입니다.';
      showUpdate(av);
    }, err => { out.textContent = ''; showError(err); });
  };
  document.getElementById('btn-auth').onclick = () => {
    document.getElementById('auth-result').innerHTML = '<p style="margin-top:8px">브라우저에서 인증을 완료해주세요...</p>';
    api().GoogleAuthorize().then(renderAdminSettings, err => {
      document.getElementById('auth-result').innerHTML = '';
      showError(err);
    });
  };
  document.getElementById('btn-sync').onclick = () => {
    document.getElementById('sync-result').innerHTML = '<p style="margin-top:8px">동기화 중...</p>';
    api().SyncNow().then(res => {
      const done = [];
      if (res.sheets || res.uploaded) done.push(`근로기록 ${res.uploaded}건`);
      if (res.master) done.push('직원·근무스케줄');
      if (res.desk) done.push('대여·분실물');
      document.getElementById('sync-result').innerHTML =
        `<p style="margin-top:8px">✅ ${done.length ? done.join(' · ') + ' 동기화 완료' : '동기화할 항목이 없습니다'}</p>` +
        (res.master ? `<p style="font-size:12px"><a href="${res.master}" target="_blank">직원·근무스케줄 시트</a></p>` : '') +
        (res.desk ? `<p style="font-size:12px"><a href="${res.desk}" target="_blank">대여·분실물 시트</a></p>` : '') +
        (res.sheets || []).map(u => `<p style="font-size:12px"><a href="${u}" target="_blank">${u}</a></p>`).join('');
    }, err => {
      document.getElementById('sync-result').innerHTML = '';
      showError(err);
    });
  };
}
