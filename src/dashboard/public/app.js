const API_BASE = '';

function initThemeToggle() {
  const toggle = document.getElementById('theme-toggle');
  const stored = localStorage.getItem('olteststack-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = stored ?? (prefersDark ? 'dark' : 'light');
  document.documentElement.dataset.theme = theme;

  toggle?.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('olteststack-theme', next);
  });
}

function formatDuration(ms) {
  if (!ms && ms !== 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function createStatusBadge(status) {
  const span = document.createElement('span');
  const cls =
    status === 'passed' ? 'badge-passed' : status === 'failed' ? 'badge-failed' : 'badge-error';
  span.className = `badge ${cls}`;
  span.textContent = status;
  return span;
}

function createPersistenceBadge(session) {
  const span = document.createElement('span');
  if (session.saved) {
    span.className = 'badge badge-saved';
    span.textContent = 'Saved';
    return span;
  }
  span.className = 'badge badge-ephemeral';
  if (session.expiresInHours === 0) {
    span.textContent = 'Expiring soon';
  } else if (session.expiresInHours != null) {
    span.textContent = `Expires in ${session.expiresInHours}h`;
  } else {
    span.textContent = 'Ephemeral';
  }
  return span;
}

function formatPersistenceDetail(report) {
  if (report.saved) {
    return report.savedAt ? `Saved ${formatDate(report.savedAt)}` : 'Saved';
  }
  if (report.expiresInHours === 0) return 'Expires soon';
  if (report.expiresInHours != null) return `Expires in ${report.expiresInHours} hour(s)`;
  if (report.expiresAt) return `Expires ${formatDate(report.expiresAt)}`;
  return 'Ephemeral';
}

function showBanner(message, isError = false) {
  const banner = document.getElementById('banner');
  if (!banner) return;
  if (!message) {
    banner.classList.add('hidden');
    return;
  }
  banner.textContent = message;
  banner.classList.remove('hidden');
  banner.style.borderColor = isError ? 'var(--danger)' : '';
}

function screenshotHref(path) {
  if (!path) return null;
  const parts = path.replace(/\\/g, '/').split('/');
  const name = parts[parts.length - 1];
  if (!name) return null;
  return `${API_BASE}/api/screenshots/${encodeURIComponent(name)}`;
}

async function fetchJson(url) {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? data.message ?? `Request failed (${response.status})`);
  }
  return data;
}

