import { requireAuth, getServiceClient, errorResponse } from './_lib.js';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return errorResponse(res, 405, 'Method not allowed');

  try {
    const admin = await requireAuth(req);
    console.log('Admin role:', admin.role);
    if (admin.role !== 'admin') return errorResponse(res, 403, 'Only admins can invite users');

    const { email, full_name, role, customer_id, technician_id, company_name } = req.body;
    console.log('Invite request:', { email, full_name, role, customer_id });
    
    if (!email || !role) return errorResponse(res, 400, 'Missing required fields: email and role');

    const db = getServiceClient();
    const appUrl = process.env.APP_URL || 'https://app.fieldcalls.com';

    // Store pending user config
    console.log('Upserting pending_users...');
    const { error: pendingError } = await db.from('pending_users').upsert({
      email: email.toLowerCase().trim(),
      full_name: full_name || email,
      role,
      customer_id: customer_id || null,
      technician_id: technician_id || null,
      invited_by: admin.id,
      invited_at: new Date().toISOString(),
    }, { onConflict: 'email' });

    if (pendingError) {
      console.error('pending_users error:', pendingError.message);
      // Non-fatal - continue with invite
    } else {
      console.log('pending_users upsert OK');
    }

    // Generate invite link — fall back to recovery if user already exists
    console.log('Generating Supabase invite link...');
    let { data: linkData, error: inviteError } = await db.auth.admin.generateLink({
      type: 'invite',
      email,
      options: {
        data: { role, full_name: full_name || email },
        redirectTo: appUrl + '/set-password',
      }
    });

    if (inviteError) {
      console.log('Invite failed (user may already exist), trying recovery link...');
      const { data: recoveryData, error: recoveryError } = await db.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo: appUrl + '/set-password' },
      });
      if (recoveryError) {
        console.error('Recovery link also failed:', recoveryError.message);
        throw recoveryError;
      }
      linkData = recoveryData;
      console.log('Recovery link generated OK');
    } else {
      console.log('Invite link generated OK');
    }

    const inviteLink = linkData?.properties?.action_link || appUrl;
    console.log('Invite link:', inviteLink ? 'generated' : 'fallback to appUrl');

    // Send branded email with the real invite link
    console.log('Sending Resend email...');
    const isCustomer = role === 'customer';
    const portalNote = isCustomer && company_name
      ? `<p style="color:#4b5563;margin:0 0 16px;">You will have access to the <strong>FieldCalls Customer Portal</strong> for <strong>${company_name}</strong>.</p>`
      : '';

    const { error: emailError } = await resend.emails.send({
      from: 'FieldCalls <noreply@tickets.fieldcalls.com>',
      to: email,
      subject: "You've been invited to the FieldCalls Portal",
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 20px;">
<tr><td align="center">
<table width="100%" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
<tr><td style="background:#111827;padding:28px 32px;">
  <p style="margin:0;color:#fff;font-size:22px;font-weight:700;">FieldCalls</p>
  <p style="margin:4px 0 0;color:#9ca3af;font-size:13px;">Service Management Portal</p>
</td></tr>
<tr><td style="padding:32px;">
  <p style="color:#111827;font-size:20px;font-weight:600;margin:0 0 8px;">You're invited${full_name ? `, ${full_name.split(' ')[0]}` : ''}</p>
  <p style="color:#6b7280;font-size:14px;margin:0 0 24px;">${admin.full_name || 'FieldCalls'} has invited you to join the portal as a <strong>${role}</strong>.</p>
  ${portalNote}
  <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
    <tr><td align="center">
      <a href="${inviteLink}" style="display:inline-block;background:#111827;color:#fff;font-size:15px;font-weight:600;padding:14px 32px;border-radius:8px;text-decoration:none;">Accept Invitation &rarr;</a>
    </td></tr>
  </table>
  <p style="color:#9ca3af;font-size:12px;margin:0;text-align:center;">If you weren't expecting this, you can safely ignore this email.</p>
</td></tr>
<tr><td style="background:#f9fafb;border-top:1px solid #f3f4f6;padding:20px 32px;">
  <p style="margin:0;color:#9ca3af;font-size:12px;">FieldCalls Inc. &middot; </p>
</td></tr>
</table></td></tr></table>
</body></html>`,
    });

    if (emailError) {
      console.error('Resend error:', emailError.message);
      // Non-fatal - invite was created
    } else {
      console.log('Resend email sent OK');
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('sendPortalInvitation fatal error:', err.message || err);
    if (err.status) return errorResponse(res, err.status, err.error);
    return errorResponse(res, 500, err.message || 'Unknown error');
  }
}
