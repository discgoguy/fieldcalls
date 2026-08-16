import { requireAuth, getServiceClient, errorResponse } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return errorResponse(res, 405, 'Method not allowed');

  try {
    await requireAuth(req);
    const db = getServiceClient();
    const { noteId } = req.body;

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
  } catch (err) {
    if (err.status) return errorResponse(res, err.status, err.error);
    console.error('sendTicketNoteNotification error:', err);
    return errorResponse(res, 500, err.message);
  }
}
