import React from 'react';
import { format } from '@/lib/dateUtils';

export default function ServiceCallPrintLayout({ serviceCall, customer, technicians, parts, machines }) {
    if (!serviceCall) return null;

    const getTechName = (id) => technicians.find(t => t.id === id)?.full_name || id;

    return (
        <div id="service-call-print-area" className="hidden print:block p-8 font-sans text-sm text-gray-900">
            <style>{`
                @media print {
                    body * { visibility: hidden !important; }
                    #service-call-print-area, #service-call-print-area * { visibility: visible !important; }
                    #service-call-print-area { position: fixed; top: 0; left: 0; width: 100%; }
                }
            `}</style>

            {/* Header */}
            <div className="flex justify-between items-start mb-6 pb-4 border-b-2 border-gray-800">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Service Call Report</h1>
                    <p className="text-gray-500 text-xs mt-1">Generated: {format(new Date(), 'MMM dd, yyyy')}</p>
                </div>
                <div className="text-right">
                    <p className="font-mono font-bold text-blue-700 text-lg">{serviceCall.service_call_id}</p>
                    <p className="text-gray-600">{format(new Date(serviceCall.date), 'MMMM dd, yyyy')}</p>
                </div>
            </div>

            {/* Customer & Technician Info */}
            <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                    <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Customer</h2>
                    <p className="font-semibold text-base">{customer?.company_name || 'N/A'}</p>
                    {customer?.contact_person && <p className="text-gray-600">{customer.contact_person}</p>}
                    {customer?.phone && <p className="text-gray-600">{customer.phone}</p>}
                </div>
                <div>
                    <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Technician(s)</h2>
                    <p className="font-semibold text-base">{serviceCall.technician_name || 'N/A'}</p>
                    {serviceCall.purchase_order_number && (
                        <p className="text-gray-600 mt-1">PO #: {serviceCall.purchase_order_number}</p>
                    )}
                </div>
            </div>

            {/* Service Details */}
            {serviceCall.expenses && (
                <div className="mb-6">
                    <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Service Details</h2>
                    <div className="border rounded p-4 bg-gray-50 grid grid-cols-3 gap-3">
                        {serviceCall.expenses.travel_hours > 0 && (
                            <div>
                                <p className="text-xs text-gray-500">Travel Hours</p>
                                <p className="font-medium">{serviceCall.expenses.travel_hours}h</p>
                            </div>
                        )}
                        {serviceCall.expenses.onsite_hours > 0 && (
                            <div>
                                <p className="text-xs text-gray-500">On-site Hours</p>
                                <p className="font-medium">{serviceCall.expenses.onsite_hours}h</p>
                            </div>
                        )}
                        {serviceCall.expenses.kilometers > 0 && (
                            <div>
                                <p className="text-xs text-gray-500">Distance</p>
                                <p className="font-medium">{serviceCall.expenses.kilometers} km</p>
                            </div>
                        )}
                        {serviceCall.expenses.food_expense > 0 && (
                            <div>
                                <p className="text-xs text-gray-500">Food</p>
                                <p className="font-medium">${serviceCall.expenses.food_expense.toFixed(2)}</p>
                            </div>
                        )}
                        {serviceCall.expenses.hotel_expense > 0 && (
                            <div>
                                <p className="text-xs text-gray-500">Hotel</p>
                                <p className="font-medium">${serviceCall.expenses.hotel_expense.toFixed(2)}</p>
                            </div>
                        )}
                        {serviceCall.expenses.tolls_expense > 0 && (
                            <div>
                                <p className="text-xs text-gray-500">Tolls</p>
                                <p className="font-medium">${serviceCall.expenses.tolls_expense.toFixed(2)}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Parts Used */}
            {serviceCall.parts?.length > 0 && (
                <div className="mb-6">
                    <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Parts Used</h2>
                    <table className="w-full border-collapse border border-gray-300 text-sm">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="border border-gray-300 px-3 py-2 text-left">Part Name</th>
                                <th className="border border-gray-300 px-3 py-2 text-left">Part #</th>
                                <th className="border border-gray-300 px-3 py-2 text-left">Machine</th>
                                <th className="border border-gray-300 px-3 py-2 text-center">Qty</th>
                            </tr>
                        </thead>
                        <tbody>
                            {serviceCall.parts.map((part, idx) => {
                                const partDetails = parts.find(p => p.id === part.part_id);
                                const machineDetails = machines.find(m => m.id === part.machine_id);
                                return (
                                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                        <td className="border border-gray-300 px-3 py-2">{partDetails?.part_name || 'Unknown'}</td>
                                        <td className="border border-gray-300 px-3 py-2 font-mono text-xs">{partDetails?.part_number || 'N/A'}</td>
                                        <td className="border border-gray-300 px-3 py-2">
                                            {machineDetails ? `${machineDetails.model} (S/N: ${machineDetails.serial_number})` : '—'}
                                        </td>
                                        <td className="border border-gray-300 px-3 py-2 text-center">{part.quantity}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Notes */}
            {serviceCall.notes && (
                <div className="mb-6">
                    <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Service Notes</h2>
                    <div className="border rounded p-4 bg-gray-50">
                        <p className="whitespace-pre-wrap">{serviceCall.notes}</p>
                    </div>
                </div>
            )}

            {/* Signature */}
            <div className="mt-10 pt-6 border-t grid grid-cols-2 gap-12">
                <div>
                    <div className="border-b border-gray-400 mb-1 h-8"></div>
                    <p className="text-xs text-gray-500">Technician Signature</p>
                </div>
                <div>
                    <div className="border-b border-gray-400 mb-1 h-8"></div>
                    <p className="text-xs text-gray-500">Customer Signature</p>
                </div>
            </div>
        </div>
    );
}