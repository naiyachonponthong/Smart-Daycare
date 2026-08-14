/* ============================================================
   หน้าสำหรับผู้ปกครองบน LINE (LIFF)
   โฮสต์เป็นไฟล์ static เช่น GitHub Pages แล้วเรียก Apps Script เป็น API
   ============================================================ */

var APP = { token: null, data: null, tab: 'today' };

/* ---------- เรียก API ---------- */
/* ส่งเป็น text/plain เพื่อเลี่ยง preflight ที่ Apps Script ตอบไม่ได้ */
function api(fn, args) {
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

/* ---------- เริ่มทำงาน ---------- */
$(function () {
  if (!SD_CONFIG.API_URL || SD_CONFIG.API_URL.indexOf('http') !== 0) {
    fatal('ยังไม่ได้ตั้งค่า API_URL ในไฟล์ config.js');
    return;
  }

  var urlToken = new URLSearchParams(location.search).get('t');

  liff.init({ liffId: SD_CONFIG.LIFF_ID })
    .then(function () {
      if (!liff.isLoggedIn()) { liff.login(); return; }
      var idToken = liff.getIDToken();

      if (urlToken) {
        // เปิดครั้งแรกจากลิงก์ที่ศูนย์ส่งให้ ผูกบัญชี LINE ไว้เลย
        APP.token = urlToken;
        return api('apiParentBindLine', [urlToken, idToken])
          .catch(function () { /* ผูกไม่สำเร็จก็ยังดูข้อมูลได้ */ })
          .then(load);
      }

      return api('apiParentLineLogin', [idToken]).then(function (res) {
        var kids = res.data.children || [];
        if (!kids.length) {
          fatal('บัญชี LINE นี้ยังไม่ได้ผูกกับข้อมูลเด็ก กรุณาเปิดลิงก์ที่ได้รับจากศูนย์');
          return;
        }
        if (kids.length === 1) { APP.token = kids[0].portal_token; load(); return; }
        pickChild(kids);
      });
    })
    .catch(function (err) {
      // เปิดนอก LINE ยังใช้ลิงก์ส่วนตัวได้
      if (urlToken) { APP.token = urlToken; load(); return; }
      fatal('เชื่อมต่อ LINE ไม่สำเร็จ: ' + err.message);
    });
});

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
    render();
  }).catch(function (e) { fatal(e.message); });
}

function render() {
  var d = APP.data, c = d.child;

  var status = d.today.status
    ? '<span class="pill ' + attTone(d.today.status) + '">' + esc(d.today.status) + '</span>'
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
    (d.today.check_in ? ' <span style="font-size:.8rem">เข้า ' + esc(d.today.check_in) + '</span>' : '') +
    (d.today.check_out ? ' <span style="font-size:.8rem">กลับ ' + esc(d.today.check_out) + '</span>' : '') +
    '</div></div></div></div>';

  var tabs = [
    ['today', 'bi-house', 'วันนี้'],
    ['daily', 'bi-clipboard-check', 'กิจวัตร'],
    ['health', 'bi-heart-pulse', 'สุขภาพ'],
    ['photos', 'bi-images', 'ภาพ'],
    ['more', 'bi-three-dots', 'เพิ่มเติม']
  ];

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

    var meals = d.meals.length
      ? d.meals.map(function (m) {
          return '<div class="kv"><div class="kv-k">' + esc(m.meal_type) + '</div>' +
            '<div>' + esc(m.menu) + '</div></div>';
        }).join('')
      : '<div style="font-size:.85rem;color:var(--muted)">ยังไม่มีข้อมูลเมนูของวันนี้</div>';

    var recent = d.attendance.slice(0, 7).map(function (a) {
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
          '<div><span class="pill pill-ok">ผูกบัญชี LINE แล้ว</span></div></div>' : '')));

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
