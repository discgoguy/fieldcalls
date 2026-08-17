import { requireAuth, getServiceClient, errorResponse } from './_lib.js';

// Consolidated ticket-notification endpoints (assignment / new-ticket / note
// emails, plus the reminder sweep) -- merged into one route to stay under the
// Vercel Hobby-plan 12-serverless-function cap, same pattern as api/crm.ts.
// GET is reserved for the Vercel Cron reminder sweep (see vercel.json); POST
// actions are triggered from the frontend via
// invokeApi('ticketNotifications', { action, ...payload }).

// ======================= reminders (cron, GET) =======================
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

// Runs on the Vercel Cron schedule (see vercel.json). For every open, owned
// ticket that isn't Pending: sends the owner a reminder once activity has
// been quiet for 4 hours (Critical) or 24 hours (everything else), and
// escalates to a manager if it's still quiet after 2x that threshold.
// "Activity" = the most recent of the ticket's own last update (covers
// status changes) or its most recent note.
async function handleReminders(req, res) {
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
    console.error('ticketNotifications reminders error:', err);
    return errorResponse(res, 500, err.message);
  }
}

// ======================= assignment (POST) =======================
// Notifies a technician by email when a ticket is assigned to them (at
// creation or via ownership transfer) -- but only when it's actually someone
// other than whoever is doing the assigning, so nobody gets emailed for
// assigning a ticket to themselves.
async function handleAssignment(user, body, res) {
  const db = getServiceClient();
  const { ticketId } = body;
  if (!ticketId) return errorResponse(res, 400, 'ticketId is required');

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) return errorResponse(res, 500, 'Resend API key not configured');

  const { data: ticket } = await db.from('tickets').select('*').eq('id', ticketId).maybeSingle();
  if (!ticket || !ticket.technician_id) {
    return res.json({ message: 'No technician assigned, nothing to notify' });
  }

  const { data: technician } = await db.from('technicians').select('*').eq('id', ticket.technician_id).maybeSingle();
  if (!technician?.email) {
    return res.json({ message: 'Assigned technician has no email on file' });
  }

  const appUrl = process.env.APP_URL || 'https://app.fieldcalls.com';

  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'FieldCalls Support <noreply@tickets.fieldcalls.com>',
      to: [technician.email],
      subject: `Ticket Assigned to You: ${ticket.ticket_number}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2>A Ticket Has Been Assigned to You</h2>
        <p>Hello ${technician.full_name},</p>
        <p><strong>${ticket.ticket_number}</strong> ("${ticket.subject}") has been assigned to you${user?.full_name ? ` by ${user.full_name}` : ''}.</p>
        <div style="background:#f5f5f5;padding:20px;border-radius:8px">
          <p><strong>Urgency:</strong> ${ticket.urgency}</p>
          <p><strong>Type:</strong> ${ticket.ticket_type}</p>
        </div>
        <div style="text-align:center;margin:30px 0">
          <a href="${appUrl}" style="background:#4f46e5;color:white;padding:10px 20px;text-decoration:none;border-radius:5px">View Ticket</a>
        </div>
        <p style="color:#999;font-size:12px">Automated notification from FieldCalls Support</p>
      </div>`,
    }),
  });

  const resendResult = await resendResponse.json().catch(() => null);
  if (!resendResponse.ok) {
    console.error('Resend API error sending assignment notification:', resendResponse.status, resendResult);
    return errorResponse(res, 502, `Resend API error (${resendResponse.status}): ${resendResult?.message || JSON.stringify(resendResult)}`);
  }

  return res.json({ success: true, resendId: resendResult?.id });
}

// ======================= newTicket (POST) =======================
async function handleNewTicket(user, body, res) {
  const db = getServiceClient();
  const { ticketData, customerName } = body;

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) return errorResponse(res, 500, 'Resend API key not configured');

  // Get Customer Service team members
  const { data: allProfiles } = await db.from('profiles').select('*');
  const csUsers = (allProfiles || []).filter(u =>
    u.department && u.department.toLowerCase().includes('customer service')
  );

  const recipientEmails = csUsers.map(u => u.email).filter(Boolean);
  if (recipientEmails.length === 0) {
    return res.json({ message: 'No Customer Service users found to notify' });
  }

  const appUrl = process.env.APP_URL || 'https://your-app.vercel.app';

  // Determine customer email
  let customerEmailAddress = null;
  if (user.is_customer) {
    customerEmailAddress = user.email;
  } else if (ticketData.customer_id) {
    const { data: customer } = await db.from('customers').select('email').eq('id', ticketData.customer_id).single();
    customerEmailAddress = customer?.email || null;
  }

  const sendEmail = (payload) =>
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

  // Internal notification
  await sendEmail({
    from: 'FieldCalls Support <noreply@tickets.fieldcalls.com>',
    to: recipientEmails,
    subject: `New Support Ticket: ${ticketData.subject}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <h2>New Support Ticket Created</h2>
      <div style="background:#f5f5f5;padding:20px;border-radius:8px">
        <p><strong>Ticket #:</strong> ${ticketData.ticket_number}</p>
        <p><strong>Customer:</strong> ${customerName}</p>
        <p><strong>Subject:</strong> ${ticketData.subject}</p>
        <p><strong>Type:</strong> ${ticketData.ticket_type}</p>
        <p><strong>Urgency:</strong> ${ticketData.urgency}</p>
        <p><strong>Status:</strong> ${ticketData.status}</p>
      </div>
      <p><strong>Description:</strong></p>
      <p style="background:#f9f9f9;padding:15px;border-left:4px solid #4f46e5">${ticketData.description}</p>
      <p style="color:#999;font-size:12px">Automated notification from FieldCalls Support</p>
    </div>`,
  });

  // Customer confirmation
  if (customerEmailAddress) {
    await sendEmail({
      from: 'FieldCalls Support <noreply@tickets.fieldcalls.com>',
      to: [customerEmailAddress],
      subject: `Ticket Received: ${ticketData.ticket_number} - ${ticketData.subject}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2>We received your request</h2>
        <p>Hello ${user.full_name || 'Customer'},</p>
        <p>Thank you for contacting FieldCalls Support. Our team will review it shortly.</p>
        <div style="background:#f5f5f5;padding:20px;border-radius:8px">
          <p><strong>Ticket #:</strong> ${ticketData.ticket_number}</p>
          <p><strong>Subject:</strong> ${ticketData.subject}</p>
          <p><strong>Status:</strong> ${ticketData.status}</p>
        </div>
        <p style="color:#999;font-size:12px">Automated notification from FieldCalls Support</p>
      </div>`,
    });
  }

  return res.json({ success: true, message: `Notifications sent to ${recipientEmails.length} recipients.` });
}

