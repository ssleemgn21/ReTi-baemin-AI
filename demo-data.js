/* 가게체크 데모 — 가상 데이터 (이 파일 하나에 모두 있음)
 * 데모 주소(gagecheck-demo…)에서 열거나 주소 끝에 ?demo=1 을 붙였을 때만 켜진다.
 * 실제로 쓰는 가게체크 기록(gagecheck.v1)과 다른 칸(gagecheck.demo.v1)에 저장해서 서로 섞이지 않는다.
 * 숫자·이름을 바꾸려면 아래 '정한 설정'만 고치면 된다. 이름·내용은 모두 가상이다.
 */
(function () {
  "use strict";
  var on = /(^|\.)gagecheck-demo/.test(location.hostname) || /[?&]demo=1(&|$)/.test(location.search);
  if (!on) return;

  /* ───────── 정한 설정 ───────── */
  var STORE = "레티식당(데모) — 돈까스·김치찜 포장·배달 · 화~일 영업, 월요일 휴무";
  var WEEKS = 8;                 // 지난 몇 주치 기록
  var CLOSED = [1];              // 휴무 요일 (0=일 … 6=토)
  var OPEN_DAYS = [0, 2, 3, 4, 5, 6];
  var SKIPPED_DAYS_AGO = [17, 31]; // 앱을 안 연 날 (며칠 전)
  var MISSED = [                 // 일부러 빠뜨린 일 (며칠 전 · 루틴 key)
    { daysAgo: 6, keys: ["sign", "gas"] },   // 마감 점검표·가스 밸브 빠짐
    { daysAgo: 4, keys: ["oil"] },           // 튀김기름 확인 빠짐
    { daysAgo: 13, keys: ["sign"] },
    { daysAgo: 20, keys: ["stock", "sign"] },
    { daysAgo: 27, keys: ["temp"] }
  ];
  var CATS = [
    { id: "c1", name: "오픈", color: "#2563eb" },
    { id: "c2", name: "마감", color: "#7c3aed" },
    { id: "c3", name: "주방/재료", color: "#059669" },
    { id: "c4", name: "발주/거래처", color: "#d97706" },
    { id: "c5", name: "행정/세무", color: "#dc2626" },
    { id: "c6", name: "기타", color: "#64748b" }
  ];
  var ROUTINES = [
    { key: "light", title: "간판·조명 켜기", cat: "c1", days: null },
    { key: "pos", title: "포스 시재 확인", cat: "c1", days: null },
    { key: "temp", title: "냉장·냉동고 온도 기록", cat: "c3", days: null, memo: "냉장 5도 이하 · 냉동 -18도 이하" },
    { key: "oil", title: "튀김기름 색·냄새 확인 (화·금 교체)", cat: "c3", days: null },
    { key: "stock", title: "등심·안심 손질 수량 기록 (안심 품절 주의)", cat: "c3", days: null },
    { key: "meat", title: "평택축산 발주 (가상 거래처)", cat: "c4", days: [0, 3], memo: "화요일 배송분 — 일요일·수요일에 주문" },
    { key: "veg", title: "통복농산 발주 (가상 거래처)", cat: "c4", days: [3], memo: "목요일 배송분" },
    { key: "sales", title: "매출 정산 (포스·배민·쿠팡이츠)", cat: "c2", days: null },
    { key: "gas", title: "가스 밸브 잠그기", cat: "c2", days: null },
    { key: "sign", title: "마감 점검표 서명", cat: "c2", days: null }
  ];
  var TODOS = [ // due: 오늘부터 며칠 뒤(음수 = 지남) · done: 끝낸 날(며칠 전)
    { title: "영문 알레르기 안내판 만들기 (외국인 손님 문의)", cat: "c6", due: 2 },
    { title: "박도윤 보건증 갱신 안내 (가상 직원)", cat: "c5", due: 12 },
    { title: "쿠팡이츠 지난달 정산 미입금 확인", cat: "c5", due: 0 },
    { title: "배민 쿠폰 설정 바꾸기", cat: "c6", due: -2 },
    { title: "부가세 자료 세무사에게 보내기", cat: "c5", due: 15 },
    { title: "튀김기 배수 호스 교체", cat: "c3", due: -9, done: 9 },
    { title: "주말 가족 세트 재가열 안내문 인쇄", cat: "c6", due: -5, done: 6 }
  ];

  /* ───────── 만들기 ───────── */
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function ymd(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function bizToday() { return new Date(Date.now() - 5 * 3600 * 1000); } // 새벽 5시 기준 영업일
  function dayAgo(n) { var d = bizToday(); d.setDate(d.getDate() - n); return d; }
  function rand(key) { var h = 2166136261; for (var i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 1000) / 1000; }

  function seed(uid) {
    var start = dayAgo(WEEKS * 7);
    var startIso = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 9).toISOString();
    var routines = ROUTINES.map(function (r, i) {
      return { id: "r_" + r.key, title: r.title, categoryId: r.cat, order: i + 1, checkedOn: null, days: r.days ? r.days.slice() : OPEN_DAYS.slice(), memo: r.memo || "", createdAt: startIso, _key: r.key };
    });
    var todos = TODOS.map(function (t, i) {
      var due = dayAgo(-t.due);
      return { id: "t_" + i, title: t.title, categoryId: t.cat, dueDate: ymd(due), done: !!t.done, completedAt: t.done ? new Date(dayAgo(t.done).setHours(15)).toISOString() : null, memo: "데모용 가상 할 일", createdAt: startIso };
    });
    var history = {};
    for (var n = WEEKS * 7; n >= 1; n--) {
      var d = dayAgo(n);
      var key = ymd(d);
      if (CLOSED.indexOf(d.getDay()) >= 0 || SKIPPED_DAYS_AGO.indexOf(n) >= 0) continue;
      var miss = [];
      MISSED.forEach(function (m) { if (m.daysAgo === n) miss = miss.concat(m.keys); });
      // 바쁜 주말에는 가끔 하나쯤 빠짐 (같은 날짜 = 같은 결과)
      if ((d.getDay() === 6 || d.getDay() === 0) && rand("busy:" + key) < 0.25) miss.push("pos");
      var done = routines.filter(function (r) {
        var applies = !r.days || r.days.indexOf(d.getDay()) >= 0;
        return applies && miss.indexOf(r._key) < 0;
      }).map(function (r) { return { id: r.id, title: r.title }; });
      var doneTodos = todos.filter(function (t) { return t.done && t.completedAt && ymd(new Date(t.completedAt)) === key; }).map(function (t) { return { id: t.id, title: t.title }; });
      history[key] = { done: done, todos: doneTodos };
    }
    // 오늘: 오픈 일만 해 둔 상태 (마감은 아직)
    var today = bizToday();
    if (CLOSED.indexOf(today.getDay()) < 0) {
      var opened = routines.filter(function (r) { return ["light", "pos", "temp"].indexOf(r._key) >= 0; });
      opened.forEach(function (r) { r.checkedOn = ymd(today); }); // 오늘 체크 표시는 checkedOn 으로 본다
      history[ymd(today)] = { done: opened.map(function (r) { return { id: r.id, title: r.title }; }), todos: [] };
    }
    routines.forEach(function (r) { delete r._key; });
    return { version: 2, settings: { dayResetHour: 5, firstUseAt: startIso, lastBackupAt: new Date(dayAgo(3).setHours(22)).toISOString() }, categories: CATS.map(function (c) { return { id: c.id, name: c.name, color: c.color }; }), routines: routines, todos: todos, history: history };
  }

  window.GAGECHECK_DEMO = { key: "gagecheck.demo.v1", seed: seed };

  /* ───────── 데모 표시 · 여기부터 눌러 보세요 · 다시 채우기 ───────── */
  function banner() {
    var wrap = document.querySelector(".wrap");
    if (!wrap || document.getElementById("demoBanner")) return;
    var box = document.createElement("section");
    box.id = "demoBanner";
    box.setAttribute("aria-label", "데모 안내");
    box.style.cssText = "border:3px solid #F526A8;border-radius:16px;padding:14px 16px;margin:0 0 14px;background:#fff7fc;color:#1f2937";
    box.innerHTML =
      '<div style="font-size:22px;font-weight:900;line-height:1.3">🎬 데모입니다 · 가상 데이터</div>' +
      '<div style="font-size:13px;margin-top:4px;color:#4b5563">' + STORE + ' — 지난 ' + WEEKS + '주 기록이 들어 있어요. 실제 가게·사람이 아니에요. 비밀번호·PIN 이 필요하면 <b>test</b>.</div>' +
      '<div style="margin-top:10px;font-weight:800">👉 여기부터 눌러 보세요</div>' +
      '<ol style="margin:4px 0 0 20px;padding:0;font-size:14px;line-height:1.6">' +
      '<li><b>오늘</b> 탭 — 마감 할 일(가스 밸브·마감 점검표)을 눌러 체크해 보기</li>' +
      '<li><b>달력</b> 탭 — 일부러 빠뜨린 날(6일 전 마감 점검표·가스)과 앱을 안 연 날 보기</li>' +
      '<li><b>리포트</b> 탭 — 이번 달 자주 빠지는 일 보기</li></ol>' +
      '<button type="button" id="demoReset" style="margin-top:10px;border:1px solid #d1d5db;background:#fff;border-radius:10px;padding:8px 12px;font-weight:700;min-height:44px">데모 데이터 다시 채우기</button>';
    wrap.insertBefore(box, wrap.firstChild);
    document.getElementById("demoReset").addEventListener("click", function () {
      if (!confirm("지금까지 바꾼 내용을 지우고 처음 데모 상태로 다시 채울까요?")) return;
      try {
        localStorage.removeItem("gagecheck.demo.v1");
        localStorage.removeItem("gagecheck.demo.v1.beforeimport");
      } catch (e) {}
      location.reload();
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", banner);
  else banner();
})();
