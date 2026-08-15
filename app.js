/* ============================================================
   หน้าสำหรับผู้ปกครองบน LINE (LIFF)
   โฮสต์เป็นไฟล์ static เช่น GitHub Pages แล้วเรียก Apps Script เป็น API
   ============================================================ */

var APP = { token: null, data: null, tab: 'today', cacheKey: 'SD_PARENT_HOME_CACHE' };

/* ---------- เรียก API ---------- */
/* ส่งเป็น text/plain เพื่อเลี่ยง preflight ที่ Apps Script ตอบไม่ได้ */
function api(fn, args) {
  if (navigator.onLine === false) return Promise.reject(new Error('ออฟไลน์อยู่ กรุณาเชื่อมต่ออินเทอร์เน็ตก่อน'));
  return fetch(SD_CONFIG.API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ fn: fn, args: args || [] })
  }).then(function (r) { return r.json(); })
    .then(function (res) {
      if (!res || res.status === 'error') throw new Error(res ? res.message : 'เชื่อมต่อไม่สำเร็จ');
      return res;
    });
}

function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/[<]/g, '&lt;')
    .replace(/[>]/g, '&gt;').replace(/"/g, '&quot;');
}

function toast(msg) {
  $('.toast-x').remove();
  var $t = $('<div class="toast-x"></div>').text(msg);
  $('body').append($t);
  setTimeout(function () { $t.fadeOut(200, function () { $t.remove(); }); }, 3000);
}

function fmtDate(iso) {
  if (!iso) return '-';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  var m = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return d.getDate() + ' ' + m[d.getMonth()] + ' ' + (d.getFullYear() + 543);
}

function monthLabel(month) {
  var parts = String(month || '').split('-');
  var y = Number(parts[0]), m = Number(parts[1]);
  var names = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return y && m >= 1 && m <= 12 ? names[m - 1] + ' พ.ศ. ' + (y + 543) : String(month || '-');
}

function todayStr() {
  var d = new Date();
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}

function attTone(s) {
  if (s === 'มาเรียน' || s === 'กลับบ้านแล้ว') return 'pill-ok';
  if (s === 'มาสาย') return 'pill-warn';
  if (s === 'ขาด') return 'pill-danger';
  if (s === 'ลา') return 'pill-info';
  return 'pill-mute';
}

function card(title, body) {
  return '<div class="card-x">' +
    (title ? '<div class="card-x-head">' + esc(title) + '</div>' : '') +
    '<div class="card-x-body">' + body + '</div></div>';
}

function empty(icon, title, sub) {
  return '<div class="empty"><i class="bi ' + icon + '"></i>' +
    '<div style="font-weight:600">' + esc(title) + '</div>' +
    (sub ? '<div style="font-size:.85rem">' + esc(sub) + '</div>' : '') + '</div>';
}

function fatal(msg) {
  $('#app').html('<div class="wrap">' + empty('bi-exclamation-triangle', 'เปิดหน้านี้ไม่ได้', msg) + '</div>');
}

// LIFF ID Token มีอายุจำกัด หากเปิดหน้าเดิมค้างไว้นาน LINE จะส่ง token เก่ากลับมา
// ให้ล้างเซสชัน LIFF และเริ่มเข้าสู่ระบบใหม่หนึ่งครั้งแทนการค้างที่หน้า error
var LIFF_REAUTH_KEY = 'SD_LIFF_REAUTH_ATTEMPT';

function isExpiredLineTokenError(err) {
  var msg = String(err && err.message || err || '');
  return /IdToken expired|token expired|id.?token.*expired|หมดอายุ/i.test(msg);
}

