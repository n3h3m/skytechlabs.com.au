/* SkyTech Labs booking widget: a native, site-styled booking form over the scheduling API.
   No iframe, no third-party script, no cookies (credentials:'omit'). Availability always comes from the API. */
(function () {
  'use strict';
  var root = document.querySelector('[data-booker]');
  if (!root) return;
  var API = 'https://api.cal.com/v2', USER = root.getAttribute('data-user'), EVENT = root.getAttribute('data-event'),
      FALLBACK = root.getAttribute('data-fallback'), LEN = +root.getAttribute('data-length') || 20, SYD = 'Australia/Sydney';
  var PHONE = '0430 063 080', PHONE_HREF = 'tel:+61430063080', MAIL = 'nehem@skytechlabs.com.au';
  function q(s, el) { return (el || root).querySelector(s); }
  var tzSel = q('[data-tz]'), tzNote = q('[data-tznote]'), daysEl = q('[data-days]'), timesEl = q('[data-times]'),
      dayHead = q('[data-dayhead]'), pickEl = q('[data-pick]'), form = q('[data-bk-form]'), doneEl = q('[data-done]'),
      msgEl = q('[data-bk-msg]'), sumEl = q('[data-summary]'), live = q('[data-live]');
  var tz = SYD, slots = {}, days = [], day = null, chosen = null, sending = false, shownAt = 0, loadedAll = false;
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || SYD; } catch (e) {}

  function track(n, p) { if (window.skyTrack) window.skyTrack(n, p || {}); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function f(d, o, z) { return new Intl.DateTimeFormat('en-AU', Object.assign({ timeZone: z || tz }, o)).format(d); }
  function key(d) { return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); }
  function time(d, z) { return f(d, { hour: 'numeric', minute: '2-digit', hour12: true }, z).replace(/\s?([ap])\.?m\.?/i, function (m, a) { return a.toLowerCase() + 'm'; }); }
  function city(z) { return (z.split('/').pop() || z).replace(/_/g, ' '); }
  function abbr(z) { try { return f(new Date(), { timeZoneName: 'short' }, z).split(' ').pop(); } catch (e) { return ''; } }
  function say(t) { live.textContent = ''; setTimeout(function () { live.textContent = t; }, 30); }
  function isSyd() { return tz === SYD || tz === 'Australia/Melbourne' || tz === 'Australia/Hobart' || tz === 'Australia/Canberra' || tz === 'Australia/ACT' || tz === 'Australia/NSW'; }

  /* ---- time zone picker: short list first, every zone added on first use ---- */
  var SHORT = [SYD, 'Australia/Melbourne', 'Australia/Brisbane', 'Australia/Adelaide', 'Australia/Darwin', 'Australia/Perth', 'Australia/Hobart', 'Pacific/Auckland'];
  function opt(z) { var o = document.createElement('option'); o.value = z; o.textContent = city(z) + ' (' + abbr(z) + ')'; return o; }
  function fillTz(all) {
    tzSel.innerHTML = '';
    var seen = {}, list = [tz].concat(SHORT);
    list.forEach(function (z) { if (!seen[z]) { seen[z] = 1; tzSel.appendChild(opt(z)); } });
    if (all && Intl.supportedValuesOf) {
      var g = document.createElement('optgroup'); g.label = 'All time zones';
      Intl.supportedValuesOf('timeZone').forEach(function (z) { if (!seen[z]) g.appendChild(opt(z)); });
      tzSel.appendChild(g); loadedAll = true;
    }
    tzSel.value = tz;
  }
  function tzText() {
    tzNote.textContent = isSyd() ? 'Same as Sydney time.' : 'Nehem is in Sydney (' + abbr(SYD) + '). Times below are in your time zone.';
  }
  tzSel.disabled = false; fillTz(false); tzText();
  ['focus', 'pointerdown', 'keydown'].forEach(function (ev) { tzSel.addEventListener(ev, function () { if (!loadedAll) fillTz(true); }); });
  tzSel.addEventListener('change', function () { tz = tzSel.value; tzText(); load(chosen ? null : 'tz'); });

  /* ---- slots ---- */
  function load(why) {
    msgEl.hidden = true; root.classList.add('bk-loading');
    var now = new Date(), end = new Date(now.getTime() + 9 * 864e5);
    var url = API + '/slots?eventTypeSlug=' + encodeURIComponent(EVENT) + '&username=' + encodeURIComponent(USER) +
      '&start=' + encodeURIComponent(now.toISOString()) + '&end=' + encodeURIComponent(end.toISOString()) + '&timeZone=' + encodeURIComponent(tz);
    return fetch(url, { headers: { 'cal-api-version': '2024-09-04' }, credentials: 'omit', referrerPolicy: 'strict-origin-when-cross-origin' })
      .then(function (r) { if (!r.ok) throw new Error('slots ' + r.status); return r.json(); })
      .then(function (j) {
        if (!j || j.status !== 'success' || typeof j.data !== 'object') throw new Error('bad slots');
        slots = {};
        Object.keys(j.data).forEach(function (k) {
          var list = (j.data[k] || []).map(function (s) { return new Date(s.start); }).filter(function (d) { return !isNaN(d) && d > now; });
          list.forEach(function (d) { var kk = key(d); (slots[kk] = slots[kk] || []).push(d); });
        });
        Object.keys(slots).forEach(function (k) { slots[k].sort(function (a, b) { return a - b; }); });
        root.classList.remove('bk-loading'); root.classList.add('bk-ready');
        renderDays(why);
      })
      .catch(function () { root.classList.remove('bk-loading'); fail(); });
  }
  function renderDays(why) {
    var start = new Date(), keys = Object.keys(slots).sort(), last = keys[keys.length - 1];
    days = [];
    for (var i = 0; i < 9; i++) {
      var d = new Date(start.getTime() + i * 864e5), k = key(d);
      if (days.length && days[days.length - 1].k === k) continue;
      if (i >= 7 && (!last || k > last)) break;
      days.push({ k: k, d: d });
    }
    var any = keys.length > 0;
    setTimeout(function () { document.dispatchEvent(new Event('bk:rendered')); }, 0);
    daysEl.innerHTML = days.map(function (o) {
      var n = (slots[o.k] || []).length, label = f(o.d, { weekday: 'long', day: 'numeric', month: 'long' });
      return '<li><button type="button" class="bk-day" data-k="' + o.k + '"' + (n ? '' : ' disabled') + ' aria-pressed="false" aria-label="' +
        esc(label + (n ? ', ' + n + (n > 1 ? ' times' : ' time') + ' free' : ', no times')) + '"><span class="bk-dw">' + esc(f(o.d, { weekday: 'short' })) +
        '</span><span class="bk-dn">' + esc(f(o.d, { day: 'numeric' })) + '</span><span class="bk-dm">' + (n ? esc(f(o.d, { month: 'short' })) : 'Full') + '</span></button></li>';
    }).join('');
    if (!any) { empty(); return; }
    var keep = day && slots[day] ? day : keys[0];
    pickDay(keep, false);
    if (why === 'taken') say('That time was just taken. The times have been refreshed.');
  }
  function pickDay(k, focus) {
    day = k;
    Array.prototype.forEach.call(daysEl.querySelectorAll('.bk-day'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-k') === k ? 'true' : 'false'); });
    var list = slots[k] || [], d0 = list[0];
    dayHead.textContent = d0 ? f(d0, { weekday: 'long', day: 'numeric', month: 'long' }) : '';
    timesEl.innerHTML = list.map(function (d, i) {
      var t = time(d), extra = isSyd() ? '' : '<small>' + esc(time(d, SYD)) + ' Sydney</small>';
      return '<li><button type="button" class="bk-time" data-i="' + i + '" aria-label="' + esc(t + (isSyd() ? '' : ' your time, ' + time(d, SYD) + ' Sydney time')) + '">' + esc(t) + extra + '</button></li>';
    }).join('');
    if (focus) say(list.length + ' times on ' + dayHead.textContent);
  }
  daysEl.addEventListener('click', function (e) { var b = e.target.closest('.bk-day'); if (b && !b.disabled) pickDay(b.getAttribute('data-k'), true); });
  daysEl.addEventListener('keydown', function (e) {
    var b = e.target.closest('.bk-day'); if (!b || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
    var all = Array.prototype.slice.call(daysEl.querySelectorAll('.bk-day:not([disabled])')), i = all.indexOf(b) + (e.key === 'ArrowRight' ? 1 : -1);
    if (all[i]) { e.preventDefault(); all[i].focus(); }
  });
  timesEl.addEventListener('click', function (e) { var b = e.target.closest('.bk-time'); if (b) choose(slots[day][+b.getAttribute('data-i')]); });

  function when(d) {
    var s = f(d, { weekday: 'long', day: 'numeric', month: 'long' }) + ', ' + time(d) + '\u2013' + time(new Date(d.getTime() + LEN * 6e4));
    return s + (isSyd() ? ' (Sydney time)' : ' (' + city(tz) + ' time, ' + time(d, SYD) + ' in Sydney)');
  }
  function choose(d) {
    chosen = d; pickEl.hidden = true; form.hidden = false; doneEl.hidden = true; shownAt = Date.now();
    sumEl.textContent = when(d);
    track('booking_start', { calendar: 'booking' });
    var h = q('[data-formhead]'); h.focus({ preventScroll: true });
    var r = root.getBoundingClientRect(); if (r.top < 0 || r.top > innerHeight * 0.6) root.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  q('[data-change]').addEventListener('click', function () { back(); });
  function back(why) {
    chosen = null; form.hidden = true; pickEl.hidden = false; setErr('');
    if (why) load(why); else { var b = daysEl.querySelector('[aria-pressed="true"]'); if (b) b.focus(); }
  }

  /* ---- states ---- */
  function showMsg(html) { msgEl.innerHTML = html; msgEl.hidden = false; }
  function empty() {
    timesEl.innerHTML = ''; dayHead.textContent = '';
    showMsg('<p><strong>No free times in the next 7 days.</strong> Call <a href="' + PHONE_HREF + '">' + PHONE + '</a> or email <a href="mailto:' + MAIL + '">' + MAIL + '</a> and Nehem will find a time that suits you.</p>');
  }
  function fail() {
    root.classList.add('bk-ready');
    daysEl.innerHTML = ''; timesEl.innerHTML = ''; dayHead.textContent = '';
    showMsg('<p><strong>The calendar didn\'t load.</strong> <a href="' + FALLBACK + '" target="_blank" rel="noopener">Open the booking page</a>, or call <a href="' + PHONE_HREF + '">' + PHONE +
      '</a>.</p><p><button type="button" class="bk-retry" data-retry>Try again</button></p>');
    var r = q('[data-retry]'); if (r) r.addEventListener('click', function () { load(); });
  }

  /* ---- booking form ---- */
  function field(n) { return form.querySelector('[name="' + n + '"]'); }
  function setErr(t) { var e = q('[data-formerr]'); e.innerHTML = t; e.hidden = !t; }
  function phoneIntl(v) {
    var p = v.replace(/[\s().-]/g, '');
    if (/^\+\d{8,15}$/.test(p)) return p;
    if (/^0\d{9}$/.test(p)) return '+61' + p.slice(1);
    if (/^61\d{9}$/.test(p)) return '+' + p;
    return '';
  }
  function bad(n, msg) {
    var el = field(n), er = form.querySelector('#bk-' + n + '-err');
    if (el) el.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (er) er.textContent = msg || '';
    return !!msg;
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (sending || !chosen) return;
    var name = field('name').value.trim(), email = field('email').value.trim(), phone = field('phone').value.trim(),
        biz = field('company').value.trim(), notes = field('notes').value.trim(), errs = [];
    if (bad('name', name.length < 2 ? 'Please add your name.' : '')) errs.push('name');
    if (bad('email', /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? '' : 'Please check your email address.')) errs.push('email');
    var ph = phoneIntl(phone);
    if (bad('phone', ph ? '' : 'Please add a mobile number Nehem can call, like 0412 345 678.')) errs.push('phone');
    if (errs.length) { field(errs[0]).focus(); return; }
    // spam: honeypot or a form filled faster than a person can
    if (field('website').value || Date.now() - shownAt < 1500) { booked({ start: chosen.toISOString() }, email, ph, true); return; }
    sending = true; form.classList.add('is-sending'); setErr('');
    var btn = form.querySelector('[type=submit]'); btn.disabled = true; btn.firstChild.nodeValue = 'Booking\u2026 ';
    var body = {
      start: chosen.toISOString(), eventTypeSlug: EVENT, username: USER,
      attendee: { name: name, email: email, timeZone: tz, language: 'en', phoneNumber: ph },
      location: { type: 'attendeePhone', phone: ph },
      bookingFieldsResponses: {},
      metadata: { source: 'skytechlabs.com.au', page: location.pathname.slice(0, 200) }
    };
    if (biz) body.bookingFieldsResponses['Business-name'] = biz.slice(0, 120);
    if (notes) body.bookingFieldsResponses.notes = notes.slice(0, 1500);
    fetch(API + '/bookings', { method: 'POST', credentials: 'omit', headers: { 'cal-api-version': '2024-08-13', 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { s: r.status, j: j }; }); })
      .then(function (res) {
        sending = false; form.classList.remove('is-sending'); btn.disabled = false; btn.firstChild.nodeValue = 'Book my call ';
        if ((res.s === 200 || res.s === 201) && res.j && res.j.status === 'success') { booked(res.j.data || {}, email, ph, false); return; }
        if (res.s === 409) { back('taken'); showMsg('<p><strong>Sorry, that time was just taken.</strong> Here are the latest free times.</p>'); msgEl.focus({ preventScroll: true }); var rt = root.getBoundingClientRect(); if (rt.top < 0) root.scrollIntoView({ block: 'start', behavior: 'smooth' }); return; }
        var m = (res.j && res.j.error && res.j.error.message) || '';
        setErr('<strong>That didn\'t go through.</strong> ' + (res.s === 400 && m ? esc(m) + '. ' : '') + 'Please try again, call <a href="' + PHONE_HREF + '">' + PHONE +
          '</a>, or <a href="' + FALLBACK + '" target="_blank" rel="noopener">open the booking page</a>.');
      })
      .catch(function () {
        sending = false; form.classList.remove('is-sending'); btn.disabled = false; btn.firstChild.nodeValue = 'Book my call ';
        setErr('<strong>We couldn\'t reach the calendar.</strong> Check your connection and try again, call <a href="' + PHONE_HREF + '">' + PHONE +
          '</a>, or <a href="' + FALLBACK + '" target="_blank" rel="noopener">open the booking page</a>.');
      });
  });

  function ics(start, end, title) {
    function z(d) { return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
    return 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//SkyTech Labs//Booking//EN\r\nBEGIN:VEVENT\r\nUID:' + z(start) + '-skytechlabs\r\nDTSTAMP:' + z(new Date()) +
      '\r\nDTSTART:' + z(start) + '\r\nDTEND:' + z(end) + '\r\nSUMMARY:' + title + '\r\nDESCRIPTION:Nehem from SkyTech Labs will call you.\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n';
  }
  function booked(data, email, ph, quiet) {
    var start = new Date(data.start || chosen), end = new Date(start.getTime() + LEN * 6e4), title = 'Free 20-minute call with SkyTech Labs';
    function z(d) { return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
    var g = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(title) + '&dates=' + z(start) + '/' + z(end) +
      '&details=' + encodeURIComponent('Nehem from SkyTech Labs will call you on ' + ph + '.');
    var blob = URL.createObjectURL(new Blob([ics(start, end, title)], { type: 'text/calendar' }));
    form.hidden = true; pickEl.hidden = true; msgEl.hidden = true; doneEl.hidden = false;
    q('[data-done-when]').textContent = when(start);
    q('[data-done-email]').textContent = email;
    q('[data-done-phone]').textContent = ph;
    q('[data-gcal]').href = g; var ic = q('[data-ics]'); ic.href = blob;
    q('[data-done-h]').focus();
    if (!quiet) track('booking_complete', { calendar: 'booking' });
  }

  /* ---- start: fetch once the page has loaded (never competes with the first paint) ---- */
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) { if (es.some(function (x) { return x.isIntersecting; })) { track('calendar_view', { calendar: 'booking' }); io.disconnect(); } });
    io.observe(root);
  }
  function go() { load(); }
  if (document.readyState === 'complete') go(); else window.addEventListener('load', go);
})();
