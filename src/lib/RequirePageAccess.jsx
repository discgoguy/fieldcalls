import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

// Pages that only the CRM-facing base roles may open. Keyed by page name
// (the pages.config.js key), including the detail pages that have no nav entry.
const CRM_PAGES = new Set([
  'CRMDashboard', 'Companies', 'CompanyDetail', 'Contacts', 'ContactDetail',
  'Deals', 'DealDetail', 'Leads', 'LeadDetail', 'SourcesCampaigns', 'Tasks',
]);

// Base roles (profiles.role) allowed into the CRM. Mirror this in the CRM RLS
// policies if/when the section needs a hard DB boundary, not just a redirect.
const CRM_ROLES = new Set(['admin', 'sales']);

/**
 * Route-level guard. Redirects to the home page if the signed-in user's base
 * role isn't allowed to open the requested page. This is UX enforcement only —
 * RLS is the real boundary (see auth-and-permissions.md).
 */
export default function RequirePageAccess({ pageName, children }) {
  const { user } = useAuth();
  // Auth has already resolved by the time routes render; if a role is present
  // and not allowed for a CRM page, bounce them out before the page mounts.
  if (user && CRM_PAGES.has(pageName) && !CRM_ROLES.has(user.role)) {
    return <Navigate to="/" replace />;
  }
  return children;
}