function reauthenticateLine(err) {
  if (!isExpiredLineTokenError(err) || !window.liff || typeof liff.login !== 'function') return false;
  var alreadyRetried = false;
  try {
    alreadyRetried = sessionStorage.getItem(LIFF_REAUTH_KEY) === '1';
  } catch (e) { /* ignore */ }
  if (alreadyRetried) {
    try { sessionStorage.removeItem(LIFF_REAUTH_KEY); } catch (e) { /* ignore */ }
    fatal('เซสชัน LINE หมดอายุ กรุณาปิดหน้านี้แล้วเปิดจาก Rich Menu อีกครั้ง');
    return true;
  }
  try { sessionStorage.setItem(LIFF_REAUTH_KEY, '1'); } catch (e) { /* ignore */ }
  $('#app').html('<div class="empty" style="padding-top:80px"><div class="spinner-border text-secondary"></div>' +
    '<div class="mt-2" style="font-size:.85rem">เซสชัน LINE หมดอายุ กำลังเชื่อมต่อใหม่…</div></div>');
  try { if (typeof liff.isLoggedIn !== 'function' || liff.isLoggedIn()) liff.logout(); } catch (e) { /* ignore */ }
  setTimeout(function () {
    try { liff.login({ redirectUri: window.location.href }); }
    catch (loginErr) { fatal('กรุณาเปิดหน้านี้จาก LINE อีกครั้ง'); }
  }, 250);
  return true;
}

function clearLineReauthAttempt() {
  try { sessionStorage.removeItem(LIFF_REAUTH_KEY); } catch (e) { /* ignore */ }
}

function canView(key) {
  var list = APP.data && APP.data.guardian && APP.data.guardian.visible_sections;
  return !Array.isArray(list) || list.indexOf(key) !== -1;
}

function offlineBanner() {
  if (!$('#offlineBanner').length) $('body').prepend('<div id="offlineBanner" class="alert alert-warning rounded-0 mb-0 py-2 text-center small d-none"><i class="bi bi-wifi-off me-1"></i>ออฟไลน์: กำลังแสดงข้อมูลล่าสุดที่บันทึกไว้ การลาและคำขอเพิ่มผู้รับเด็กจะส่งเมื่อกลับมาออนไลน์</div>');
  $('#offlineBanner').toggleClass('d-none', navigator.onLine !== false);
}

/* ---------- เริ่มทำงาน ---------- */
$(function () {
  offlineBanner();
  window.addEventListener('offline', offlineBanner);
  window.addEventListener('online', offlineBanner);
  if (!SD_CONFIG.API_URL || SD_CONFIG.API_URL.indexOf('http') !== 0) {
    fatal('ยังไม่ได้ตั้งค่า API_URL ในไฟล์ config.js');
    return;
  }

  var bindTokenKey = 'SD_PARENT_BIND_TOKEN';
  var urlToken = new URLSearchParams(location.search).get('t');
  try {
    if (urlToken) sessionStorage.setItem(bindTokenKey, urlToken);
    else urlToken = sessionStorage.getItem(bindTokenKey) || '';
  } catch (e) { /* sessionStorage may be unavailable in restricted browsers */ }

  liff.init({ liffId: SD_CONFIG.LIFF_ID })
    .then(function () {
      if (!liff.isLoggedIn()) { liff.login(); return; }
      var idToken = liff.getIDToken();

      if (urlToken) {
        // เปิดครั้งแรกจากลิงก์ที่ศูนย์ส่งให้ ผูกบัญชี LINE ไว้เลย
        APP.token = urlToken;
        return api('apiParentBindLine', [urlToken, idToken])
          .then(function (res) {
            clearLineReauthAttempt();
            try { sessionStorage.removeItem(bindTokenKey); } catch (e) { /* ignore */ }
            return res;
          })
          .catch(function () { /* ผูกไม่สำเร็จก็ยังดูข้อมูลได้ */ })
          .then(load);
      }

      return api('apiParentLineLogin', [idToken]).then(function (res) {
        clearLineReauthAttempt();
        var kids = res.data.children || [];
        if (!kids.length) {
          renderPhoneBind();
          return;
        }
        if (kids.length === 1) { APP.token = kids[0].portal_token; load(); return; }
        pickChild(kids);
      }).catch(function (err) {
        if (String(err.message || '').indexOf('ยังไม่ได้ผูก') !== -1) {
          renderPhoneBind();
          return;
        }
        throw err;
      });
    })
    .catch(function (err) {
      // เปิดนอก LINE ยังใช้ลิงก์ส่วนตัวได้
      if (urlToken) { APP.token = urlToken; load(); return; }
      if (reauthenticateLine(err)) return;
      fatal('เชื่อมต่อ LINE ไม่สำเร็จ: ' + err.message);
    });
});

