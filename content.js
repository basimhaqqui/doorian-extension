// Content script - extracts job data from supported job sites

function extractHandshakeJob() {
  const title = document.querySelector('h1')?.textContent?.trim() || '';
  const allText = document.body.innerText;

  let company = document.querySelector('[data-hook="employer-name"], a[href*="/employers/"], a[href*="/employer"]')?.textContent?.trim() || '';
  if (!company) {
    const allLinks = document.querySelectorAll('a');
    for (const link of allLinks) {
      if (link.href && link.href.includes('/employers/') && link.textContent.trim()) {
        company = link.textContent.trim();
        break;
      }
    }
  }
  if (!company) {
    const companyMatch = allText.match(/^(.+?)\n(?:Internet|Software|Technology|Manufacturing|Financial|Scientific|Information|Consulting|Healthcare|Education|Engineering|Business)[^\n]*\n/m);
    if (companyMatch) company = companyMatch[1].trim();
  }

  const glanceItems = document.querySelectorAll('[class*="style__body"] li, [class*="at-a-glance"] li, .style-guide-at-a-glance li');
  let pay = '';
  let location = '';
  let type = '';

  // Pay - look for salary patterns
  const payMatch = allText.match(/\$[\d,]+(?:\s*[-–]\s*\$?[\d,]+)?(?:\/(?:hr|yr))?/);
  if (payMatch) pay = payMatch[0];

  // Deadline
  const deadlineMatch = allText.match(/Apply by\s+(.+?)(?:\n|$)/i);
  const deadline = deadlineMatch ? deadlineMatch[1].trim() : '';

  // Location - look for common patterns
  const locationEl = document.querySelectorAll('[class*="glance"] div, [class*="detail"] div');
  locationEl.forEach(el => {
    const text = el.textContent.trim();
    if (text.includes('based in') || text.includes('Remote') || text.includes('Onsite') || text.includes('Hybrid')) {
      if (!location) location = text;
    }
  });

  // If we couldn't get location from elements, try regex
  if (!location) {
    const locMatch = allText.match(/(?:Remote|Onsite|Hybrid)[^.\n]*(?:based in [^.\n]+)?/i);
    if (locMatch) location = locMatch[0].trim();
  }

  // Job type
  const typeMatch = allText.match(/(?:Full-time|Part-time|Internship|Contract)/i);
  if (typeMatch) type = typeMatch[0];

  return {
    title,
    company,
    pay,
    location,
    type,
    deadline,
    source: 'Handshake'
  };
}

