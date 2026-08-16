import { requireAuth, getServiceClient, errorResponse } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return errorResponse(res, 405, 'Method not allowed');

  try {
    const user = await requireAuth(req);
    const db = getServiceClient();
    const { parts, referenceType, referenceId, referenceNumber } = req.body;

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
  } catch (err) {
    if (err.status) return errorResponse(res, err.status, err.error);
    console.error('Inventory deduction error:', err);
    return errorResponse(res, 500, err.message);
  }
}
