(() => {
  'use strict';
  const loginPanel = document.getElementById('loginPanel');
  const loginForm = document.getElementById('loginForm');
  const loginMessage = document.getElementById('loginMessage');
  const dashboard = document.getElementById('dashboard');
  const dashboardContent = document.getElementById('dashboardContent');
  const dashboardStatus = document.getElementById('dashboardStatus');
  const logoutButton = document.getElementById('logoutButton');
  const refreshButton = document.getElementById('refreshButton');

  function showLogin(message = '') {
    loginPanel.hidden = false;
    dashboard.hidden = true;
    logoutButton.hidden = true;
    loginMessage.textContent = message;
  }

  function formatTime(iso) {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/New_York',
    }).format(new Date(iso)) + ' ET';
  }

  function renderList(target, records) {
    target.replaceChildren();
    if (!records.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-list';
      empty.textContent = 'No responses yet.';
      target.append(empty);
      return;
    }
    records.forEach(record => {
      const card = document.createElement('article');
      card.className = 'response-card';
      const identity = document.createElement('div');
      const name = document.createElement('h4');
      name.textContent = record.firstName + ' ' + record.lastName;
      const response = document.createElement('p');
      response.textContent = record.attending === 'yes' ? 'Attending' : 'Not attending';
      identity.append(name, response);
      const count = document.createElement('strong');
      count.textContent = String(record.guestCount);
      count.setAttribute('aria-label', record.guestCount + ' attending guests');
      const members = document.createElement('p');
      members.textContent = record.memberNames.length ? record.memberNames.join(', ') : 'No additional names';
      const time = document.createElement('time');
      time.dateTime = record.submittedAt;
      time.textContent = formatTime(record.submittedAt);
      card.append(identity, count, members, time);
      target.append(card);
    });
  }

  async function loadDashboard() {
    dashboardStatus.hidden = false;
    dashboardStatus.textContent = 'Loading responses…';
    dashboardContent.hidden = true;
    try {
      const response = await fetch('/api/admin/rsvps', { headers: { Accept: 'application/json' } });
      if (response.status === 401) return showLogin();
      if (!response.ok) throw new Error('Unable to load responses.');
      const data = await response.json();
      loginPanel.hidden = true;
      dashboard.hidden = false;
      logoutButton.hidden = false;
      document.getElementById('yesCount').textContent = data.summary.attendingHouseholds;
      document.getElementById('noCount').textContent = data.summary.decliningHouseholds;
      document.getElementById('guestTotal').textContent = data.summary.attendingGuests;
      renderList(document.getElementById('yesList'), data.responses.filter(item => item.attending === 'yes'));
      renderList(document.getElementById('noList'), data.responses.filter(item => item.attending === 'no'));
      dashboardStatus.hidden = true;
      dashboardContent.hidden = false;
    } catch (error) {
      dashboard.hidden = false;
      dashboardStatus.hidden = false;
      dashboardStatus.textContent = error.message;
    }
  }

  loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    const button = loginForm.querySelector('button');
    button.disabled = true;
    loginMessage.textContent = '';
    try {
      const body = Object.fromEntries(new FormData(loginForm));
      const response = await fetch('/api/admin/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Sign in failed.');
      loginForm.reset();
      await loadDashboard();
    } catch (error) {
      loginMessage.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });

  logoutButton.addEventListener('click', async () => {
    await fetch('/api/admin/logout', { method: 'POST' }).catch(() => {});
    showLogin('You have been signed out.');
  });
  refreshButton.addEventListener('click', loadDashboard);
  loadDashboard();
})();
