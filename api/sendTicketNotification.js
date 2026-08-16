import { requireAuth, getServiceClient, errorResponse } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return errorResponse(res, 405, 'Method not allowed');

  try {
    const user = await requireAuth(req);
    const db = getServiceClient();
    const { ticketData, customerName } = req.body;

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
  } catch (err) {
    if (err.status) return errorResponse(res, err.status, err.error);
    console.error('sendTicketNotification error:', err);
    return errorResponse(res, 500, err.message);
  }
}
