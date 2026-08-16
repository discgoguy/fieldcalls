// Shared inventory-availability logic used anywhere parts are being committed to
// a transaction (Parts Orders, On-Site Service calls, etc). Mirrors the
// assembly-buildable-quantity logic in src/pages/Parts.jsx so "available to sell"
// means the same thing everywhere: on-hand stock, plus (for assemblies) whatever
// can be built right now from component stock.

/**
 * Recursively compute how many units of an assembly could be built right now
 * from its components' on-hand stock (does not consider nested assemblies'
 * own on-hand stock beyond what's already counted by the caller).
 */
export function calculateBuildableQuantity(assemblyId, partsById, componentsByAssembly, visited = new Set()) {
    if (visited.has(assemblyId)) return 0;
    visited.add(assemblyId);

    const components = componentsByAssembly[assemblyId] || [];
    if (components.length === 0) return 0;

    let minAvailable = Infinity;

    components.forEach(comp => {
        const componentPart = partsById[comp.component_part_id];
        if (componentPart) {
            let available;
            if (componentPart.is_assembly) {
                available = calculateBuildableQuantity(componentPart.id, partsById, componentsByAssembly, new Set(visited));
            } else {
                available = componentPart.quantity_in_inventory || 0;
            }
            const possibleQty = Math.floor(available / (comp.quantity_required || 1));
            minAvailable = Math.min(minAvailable, possibleQty);
        } else {
            minAvailable = 0;
        }
    });

    return minAvailable === Infinity ? 0 : minAvailable;
}

/**
 * Returns { ownStock, buildable, available } for a single part.
 * `available` is what can actually be fulfilled right now: on-hand stock for
 * regular parts, or on-hand + buildable-from-components for assemblies.
 */
export function getPartAvailability(part, partsById, componentsByAssembly) {
    const ownStock = part.quantity_in_inventory || 0;
    if (!part.is_assembly) {
        return { ownStock, buildable: 0, available: ownStock };
    }
    const buildable = calculateBuildableQuantity(part.id, partsById, componentsByAssembly);
    return { ownStock, buildable, available: ownStock + buildable };
}

/**
 * Given a list of { part_id, quantity } entries (already aggregated per part_id
 * if a part appears more than once), returns an array of shortage objects for
 * any part whose needed quantity exceeds what's actually available.
 * Each shortage: { part_id, part, needed, ownStock, buildable, available, shortfall }
 */
export function findInventoryShortages(neededEntries, partsById, componentsByAssembly) {
    const shortages = [];
    for (const entry of neededEntries) {
        const part = partsById[entry.part_id];
        if (!part) continue;
        const { ownStock, buildable, available } = getPartAvailability(part, partsById, componentsByAssembly);
        if (entry.quantity > available) {
            shortages.push({
                part_id: entry.part_id,
                part,
                needed: entry.quantity,
                ownStock,
                buildable,
                available,
                shortfall: entry.quantity - available,
            });
        }
    }
    return shortages;
}

/** Aggregate a list of { part_id, quantity } line items into one entry per part_id. */
export function aggregateQuantitiesByPart(lineItems) {
    const map = {};
    for (const item of lineItems) {
        if (!item.part_id || !item.quantity) continue;
        map[item.part_id] = (map[item.part_id] || 0) + Number(item.quantity);
    }
    return Object.entries(map).map(([part_id, quantity]) => ({ part_id, quantity }));
}
