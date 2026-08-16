import type { ComponentType, ReactNode } from 'react';
import { useGoBack } from '@/lib/useGoBack';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Pencil } from 'lucide-react';

interface RecordHeaderProps {
  /** Icon shown in the circle left of the title. */
  icon?: ComponentType<{ className?: string }>;
  /** Record name / primary heading. */
  title: ReactNode;
  /** Muted line under the title (e.g. industry, job title). */
  subtitle?: ReactNode;
  /** Rendered inline next to the title, e.g. a status pill. */
  badge?: ReactNode;
  /** When set, shows an Edit button that calls this. */
  onEdit?: () => void;
  /** Fallback list URL for the Back button when there's no in-app history to pop (see useGoBack). */
  backTo?: string;
  /** Extra controls rendered on the right, before the Edit button. */
  actions?: ReactNode;
}

/** Header for a CRM record detail page: back button, icon, title/subtitle, optional edit. */
export default function RecordHeader({ icon: Icon, title, subtitle, badge, onEdit, backTo, actions }: RecordHeaderProps) {
  const goBack = useGoBack(backTo);
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={goBack} title="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        {Icon && (
          <div className="w-11 h-11 rounded-full bg-blue-100 flex items-center justify-center mt-0.5">
            <Icon className="h-5 w-5 text-blue-600" />
          </div>
        )}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
            {badge}
          </div>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {actions}
        {onEdit && (
          <Button variant="outline" onClick={onEdit}>
            <Pencil className="h-4 w-4 mr-2" /> Edit
          </Button>
        )}
      </div>
    </div>
  );
}
