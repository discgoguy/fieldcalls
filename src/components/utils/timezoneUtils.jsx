import { Setting } from '@/api/entities';

// Cache the timezone setting to avoid repeated DB calls
let cachedTimezone = null;

export async function getTimezone() {
    if (cachedTimezone) return cachedTimezone;
    
    try {
        const setting = await Setting.filter({ key: 'timezone' });
        if (setting && setting.length > 0) {
            cachedTimezone = setting[0].value;
            return cachedTimezone;
        }
    } catch (e) {
        console.error('Failed to load timezone setting', e);
    }
    
    return 'America/Halifax'; // Default fallback
}

export function clearTimezoneCache() {
    cachedTimezone = null;
}

/**
 * Converts a UTC date string to local timezone
 * @param {string} utcDateString - ISO date string from database
 * @param {string} timezone - IANA timezone identifier
 * @returns {string} - Formatted date in local timezone (YYYY-MM-DD)
 */
export function formatDateInTimezone(utcDateString, timezone) {
    if (!utcDateString) return '';
    
    try {
        const date = new Date(utcDateString);
        return date.toLocaleDateString('en-CA', { 
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    } catch (e) {
        console.error('Failed to format date', e);
        return utcDateString;
    }
}

/**
 * Converts a UTC datetime string to local timezone with time
 * @param {string} utcDateString - ISO datetime string from database
 * @param {string} timezone - IANA timezone identifier
 * @returns {string} - Formatted datetime in local timezone
 */
export function formatDateTimeInTimezone(utcDateString, timezone) {
    if (!utcDateString) return '';
    
    try {
        const date = new Date(utcDateString);
        return date.toLocaleString('en-CA', { 
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    } catch (e) {
        console.error('Failed to format datetime', e);
        return utcDateString;
    }
}

/**
 * Converts a local date (YYYY-MM-DD) to UTC for database storage
 * @param {string} localDateString - Date in YYYY-MM-DD format
 * @param {string} timezone - IANA timezone identifier
 * @returns {string} - ISO string in UTC
 */
export function convertLocalDateToUTC(localDateString, timezone) {
    if (!localDateString) return '';
    
    try {
        // Create date at noon in local timezone to avoid DST issues
        const localDateTimeString = `${localDateString}T12:00:00`;
        const date = new Date(localDateTimeString);
        
        // Get the offset for this timezone
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
        
        return date.toISOString();
    } catch (e) {
        console.error('Failed to convert date to UTC', e);
        return new Date(localDateString).toISOString();
    }
}