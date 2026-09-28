// lib/feedback.js
// Validation and the optional Discord notification for the Feedback button.
// Submissions are always stored in the feedback table; FEEDBACK_WEBHOOK_URL
// (a Discord channel webhook) additionally pings the owner's phone.

const KINDS = ['problem', 'idea', 'other'];

function parseFeedback(body) {
  const { kind, message, contact, page } = body || {};
  if (typeof message !== 'string' || message.trim() === '') return { error: 'Please write a message' };
  if (message.trim().length > 2000) return { error: 'Message must be under 2000 characters' };
  if (contact != null && (typeof contact !== 'string' || contact.length > 200)) {
    return { error: 'Contact must be under 200 characters' };
  }
  return {
    value: {
      kind: KINDS.includes(kind) ? kind : 'other',
      message: message.trim(),
      contact: typeof contact === 'string' && contact.trim() ? contact.trim() : null,
      // Drop the URL fragment: it can hold a manage link token.
      page: typeof page === 'string' ? page.split(/[?#]/)[0].slice(0, 300) : null,
    },
  };
}

async function notifyFeedback(feedback) {
  const url = process.env.FEEDBACK_WEBHOOK_URL;
  if (!url) return;
  const lines = [
    `**Carpool feedback** (${feedback.kind})`,
    feedback.message,
    feedback.contact ? `Contact: ${feedback.contact}` : 'No contact left',
  ];
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // allowed_mentions: user text must never ping @everyone.
      body: JSON.stringify({ content: lines.join('\n').slice(0, 1900), allowed_mentions: { parse: [] } }),
      signal: AbortSignal.timeout(3000),
    });
  } catch (err) {
    console.error('Feedback webhook failed:', err.message);
  }
}

module.exports = { parseFeedback, notifyFeedback };