function clearElement(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function setLoadingRow(tbody, message, colSpan = 8) {
  clearElement(tbody);
  const row = document.createElement('tr');
  const cell = document.createElement('td');
  cell.colSpan = colSpan;
  cell.className = 'loading';
  cell.textContent = message;
  row.appendChild(cell);
  tbody.appendChild(row);
}

function initSessionsList() {
  const searchInput = document.getElementById('search');
  const statusFilter = document.getElementById('status-filter');
  const persistenceFilter = document.getElementById('persistence-filter');
  const refreshBtn = document.getElementById('refresh');
  const tbody = document.getElementById('sessions-body');
  const pagination = document.getElementById('pagination');

  let page = 1;
  let debounceTimer;

  async function loadSessions() {
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    const search = searchInput?.value.trim();
    const status = statusFilter?.value;
    const persistence = persistenceFilter?.value;
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    if (persistence) params.set('persistence', persistence);

    setLoadingRow(tbody, 'Loading sessions…');

    try {
      const data = await fetchJson(`${API_BASE}/api/sessions?${params}`);
      showBanner(data.message, !data.dbAvailable);
      clearElement(tbody);

      if (data.sessions.length === 0) {
        setLoadingRow(tbody, 'No sessions found. Run tests with persistence enabled.');
      } else {
        for (const session of data.sessions) {
          const row = document.createElement('tr');

          const nameCell = document.createElement('td');
          const link = document.createElement('a');
          link.className = 'row-link';
          link.href = `/dashboard/detail.html?id=${encodeURIComponent(session.id)}`;
          link.textContent = session.testName;
          nameCell.appendChild(link);

          const statusCell = document.createElement('td');
          statusCell.appendChild(createStatusBadge(session.status));

          const persistenceCell = document.createElement('td');
          persistenceCell.appendChild(createPersistenceBadge(session));

          const durationCell = document.createElement('td');
          durationCell.textContent = formatDuration(session.executionTimeMs);

          const actionsCell = document.createElement('td');
          actionsCell.textContent = String(session.actionCount);

          const assertionsCell = document.createElement('td');
          assertionsCell.textContent = `${session.assertionsPassedCount}✓ / ${session.assertionsFailedCount}✗`;

          const eventsCell = document.createElement('td');
          eventsCell.textContent = String(session.eventCount);

          const createdCell = document.createElement('td');
          createdCell.textContent = formatDate(session.createdAt);

          row.append(nameCell, statusCell, persistenceCell, durationCell, actionsCell, assertionsCell, eventsCell, createdCell);
          tbody.appendChild(row);
        }
      }

      renderPagination(data.pagination);
    } catch (error) {
      showBanner(error.message, true);
      setLoadingRow(tbody, error.message);
      clearElement(pagination);
    }
  }

  function renderPagination(meta) {
    clearElement(pagination);
    if (!meta) return;

    const info = document.createElement('span');
    info.className = 'page-info';
    if (meta.totalPages <= 1) {
      info.textContent = `${meta.total} session${meta.total === 1 ? '' : 's'}`;
      pagination.appendChild(info);
      return;
    }

    info.textContent = `Page ${meta.page} of ${meta.totalPages} (${meta.total} total)`;
    const buttons = document.createElement('div');
    buttons.className = 'page-buttons';

    const prev = document.createElement('button');
    prev.className = 'btn';
    prev.textContent = 'Previous';
    prev.disabled = meta.page <= 1;
    prev.addEventListener('click', () => {
      page = meta.page - 1;
      loadSessions();
    });

    const next = document.createElement('button');
    next.className = 'btn';
    next.textContent = 'Next';
    next.disabled = meta.page >= meta.totalPages;
    next.addEventListener('click', () => {
      page = meta.page + 1;
      loadSessions();
    });

    buttons.append(prev, next);
    pagination.append(info, buttons);
  }

  searchInput?.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      page = 1;
      loadSessions();
    }, 300);
  });

  statusFilter?.addEventListener('change', () => {
    page = 1;
    loadSessions();
  });

  persistenceFilter?.addEventListener('change', () => {
    page = 1;
    loadSessions();
  });

  refreshBtn?.addEventListener('click', () => loadSessions());
  loadSessions();
}

