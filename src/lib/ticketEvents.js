import { TicketEvent } from '@/api/entities';

// Single place that writes to the ticket activity timeline, so every part of
// the app (creation, ownership transfer, status changes, resolution,
// conversion, reminders) logs events the same way. Never throws -- a failed
// audit-log write shouldn't block the actual action that triggered it.
export async function logTicketEvent(ticketId, eventType, { fromValue, toValue, actorName, actorId, details } = {}) {
    try {
        await TicketEvent.create({
            ticket_id: ticketId,
            event_type: eventType,
            from_value: fromValue ?? null,
            to_value: toValue ?? null,
            actor_name: actorName ?? null,
            actor_id: actorId ?? null,
            details: details ?? null,
        });
    } catch (e) {
        console.error('Failed to log ticket event', eventType, e);
    }
}