function renderPhoneBind() {
  $('#app').html('<div class="wrap"><div class="head"><div class="center-name">ผูกบัญชีผู้ปกครอง</div>' +
    '<div class="small text-muted">กรอกเบอร์โทรที่ลงทะเบียนไว้กับศูนย์</div></div>' +
    '<div class="card-x"><div class="card-x-body">' +
    '<label class="form-label">เบอร์โทรผู้ปกครอง</label>' +
    '<input id="bindPhone" class="form-control" type="tel" inputmode="tel" autocomplete="tel" placeholder="เช่น 0812345678">' +
    '<div class="small text-muted mt-2">เบอร์ต้องตรงกับข้อมูลที่ศูนย์บันทึกไว้ หากเป็นเบอร์ร่วมหลายรายการให้ใช้ลิงก์ส่วนตัวแทน</div>' +
    '<button id="btnBindPhone" class="btn btn-primary w-100 mt-3">ผูกบัญชีกับ LINE</button>' +
    '<div id="bindPhoneMsg" class="small mt-2"></div>' +
    '</div></div></div>');

  $('#btnBindPhone').on('click', function () {
    var $btn = $(this), phone = String($('#bindPhone').val() || '').trim();
    if (!phone) { $('#bindPhoneMsg').text('กรุณากรอกเบอร์โทร').removeClass('text-success').addClass('text-danger'); return; }
    $btn.prop('disabled', true).text('กำลังตรวจสอบ…');
    $('#bindPhoneMsg').text('').removeClass('text-danger text-success');
    api('apiParentBindPhone', [phone, liff.getIDToken()])
      .then(function () { return api('apiParentLineLogin', [liff.getIDToken()]); })
      .then(function (res) {
        clearLineReauthAttempt();
        var kids = res.data.children || [];
        if (kids.length === 1) { APP.token = kids[0].portal_token; load(); return; }
        pickChild(kids);
      })
      .catch(function (err) {
        if (reauthenticateLine(err)) return;
        $btn.prop('disabled', false).text('ผูกบัญชีกับ LINE');
        $('#bindPhoneMsg').text(err.message).removeClass('text-success').addClass('text-danger');
      });
  });
}

function pickChild(kids) {
  $('#app').html('<div class="wrap"><div class="head"><div class="center-name">เลือกบุตรหลาน</div></div>' +
    kids.map(function (k, i) {
      return '<div class="child pick" data-i="' + i + '" style="cursor:pointer">' +
        '<div class="ava">' + (k.photo_url ? '<img src="' + esc(k.photo_url) + '">' : esc(k.child_name.charAt(0))) + '</div>' +
        '<div><div class="child-name">' + esc(k.child_name) + '</div></div></div>';
    }).join('') + '</div>');
  $('.pick').on('click', function () {
    APP.token = kids[Number($(this).data('i'))].portal_token;
    load();
  });
}

function load() {
  $('#app').html('<div class="empty" style="padding-top:80px"><div class="spinner-border text-secondary"></div>' +
    '<div class="mt-2" style="font-size:.85rem">กำลังโหลดข้อมูล…</div></div>');

  api('apiParentHome', [APP.token]).then(function (res) {
    APP.data = res.data;
    try { localStorage.setItem(APP.cacheKey, JSON.stringify({ saved_at: new Date().toISOString(), data: APP.data })); } catch (e) { /* ignore */ }
    render();
  }).catch(function (e) {
    try {
      var cached = JSON.parse(localStorage.getItem(APP.cacheKey) || 'null');
      if (cached && cached.data) { APP.data = cached.data; render(); toast('กำลังแสดงข้อมูลล่าสุดที่โหลดไว้'); return; }
    } catch (ignore) { /* ignore */ }
    fatal(e.message);
  });
}

