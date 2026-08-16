import { requireAuth, getServiceClient, errorResponse } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return errorResponse(res, 405, 'Method not allowed');

  try {
    const user = await requireAuth(req);
    if (user.role !== 'admin') return errorResponse(res, 403, 'Admin access required');

    const { fileContent, fileName } = req.body;
    if (!fileContent || !fileName) return errorResponse(res, 400, 'Missing fileContent or fileName');

    // Get Google Drive access token from stored OAuth credentials
    const db = getServiceClient();
    const { data: setting } = await db
      .from('settings')
      .select('value')
      .eq('key', 'google_drive_access_token')
      .single();

    if (!setting?.value) return errorResponse(res, 400, 'Google Drive not connected. Please authenticate in Settings.');

    const accessToken = setting.value;
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelim = `\r\n--${boundary}--`;

    const multipartBody =
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify({ name: fileName, mimeType: 'application/json' }) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      fileContent +
      closeDelim;

    const uploadResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    });

    if (!uploadResponse.ok) {
      const error = await uploadResponse.text();
      throw new Error(`Google Drive upload failed: ${error}`);
    }

    const result = await uploadResponse.json();
    return res.json({
      success: true,
      fileId: result.id,
      fileName: result.name,
      webViewLink: `https://drive.google.com/file/d/${result.id}/view`,
    });
  } catch (err) {
    if (err.status) return errorResponse(res, err.status, err.error);
    console.error('saveToDrive error:', err);
    return errorResponse(res, 500, err.message);
  }
}