function extractLinkedInJob() {
  // Title - try multiple selectors LinkedIn uses
  const title = (
    document.querySelector('.job-details-jobs-unified-top-card__job-title h1') ||
    document.querySelector('.job-details-jobs-unified-top-card__job-title') ||
    document.querySelector('.jobs-unified-top-card__job-title') ||
    document.querySelector('h1.t-24') ||
    document.querySelector('.topcard__title') ||
    document.querySelector('h1[class*="job-title"]') ||
    document.querySelector('h1')
  )?.textContent?.trim() || '';

  // Company
  let company = (
    document.querySelector('.job-details-jobs-unified-top-card__company-name a') ||
    document.querySelector('.job-details-jobs-unified-top-card__company-name') ||
    document.querySelector('.jobs-unified-top-card__company-name a') ||
    document.querySelector('.jobs-unified-top-card__company-name') ||
    document.querySelector('.topcard__org-name-link') ||
    document.querySelector('a[class*="company-name"]') ||
    document.querySelector('[class*="company-name"]')
  )?.textContent?.trim() || '';

  // Location - try selectors then fallback to text near company name
  let location = (
    document.querySelector('.job-details-jobs-unified-top-card__bullet') ||
    document.querySelector('.jobs-unified-top-card__bullet') ||
    document.querySelector('.topcard__flavor--bullet') ||
    document.querySelector('[class*="job-location"]') ||
    document.querySelector('span[class*="location"]')
  )?.textContent?.trim() || '';

  const allText = document.body.innerText;

  // Location fallback: look for "City, State" or "(Hybrid/Remote/On-site)" patterns near job info
  if (!location) {
    const locMatch = allText.match(/([A-Z][a-zA-Z\s]+(?:,\s*[A-Z]{2})?(?:\s+(?:Area|Metro))?\s*\((?:Hybrid|Remote|On-site)\))/);
    if (locMatch) location = locMatch[1].trim();
  }
  if (!location) {
    // Try to find location text right after company name in the page
    const locMatch2 = allText.match(/(?:Location[:\s]*)([\w\s,.-]+(?:\((?:Hybrid|Remote|On-site)\))?)/i);
    if (locMatch2) location = locMatch2[1].trim();
  }

  // Pay
  const payMatch = allText.match(/\$[\d,]+(?:K)?(?:\s*[-–\/]\s*\$?[\d,]+(?:K)?)?(?:\s*\/(?:hr|yr))?/);
  const pay = payMatch ? payMatch[0] : '';

  // Job type
  const typeMatch = allText.match(/(?:Full-time|Part-time|Internship|Contract|Temporary)/i);
  const type = typeMatch ? typeMatch[0] : '';

  // Deadline - LinkedIn sometimes shows "Apply by" or posting date
  let deadline = '';
  const deadlineMatch = allText.match(/(?:Apply by|Application deadline|Deadline)[:\s]*([^\n]+)/i);
  if (deadlineMatch) deadline = deadlineMatch[1].trim();
  // Fallback: "Posted X ago" as reference
  if (!deadline) {
    const postedMatch = allText.match(/Posted\s+(\d+\s+(?:hour|day|week|month)s?\s+ago)/i);
    if (postedMatch) deadline = postedMatch[1];
  }

  // Fallback for company/title from links
  if (!company) {
    const links = document.querySelectorAll('a[href*="/company/"]');
    for (const link of links) {
      const text = link.textContent.trim();
      if (text && text.length < 100) {
        company = text;
        break;
      }
    }
  }

  return {
    title,
    company,
    pay,
    location,
    type,
    deadline,
    source: 'LinkedIn'
  };
}

function extractIndeedJob() {
  const title = document.querySelector('h1.jobsearch-JobInfoHeader-title, .jobsearch-JobInfoHeader-title')?.textContent?.trim() || '';
  const company = document.querySelector('[data-company-name], .css-1saizt3')?.textContent?.trim() || '';
  const location = document.querySelector('[data-testid="job-location"], .css-6z8o9s')?.textContent?.trim() || '';

  const allText = document.body.innerText;
  const payMatch = allText.match(/\$[\d,]+(?:\s*[-–]\s*\$?[\d,]+)?(?:\s*(?:a |an |per )?(?:year|hour|month|week))?/i);
  const pay = payMatch ? payMatch[0] : '';

  const typeMatch = allText.match(/(?:Full-time|Part-time|Internship|Contract|Temporary)/i);
  const type = typeMatch ? typeMatch[0] : '';

  return {
    title,
    company,
    pay,
    location,
    type,
    deadline: '',
    source: 'Indeed'
  };
}

function extractJobData() {
  const url = window.location.href;

  if (url.includes('joinhandshake.com')) {
    return extractHandshakeJob();
  } else if (url.includes('linkedin.com')) {
    return extractLinkedInJob();
  } else if (url.includes('indeed.com')) {
    return extractIndeedJob();
  }

  return null;
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getJobData') {
    const job = extractJobData();
    sendResponse({ job });
  }
  return true;
});

// Safe wrapper for chrome API calls — prevents errors when extension is reloaded
function safeStorageGet(keys, callback) {
  try {
    if (!chrome.runtime?.id) return;
    chrome.storage.local.get(keys, (data) => {
      if (chrome.runtime.lastError) return;
      callback(data);
    });
  } catch (e) { /* extension context invalidated */ }
}

function safeStorageSet(obj, callback) {
  try {
    if (!chrome.runtime?.id) return;
    chrome.storage.local.set(obj, () => {
      if (chrome.runtime.lastError) return;
      if (callback) callback();
    });
  } catch (e) { /* extension context invalidated */ }
}

