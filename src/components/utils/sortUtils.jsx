import { Setting } from '@/api/entities';

export const applySortSettings = async () => {
    try {
        const sortSettingsData = await Setting.filter({ key: 'default_sort_settings' });
        if (sortSettingsData && sortSettingsData.length > 0) {
            return JSON.parse(sortSettingsData[0].value);
        }
    } catch (e) {
        console.error('Failed to load sort settings:', e);
    }
    return {
        parts: { primary: 'part_name_asc', secondary: 'none' },
        customers: 'company_name_asc',
        technicians: 'full_name_asc',
        tickets: 'created_date_desc',
        categories: 'name_asc',
        machines: 'model_asc',
        suppliers: 'name_asc',
        purchaseOrders: 'created_date_desc',
        maintenanceChecklists: 'created_date_desc'
    };
};

export const parseSortValue = (sortValue) => {
    if (!sortValue) return { field: 'created_date', direction: -1 };
    
    const match = sortValue.match(/^(.+)_(asc|desc)$/);
    if (!match) return { field: 'created_date', direction: -1 };
    
    const [, field, direction] = match;
    return {
        field,
        direction: direction === 'desc' ? -1 : 1
    };
};

const compareByField = (a, b, sortValue) => {
    const { field, direction } = parseSortValue(sortValue);
    const aVal = a[field];
    const bVal = b[field];

    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    if (typeof aVal === 'string' && typeof bVal === 'string') {
        const aMatch = aVal.match(/-(\d+)$/);
        const bMatch = bVal.match(/-(\d+)$/);
        if (aMatch && bMatch) {
            const diff = parseInt(aMatch[1]) - parseInt(bMatch[1]);
            return diff !== 0 ? diff * direction : 0;
        }
        return direction * aVal.localeCompare(bVal);
    }

    if (aVal < bVal) return -direction;
    if (aVal > bVal) return direction;
    return 0;
};

export const sortArray = (array, sortValue) => {
    // sortValue can be a string (single sort) or { primary, secondary } object
    if (sortValue && typeof sortValue === 'object' && sortValue.primary) {
        const { primary, secondary } = sortValue;
        return [...array].sort((a, b) => {
            const primaryResult = compareByField(a, b, primary);
            if (primaryResult !== 0) return primaryResult;
            if (secondary && secondary !== 'none') {
                return compareByField(a, b, secondary);
            }
            return 0;
        });
    }
    return [...array].sort((a, b) => compareByField(a, b, sortValue));
};