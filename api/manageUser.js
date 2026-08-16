import { requireAuth, getServiceClient, errorResponse } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return errorResponse(res, 405, 'Method not allowed');

  try {
    const admin = await requireAuth(req);
    if (admin.role !== 'admin') return errorResponse(res, 403, 'Admin access required');

    const { action, userId, updates } = req.body;
    const db = getServiceClient();

    if (action === 'delete') {
      if (!userId) return errorResponse(res, 400, 'userId required');
      
      // Delete from auth.users (cascades to profiles)
      const { error } = await db.auth.admin.deleteUser(userId);
      if (error) throw error;
      
      return res.json({ success: true });
    }

    if (action === 'resetPassword') {
      const { email } = req.body;
      if (!email) return errorResponse(res, 400, 'email required');
      const appUrl = process.env.APP_URL || 'https://app.fieldcalls.com';
      const { error } = await db.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo: appUrl + '/set-password' },
      });
      // Send the recovery email via Resend
      if (!error) {
        const { data: linkData } = await db.auth.admin.generateLink({
          type: 'recovery',
          email,
          options: { redirectTo: appUrl + '/set-password' },
        });
        const { Resend } = await import('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        const link = linkData?.properties?.action_link || appUrl;
        await resend.emails.send({
          from: 'FieldCalls <noreply@tickets.fieldcalls.com>',
          to: email,
          subject: 'Reset your FieldCalls password',
          html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 20px;">
<tr><td align="center">
<table width="100%" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
<tr><td style="background:#111827;padding:28px 32px;">
  <p style="margin:0;color:#fff;font-size:22px;font-weight:700;">FieldCalls</p>
  <p style="margin:4px 0 0;color:#9ca3af;font-size:13px;">Service Management Portal</p>
</td></tr>
<tr><td style="padding:32px;">
  <p style="color:#111827;font-size:20px;font-weight:600;margin:0 0 8px;">Reset your password</p>
  <p style="color:#6b7280;font-size:14px;margin:0 0 24px;">Click the button below to set a new password for your FieldCalls account.</p>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
    <tr><td align="center">
      <a href="${link}" style="display:inline-block;background:#111827;color:#fff;font-size:15px;font-weight:600;padding:14px 32px;border-radius:8px;text-decoration:none;">Set New Password &rarr;</a>
    </td></tr>
  </table>
  <p style="color:#9ca3af;font-size:12px;margin:0;text-align:center;">If you didn't request this, you can safely ignore this email.</p>
</td></tr>
</table></td></tr></table>
</body></html>`,
        });
      }
      if (error) throw error;
      return res.json({ success: true });
    }


      if (!userId || !updates) return errorResponse(res, 400, 'userId and updates required');
      
      // Update profile via service role (bypasses RLS)
      const { error } = await db.from('profiles').update({
        full_name:   updates.full_name,
        role:        updates.role,
        customer_id: updates.customer_id || null,
        department:  updates.department || null,
        phone:       updates.phone || null,
        is_customer: updates.role === 'customer',
      }).eq('id', userId);
      
      if (error) throw error;
      return res.json({ success: true });
    }

    return errorResponse(res, 400, 'Invalid action');
  } catch (err) {
    console.error('manageUser error:', err);
    if (err.status) return errorResponse(res, err.status, err.error);
    return errorResponse(res, 500, err.message || 'Unknown error');
  }
}