// --- Floating "Add Job" button ---
function createFloatingButton() {
  if (document.getElementById('doorian-fab')) return;

  const job = extractJobData();
  if (!job || !job.title) return;

  const fab = document.createElement('button');
  fab.id = 'doorian-fab';
  fab.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
    </svg>
    Add Job`;

  // Check if already saved
  safeStorageGet(['bookmarked', 'applied'], (data) => {
    const allSaved = [...(data.bookmarked || []), ...(data.applied || [])];
    if (allSaved.some(j => j.url === window.location.href)) {
      fab.classList.add('saved');
      fab.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
        </svg>
        Saved`;
    }
  });

  fab.addEventListener('click', () => {
    const currentJob = extractJobData();
    if (!currentJob) return;

    const jobData = {
      ...currentJob,
      url: window.location.href,
      savedAt: new Date().toISOString()
    };

    safeStorageGet(['bookmarked'], (data) => {
      const list = data.bookmarked || [];
      if (list.some(j => j.url === jobData.url)) return;
      list.unshift(jobData);
      safeStorageSet({ bookmarked: list }, () => {
        fab.classList.add('saved');
        fab.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
          </svg>
          Saved`;
      });
    });
  });

  document.body.appendChild(fab);
}

// --- Auto-detect Apply button clicks ---
function createApplyToast(job) {
  let toast = document.getElementById('doorian-apply-toast');
  if (toast) toast.remove();

  toast = document.createElement('div');
  toast.id = 'doorian-apply-toast';
  toast.innerHTML = `
    <div class="toast-header">
      <div class="toast-logo">D</div>
      <div>
        <div class="toast-title">Application Detected</div>
        <div class="toast-subtitle">DoorIan</div>
      </div>
    </div>
    <div class="toast-body">
      Track <span class="toast-job-name">${job.title}</span> at ${job.company || 'this company'}?
    </div>
    <div class="toast-actions">
      <button class="toast-btn toast-btn-primary" id="doorian-toast-save">Save as Applied</button>
      <button class="toast-btn toast-btn-secondary" id="doorian-toast-dismiss">Dismiss</button>
    </div>`;

  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('visible'), 50);

  document.getElementById('doorian-toast-save').addEventListener('click', () => {
    const jobData = {
      ...job,
      url: window.location.href,
      status: 'Applied',
      savedAt: new Date().toISOString()
    };

    safeStorageGet(['applied', 'bookmarked'], (data) => {
      const applied = data.applied || [];
      const bookmarked = (data.bookmarked || []).filter(j => j.url !== jobData.url);
      if (!applied.some(j => j.url === jobData.url)) {
        applied.unshift(jobData);
      }
      safeStorageSet({ applied, bookmarked }, () => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);

        // Update FAB if present
        const fab = document.getElementById('doorian-fab');
        if (fab) {
          fab.classList.add('saved');
          fab.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
            </svg>
            Saved`;
        }
      });
    });
  });

  document.getElementById('doorian-toast-dismiss').addEventListener('click', () => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  });

  // Auto-dismiss after 15 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    }
  }, 15000);
}

function watchForApplyClicks() {
  const applySelectors = [
    'button[aria-label*="Apply"]',
    'button[aria-label*="apply"]',
    'a[aria-label*="Apply"]',
    'button[data-control-name*="apply"]',
    '.jobs-apply-button',
    '.ia-IndeedApplyButton',
    'button.apply',
    'a.apply',
    '[class*="apply-button"]',
    '[class*="ApplyButton"]',
    'button[class*="apply"]',
    'a[class*="apply"]'
  ];

  document.addEventListener('click', (e) => {
    const target = e.target.closest(applySelectors.join(', '));
    if (!target) {
      // Also check if button text contains "Apply"
      const btn = e.target.closest('button, a');
      if (!btn) return;
      const text = btn.textContent.trim();
      if (!/^(Easy )?Apply/i.test(text) && !/Apply (Now|Externally)/i.test(text)) return;
    }

    const job = extractJobData();
    if (job && job.title) {
      // Small delay so the apply action goes through first
      setTimeout(() => createApplyToast(job), 800);
    }
  }, true);
}

// Initialize on page load
function init() {
  createFloatingButton();
  watchForApplyClicks();
}

// Run on load and on SPA navigation changes
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Re-check on URL changes (for SPAs like LinkedIn)
let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    const oldFab = document.getElementById('doorian-fab');
    if (oldFab) oldFab.remove();
    setTimeout(init, 1000);
  }
}).observe(document.body, { childList: true, subtree: true });
