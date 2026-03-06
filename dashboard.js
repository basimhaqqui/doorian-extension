document.addEventListener('DOMContentLoaded', () => {
  // Navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      item.classList.add('active');
      document.getElementById(item.dataset.view + 'View').classList.add('active');
    });
  });

  loadDashboard();

  // Listen for storage changes to update in real time
  chrome.storage.onChanged.addListener(() => loadDashboard());

  // Export CSV
  document.getElementById('exportCsvBtn').addEventListener('click', exportToCsv);
});

function loadDashboard() {
  chrome.storage.local.get(['bookmarked', 'applied'], (data) => {
    const bookmarked = data.bookmarked || [];
    const applied = data.applied || [];
    const all = [
      ...bookmarked.map(j => ({ ...j, _status: 'Bookmarked' })),
      ...applied.map(j => ({ ...j, _status: j.status || 'Applied' }))
    ];

    renderStats(bookmarked, applied, all);
    renderRecentActivity(all);
    renderDeadlines(all);
    renderTable('bookmarkedTable', bookmarked, 'bookmarked');
    renderTable('appliedTable', applied, 'applied');
    renderTimeline(all);
  });
}

function renderStats(bookmarked, applied, all) {
  document.getElementById('statBookmarked').textContent = bookmarked.length;
  document.getElementById('statApplied').textContent = applied.length;
  document.getElementById('statTotal').textContent = all.length;

  const companies = new Set(all.map(j => j.company).filter(c => c && c !== 'Unknown' && c !== '-'));
  document.getElementById('statCompanies').textContent = companies.size;
}

function renderRecentActivity(all) {
  const container = document.getElementById('recentActivity');
  const sorted = [...all].sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));

  if (sorted.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No activity yet. Bookmark some jobs to get started!</p></div>';
    return;
  }

  container.innerHTML = sorted.slice(0, 6).map(job => {
    const statusClass = job._status === 'Bookmarked' ? 'bookmarked' : 'applied';
    const action = job._status === 'Bookmarked' ? 'Bookmarked' : job._status;
    return `
      <div class="activity-item">
        <div class="activity-dot ${statusClass}"></div>
        <div class="activity-info">
          <div class="activity-title">${job.title || 'Unknown'}</div>
          <div class="activity-detail">${action} at ${job.company || 'Unknown'}</div>
        </div>
        <div class="activity-time">${formatTimeAgo(job.savedAt)}</div>
      </div>`;
  }).join('');
}

function renderDeadlines(all) {
  const container = document.getElementById('upcomingDeadlines');
  const withDeadlines = all.filter(j => j.deadline && j.deadline !== '-');

  if (withDeadlines.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No deadlines tracked yet.</p></div>';
    return;
  }

  // Try to parse and sort deadlines
  const parsed = withDeadlines.map(j => {
    const d = parseDeadline(j.deadline);
    return { ...j, _parsedDate: d };
  }).filter(j => j._parsedDate).sort((a, b) => a._parsedDate - b._parsedDate);

  if (parsed.length === 0) {
    container.innerHTML = withDeadlines.map(j => `
      <div class="deadline-item">
        <div class="deadline-date">
          <div class="day">--</div>
        </div>
        <div class="deadline-info">
          <div class="deadline-title">${j.title || 'Unknown'}</div>
          <div class="deadline-company">${j.company || 'Unknown'} &middot; ${j.deadline}</div>
        </div>
      </div>`).join('');
    return;
  }

  const now = new Date();
  container.innerHTML = parsed.slice(0, 5).map(j => {
    const d = j._parsedDate;
    const daysLeft = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
    const urgent = daysLeft <= 3;
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `
      <div class="deadline-item">
        <div class="deadline-date ${urgent ? 'urgent' : ''}">
          <div class="month">${months[d.getMonth()]}</div>
          <div class="day">${d.getDate()}</div>
        </div>
        <div class="deadline-info">
          <div class="deadline-title">${j.title || 'Unknown'}</div>
          <div class="deadline-company">${j.company || 'Unknown'} &middot; ${daysLeft > 0 ? daysLeft + ' days left' : 'Past due'}</div>
        </div>
      </div>`;
  }).join('');
}

