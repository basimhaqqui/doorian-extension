// Content script - extracts job data from supported job sites

function extractHandshakeJob() {
  const title = document.querySelector('h1')?.textContent?.trim() || '';
  // Try multiple selectors + fallback: grab the text right after the company logo area
  let company = document.querySelector('[data-hook="employer-name"], a[href*="/employers/"], a[href*="/employer"]')?.textContent?.trim() || '';
  if (!company) {
    // Handshake often puts company name as a link or heading near the top
    const allLinks = document.querySelectorAll('a');
    for (const link of allLinks) {
      if (link.href && link.href.includes('/employers/') && link.textContent.trim()) {
        company = link.textContent.trim();
        break;
      }
    }
  }
  if (!company) {
    // Fallback: look for text pattern "CompanyName\nIndustry" above the job title
    const allText = document.body.innerText;
    const companyMatch = allText.match(/^(.+?)\n(?:Internet|Software|Technology|Manufacturing|Financial|Scientific|Information|Consulting|Healthcare|Education|Engineering|Business)[^\n]*\n/m);
    if (companyMatch) company = companyMatch[1].trim();
  }

  // Extract "At a glance" details
  const glanceItems = document.querySelectorAll('[class*="style__body"] li, [class*="at-a-glance"] li, .style-guide-at-a-glance li');
  let pay = '';
  let location = '';
  let type = '';

  // Try to get info from the "At a glance" section
  const allText = document.body.innerText;

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
