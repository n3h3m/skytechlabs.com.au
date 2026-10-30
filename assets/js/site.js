/* SkyTech Labs: progressive enhancement. The site works without JavaScript. */
(function () {
  'use strict';
  document.documentElement.classList.add('js');
  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }

  ready(function () {
    /* "#book" links: move focus to the booking section after scrolling (keyboard + screen readers) */
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href="#book"]');
      if (!a) return;
      var t = document.getElementById('book');
      if (!t) return;
      e.preventDefault();
      t.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      history.replaceState(null, '', '#book');
      setTimeout(function () { var f = t.querySelector('[data-chips] .chip, input, textarea'); (f || t).focus({ preventScroll: true }); }, 450);
    });
    var form = document.querySelector('[data-enquiry]');
    if (form) enquiry(form);
    var list = document.querySelector('[data-checklist]');
    if (list) checklist(list);
  });

  var EMAIL_RE = /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
  var PHONE_RE = /^\+?[0-9 ()-]{8,20}$/;

  function enquiry(form) {
    var status = form.querySelector('[data-status]');
    var btn = form.querySelector('[data-submit]');
    var details = form.querySelector('[data-details]');
    form.querySelector('[data-ts]').value = String(Date.now());
    form.querySelector('[data-page]').value = location.pathname;

    /* Topic chips: toggled buttons, sent as "details" */
    var chips = Array.prototype.slice.call(form.querySelectorAll('[data-chip]'));
    function syncChips() {
      var on = chips.filter(function (c) { return c.getAttribute('aria-pressed') === 'true'; }).map(function (c) { return c.getAttribute('data-chip'); });
      var box = form.querySelector('[data-chips]'), pre = (box && box.getAttribute('data-prefix')) || 'Time-eaters';
      details.value = on.length ? pre + ': ' + on.join(', ') : '';
    }
    chips.forEach(function (c) {
      c.addEventListener('click', function () { c.setAttribute('aria-pressed', String(c.getAttribute('aria-pressed') !== 'true')); syncChips(); });
    });

    /* Button label follows the chosen intent */
    function label() {
      var email = form.querySelector('input[name="intent"][value="email"]').checked;
      btn.innerHTML = (email ? 'Send my question' : 'Request a call-back') + ' <span aria-hidden="true">→</span>';
    }
    form.querySelectorAll('input[name="intent"]').forEach(function (r) { r.addEventListener('change', label); });
    var params = new URLSearchParams(location.search);
    var intent = params.get('intent');
    if (intent === 'call' || intent === 'email') {
      var r = form.querySelector('input[name="intent"][value="' + intent + '"]');
      if (r) r.checked = true;
    }
    label();
    if (params.get('error') === 'validation') showStatus('err', '<strong>Some details were missing.</strong><p>Please check the form and try again.</p>');

    var rules = {
      automate: function (v) { return v.trim().length >= 10 ? '' : 'Tell us a little about it (at least 10 characters).'; },
      name: function (v) { return v.trim().length >= 2 ? '' : 'Please enter your name.'; },
      company: function (v) { return v.trim().length >= 2 ? '' : 'Please enter your business name.'; },
      phone: function (v) { v = v.trim(); return PHONE_RE.test(v) && v.replace(/\D/g, '').length >= 8 ? '' : 'Please enter a valid phone number.'; },
      email: function (v) { return EMAIL_RE.test(v.trim()) ? '' : 'Please enter a valid email address.'; },
      consent: function (v, el) { return el.checked ? '' : 'Please tick the box so we can reply to you.'; }
    };
    function setErr(name, msg) {
      var el = form.elements[name], out = document.getElementById('f-' + name + '-err');
      if (el) el.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (out) out.textContent = msg || '';
    }
    function check(name) { var el = form.elements[name]; var msg = rules[name](el.value || '', el); setErr(name, msg); return msg; }
    Object.keys(rules).forEach(function (name) {
      var el = form.elements[name];
      el.addEventListener('blur', function () { if (el.value || el.type === 'checkbox') check(name); });
      el.addEventListener('input', function () { if (el.getAttribute('aria-invalid') === 'true') check(name); });
      el.addEventListener('change', function () { if (el.getAttribute('aria-invalid') === 'true') check(name); });
    });
    function showStatus(kind, html) { status.className = 'form-status ' + kind; status.innerHTML = html; }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var first = null;
      Object.keys(rules).forEach(function (n) { if (check(n) && !first) first = form.elements[n]; });
      if (first) { showStatus('err', '<strong>Please check the highlighted fields.</strong>'); first.focus(); return; }
      syncChips();
      var data = {};
      new FormData(form).forEach(function (v, k) { data[k] = v; });
      data.consent = form.elements.consent.checked ? 'yes' : '';
      var btnHtml = btn.innerHTML;
      btn.disabled = true; btn.textContent = 'Sending…';
      showStatus('', '');
      fetch(form.action, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(data), credentials: 'omit', mode: 'cors'
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (j) { return { status: res.status, body: j }; });
      }).then(function (r) {
        if (r.status === 200 && r.body && r.body.ok) {
          form.classList.add('form-done');
          showStatus('ok', '<strong>Thanks, ' + esc(data.name.trim().split(' ')[0]) + '. Got it.</strong>' +
            '<p>' + (data.intent === 'email' ? 'Nehem will reply by email.' : 'Nehem will ring you to lock in your free 20-minute call.') +
            ' Your reference is <strong>' + esc(r.body.ref) + '</strong>.</p>');
          status.focus();
        } else if (r.status === 422 && r.body && r.body.fields) {
          var f = null;
          Object.keys(r.body.fields).forEach(function (n) { setErr(n, r.body.fields[n]); if (!f && form.elements[n]) f = form.elements[n]; });
          showStatus('err', '<strong>Please check the highlighted fields.</strong>');
          if (f) f.focus();
        } else if (r.status === 429) {
          showStatus('err', '<strong>Too many enquiries from this connection.</strong><p>Please call <a href="tel:+61430063080">0430 063 080</a> or email <a href="mailto:nehem@skytechlabs.com.au">nehem@skytechlabs.com.au</a>.</p>');
        } else { throw new Error('bad status'); }
      }).catch(function () {
        showStatus('err', '<strong>Sorry, that didn\'t send.</strong><p>Please try again, or call <a href="tel:+61430063080">0430 063 080</a> or email <a href="mailto:nehem@skytechlabs.com.au">nehem@skytechlabs.com.au</a>.</p>');
      }).then(function () { btn.disabled = false; if (btn.textContent === 'Sending…') btn.innerHTML = btnHtml; });
    });
  }
  /* Trade-page self-check: counts ticks locally, nothing is sent anywhere */
  function checklist(f) {
    var boxes = Array.prototype.slice.call(f.querySelectorAll('[data-check]'));
    var out = document.querySelector('[data-score]');
    f.addEventListener('submit', function (e) { e.preventDefault(); });
    function update() {
      var n = boxes.filter(function (b) { return b.checked; }).length, gaps = boxes.length - n;
      out.hidden = false;
      out.innerHTML = '<strong>' + n + ' of ' + boxes.length + ' handled.</strong> ' + (gaps === 0
        ? 'Nicely done. A quick call can still check nothing is slipping through.'
        : gaps + (gaps === 1 ? ' gap' : ' gaps') + ' worth a look. Those are exactly what the free admin check is for.');
    }
    boxes.forEach(function (b) { b.addEventListener('change', update); });
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
})();

