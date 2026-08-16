import { requireAuth, getServiceClient, errorResponse } from './_lib.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // List audit records with filters
    try {
      await requireAuth(req);
      const db = getServiceClient();
      const { part_id, limit = 100, offset = 0 } = req.query;

      let query = db.from('inventory_audit')
        .select('*')
        .order('created_date', { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      if (part_id) query = query.eq('part_id', part_id);

      const { data, error } = await query;
      if (error) throw error;
      return res.json({ records: data });
    } catch (err) {
      return errorResponse(res, 500, err.message);
    }
  }

  if (req.method === 'POST') {
    // Log a manual audit record (e.g. PO receipt, manual adjustment)
    try {
      const user = await requireAuth(req);
      const db = getServiceClient();
      const { part_id, change_type, quantity_before, quantity_change, quantity_after,
              reference_type, reference_id, reference_number, notes } = req.body;

      if (!part_id || quantity_before === undefined || quantity_change === undefined) {
        return errorResponse(res, 400, 'Missing required fields');
      }

      const { data: part } = await db.from('parts').select('part_name,part_number').eq('id', part_id).maybeSingle();

      const { data, error } = await db.from('inventory_audit').insert([{
        part_id,
        part_name: part?.part_name,
        part_number: part?.part_number,
        change_type: change_type || 'adjustment',
        quantity_before,
        quantity_change,
        quantity_after,
        reference_type: reference_type || null,
        reference_id: reference_id || null,
        reference_number: reference_number || null,
        notes: notes || null,
        created_by: user.id,
        created_by_name: user.full_name || user.email,
      }]).select().single();

      if (error) throw error;
      return res.json({ success: true, record: data });
    } catch (err) {
      return errorResponse(res, 500, err.message);
    }
  }

  return errorResponse(res, 405, 'Method not allowed');
}
