import { requireAuth, getServiceClient, errorResponse } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return errorResponse(res, 405, 'Method not allowed');

  try {
    const user = await requireAuth(req);
    if (user.role !== 'admin' && user.role !== 'technician') {
      return errorResponse(res, 403, 'Insufficient permissions');
    }

    const { countId } = req.body;
    if (!countId) return errorResponse(res, 400, 'countId required');

    const db = getServiceClient();

    // Load the count session
    const { data: count, error: countError } = await db
      .from('inventory_counts').select('*').eq('id', countId).maybeSingle();
    if (countError) throw countError;
    if (!count) return errorResponse(res, 404, 'Count session not found');
    if (count.status === 'committed') return errorResponse(res, 400, 'Already committed');

    // Load all items
    const { data: items, error: itemsError } = await db
      .from('inventory_count_items').select('*').eq('count_id', countId);
    if (itemsError) throw itemsError;

    const auditRecords = [];
    const partUpdates = [];

    for (const item of items) {
      // Recalculate total from location_counts
      const locationCounts = item.location_counts || {};
      const totalCounted = Object.values(locationCounts).reduce((sum, v) => sum + (Number(v) || 0), 0);

      if (totalCounted === 0 && item.system_quantity === 0) continue;

      const variance = totalCounted - item.system_quantity;
      if (variance === 0) continue; // No change needed

      const newQty = Math.max(0, totalCounted);

      partUpdates.push(
        db.from('parts').update({ quantity_in_inventory: newQty }).eq('id', item.part_id)
      );

      auditRecords.push({
        part_id: item.part_id,
        part_name: item.part_name,
        part_number: item.part_number,
        change_type: 'adjustment',
        quantity_before: item.system_quantity,
        quantity_change: variance,
        quantity_after: newQty,
        reference_type: 'inventory_count',
        reference_id: countId,
        reference_number: count.name,
        notes: item.notes || null,
        created_by: user.id,
        created_by_name: user.full_name || user.email,
      });
    }

    // Execute all part updates
    await Promise.all(partUpdates);

    // Write audit records
    if (auditRecords.length > 0) {
      const { error: auditError } = await db.from('inventory_audit').insert(auditRecords);
      if (auditError) console.error('Audit log error:', auditError.message);
    }

    // Mark session as committed
    await db.from('inventory_counts').update({
      status: 'committed',
      committed_by: user.id,
      committed_by_name: user.full_name || user.email,
      committed_at: new Date().toISOString(),
    }).eq('id', countId);

    return res.json({
      success: true,
      partsUpdated: partUpdates.length,
      auditRecords: auditRecords.length,
    });
  } catch (err) {
    console.error('commitInventoryCount error:', err);
    if (err.status) return errorResponse(res, err.status, err.error);
    return errorResponse(res, 500, err.message || 'Failed to commit count');
  }
}