// Load the Cal.com calendar only when it is about to scroll into view (and never when hidden on phones)
(function(){var f=document.querySelectorAll('iframe[data-src]');if(!f.length)return;
function go(el){if(!el.src)el.src=el.getAttribute('data-src');}
if(!('IntersectionObserver' in window)){f.forEach(go);return;}
var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){go(e.target);io.unobserve(e.target);}});},{rootMargin:'300px 0px'});
f.forEach(function(el){io.observe(el);});})();

// Mobile sticky bar: appears after one swipe (30% of the screen height scrolled),
// tucked away while the booking section or the final CTA is on screen so it never overlaps them.
(function(){var bar=document.querySelector('.mobile-bar');if(!bar)return;
var hide=[document.getElementById('book'),document.querySelector('.final')].filter(Boolean);
var ticking=false,shown=false;
function onScreen(el){var r=el.getBoundingClientRect();return r.bottom>0&&r.top<window.innerHeight;}
function update(){ticking=false;
  var want=window.scrollY>=window.innerHeight*0.3&&!hide.some(onScreen);
  if(want!==shown){shown=want;bar.classList.toggle('is-shown',want);}}
function req(){if(!ticking){ticking=true;requestAnimationFrame(update);}}
window.addEventListener('scroll',req,{passive:true});window.addEventListener('resize',req,{passive:true});req();})();