function renderTable(containerId, jobs, listName) {
  const container = document.getElementById(containerId);

  if (jobs.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
        </svg>
        <h3>No jobs here yet</h3>
        <p>Jobs you ${listName === 'bookmarked' ? 'bookmark' : 'apply to'} will show up here.</p>
      </div>`;
    return;
  }

  const isApplied = listName === 'applied';

  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Job Title</th>
          <th>Company</th>
          <th>Pay</th>
          <th>Location</th>
          <th>Type</th>
          ${isApplied ? '<th>Status</th>' : '<th>Deadline</th>'}
          <th>Source</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${jobs.map((job, i) => `
          <tr>
            <td>
              <a href="${job.url || '#'}" target="_blank" class="table-link">${job.title || '-'}</a>
            </td>
            <td class="table-company">${job.company || '-'}</td>
            <td>${job.pay || '-'}</td>
            <td>${job.location || '-'}</td>
            <td>${job.type || '-'}</td>
            ${isApplied
              ? `<td><span class="status-badge ${statusClass(job.status || 'Applied')}" data-list="${listName}" data-index="${i}">${job.status || 'Applied'}</span></td>`
              : `<td>${job.deadline || '-'}</td>`
            }
            <td>${job.source || '-'}</td>
            <td>
              <div class="table-actions">
                ${!isApplied ? `
                  <button class="table-action-btn move-btn" data-list="${listName}" data-index="${i}" title="Mark as Applied">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  </button>` : ''}
                <button class="table-action-btn delete" data-list="${listName}" data-index="${i}" title="Remove">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>`;

  // Status badge click -> open modal
  container.querySelectorAll('.status-badge').forEach(badge => {
    badge.addEventListener('click', () => {
      const idx = parseInt(badge.dataset.index);
      openStatusModal(listName, idx);
    });
  });

  // Move to applied
  container.querySelectorAll('.move-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      moveToApplied(listName, idx);
    });
  });

  // Delete
  container.querySelectorAll('.table-action-btn.delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const list = btn.dataset.list;
      const idx = parseInt(btn.dataset.index);
      chrome.storage.local.get([list], (data) => {
        const jobs = data[list] || [];
        jobs.splice(idx, 1);
        chrome.storage.local.set({ [list]: jobs }, loadDashboard);
      });
    });
  });
}

function renderTimeline(all) {
  const container = document.getElementById('timelineContent');
  const sorted = [...all].sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));

  if (sorted.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>Your application timeline will appear here.</p></div>';
    return;
  }

  // Group by date
  const groups = {};
  sorted.forEach(job => {
    const date = new Date(job.savedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    if (!groups[date]) groups[date] = [];
    groups[date].push(job);
  });

  container.innerHTML = '<div class="timeline-line"></div>' +
    Object.entries(groups).map(([date, jobs]) => `
      <div class="timeline-group">
        <div class="timeline-date-label">${date}</div>
        ${jobs.map(job => `
          <div class="timeline-card">
            <div class="timeline-card-info">
              <h4>${job.title || 'Unknown'}</h4>
              <p>${job.company || 'Unknown'} &middot; ${job._status}</p>
            </div>
            <span class="status-badge ${statusClass(job._status)}">${job._status}</span>
          </div>
        `).join('')}
      </div>
    `).join('');
}

// Status Modal
function openStatusModal(listName, index) {
  chrome.storage.local.get([listName], (data) => {
    const jobs = data[listName] || [];
    const job = jobs[index];
    if (!job) return;

    const modal = document.getElementById('statusModal');
    const reflection = document.getElementById('rejectionReflection');
    modal.style.display = 'flex';
    document.getElementById('modalJobTitle').textContent = `${job.title} at ${job.company}`;
    reflection.style.display = 'none';

    // Reset selections
    document.querySelectorAll('.status-option').forEach(opt => opt.classList.remove('selected'));
    const current = document.querySelector(`.status-option[data-status="${job.status || 'Applied'}"]`);
    if (current) current.classList.add('selected');

    let selectedStatus = job.status || 'Applied';

    // Status option clicks
    const statusHandler = (e) => {
      document.querySelectorAll('.status-option').forEach(o => o.classList.remove('selected'));
      e.target.classList.add('selected');
      selectedStatus = e.target.dataset.status;
      reflection.style.display = selectedStatus === 'Rejected' ? 'block' : 'none';
    };

    document.querySelectorAll('.status-option').forEach(opt => {
      opt.replaceWith(opt.cloneNode(true));
    });
    document.querySelectorAll('.status-option').forEach(opt => {
      opt.addEventListener('click', statusHandler);
      if (opt.dataset.status === selectedStatus) opt.classList.add('selected');
    });

    // Save
    const saveBtn = document.getElementById('modalSave');
    const newSave = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSave, saveBtn);
    newSave.addEventListener('click', () => {
      jobs[index].status = selectedStatus;
      if (selectedStatus === 'Rejected') {
        const reason = document.querySelector('input[name="reason"]:checked');
        jobs[index].rejectionReason = reason ? reason.value : '';
        jobs[index].reflectionNotes = document.getElementById('reflectionNotes').value;
      }
      chrome.storage.local.set({ [listName]: jobs }, () => {
        modal.style.display = 'none';
        loadDashboard();
      });
    });

    // Cancel
    const cancelBtn = document.getElementById('modalCancel');
    const newCancel = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
    newCancel.addEventListener('click', () => modal.style.display = 'none');

    // Backdrop close
    modal.querySelector('.modal-backdrop').onclick = () => modal.style.display = 'none';
  });
}

function moveToApplied(fromList, index) {
  chrome.storage.local.get([fromList, 'applied'], (data) => {
    const from = data[fromList] || [];
    const applied = data.applied || [];
    const job = from.splice(index, 1)[0];
    if (!job) return;
    job.status = 'Applied';
    job.savedAt = new Date().toISOString();
    applied.unshift(job);
    chrome.storage.local.set({ [fromList]: from, applied }, loadDashboard);
  });
}

function exportToCsv() {
  chrome.storage.local.get(['bookmarked', 'applied'], (data) => {
    const allJobs = [
      ...(data.bookmarked || []).map(j => ({ ...j, status: 'Bookmarked' })),
      ...(data.applied || [])
    ];

    if (allJobs.length === 0) return;

    const headers = ['Title', 'Company', 'Pay', 'Location', 'Type', 'Deadline', 'Status', 'URL', 'Source', 'Saved At'];
    const rows = allJobs.map(j => [
      j.title || '', j.company || '', j.pay || '', j.location || '',
      j.type || '', j.deadline || '', j.status || '', j.url || '', j.source || '', j.savedAt || ''
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `doorian-jobs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

// Helpers
function statusClass(status) {
  return (status || '').toLowerCase().replace(/\s+/g, '-');
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  const days = Math.floor(hrs / 24);
  return days + 'd ago';
}

function parseDeadline(str) {
  if (!str || str === '-') return null;
  // Try common formats: "March 15, 2026", "Mar 15", "3/15/2026"
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d;

  // Try extracting from "Apply by March 15, 2026 at 8:59 PM"
  const match = str.match(/(\w+ \d{1,2},?\s*\d{4})/);
  if (match) {
    const parsed = new Date(match[1]);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return null;
}
