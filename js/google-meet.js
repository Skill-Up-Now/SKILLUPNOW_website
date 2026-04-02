/* ==========================================
   GOOGLE MEET MODULE — Admin Scheduling
   ==========================================
   Modular, independent component for scheduling,
   agenda generation, and website publishing.
   ========================================== */

const GoogleMeetModule = (() => {
  const STORAGE_KEY = 'adminMeets';

  /* ── Agenda Generator ──
     Auto-generates a concise 2-line agenda based on meeting title, course, and date.
  */
  function generateAgenda(title, course, date) {
    const formattedDate = date ? new Date(date).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '';
    const courseLabel = course && course !== 'General / All Students' ? `${course}` : 'all enrolled students';
    const line1 = `Live session: ${title || 'Interactive Q&A and concept walkthrough'} for ${courseLabel}.`;
    const line2 = `${formattedDate ? 'Scheduled for ' + formattedDate + '. ' : ''}Students should review recent modules and prepare questions in advance.`;
    return `${line1}\n${line2}`;
  }

  /* ── URL Parser ──
     Extracts meeting ID from a Google Meet link.
     Returns null if the URL doesn't match the expected pattern.
  */
  function parseMeetUrl(url) {
    if (!url) return null;
    const match = url.match(/meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/i);
    return match ? match[1] : null;
  }

  /* ── URL Validator ──
     Returns true if the URL looks like a valid Google Meet link.
  */
  function isValidMeetUrl(url) {
    return /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/i.test(url.trim());
  }

  /* ── Save Meet ──
     Saves a meet to localStorage. Marks as published if publishToWebsite is true.
  */
  function saveMeet(meetData) {
    const meets = loadAllMeets();
    const meet = {
      id: Date.now().toString(36),
      ...meetData,
      created: new Date().toISOString(),
      published: meetData.publishToWebsite === true,
    };
    delete meet.publishToWebsite;
    meets.unshift(meet);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(meets));
    return meet;
  }

  /* ── Load All Meets ──
     Returns all stored meets from localStorage.
  */
  function loadAllMeets() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  /* ── Load Upcoming Meets ──
     Returns only future meets, optionally filtered to published-only.
  */
  function loadUpcomingMeets(publishedOnly = false) {
    const now = Date.now();
    return loadAllMeets().filter(m => {
      const meetTime = new Date(`${m.date}T${m.time || '00:00'}`).getTime();
      if (meetTime < now) return false;
      if (publishedOnly && !m.published) return false;
      return true;
    });
  }

  /* ── Delete Meet ──
     Removes a meet by index from localStorage.
  */
  function deleteMeet(idx) {
    const meets = loadAllMeets();
    meets.splice(idx, 1);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(meets));
  }

  /* ── Toggle Publish ──
     Toggles the published state of a meet by index.
  */
  function togglePublish(idx) {
    const meets = loadAllMeets();
    if (!meets[idx]) return;
    meets[idx].published = !meets[idx].published;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(meets));
    return meets[idx].published;
  }

  /* ── Format Meet Card (for home page display) ──
     Returns an HTML string for displaying a meet on the home page.
  */
  function formatMeetCard(meet) {
    const meetDate = new Date(`${meet.date}T${meet.time || '00:00'}`);
    const dateStr = meetDate.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
    const timeStr = meetDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const meetId = parseMeetUrl(meet.link);
    const linkHtml = meet.link
      ? `<a href="${meet.link}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:0.4rem;color:#00cfee;font-weight:600;font-size:0.8rem;text-decoration:none;margin-top:0.5rem;">
           <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
           Join Meet${meetId ? ' · ' + meetId : ''}
         </a>`
      : '';
    return `
      <div style="background:var(--panel);border:1px solid var(--border);border-radius:var(--r2);padding:1.2rem;transition:all 0.3s ease;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;">
          <div style="flex:1;">
            <div style="font-weight:700;color:var(--txt);font-size:0.95rem;margin-bottom:0.3rem;">${meet.title}</div>
            ${meet.course ? `<div style="font-size:0.78rem;color:var(--v2);font-weight:600;margin-bottom:0.4rem;">${meet.course}</div>` : ''}
            <div style="font-size:0.82rem;color:var(--txt3);line-height:1.5;">${(meet.notes || '').split('\n')[0] || ''}</div>
            ${linkHtml}
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <div style="font-size:0.82rem;font-weight:700;color:var(--txt2);">${dateStr}</div>
            <div style="font-size:0.78rem;color:var(--txt4);">${timeStr}</div>
            ${meet.duration ? `<div style="font-size:0.72rem;color:var(--txt4);">${meet.duration} min</div>` : ''}
          </div>
        </div>
      </div>`;
  }

  /* Public API */
  return {
    generateAgenda,
    parseMeetUrl,
    isValidMeetUrl,
    saveMeet,
    loadAllMeets,
    loadUpcomingMeets,
    deleteMeet,
    togglePublish,
    formatMeetCard,
  };
})();

window.GoogleMeetModule = GoogleMeetModule;