function render() {
  var d = APP.data, c = d.child;

  var today = d.today || {};
  var status = today.status
    ? '<span class="pill ' + attTone(today.status) + '">' + esc(today.status) + '</span>'
    : '<span class="pill pill-mute">ยังไม่มีการบันทึกวันนี้</span>';

  var head = '<div class="head">' +
    '<div class="center-row">' +
    (d.center.logo_url ? '<img src="' + esc(d.center.logo_url) + '" class="logo">' : '') +
    '<div><div class="center-name">' + esc(d.center.name) + '</div>' +
    '<div class="center-sub">สำหรับผู้ปกครอง · ' + esc(d.guardian.name) + '</div></div></div>' +
    '<div class="child"><div class="ava">' +
    (c.photo_url ? '<img src="' + esc(c.photo_url) + '">' : esc(c.name.charAt(0))) +
    '</div><div style="flex:1">' +
    '<div class="child-name">' + esc(c.name) + '</div>' +
    '<div class="child-sub">' + esc(c.room_name || '-') + ' · อายุ ' + esc(c.age_text) + '</div>' +
    '<div style="margin-top:4px">' + status +
    (today.check_in ? ' <span style="font-size:.8rem">เข้า ' + esc(today.check_in) + '</span>' : '') +
    (today.check_out ? ' <span style="font-size:.8rem">กลับ ' + esc(today.check_out) + '</span>' : '') +
    '</div></div></div></div>';

  var tabs = [
    ['today', 'bi-house', 'วันนี้'],
    ['daily', 'bi-clipboard-check', 'กิจวัตร'],
    ['health', 'bi-heart-pulse', 'สุขภาพ'],
    ['photos', 'bi-images', 'ภาพ'],
    ['more', 'bi-three-dots', 'เพิ่มเติม']
  ].filter(function (t) { return t[0] === 'today' || t[0] === 'more' || (t[0] === 'daily' && canView('daily')) || (t[0] === 'health' && (canView('health') || canView('growth'))) || (t[0] === 'photos' && canView('photos')); });

  $('#app').html('<div class="wrap" style="padding:0">' + head +
    '<div style="padding:14px 12px 0" id="body"></div></div>' +
    '<div class="tabs">' + tabs.map(function (t) {
      return '<button class="tab' + (t[0] === APP.tab ? ' active' : '') + '" data-tab="' + t[0] + '">' +
        '<i class="bi ' + t[1] + '"></i><span>' + t[2] + '</span></button>';
    }).join('') + '</div>');

  $('.tab').on('click', function () {
    APP.tab = $(this).data('tab');
    $('.tab').removeClass('active');
    $(this).addClass('active');
    renderTab();
  });

  renderTab();
}

