// A ticket is "owned" by whoever is in technician_id. Only the current owner,
// or an admin, may convert/resolve/close it or transfer ownership to someone
// else -- this is what actually enforces "if someone else is assigned, nobody
// else can convert/close/resolve that ticket."
export function canManageTicket(ticket, currentUserTechnicianId, isAdmin) {
    if (isAdmin) return true;
    if (!ticket?.technician_id) return true; // unassigned tickets are open to whoever gets to them first
    return String(ticket.technician_id) === String(currentUserTechnicianId);
}