async function saveSession(reportId) {
  const response = await fetch(`${API_BASE}/api/sessions/${encodeURIComponent(reportId)}/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? `Save failed (${response.status})`);
  }
  return data;
}

function initSessionDetail() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const root = document.getElementById('detail-root');

  if (!id) {
    root.textContent = 'Missing session id.';
    root.className = 'loading';
    return;
  }

  fetchJson(`${API_BASE}/api/sessions/${encodeURIComponent(id)}`)
    .then((data) => {
      showBanner(data.message, !data.dbAvailable);
      renderDetail(root, data);
    })
    .catch((error) => {
      showBanner(error.message, true);
      root.textContent = error.message;
      root.className = 'loading';
    });
}

function appendMetaGrid(parent, report) {
  const grid = document.createElement('div');
  grid.className = 'meta-grid';

  const items = [
    ['Duration', formatDuration(report.executionTimeMs)],
    ['Persistence', formatPersistenceDetail(report)],
    ['Started', formatDate(report.startedAt)],
    ['Completed', formatDate(report.completedAt)],
    ['Browser', report.browserId ?? '—'],
  ];

  for (const [label, value] of items) {
    const item = document.createElement('div');
    item.className = 'meta-item';
    const labelEl = document.createElement('span');
    labelEl.className = 'meta-label';
    labelEl.textContent = label;
    const valueEl = document.createElement('span');
    valueEl.className = 'meta-value';
    valueEl.textContent = value;
    item.append(labelEl, valueEl);
    grid.appendChild(item);
  }

  parent.appendChild(grid);
}

function appendJsonList(section, title, items, className) {
  if (!items?.length) return;
  const heading = document.createElement('h3');
  heading.className = 'muted';
  heading.textContent = title;
  const list = document.createElement('ul');
  list.className = 'assertion-list';
  for (const item of items) {
    const li = document.createElement('li');
    li.className = className;
    li.textContent = JSON.stringify(item, null, 2);
    list.appendChild(li);
  }
  section.append(heading, list);
}

function renderDetail(root, data) {
  clearElement(root);
  root.className = 'detail-root';

  const { report, events } = data;

  const hero = document.createElement('article');
  hero.className = 'detail-hero';
  hero.appendChild(createStatusBadge(report.status));

  const title = document.createElement('h1');
  title.textContent = report.testName;
  hero.appendChild(title);

  const subtitle = document.createElement('p');
  subtitle.className = 'muted';
  subtitle.textContent = 'Session ';
  const code = document.createElement('code');
  code.textContent = report.id;
  subtitle.appendChild(code);
  hero.appendChild(subtitle);

  if (!report.saved) {
    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'btn btn-primary save-session-btn';
    saveBtn.textContent = 'Save session';
    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving…';
      try {
        await saveSession(report.id);
        const refreshed = await fetchJson(`${API_BASE}/api/sessions/${encodeURIComponent(report.id)}`);
        renderDetail(root, refreshed);
        showBanner('Session saved — it will no longer expire.');
      } catch (error) {
        showBanner(error.message, true);
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save session';
      }
    });
    hero.appendChild(saveBtn);
  }

  appendMetaGrid(hero, report);
  root.appendChild(hero);

  if (report.screenshots?.length) {
    const section = document.createElement('section');
    section.className = 'section';
    const h2 = document.createElement('h2');
    h2.textContent = 'Screenshots';
    const grid = document.createElement('div');
    grid.className = 'screenshot-grid';

    for (const path of report.screenshots) {
      const href = screenshotHref(path);
      if (!href) continue;
      const name = path.split(/[/\\]/).pop() ?? path;
      const figure = document.createElement('figure');
      figure.className = 'screenshot-card';

      const imgLink = document.createElement('a');
      imgLink.href = href;
      imgLink.target = '_blank';
      imgLink.rel = 'noopener';
      const img = document.createElement('img');
      img.src = href;
      img.alt = name;
      img.loading = 'lazy';
      img.addEventListener('error', () => {
        img.style.display = 'none';
      });
      imgLink.appendChild(img);

      const textLink = document.createElement('a');
      textLink.href = href;
      textLink.target = '_blank';
      textLink.rel = 'noopener';
      textLink.textContent = name;

      figure.append(imgLink, textLink);
      grid.appendChild(figure);
    }

    section.append(h2, grid);
    root.appendChild(section);
  }

  if (report.assertionsPassed?.length || report.assertionsFailed?.length) {
    const section = document.createElement('section');
    section.className = 'section';
    const h2 = document.createElement('h2');
    h2.textContent = 'Assertions';
    section.appendChild(h2);
    appendJsonList(section, 'Passed', report.assertionsPassed, 'assertion-pass');
    appendJsonList(section, 'Failed', report.assertionsFailed, 'assertion-fail');
    root.appendChild(section);
  }

  if (report.networkErrors?.length || report.consoleErrors?.length) {
    const section = document.createElement('section');
    section.className = 'section';
    const h2 = document.createElement('h2');
    h2.textContent = 'Errors';
    section.appendChild(h2);
    appendJsonList(section, 'Network', report.networkErrors, 'error-block');
    appendJsonList(section, 'Console', report.consoleErrors, 'error-block');
    root.appendChild(section);
  }

  const timelineSection = document.createElement('section');
  timelineSection.className = 'section';
  const timelineTitle = document.createElement('h2');
  timelineTitle.textContent = `Event timeline (${events.length})`;
  timelineSection.appendChild(timelineTitle);

  if (!events.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'No recorded events for this session.';
    timelineSection.appendChild(empty);
  } else {
    const list = document.createElement('ol');
    list.className = 'timeline';
    for (const event of events) {
      const item = document.createElement('li');
      item.className = 'timeline-item';

      const time = document.createElement('time');
      time.className = 'timeline-time';
      time.textContent = formatDate(event.timestamp);

      const body = document.createElement('div');
      const action = document.createElement('div');
      action.className = 'timeline-action';
      action.textContent = event.action;
      body.appendChild(action);

      if (event.target) {
        const target = document.createElement('div');
        target.className = 'timeline-target';
        target.textContent = event.target;
        body.appendChild(target);
      }

      if (event.metadata && Object.keys(event.metadata).length > 0) {
        const meta = document.createElement('pre');
        meta.className = 'timeline-meta';
        meta.textContent = JSON.stringify(event.metadata, null, 2);
        body.appendChild(meta);
      }

      item.append(time, body);
      list.appendChild(item);
    }
    timelineSection.appendChild(list);
  }

  root.appendChild(timelineSection);
}

window.initThemeToggle = initThemeToggle;
window.initSessionsList = initSessionsList;
window.initSessionDetail = initSessionDetail;
