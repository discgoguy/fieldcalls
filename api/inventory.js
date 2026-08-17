import { requireAuth, getServiceClient, errorResponse } from './_lib.js';

// Consolidated inventory endpoints (count commit / deduction / audit log) --
// merged into one route to stay under the Vercel Hobby-plan 12-serverless-
// function cap, same pattern as api/crm.ts and api/ticketNotifications.js.
// GET lists audit records (unchanged from the old inventoryAudit.js GET
// behavior); POST actions are triggered from the frontend via
// invokeApi('inventory', { action, ...payload }).

// ======================= audit list (GET) =======================
async function handleAuditList(req, res) {
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

// ======================= commitCount (POST) =======================
async function handleCommitCount(user, body, res) {
  if (user.role !== 'admin' && user.role !== 'technician') {
    return errorResponse(res, 403, 'Insufficient permissions');
  }

  const { countId } = body;
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
}

// ======================= deduct (POST) =======================
async function handleDeduct(user, body, res) {
  const db = getServiceClient();
  const { parts, referenceType, referenceId, referenceNumber } = body;

  if (!parts || !Array.isArray(parts) || parts.length === 0) {
    return errorResponse(res, 400, 'No parts provided for deduction.');
  }

  for (const entry of parts) {
    if (!entry.part_id || !entry.quantity || Number(entry.quantity) <= 0) {
      return errorResponse(res, 400, `Invalid part entry: ${JSON.stringify(entry)}`);
    }
  }

  const deductionMap = {};

  const explodeAssembly = async (partId, quantity) => {
    const { data: part, error } = await db.from('parts').select('*').eq('id', partId).single();
    if (error || !part) throw new Error(`Part ${partId} not found.`);

    if (part.is_assembly) {
      if ((part.quantity_in_inventory || 0) >= quantity) {
        deductionMap[partId] = (deductionMap[partId] || 0) + quantity;
      } else {
        const fromStock = part.quantity_in_inventory || 0;
        const fromComponents = quantity - fromStock;
        if (fromStock > 0) deductionMap[partId] = (deductionMap[partId] || 0) + fromStock;
        const { data: components } = await db.from('assembly_components').select('*').eq('assembly_part_id', partId);
        if (!components || components.length === 0) throw new Error(`Assembly ${part.part_name} has no components but insufficient stock.`);
        for (const comp of components) {
          await explodeAssembly(comp.component_part_id, comp.quantity_required * fromComponents);
        }
      }
    } else {
      deductionMap[partId] = (deductionMap[partId] || 0) + quantity;
    }
  };

  for (const entry of parts) {
    await explodeAssembly(entry.part_id, Number(entry.quantity));
  }

  const deductions = [];
  const auditRecords = [];

  for (const [partId, totalQty] of Object.entries(deductionMap)) {
    const { data: freshPart } = await db.from('parts').select('*').eq('id', partId).single();
    if (!freshPart) throw new Error(`Part ${partId} not found during deduction.`);

    const currentStock = freshPart.quantity_in_inventory || 0;
    const newStock = Math.max(0, currentStock - totalQty);

    await db.from('parts').update({ quantity_in_inventory: newStock }).eq('id', partId);

    deductions.push({
      part_id: partId,
      part_name: freshPart.part_name,
      previous_stock: currentStock,
      deducted: totalQty,
      new_stock: newStock,
      went_negative: currentStock < totalQty,
    });

    auditRecords.push({
      part_id: partId,
      part_name: freshPart.part_name,
      part_number: freshPart.part_number || null,
      change_type: 'deduction',
      quantity_before: currentStock,
      quantity_change: -totalQty,
      quantity_after: newStock,
      reference_type: referenceType || null,
      reference_id: referenceId || null,
      reference_number: referenceNumber || null,
      created_by: user.id,
      created_by_name: user.full_name || user.email,
    });
  }

  // Write audit records
  if (auditRecords.length > 0) {
    const { error: auditError } = await db.from('inventory_audit').insert(auditRecords);
    if (auditError) console.error('Audit log error:', auditError.message);
  }

  return res.json({ success: true, deductions });
}

// ======================= audit create (POST) =======================
// Log a manual audit record (e.g. PO receipt, manual adjustment)
async function handleAuditCreate(user, body, res) {
  const db = getServiceClient();
  const { part_id, change_type, quantity_before, quantity_change, quantity_after,
          reference_type, reference_id, reference_number, notes } = body;

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
}

// ============================ dispatch ============================
export default async function handler(req, res) {
  if (req.method === 'GET') return handleAuditList(req, res);
  if (req.method !== 'POST') return errorResponse(res, 405, 'Method not allowed');

  try {
    const user = await requireAuth(req);
    const action = req.body?.action;
    if (action === 'commitCount') return await handleCommitCount(user, req.body, res);
    if (action === 'deduct') return await handleDeduct(user, req.body, res);
    if (action === 'audit') return await handleAuditCreate(user, req.body, res);
    return errorResponse(res, 400, `Unknown action: ${action || '(none)'}`);
  } catch (err) {
    if (err.status) return errorResponse(res, err.status, err.error);
    console.error('inventory error:', err);
    return errorResponse(res, 500, err.message || 'Request failed');
  }
}