function renderTab() {
  var d = APP.data, c = d.child, $b = $('#body');

  if (APP.tab === 'today') {
    var alerts = '';
    if (c.allergy) alerts += '<div class="alert-x danger">แพ้: ' + esc(c.allergy) + '</div>';
    if (c.chronic) alerts += '<div class="alert-x warn">โรคประจำตัว: ' + esc(c.chronic) + '</div>';

    var meals = canView('meals') && d.meals.length
      ? d.meals.map(function (m) {
          return '<div class="kv"><div class="kv-k">' + esc(m.meal_type) + '</div>' +
            '<div>' + esc(m.menu) + '</div></div>';
        }).join('')
      : '<div style="font-size:.85rem;color:var(--muted)">ยังไม่มีข้อมูลเมนูของวันนี้</div>';

    var recent = canView('attendance') && d.attendance.slice(0, 7).map(function (a) {
      return '<div class="kv"><div class="kv-k">' + fmtDate(a.date) + '</div>' +
        '<div><span class="pill ' + attTone(a.status) + '">' + esc(a.status || '-') + '</span>' +
        (a.check_in ? ' <span style="font-size:.8rem;color:var(--muted)">' + esc(a.check_in) +
          (a.check_out ? ' - ' + esc(a.check_out) : '') + '</span>' : '') + '</div></div>';
    }).join('');

    $b.html(alerts + card('เมนูอาหารวันนี้', meals) +
      card('การมาเรียน 7 วันล่าสุด', recent || '<div style="font-size:.85rem;color:var(--muted)">ยังไม่มีข้อมูล</div>'));
    return;
  }

  if (APP.tab === 'daily') {
    $b.html(d.logs.length
      ? d.logs.map(function (l) {
          var chip = function (v) { return v ? '<span class="chip">' + esc(v) + '</span>' : ''; };
          return card(fmtDate(l.date),
            '<div class="chips">' +
            chip(l.breakfast ? 'เช้า: ' + l.breakfast : '') +
            chip(l.lunch ? 'กลางวัน: ' + l.lunch : '') +
            chip(l.snack ? 'ว่าง: ' + l.snack : '') +
            chip(l.milk ? 'นม: ' + l.milk : '') +
            chip((l.nap_start || l.nap_end) ? ('นอน ' + (l.nap_start || '?') + '-' + (l.nap_end || '?')) : '') +
            chip((l.pee_count || l.poo_count) ? ('ฉี่ ' + (l.pee_count || 0) + ' · อึ ' + (l.poo_count || 0)) : '') +
            chip(l.mood) +
            '</div>' +
            (l.activity_done ? '<div style="font-size:.85rem;margin-top:8px"><b>กิจกรรม</b> ' + esc(l.activity_done) + '</div>' : '') +
            (l.note ? '<div style="font-size:.85rem;margin-top:4px"><b>ข้อความจากครู</b> ' + esc(l.note) + '</div>' : ''));
        }).join('')
      : empty('bi-clipboard-check', 'ยังไม่มีบันทึกกิจวัตร', 'ครูจะบันทึกให้ทุกวัน'));
    return;
  }

  if (APP.tab === 'health') {
    var gs = d.growth_summary || {};
    var latestGrowth = gs.latest;
    var growthBody = latestGrowth
      ? '<div class="kv"><div class="kv-k">เดือนล่าสุด</div><div>' + esc(monthLabel(latestGrowth.month)) + '</div></div>' +
        '<div class="kv"><div class="kv-k">น้ำหนัก</div><div>' + (latestGrowth.weight_kg === null || latestGrowth.weight_kg === undefined ? '-' : esc(latestGrowth.weight_kg) + ' กก.') + '</div></div>' +
        '<div class="kv"><div class="kv-k">ส่วนสูง</div><div>' + (latestGrowth.height_cm === null || latestGrowth.height_cm === undefined ? '-' : esc(latestGrowth.height_cm) + ' ซม.') + '</div></div>' +
        '<div class="kv"><div class="kv-k">บันทึกสะสม</div><div>' + esc(gs.count || 0) + ' เดือน</div></div>' +
        (gs.weight_change !== null && gs.weight_change !== undefined || gs.height_change !== null && gs.height_change !== undefined ? '<div style="font-size:.8rem;color:var(--muted);margin-top:6px">เทียบครั้งก่อน: ' + (gs.weight_change === null || gs.weight_change === undefined ? '-' : (gs.weight_change >= 0 ? '+' : '') + esc(gs.weight_change) + ' กก.') + ' / ' + (gs.height_change === null || gs.height_change === undefined ? '-' : (gs.height_change >= 0 ? '+' : '') + esc(gs.height_change) + ' ซม.') + '</div>' : '') +
        (d.growth && d.growth.length > 1 ? '<div class="mt-2" style="font-size:.8rem;color:var(--muted)">' + d.growth.slice(0, 6).map(function (g) {
          return '<span class="chip" style="margin:2px;display:inline-block">' + esc(monthLabel(g.month)) + ': ' + (g.weight_kg === null || g.weight_kg === undefined ? '-' : esc(g.weight_kg) + ' กก.') + ' / ' + (g.height_cm === null || g.height_cm === undefined ? '-' : esc(g.height_cm) + ' ซม.') + '</span>';
        }).join('') + '</div>' : '')
      : '<div style="font-size:.85rem;color:var(--muted)">ยังไม่มีบันทึกน้ำหนักส่วนสูงรายเดือน</div>';
    var growth = card('การเจริญเติบโต', growthBody);
    var dev = d.development.length
      ? card('ผลประเมินพัฒนาการ', d.development.map(function (p) {
          return '<div style="margin-bottom:10px"><div style="font-weight:600;font-size:.88rem">' +
            esc(p.period) + ' · ภาพรวม ' + p.overall.toFixed(2) + ' / 4</div>' +
            p.domains.filter(function (x) { return x.count; }).map(function (x) {
              return '<div class="kv"><div class="kv-k" style="min-width:150px;font-size:.82rem">' +
                esc(x.domain) + '</div><div>' + x.avg.toFixed(1) + '</div></div>';
            }).join('') + '</div>';
        }).join(''))
      : '';

    $b.html(growth + (d.health.length
      ? card('บันทึกสุขภาพ', d.health.map(function (h) {
          var tone = h.severity === 'ฉุกเฉิน' ? 'pill-danger' : (h.severity === 'ต้องติดตาม' ? 'pill-warn' : 'pill-info');
          return '<div style="padding:9px 0;border-bottom:1px solid #F2F5F3">' +
            '<span class="pill ' + tone + '">' + esc(h.severity) + '</span> ' +
            '<b>' + esc(h.type) + '</b>' +
            '<div style="font-size:.78rem;color:var(--muted);margin-top:3px">' + fmtDate(h.occurred_at) + '</div>' +
            (h.symptom ? '<div style="font-size:.85rem;margin-top:3px">' + esc(h.symptom) + '</div>' : '') +
            (h.action ? '<div style="font-size:.82rem;color:var(--muted);margin-top:3px">การดูแล: ' + esc(h.action) + '</div>' : '') +
            '</div>';
        }).join(''))
      : card('บันทึกสุขภาพ', '<div style="font-size:.85rem;color:var(--muted)">ไม่มีบันทึกการเจ็บป่วยหรืออุบัติเหตุ</div>')) + dev);
    return;
  }

  if (APP.tab === 'photos') {
    $b.html(d.photos.length
      ? card('ภาพกิจกรรม', '<div class="photos">' + d.photos.map(function (p) {
          return '<div><img src="' + esc(p.url) + '">' +
            (p.caption ? '<div style="font-size:.72rem;color:var(--muted);margin-top:3px">' + esc(p.caption) + '</div>' : '') +
            '</div>';
        }).join('') + '</div>')
      : empty('bi-images', 'ยังไม่มีภาพ', 'ภาพกิจกรรมที่มีบุตรหลานของคุณจะแสดงที่นี่'));
    return;
  }

  if (APP.tab === 'more') {
    var pk = d.pickups.length
      ? d.pickups.map(function (p) {
          return '<div class="kv"><div class="kv-k">' + esc(p.name) + '</div>' +
            '<div>' + esc(p.relation || '-') + ' <span class="pill ' +
            (p.status === 'อนุญาต' ? 'pill-ok' : 'pill-warn') + '">' + esc(p.status) + '</span></div></div>';
        }).join('')
      : '<div style="font-size:.85rem;color:var(--muted)">ยังไม่มีรายชื่อผู้รับเด็ก</div>';

    $b.html(
      card('แจ้งลา',
        '<label class="form-label" style="font-size:.85rem">วันที่ลา</label>' +
        '<input type="date" class="form-control mb-2" id="lvDate" value="' + todayStr() + '">' +
        '<label class="form-label" style="font-size:.85rem">เหตุผล</label>' +
        '<input type="text" class="form-control mb-3" id="lvReason" placeholder="เช่น ไม่สบาย มีธุระ">' +
        '<button class="btn btn-primary w-100" id="lvGo">ส่งแจ้งลา</button>') +
      card('ผู้มีสิทธิ์รับเด็ก', pk) +
      card('ติดต่อศูนย์',
        '<div class="kv"><div class="kv-k">ศูนย์</div><div>' + esc(d.center.name) + '</div></div>' +
        (d.center.phone ? '<div class="kv"><div class="kv-k">โทรศัพท์</div>' +
          '<div><a href="tel:' + esc(d.center.phone) + '">' + esc(d.center.phone) + '</a></div></div>' : '') +
        (d.guardian.line_linked ? '<div class="kv"><div class="kv-k">การแจ้งเตือน</div>' +
          '<div><span class="pill pill-ok">ผูกบัญชี LINE แล้ว</span></div></div>' : '')) +
      card('วิธีใช้งาน', '<div style="font-size:.85rem;color:var(--muted)">เปิดหน้านี้จาก LINE เพื่อดูข้อมูลที่ศูนย์เปิดให้ · การลาแจ้งได้ทันทีโดยไม่ต้องรออนุมัติ · การเพิ่มผู้รับเด็กจะรอเจ้าหน้าที่ตรวจสอบ · หากเน็ตหลุด ระบบจะแสดงข้อมูลล่าสุดที่โหลดไว้และจะส่งรายการใหม่เมื่อกลับมาออนไลน์</div>'));

    $('#lvGo').on('click', function () {
      var reason = $('#lvReason').val();
      if (!reason) { toast('กรุณากรอกเหตุผลการลา'); return; }
      var $btn = $(this).prop('disabled', true).text('กำลังส่ง…');
      api('apiParentLeave', [APP.token, { date: $('#lvDate').val(), reason: reason }])
        .then(function (r) { toast(r.message); load(); })
        .catch(function (e) { $btn.prop('disabled', false).text('ส่งแจ้งลา'); toast(e.message); });
    });
    return;
  }
}

