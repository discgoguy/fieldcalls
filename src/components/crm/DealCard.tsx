import type { CSSProperties } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CrmDealRow } from '@/api/entities';
import { formatMoney } from './crmUtils';
import { Building2, Clock } from 'lucide-react';

interface DealCardProps {
  /** The deal to render. */
  deal: CrmDealRow;
  /** Company name shown on the card. */
  companyName?: string;
  /** Days the deal has sat in its stage; drives the amber/red rot badge. */
  daysInStage?: number | null;
  /** Called when the card is clicked (dragging is handled separately). */
  onOpen?: (deal: CrmDealRow) => void;
}

/**
 * A draggable deal card for the pipeline board. Click navigates; drag moves between stages.
 * daysInStage (optional) renders a time-in-stage badge that turns amber/red as the deal rots.
 */
export default function DealCard({ deal, companyName, daysInStage, onOpen }: DealCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: deal.id });
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpen?.(deal)}
      className="bg-white border rounded-lg p-3 shadow-sm cursor-grab active:cursor-grabbing hover:border-blue-400 transition-colors"
    >
      <div className="font-medium text-sm text-gray-900 mb-1">{deal.name}</div>
      {companyName && (
        <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
          <Building2 className="h-3 w-3" /> {companyName}
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-green-700">{formatMoney(deal.amount, deal.currency)}</div>
        {daysInStage != null && deal.status === 'open' && (
          <span
            className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full ${
              daysInStage > 30 ? 'bg-red-100 text-red-700' : daysInStage > 14 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
            }`}
            title={`${daysInStage} day${daysInStage === 1 ? '' : 's'} in this stage`}
          >
            <Clock className="h-3 w-3" />{daysInStage}d
          </span>
        )}
      </div>
    </div>
  );
}
