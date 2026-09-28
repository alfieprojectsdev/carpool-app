// public/js/app.js
// Everything user-supplied is rendered with textContent (via h() below), never
// innerHTML. The page is served with a Content-Security-Policy that blocks
// inline scripts, so there are no onclick="" attributes either.
(() => {
  'use strict';

  const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const STORE_KEY = 'carpool.myRides';
  const $ = (id) => document.getElementById(id);
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const track = (name, ...args) => window.analytics && window.analytics[name] && window.analytics[name](...args);

  let locations = [];
  let rides = [];

  // ---------------------------------------------------------------- helpers

  /** Build an element. String children become text nodes, never markup. */
  function h(tag, props, ...children) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(props || {})) {
      if (value === null || value === undefined || value === false) continue;
      if (key === 'class') el.className = value;
      else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
      else el.setAttribute(key, value === true ? '' : value);
    }
    for (const child of children.flat()) {
      if (child === null || child === undefined || child === false || child === '') continue;
      el.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return el;
  }

  async function api(path, { method = 'GET', body, token } = {}) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers['X-Manage-Token'] = token;
    let res;
    try {
      res = await fetch(path, {
        method,
        headers,
        credentials: 'same-origin',
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      return { ok: false, status: 0, data: { error: 'No connection. Check your internet and try again.' } };
    }
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = {};
    }
    if (res.status === 401 && data && data.code === 'PASSCODE_REQUIRED') showGate();
    return { ok: res.ok, status: res.status, data };
  }

  function say(el, text, kind = 'error') {
    el.textContent = text || '';
    el.className = `form-message ${kind}`;
    el.hidden = !text;
  }

  function formatTime(hhmm) {
    if (!hhmm) return '';
    const [hours, minutes] = hhmm.split(':').map(Number);
    return `${((hours + 11) % 12) + 1}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
  }

  function checkedDays(container) {
    return [...container.querySelectorAll('input[type=checkbox]:checked')].map((c) => c.value);
  }

  function buildDayCheckboxes(container, name) {
    container.replaceChildren(
      ...DAYS.map((day) => h('label', {}, h('input', { type: 'checkbox', name, value: day }), ` ${cap(day)}`))
    );
  }

  // Dialog buttons marked data-close close their dialog.
  document.querySelectorAll('dialog [data-close]').forEach((button) => {
    button.addEventListener('click', () => button.closest('dialog').close());
  });

  // ------------------------------------------------ "my rides" (localStorage)

  function loadMine() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY)) || [];
    } catch {
      return [];
    }
  }

  function saveMine(list) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(list));
    } catch {
      // Private browsing: the manage link shown after posting still works.
    }
  }

  function rememberRide(id, token) {
    saveMine([...loadMine().filter((r) => r.id !== id), { id, token }]);
  }

  function forgetRide(id) {
    saveMine(loadMine().filter((r) => r.id !== id));
  }

  const manageLink = (id, token) => `${location.origin}/#manage=${id}.${token}`;

  /** Opening a manage link (#manage=<id>.<token>) adds the ride to "My rides". */
  function captureManageLink() {
    const match = location.hash.match(/^#manage=(\d+)\.([A-Za-z0-9_-]{20,})$/);
    if (match) {
      rememberRide(Number(match[1]), match[2]);
      history.replaceState(null, '', location.pathname + location.search);
    }
  }

  // ------------------------------------------------------------------- gate

  function showGate() {
    $('loading').hidden = true;
    $('board').hidden = true;
    $('gate').hidden = false;
    $('passcode').focus();
  }

  async function showBoard() {
    $('loading').hidden = true;
    $('gate').hidden = true;
    $('board').hidden = false;
    await Promise.all([loadLocations(), loadRides()]);
  }

  $('gate-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    say($('gate-message'), '');
    const result = await api('/api/join', { method: 'POST', body: { passcode: $('passcode').value } });
    if (result.ok) {
      $('passcode').value = '';
      showBoard();
    } else {
      say($('gate-message'), result.data.error || 'Could not check the passcode.');
    }
  });

  $('leave').addEventListener('click', async () => {
    await api('/api/leave', { method: 'POST' });
    location.reload();
  });

  // -------------------------------------------------------------- locations

  function locationLabel(loc) {
    const icon = { residential: '🏠', terminal: '🚏', commercial: '🏢' }[loc.location_type] || '📍';
    return `${icon} ${loc.location_name}`;
  }

  async function loadLocations() {
    const result = await api('/api/locations');
    if (!result.ok) return;
    locations = result.data;

    for (const [id, placeholder] of [['origin', 'Choose origin…'], ['destination', 'Choose destination…']]) {
      const select = $(id);
      const current = select.value;
      select.replaceChildren(
        h('option', { value: '' }, placeholder),
        ...locations.map((loc) => h('option', { value: loc.location_id }, locationLabel(loc))),
        h('option', { value: '__add_new__' }, '➕ Add new location…')
      );
      if (current && current !== '__add_new__') select.value = current;
    }

    for (const id of ['filter-origin', 'filter-destination']) {
      const select = $(id);
      const current = select.value;
      select.replaceChildren(
        h('option', { value: '' }, 'Anywhere'),
        ...locations.map((loc) => h('option', { value: loc.location_name }, loc.location_name))
      );
      select.value = current;
    }
  }

  let locationTarget = null;

  document.querySelectorAll('.location-select').forEach((select) => {
    select.addEventListener('change', () => {
      if (select.value !== '__add_new__') return;
      locationTarget = select;
      $('location-form').reset();
      say($('location-message'), '');
      $('location-dialog').showModal();
    });
  });

  $('location-dialog').addEventListener('close', () => {
    if (locationTarget && locationTarget.value === '__add_new__') locationTarget.value = '';
    locationTarget = null;
  });

  $('location-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('new-location-name').value.trim();
    const type = $('new-location-type').value;
    const result = await api('/api/locations', { method: 'POST', body: { location_name: name, location_type: type } });
    if (!result.ok) return say($('location-message'), result.data.error || 'Could not add the location.');
    if (result.data.is_existing) track('locationReused', result.data.location_id);
    else track('locationAdded', name, type);
    const target = locationTarget;
    await loadLocations();
    if (target) target.value = String(result.data.location_id);
    $('location-dialog').close();
  });

  // ----------------------------------------------------------------- rides

  async function loadRides() {
    const result = await api('/api/rides');
    const container = $('rides-container');
    if (!result.ok) {
      container.replaceChildren(h('p', { class: 'error' }, result.data.error || 'Could not load rides. Please refresh.'));
      return;
    }
    rides = result.data;
    renderRides();
    renderMyRides();
  }

  function renderRides() {
    const type = $('filter-type').value;
    const from = $('filter-origin').value;
    const to = $('filter-destination').value;
    const day = $('filter-day').value;
    const shown = rides.filter(
      (r) =>
        (!type || r.post_type === type) &&
        (!from || r.origin === from) &&
        (!to || r.destination === to) &&
        (!day || r.days_of_week.includes(day))
    );

    const container = $('rides-container');
    if (rides.length === 0) {
      container.replaceChildren(h('p', { class: 'empty' }, 'No rides yet. Be the first to post!'));
    } else if (shown.length === 0) {
      container.replaceChildren(h('p', { class: 'empty' }, 'No rides match those filters.'));
    } else {
      container.replaceChildren(...shown.map(rideCard));
    }
  }

  ['filter-type', 'filter-origin', 'filter-destination', 'filter-day'].forEach((id) =>
    $(id).addEventListener('change', renderRides)
  );

  function rideCard(ride) {
    const mine = loadMine().some((r) => r.id === ride.post_id);
    return h(
      'article',
      { class: 'ride-card' },
      h(
        'div',
        { class: 'ride-header' },
        h('span', { class: `badge ${ride.post_type}` }, ride.post_type),
        h('span', { class: 'name' }, ride.name),
        mine && h('span', { class: 'badge mine' }, 'yours')
      ),
      h('div', { class: 'ride-route' }, h('strong', {}, ride.origin), ' → ', h('strong', {}, ride.destination)),
      ride.post_type === 'offer' &&
        ride.vehicle_model &&
        h(
          'div',
          { class: 'vehicle-info' },
          '🚗 ',
          h('strong', {}, ride.vehicle_model),
          ride.available_seats ? ` (${ride.available_seats} seats available)` : ''
        ),
      h(
        'div',
        { class: 'ride-schedule' },
        `📅 ${ride.days_of_week.map(cap).join(', ')}`,
        ride.departure_time ? `   ⏰ ${formatTime(ride.departure_time)}` : ''
      ),
      ride.notes && h('div', { class: 'ride-notes' }, ride.notes),
      h(
        'div',
        { class: 'ride-contact', onclick: () => track('contactViewed', ride.contact_method) },
        `Contact via ${ride.contact_method}: `,
        h('strong', {}, ride.contact_info)
      ),
      h('div', { class: 'ride-meta' }, `Posted ${new Date(ride.created_at).toLocaleDateString()}`),
      h(
        'div',
        { class: 'ride-actions' },
        mine
          ? h('span', { class: 'hint' }, 'You posted this. Manage it under "My rides".')
          : h('button', { type: 'button', class: 'btn-interest', onclick: () => openInterest(ride.post_id) }, "👋 I'm interested"),
        h('span', { class: 'interest-count' }, `${ride.interest_count} interested`)
      )
    );
  }

  // ------------------------------------------------------------ post a ride

  $('post_type').addEventListener('change', (e) => {
    $('vehicle-fields').hidden = e.target.value !== 'offer';
  });

  $('post-ride-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const message = $('form-message');
    say(message, '');

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const days = checkedDays($('days-group'));
    if (days.length === 0) return say(message, 'Please pick at least one day.');
    if ($('origin').value === $('destination').value) return say(message, 'From and To must be different places.');

    const body = {
      name: $('name').value,
      contact_method: $('contact_method').value,
      contact_info: $('contact_info').value,
      post_type: $('post_type').value,
      origin_id: Number($('origin').value),
      destination_id: Number($('destination').value),
      days_of_week: days,
      departure_time: $('departure_time').value || null,
      notes: $('notes').value || null,
      vehicle_model: $('vehicle_model').value || null,
      available_seats: $('available_seats').value ? Number($('available_seats').value) : null,
    };

    const button = form.querySelector('button[type=submit]');
    button.disabled = true;
    button.textContent = 'Posting…';
    const result = await api('/api/rides', { method: 'POST', body });
    button.disabled = false;
    button.textContent = 'Post Ride';

    if (!result.ok) return say(message, result.data.error || 'Could not post the ride. Please try again.');

    track('ridePosted', body.post_type);
    rememberRide(result.data.post_id, result.data.manage_token);
    form.reset();
    $('vehicle-fields').hidden = true;
    $('manage-link').value = manageLink(result.data.post_id, result.data.manage_token);
    $('posted').hidden = false;
    $('posted').scrollIntoView({ behavior: 'smooth', block: 'center' });
    loadRides();
  });

  $('copy-manage-link').addEventListener('click', async () => {
    const input = $('manage-link');
    try {
      await navigator.clipboard.writeText(input.value);
      $('copy-manage-link').textContent = 'Copied';
    } catch {
      input.select();
    }
  });

  $('dismiss-posted').addEventListener('click', () => {
    $('posted').hidden = true;
    $('copy-manage-link').textContent = 'Copy';
  });

  // --------------------------------------------------------------- my rides

  function renderMyRides() {
    const mine = loadMine();
    $('my-rides').hidden = mine.length === 0;
    $('my-rides-list').replaceChildren(
      ...mine.map(({ id, token }) => {
        const ride = rides.find((r) => r.post_id === id);
        const status = h('p', { class: 'form-message', role: 'status', hidden: true });
        const act = async (fn) => {
          say(status, '');
          await fn(status);
        };

        const summary = ride
          ? h(
              'div',
              {},
              h('strong', {}, `${ride.origin} → ${ride.destination}`),
              ` · ${ride.days_of_week.map(cap).join(', ')}`,
              h('br'),
              h('small', {}, `Listed until ${new Date(ride.expires_at).toLocaleDateString()} · ${ride.interest_count} interested`)
            )
          : h('div', {}, h('strong', {}, `Ride #${id}`), h('br'), h('small', {}, 'Not on the board (expired or removed).'));

        const buttons = [
          ride && h('button', { type: 'button', class: 'btn-secondary', onclick: () => openEdit(ride, token) }, 'Edit'),
          ride && h('button', { type: 'button', class: 'btn-secondary', onclick: () => openInterests(id, token) }, 'Who is interested'),
          h(
            'button',
            {
              type: 'button',
              class: 'btn-secondary',
              onclick: () =>
                act(async (el) => {
                  const result = await api(`/api/rides/${id}`, { method: 'PUT', token, body: { renew: true } });
                  if (result.status === 404) {
                    forgetRide(id);
                    return renderMyRides();
                  }
                  if (!result.ok) return say(el, result.data.error || 'Could not renew.');
                  await loadRides();
                }),
            },
            'Keep for 60 more days'
          ),
          ride &&
            h(
              'button',
              {
                type: 'button',
                class: 'btn-danger',
                onclick: () =>
                  act(async (el) => {
                    if (!confirm('Take this ride off the board?')) return;
                    const result = await api(`/api/rides/${id}`, { method: 'DELETE', token });
                    if (!result.ok && result.status !== 404) return say(el, result.data.error || 'Could not remove.');
                    forgetRide(id);
                    await loadRides();
                  }),
              },
              'Remove'
            ),
          !ride && h('button', { type: 'button', class: 'link-button', onclick: () => (forgetRide(id), renderMyRides()) }, 'Forget'),
        ];

        return h('div', { class: 'my-ride' }, summary, h('div', { class: 'my-ride-actions' }, buttons), status);
      })
    );
  }

  // Edit
  let editing = null;

  function openEdit(ride, token) {
    editing = { ride, token };
    const boxes = $('edit-days-group').querySelectorAll('input');
    boxes.forEach((box) => (box.checked = ride.days_of_week.includes(box.value)));
    $('edit-time').value = ride.departure_time || '';
    $('edit-notes').value = ride.notes || '';
    $('edit-seats').value = ride.available_seats || '';
    $('edit-seats-group').hidden = ride.post_type !== 'offer';
    say($('edit-message'), '');
    $('edit-dialog').showModal();
  }

  $('edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const days = checkedDays($('edit-days-group'));
    if (days.length === 0) return say($('edit-message'), 'Please pick at least one day.');
    const body = {
      days_of_week: days,
      departure_time: $('edit-time').value || null,
      notes: $('edit-notes').value || null,
    };
    if (editing.ride.post_type === 'offer') {
      body.available_seats = $('edit-seats').value ? Number($('edit-seats').value) : null;
    }
    const result = await api(`/api/rides/${editing.ride.post_id}`, { method: 'PUT', token: editing.token, body });
    if (!result.ok) return say($('edit-message'), result.data.error || 'Could not save.');
    $('edit-dialog').close();
    loadRides();
  });

  // Who is interested (poster only)
  async function openInterests(id, token) {
    const result = await api(`/api/rides/${id}/interests`, { token });
    const list = $('interests-list');
    if (!result.ok) {
      list.replaceChildren(h('p', { class: 'error' }, result.data.error || 'Could not load.'));
    } else if (result.data.length === 0) {
      list.replaceChildren(h('p', { class: 'empty' }, 'No one yet.'));
    } else {
      track('interestsViewed', id, result.data.length);
      list.replaceChildren(
        ...result.data.map((i) =>
          h(
            'div',
            { class: 'interest-item' },
            h('strong', {}, i.interested_name),
            h('br'),
            `${cap(i.contact_method)}: ${i.contact_info}`,
            h('br'),
            h('small', {}, `Sent ${new Date(i.created_at).toLocaleDateString()}`)
          )
        )
      );
    }
    $('interests-dialog').showModal();
  }

  // --------------------------------------------------------- I'm interested

  let interestRide = null;

  function openInterest(id) {
    interestRide = id;
    $('interest-form').reset();
    say($('interest-message'), '');
    $('interest-dialog').showModal();
  }

  $('interest-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      interested_name: $('interest-name').value,
      contact_method: $('interest-contact-method').value,
      contact_info: $('interest-contact-info').value,
    };
    const result = await api(`/api/rides/${interestRide}/interests`, { method: 'POST', body });
    if (!result.ok) return say($('interest-message'), result.data.error || 'Could not send.');
    track('interestExpressed', interestRide);
    $('interest-dialog').close();
    loadRides();
  });

  // --------------------------------------------------------------- feedback

  $('feedback-open').addEventListener('click', () => {
    say($('feedback-status'), '');
    $('feedback-dialog').showModal();
  });

  $('feedback-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = $('feedback-message').value;
    if (!message.trim()) return say($('feedback-status'), 'Please write a message.');
    const kind = document.querySelector('input[name=feedback-kind]:checked').value;
    const result = await api('/api/feedback', {
      method: 'POST',
      body: {
        kind,
        message,
        contact: $('feedback-contact').value,
        page: location.pathname,
        website: $('feedback-website').value,
      },
    });
    if (!result.ok) return say($('feedback-status'), result.data.error || 'Could not send. Please try again.');
    $('feedback-form').reset();
    say($('feedback-status'), 'Thanks, your message was sent. We read every one.', 'success');
  });

  // ------------------------------------------------------------------- start

  captureManageLink();
  buildDayCheckboxes($('days-group'), 'days');
  buildDayCheckboxes($('edit-days-group'), 'edit-days');
  $('filter-day').append(...DAYS.map((d) => h('option', { value: d }, cap(d))));

  api('/api/session').then((result) => {
    if (!result.ok) {
      $('loading').textContent = 'Could not reach the server. Please refresh.';
      return;
    }
    $('leave').hidden = !result.data.gate;
    if (result.data.member) showBoard();
    else showGate();
  });
})();
