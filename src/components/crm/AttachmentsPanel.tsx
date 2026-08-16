import { useState, useEffect, useCallback, useRef, type ChangeEvent } from 'react';
import { supabase } from '@/api/supabaseClient';
import { CrmAttachment } from '@/api/entities';
import type { CrmAttachmentRow, Filters, InsertRow } from '@/api/entities';
import { getCurrentUserId } from './crmUtils';
import { Button } from '@/components/ui/button';
import { Paperclip, Upload, Loader2, Download, Trash2, FileText } from 'lucide-react';

// Private, staff-only bucket (see the storage policies in the CRM migration).
// Files are never public - downloads go through short-lived signed URLs.
const BUCKET = 'crm-attachments';
const SIGNED_URL_TTL = 60; // seconds - long enough to open, short enough to not leak

type AttachmentLinks = Partial<Pick<InsertRow<'crm_attachments'>, 'contact_id' | 'deal_id' | 'company_id' | 'lead_id'>>;

interface AttachmentsPanelProps {
  /** The record these attachments relate to, as a relating id, e.g. { deal_id: id }. */
  links?: AttachmentLinks;
}

function prettySize(bytes: number | null | undefined): string {
  if (!bytes) return '';
  const kb = bytes / 1024;
  return kb < 1024 ? `${kb.toFixed(0)} KB` : `${(kb / 1024).toFixed(1)} MB`;
}

/**
 * File attachments for a CRM record. `links` is the relating id, e.g. { deal_id: id }.
 * Uploads now go to Supabase Storage; SharePoint-sourced rows (source='sharepoint')
 * are listed alongside uploads once that import is built.
 */
export default function AttachmentsPanel({ links = {} }: AttachmentsPanelProps) {
  const [files, setFiles] = useState<CrmAttachmentRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const filterKey = Object.keys(links)[0] as keyof AttachmentLinks;
  const filterVal = links[filterKey];

  const load = useCallback(async () => {
    if (!filterVal) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await CrmAttachment.filter({ [filterKey]: filterVal } as Filters<'crm_attachments'>, '-created_date');
      setFiles(data || []);
    } catch {
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [filterKey, filterVal]);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `crm/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { data, error } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: '3600', upsert: false });
      if (error) throw error;
      // No public URL: the bucket is private. We persist only storage_path and mint
      // a signed URL on download (file_url stays null for uploaded files).
      await CrmAttachment.create({
        file_name: file.name,
        storage_path: data.path,
        file_size: file.size,
        mime_type: file.type,
        source: 'upload',
        uploaded_by: await getCurrentUserId(),
        ...links,
      });
      load();
    } catch (err) {
      // surface minimally; detail pages show their own errors
      console.error('Attachment upload failed:', err);
      alert('Upload failed: ' + ((err as { message?: string }).message || String(err)));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const download = async (f: CrmAttachmentRow) => {
    // Uploaded files live in the private bucket → mint a short-lived signed URL on
    // click. SharePoint-sourced rows (once that import exists) carry a ready URL.
    try {
      if (f.storage_path) {
        const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(f.storage_path, SIGNED_URL_TTL);
        if (error || !data) throw error ?? new Error('No signed URL returned');
        window.open(data.signedUrl, '_blank', 'noopener');
        return;
      }
      if (f.file_url) window.open(f.file_url, '_blank', 'noopener');
    } catch (err) {
      console.error('Could not open attachment:', err);
      alert('Could not open file.');
    }
  };

  const remove = async (f: CrmAttachmentRow) => {
    try {
      if (f.storage_path) await supabase.storage.from(BUCKET).remove([f.storage_path]);
      await CrmAttachment.delete(f.id);
      load();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm flex items-center text-gray-700">
          <Paperclip className="h-4 w-4 mr-2" /> Attachments
        </h3>
        <input ref={inputRef} type="file" className="hidden" onChange={handleUpload} />
        <Button size="sm" variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Uploading...</> : <><Upload className="h-4 w-4 mr-2" />Upload</>}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-gray-400" /></div>
      ) : files.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No files attached.</p>
      ) : (
        <div className="space-y-2">
          {files.map((f) => (
            <div key={f.id} className="flex items-center justify-between p-2 border rounded-md bg-white group">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm truncate">{f.file_name}</div>
                  <div className="text-xs text-gray-400">
                    {prettySize(f.file_size)}{f.source === 'sharepoint' && ' • SharePoint'}
                  </div>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => download(f)} title="Download">
                  <Download className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => remove(f)}>
                  <Trash2 className="h-3.5 w-3.5 text-gray-400" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
