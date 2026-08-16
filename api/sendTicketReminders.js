import { getServiceClient, errorResponse } from './_lib.js';

// Only send reminders/escalations Mon-Fri, 7am-6pm Atlantic time (matches
// normal business hours -- no one should get paged nights or weekends for a
// non-critical reminder). Uses the IANA timezone rather than a fixed UTC
// offset so AST/ADT daylight-saving transitions are handled automatically.
function isWithinBusinessHours(now) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Halifax',
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(now);
  const weekday = parts.find(p => p.type === 'weekday')?.value;
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value, 10);
  const isWeekday = !['Sat', 'Sun'].includes(weekday);
  const isWorkingHour = hour >= 7 && hour < 18; // 7:00am - 5:59pm
  return isWeekday && isWorkingHour;
}

// Runs on an hourly Vercel Cron schedule (see vercel.json). For every open,
// owned ticket that isn't Pending: sends the owner a reminder once activity
// has been quiet for 4 hours (Critical) or 24 hours (everything else), and
// escalates to a manager if it's still quiet after 2x that threshold.
// "Activity" = the most recent of the ticket's own last update (covers
// status changes) or its most recent note.
export default async function handler(req, res) {
  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET
  // is configured; only enforce the check if that env var is actually set,
  // so this doesn't break in environments that haven't configured it yet.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers['authorization'] || '';
    if (authHeader !== `Bearer ${cronSecret}`) {
      return errorResponse(res, 401, 'Unauthorized');
    }
  }

  try {
    const db = getServiceClient();
    const resendApiKey = process.env.RESEND_API_KEY;
    const appUrl = process.env.APP_URL || 'https://app.fieldcalls.com';
    const managerEmail = process.env.TICKET_ESCALATION_EMAIL;
    const now = new Date();

    if (!isWithinBusinessHours(now)) {
      return res.json({ success: true, skipped: true, reason: 'Outside business hours (Mon-Fri 7am-6pm Atlantic time)' });
    }

    const { data: tickets, error } = await db
      .from('tickets')
      .select('*')
      .not('technician_id', 'is', null)
      .not('status', 'in', '(Resolved,Closed,Pending)');
    if (error) throw error;

    const results = [];

    for (const ticket of tickets || []) {
      const { data: notes } = await db
        .from('ticket_notes')
        .select('created_date')
        .eq('ticket_id', ticket.id)
        .order('created_date', { ascending: false })
        .limit(1);

      const lastNoteDate = notes && notes[0] ? new Date(notes[0].created_date) : null;
      const lastUpdateDate = ticket.updated_date ? new Date(ticket.updated_date) : new Date(ticket.created_date);
      const lastActivity = lastNoteDate && lastNoteDate > lastUpdateDate ? lastNoteDate : lastUpdateDate;

      const hoursSinceActivity = (now - lastActivity) / (1000 * 60 * 60);
      const threshold = ticket.urgency === 'Critical' ? 4 : 24;
      const escalationThreshold = threshold * 2;

      if (hoursSinceActivity < threshold) continue;

      const { data: tech } = await db.from('technicians').select('*').eq('id', ticket.technician_id).maybeSingle();

      // Reminder: only re-send if none has gone out since the last real activity.
      const lastReminder = ticket.last_reminder_sent_at ? new Date(ticket.last_reminder_sent_at) : null;
      const reminderDue = !lastReminder || lastReminder < lastActivity;

      if (reminderDue) {
        if (tech?.email && resendApiKey) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'FieldCalls Support <noreply@tickets.fieldcalls.com>',
              to: [tech.email],
              subject: `Reminder: Ticket #${ticket.ticket_number} needs attention`,
              html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
                <h2>Ticket Reminder</h2>
                <p>Hello ${tech.full_name},</p>
                <p>Ticket <strong>${ticket.ticket_number}</strong> ("${ticket.subject}") assigned to you has had no activity for over ${Math.floor(hoursSinceActivity)} hours${ticket.urgency === 'Critical' ? ' and is marked Critical' : ''}.</p>
                <div style="text-align:center;margin:30px 0">
                  <a href="${appUrl}" style="background:#4f46e5;color:white;padding:10px 20px;text-decoration:none;border-radius:5px">View Ticket</a>
                </div>
                <p style="color:#999;font-size:12px">This reminder will stop once you add a note or change the status to Pending.</p>
              </div>`,
            }),
          });
        }
        await db.from('tickets').update({ last_reminder_sent_at: now.toISOString() }).eq('id', ticket.id);
        await db.from('ticket_events').insert({
          ticket_id: ticket.id,
          event_type: 'reminder_sent',
          to_value: tech?.full_name || ticket.technician_id,
        });
        results.push({ ticket: ticket.ticket_number, action: 'reminder_sent' });
      }

      // Escalation: only re-send if none has gone out since the last real activity.
      if (hoursSinceActivity >= escalationThreshold) {
        const lastEscalation = ticket.last_escalation_sent_at ? new Date(ticket.last_escalation_sent_at) : null;
        const escalationDue = !lastEscalation || lastEscalation < lastActivity;
        if (escalationDue) {
          if (managerEmail && resendApiKey) {
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                from: 'FieldCalls Support <noreply@tickets.fieldcalls.com>',
                to: [managerEmail],
                subject: `Escalation: Ticket #${ticket.ticket_number} has had no activity`,
                html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
                  <h2>Ticket Escalation</h2>
                  <p>Ticket <strong>${ticket.ticket_number}</strong> ("${ticket.subject}"), owned by ${tech?.full_name || 'an unassigned technician'}, has had no activity for over ${Math.floor(hoursSinceActivity)} hours despite a reminder already being sent.</p>
                  <div style="text-align:center;margin:30px 0">
                    <a href="${appUrl}" style="background:#dc2626;color:white;padding:10px 20px;text-decoration:none;border-radius:5px">View Ticket</a>
                  </div>
                </div>`,
              }),
            });
          }
          await db.from('tickets').update({ last_escalation_sent_at: now.toISOString() }).eq('id', ticket.id);
          await db.from('ticket_events').insert({ ticket_id: ticket.id, event_type: 'escalated' });
          results.push({ ticket: ticket.ticket_number, action: 'escalated' });
        }
      }
    }

    return res.json({ success: true, processed: results.length, results });
  } catch (err) {
    console.error('sendTicketReminders error:', err);
    return errorResponse(res, 500, err.message);
  }
}
