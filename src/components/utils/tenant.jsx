import { base44 } from '@/api/base44Client';

/**
 * Get the current user's tenant_id
 * Returns the tenant_id or creates one if it doesn't exist
 */
export async function getTenantId() {
    try {
        const user = await base44.auth.me();
        
        // If user doesn't have a tenant_id, set it to their own user ID (making them a tenant owner)
        if (!user.tenant_id) {
            await base44.auth.updateMe({ tenant_id: user.id });
            return user.id;
        }
        
        return user.tenant_id;
    } catch (error) {
        console.error('Error getting tenant ID:', error);
        throw error;
    }
}

/**
 * Add tenant_id to data object
 */
export async function addTenantId(data) {
    const tenantId = await getTenantId();
    return { ...data, tenant_id: tenantId };
}

/**
 * Add tenant_id to multiple data objects
 */
export async function addTenantIdBulk(dataArray) {
    const tenantId = await getTenantId();
    return dataArray.map(item => ({ ...item, tenant_id: tenantId }));
}

/**
 * Create filter object with tenant_id
 */
export async function withTenantFilter(filter = {}) {
    const tenantId = await getTenantId();
    return { ...filter, tenant_id: tenantId };
}