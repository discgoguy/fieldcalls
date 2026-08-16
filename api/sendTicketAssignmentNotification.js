import { requireAuth, getServiceClient, errorResponse } from './_lib.js';

// Notifies a technician by email when a ticket is assigned to them (at
// creation or via ownership transfer) -- but only when it's actually someone
// other than whoever is doing the assigning, so nobody gets emailed for
// assigning a ticket to themselves.
export default async function handler(req, res) {
  if (req.method !== 'POST') return errorResponse(res, 405, 'Method not allowed');

  try {
    const user = await requireAuth(req);
    const db = getServiceClient();
    const { ticketId } = req.body;
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
  } catch (err) {
    if (err.status) return errorResponse(res, err.status, err.error);
    console.error('sendTicketAssignmentNotification error:', err);
    return errorResponse(res, 500, err.message);
  }
}
