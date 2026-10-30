/* SkyTech Labs — progressive enhancement. The site works without JavaScript. */
(function () {
  'use strict';
  var doc = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  doc.classList.add('js');

  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }

  ready(function () {
    /* Header shadow on scroll */
    var header = document.querySelector('[data-header]');
    if (header) {
      var onScroll = function () { header.classList.toggle('scrolled', window.scrollY > 8); };
      onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
    }

    /* Mobile navigation */
    var toggle = document.querySelector('[data-nav-toggle]');
    var menu = document.querySelector('[data-nav-menu]');
    if (toggle && menu) {
      var setOpen = function (open) {
        toggle.setAttribute('aria-expanded', String(open));
        menu.classList.toggle('open', open);
        document.body.style.overflow = open ? 'hidden' : '';
      };
      toggle.addEventListener('click', function () { setOpen(toggle.getAttribute('aria-expanded') !== 'true'); });
      menu.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { setOpen(false); toggle.focus(); }
      });
      window.matchMedia('(min-width: 981px)').addEventListener('change', function (m) { if (m.matches) setOpen(false); });
    }

    /* Mark current page in nav */
    document.querySelectorAll('.nav-links a').forEach(function (a) {
      if (a.getAttribute('href') === location.pathname) a.setAttribute('aria-current', 'page');
    });

    /* Reveal on scroll */
    var reveals = document.querySelectorAll('.reveal');
    if (!reduce && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
      reveals.forEach(function (el, i) { el.style.transitionDelay = (i % 4) * 60 + 'ms'; io.observe(el); });
    } else {
      reveals.forEach(function (el) { el.classList.add('in'); });
    }

    /* Hero SVG: pause SMIL when off-screen or when reduced motion is requested */
    var svg = document.querySelector('.hero-svg');
    if (svg && svg.pauseAnimations) {
      if (reduce) svg.pauseAnimations();
      else if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (en) { en[0].isIntersecting ? svg.unpauseAnimations() : svg.pauseAnimations(); }).observe(svg);
      }
    }

    /* Hero example-workflow ticker */
    var log = document.querySelector('[data-hero-log]');
    if (log && !reduce) {
      var items = log.querySelectorAll('li'), step = 0;
      var tick = function () {
        items.forEach(function (li, i) { li.classList.toggle('on', i <= step); });
        step = (step + 1) % (items.length + 1);
      };
      tick(); setInterval(tick, 1500);
    }

    /* Accessible tabs (How it works + Automation workflows) */
    document.querySelectorAll('[role="tablist"]').forEach(function (list) {
      var tabs = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'));
      var progress = list.querySelector('[data-progress]');
      var vertical = list.getAttribute('aria-orientation') === 'vertical';
      function select(tab, focus) {
        tabs.forEach(function (t) {
          var on = t === tab;
          t.setAttribute('aria-selected', String(on));
          t.tabIndex = on ? 0 : -1;
          var panel = document.getElementById(t.getAttribute('aria-controls'));
          if (panel) panel.hidden = !on;
        });
        if (progress) progress.style.width = ((tabs.indexOf(tab) + 1) / tabs.length * 100) + '%';
        if (focus) tab.focus();
      }
      tabs.forEach(function (tab, i) {
        tab.addEventListener('click', function () { select(tab, false); });
        tab.addEventListener('keydown', function (e) {
          var k = e.key, n = null;
          if (k === 'ArrowRight' || (vertical && k === 'ArrowDown')) n = tabs[(i + 1) % tabs.length];
          else if (k === 'ArrowLeft' || (vertical && k === 'ArrowUp')) n = tabs[(i - 1 + tabs.length) % tabs.length];
          else if (k === 'Home') n = tabs[0];
          else if (k === 'End') n = tabs[tabs.length - 1];
          if (n) { e.preventDefault(); select(n, true); }
        });
      });
    });

    /* Enquiry form */
    var form = document.querySelector('[data-enquiry]');
    if (form) enquiry(form);
  });

  var EMAIL_RE = /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
  var PHONE_RE = /^\+?[0-9 ()-]{8,20}$/;

  function enquiry(form) {
    var status = form.querySelector('[data-status]');
    var btn = form.querySelector('[data-submit]');
    var btnHtml = btn.innerHTML;
    form.querySelector('[data-ts]').value = String(Date.now());
    form.querySelector('[data-page]').value = location.pathname;
    var params = new URLSearchParams(location.search);
    var intent = params.get('intent');
    if (intent === 'call' || intent === 'email') {
      var r = form.querySelector('input[name="intent"][value="' + intent + '"]');
      if (r) r.checked = true;
    }
    if (params.get('error') === 'validation') {
      showStatus('err', '<strong>Some details were missing.</strong><p>Please check the form and try again.</p>');
    }

    var rules = {
      name: function (v) { return v.trim().length >= 2 ? '' : 'Please enter your name.'; },
      company: function (v) { return v.trim().length >= 2 ? '' : 'Please enter your business name.'; },
      email: function (v) { return EMAIL_RE.test(v.trim()) ? '' : 'Please enter a valid business email address.'; },
      phone: function (v) { v = v.trim(); return PHONE_RE.test(v) && v.replace(/\D/g, '').length >= 8 ? '' : 'Please enter a valid phone number.'; },
      automate: function (v) { return v.trim().length >= 10 ? '' : 'Tell us a little about what you would like to automate (at least 10 characters).'; },
      consent: function (v, el) { return el.checked ? '' : 'Please confirm you agree to the Privacy Policy so we can respond.'; }
    };
    function setErr(name, msg) {
      var el = form.elements[name], out = document.getElementById('f-' + name + '-err');
      if (el) el.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (out) out.textContent = msg || '';
    }
    function check(name) {
      var el = form.elements[name];
      var msg = rules[name](el.value || '', el);
      setErr(name, msg); return msg;
    }
    Object.keys(rules).forEach(function (name) {
      var el = form.elements[name];
      el.addEventListener('blur', function () { if (el.value || el.type === 'checkbox') check(name); });
      el.addEventListener('input', function () { if (el.getAttribute('aria-invalid') === 'true') check(name); });
      el.addEventListener('change', function () { if (el.getAttribute('aria-invalid') === 'true') check(name); });
    });
    function showStatus(kind, html) {
      status.className = 'form-status ' + kind; status.innerHTML = html;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var first = null;
      Object.keys(rules).forEach(function (n) { if (check(n) && !first) first = form.elements[n]; });
      if (first) {
        showStatus('err', '<strong>Please check the highlighted fields.</strong>');
        first.focus(); return;
      }
      var data = {};
      new FormData(form).forEach(function (v, k) { data[k] = v; });
      data.consent = form.elements.consent.checked ? 'yes' : '';
      btn.disabled = true; btn.textContent = 'Sending…';
      showStatus('', '');
      fetch(form.action, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(data), credentials: 'omit', mode: 'cors'
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (j) { return { status: res.status, body: j }; });
      }).then(function (r) {
        if (r.status === 200 && r.body && r.body.ok) {
          relay(form, data, r.body.ref);
          form.classList.add('form-done');
          showStatus('ok', '<strong>Thank you, ' + esc(data.name.split(' ')[0]) + '. We\'ve received your enquiry.</strong>' +
            '<p>' + (data.intent === 'call' ? 'We\'ll be in touch to arrange your free AI strategy call.' : 'We\'ll reply by email.') +
            ' Your reference is <strong>' + esc(r.body.ref) + '</strong>.</p>');
          status.focus();
        } else if (r.status === 422 && r.body && r.body.fields) {
          var f = null;
          Object.keys(r.body.fields).forEach(function (n) { setErr(n, r.body.fields[n]); if (!f && form.elements[n]) f = form.elements[n]; });
          showStatus('err', '<strong>Please check the highlighted fields.</strong>');
          if (f) f.focus();
        } else if (r.status === 429) {
          showStatus('err', '<strong>Too many enquiries from this connection.</strong><p>Please try again later, or email <a href="mailto:hello@skytechlabs.com.au">hello@skytechlabs.com.au</a>.</p>');
        } else { throw new Error('bad status'); }
      }).catch(function () {
        showStatus('err', '<strong>Sorry, your enquiry couldn\'t be sent.</strong><p>Please try again, or contact us directly on <a href="tel:+61430063080">0430 063 080</a> or <a href="mailto:hello@skytechlabs.com.au">hello@skytechlabs.com.au</a>.</p>');
      }).then(function () { btn.disabled = false; btn.innerHTML = btnHtml; });
    });
  }

  /* Optional e-mail copy via Web3Forms (only when an access key is configured at build time). */
  function relay(form, d, ref) {
    var key = form.getAttribute('data-notify-key');
    if (!key) return;
    try {
      fetch('https://api.web3forms.com/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ access_key: key, subject: 'New website enquiry ' + ref + ' — ' + d.company, from_name: 'SkyTech Labs website',
          replyto: d.email, Reference: ref, Name: d.name, 'Business name': d.company, Email: d.email, Phone: d.phone,
          'Wants': d.intent === 'call' ? 'Free AI strategy call' : 'Email reply', 'What to automate': d.automate, 'Additional information': d.details || '-' })
      }).catch(function () {});
    } catch (e) { /* enquiry already stored */ }
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
})();