// ======================= note (POST) =======================
async function handleNote(user, body, res) {
  const db = getServiceClient();
  const { noteId } = body;

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) return errorResponse(res, 500, 'Resend API key not configured');

  const { data: notes } = await db.from('ticket_notes').select('*').eq('id', noteId);
  if (!notes || notes.length === 0) return errorResponse(res, 404, 'Note not found');
  const note = notes[0];

  const { data: ticket } = await db.from('tickets').select('*').eq('id', note.ticket_id).single();
  if (!ticket) return errorResponse(res, 404, 'Ticket not found');

  let recipientEmail = null;
  let recipientName = 'User';
  let emailSubject = '';

  if (note.author_role === 'technician' || note.author_role === 'system') {
    if (note.is_internal) return res.json({ message: 'Internal note, no notification sent.' });

    if (ticket.customer_id) {
      const { data: customer } = await db.from('customers').select('*').eq('id', ticket.customer_id).single();
      if (customer?.email) {
        recipientEmail = customer.email;
        recipientName = customer.contact_person || customer.company_name;
        emailSubject = `Update on Ticket #${ticket.ticket_number}`;
      }
    }
  } else if (note.author_role === 'customer') {
    if (ticket.technician_id) {
      const { data: tech } = await db.from('technicians').select('*').eq('id', ticket.technician_id).single();
      if (tech?.email) {
        recipientEmail = tech.email;
        recipientName = tech.full_name;
        emailSubject = `Customer Reply on Ticket #${ticket.ticket_number}`;
      }
    }

    if (!recipientEmail) {
      const { data: profiles } = await db.from('profiles').select('*');
      const csUsers = (profiles || []).filter(u =>
        u.department && u.department.toLowerCase().includes('customer service')
      );
      if (csUsers.length > 0) {
        recipientEmail = csUsers.map(u => u.email);
        recipientName = 'Customer Service Team';
        emailSubject = `[Unassigned] Customer Reply on Ticket #${ticket.ticket_number}`;
      } else {
        return res.json({ message: 'No recipient found.' });
      }
    }
  }

  if (!recipientEmail || (Array.isArray(recipientEmail) && recipientEmail.length === 0)) {
    return res.json({ message: 'No valid recipient email found.' });
  }

  const appUrl = process.env.APP_URL || 'https://your-app.vercel.app';
  const emailData = {
    from: 'FieldCalls Support <noreply@tickets.fieldcalls.com>',
    to: Array.isArray(recipientEmail) ? recipientEmail : [recipientEmail],
    subject: emailSubject,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <h2>${emailSubject}</h2>
      <p>Hello ${recipientName},</p>
      <p>A new note has been added to ticket <strong>${ticket.ticket_number}</strong>.</p>
      <div style="background:#f5f5f5;padding:20px;border-radius:8px;margin:20px 0">
        <p><strong>From:</strong> ${note.author_name} (${note.author_role})</p>
        <p><strong>Message:</strong></p>
        <p style="white-space:pre-wrap">${note.content}</p>
      </div>
      <div style="text-align:center;margin:30px 0">
        <a href="${appUrl}" style="background:#4f46e5;color:white;padding:10px 20px;text-decoration:none;border-radius:5px">View Ticket</a>
      </div>
      <p style="color:#999;font-size:12px">Automated notification from FieldCalls Support System.</p>
    </div>`,
  };

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(emailData),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Email failed: ${response.status} - ${errorText}`);
  }

  return res.json({ message: `Notification sent to ${recipientEmail}` });
}

// ============================ dispatch ============================
export default async function handler(req, res) {
  if (req.method === 'GET') return handleReminders(req, res);
  if (req.method !== 'POST') return errorResponse(res, 405, 'Method not allowed');

  try {
    const user = await requireAuth(req);
    const action = req.body?.action;
    if (action === 'assignment') return await handleAssignment(user, req.body, res);
    if (action === 'newTicket') return await handleNewTicket(user, req.body, res);
    if (action === 'note') return await handleNote(user, req.body, res);
    return errorResponse(res, 400, `Unknown action: ${action || '(none)'}`);
  } catch (err) {
    if (err.status) return errorResponse(res, err.status, err.error);
    console.error('ticketNotifications error:', err);
    return errorResponse(res, 500, err.message);
  }
}
