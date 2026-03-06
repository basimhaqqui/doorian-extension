document.addEventListener('DOMContentLoaded', () => {
  const mainView = document.getElementById('mainView');
  const settingsView = document.getElementById('settingsView');
  const jobDetected = document.getElementById('jobDetected');
  const noJob = document.getElementById('noJob');

  // Settings toggle
  document.getElementById('settingsBtn').addEventListener('click', () => {
    mainView.style.display = 'none';
    settingsView.style.display = 'block';
  });

  document.getElementById('backBtn').addEventListener('click', () => {
    settingsView.style.display = 'none';
    mainView.style.display = 'block';
  });

  // Try to get job data from current tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab) {
      showNoJob();
      return;
    }

    function tryGetJob() {
      chrome.tabs.sendMessage(tab.id, { action: 'getJobData' }, (response) => {
        if (chrome.runtime.lastError || !response || !response.job) {
          // Content script not injected — inject it on demand and retry
          chrome.scripting.executeScript(
            { target: { tabId: tab.id }, files: ['content.js'] },
            () => {
              if (chrome.runtime.lastError) {
                showNoJob();
                loadSavedJobs();
                return;
              }
              // Retry after injection
              setTimeout(() => {
                chrome.tabs.sendMessage(tab.id, { action: 'getJobData' }, (resp) => {
                  if (chrome.runtime.lastError || !resp || !resp.job) {
                    showNoJob();
                  } else {
                    showJobCard(resp.job, tab.url);
                  }
                  loadSavedJobs();
                });
              }, 300);
            }
          );
        } else {
          showJobCard(response.job, tab.url);
          loadSavedJobs();
        }
      });
    }

    tryGetJob();
  });

  function showNoJob() {
    jobDetected.style.display = 'none';
    noJob.style.display = 'block';
  }

  function showJobCard(job, url) {
    jobDetected.style.display = 'block';
    noJob.style.display = 'none';

    document.getElementById('jobTitle').textContent = job.title || '-';
    document.getElementById('jobCompany').textContent = job.company || '-';
    document.getElementById('jobPay').textContent = job.pay || '-';
    document.getElementById('jobLocation').textContent = job.location || '-';
    document.getElementById('jobType').textContent = job.type || '-';
    document.getElementById('jobDeadline').textContent = job.deadline || '-';

    const bookmarkBtn = document.getElementById('bookmarkBtn');
    const appliedBtn = document.getElementById('appliedBtn');

    // Check if already saved
    chrome.storage.local.get(['bookmarked', 'applied'], (data) => {
      const bookmarked = data.bookmarked || [];
      const applied = data.applied || [];

      if (bookmarked.some(j => j.url === url)) {
        bookmarkBtn.classList.add('bookmarked');
        bookmarkBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
          </svg>
          Bookmarked`;
      }

      if (applied.some(j => j.url === url)) {
        appliedBtn.classList.add('applied');
        appliedBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          Applied`;
      }
    });

    bookmarkBtn.addEventListener('click', () => {
      saveJob('bookmarked', { ...job, url, savedAt: new Date().toISOString() }, () => {
        bookmarkBtn.classList.add('bookmarked');
        bookmarkBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
          </svg>
          Bookmarked`;
        showToast('Job bookmarked!');
        loadSavedJobs();
      });
    });

    appliedBtn.addEventListener('click', () => {
      saveJob('applied', { ...job, url, status: 'Applied', savedAt: new Date().toISOString() }, () => {
        removeJob('bookmarked', url, () => {
          bookmarkBtn.classList.remove('bookmarked');
          bookmarkBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
            </svg>
            Bookmark`;
          appliedBtn.classList.add('applied');
          appliedBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Applied`;
          showToast('Marked as applied!');
          loadSavedJobs();
        });
      });
    });
  }

  function saveJob(listName, job, callback) {
    chrome.storage.local.get([listName], (data) => {
      const list = data[listName] || [];
      const existingIdx = list.findIndex(j => j.url === job.url);
      if (existingIdx >= 0) {
        list[existingIdx] = job;
      } else {
        list.unshift(job);
      }
      chrome.storage.local.set({ [listName]: list }, callback);
    });
  }

  function removeJob(listName, url, callback) {
    chrome.storage.local.get([listName], (data) => {
      const list = (data[listName] || []).filter(j => j.url !== url);
      chrome.storage.local.set({ [listName]: list }, callback);
    });
  }

  function loadSavedJobs() {
    chrome.storage.local.get(['bookmarked', 'applied'], (data) => {
      const bookmarked = data.bookmarked || [];
      const applied = data.applied || [];

      document.getElementById('bookmarkCount').textContent = bookmarked.length;
      document.getElementById('appliedCount').textContent = applied.length;

      renderJobList('bookmarkedList', bookmarked, 'bookmarked');
      renderJobList('appliedList', applied, 'applied');
    });
  }

  function renderJobList(containerId, jobs, listName) {
    const container = document.getElementById(containerId);
    if (jobs.length === 0) {
      container.innerHTML = '<div class="empty-list">No jobs yet</div>';
      return;
    }

    container.innerHTML = jobs.slice(0, 5).map((job, i) => `
      <div class="job-list-item" data-url="${job.url}">
        <div class="job-list-item-info">
          <div class="job-list-item-title">${job.title || 'Unknown'}</div>
          <div class="job-list-item-company">${job.company || 'Unknown'}</div>
        </div>
        <div class="job-list-item-actions">
          <button class="small-btn delete-btn" data-list="${listName}" data-index="${i}" title="Remove">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
    `).join('');

    // Click to open job URL
    container.querySelectorAll('.job-list-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.delete-btn')) return;
        chrome.tabs.create({ url: item.dataset.url });
      });
    });

    // Delete buttons
    container.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const list = btn.dataset.list;
        const index = parseInt(btn.dataset.index);
        chrome.storage.local.get([list], (data) => {
          const jobs = data[list] || [];
          jobs.splice(index, 1);
          chrome.storage.local.set({ [list]: jobs }, () => loadSavedJobs());
        });
      });
    });
  }

  // Open Dashboard
  document.getElementById('dashboardBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  });

  // Export to CSV
  document.getElementById('exportBtn').addEventListener('click', () => {
    chrome.storage.local.get(['bookmarked', 'applied'], (data) => {
      const allJobs = [
        ...(data.bookmarked || []).map(j => ({ ...j, status: 'Bookmarked' })),
        ...(data.applied || []).map(j => ({ ...j, status: 'Applied' }))
      ];

      if (allJobs.length === 0) {
        showToast('No jobs to export');
        return;
      }

      const headers = ['Title', 'Company', 'Pay', 'Location', 'Type', 'Deadline', 'Status', 'URL', 'Saved At'];
      const rows = allJobs.map(j => [
        j.title || '', j.company || '', j.pay || '', j.location || '',
        j.type || '', j.deadline || '', j.status || '', j.url || '', j.savedAt || ''
      ]);

      const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `doorian-jobs-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Exported ${allJobs.length} jobs!`);
    });
  });

  // Clear data
  document.getElementById('clearDataBtn').addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all saved jobs?')) {
      chrome.storage.local.clear(() => {
        loadSavedJobs();
        showToast('All data cleared');
      });
    }
  });

  // Toast notification
  function showToast(msg) {
    let toast = document.querySelector('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
  }
});
