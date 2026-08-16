import React from 'react';
import { format } from '@/lib/dateUtils';
import { COMPANY_LOGO_URL } from '@/components/constants';
import { isOptionSelected } from '@/lib/multiSelectUtils';

export default function ChecklistPrintLayout({ checklist, customer, machines, technicians, groupedItems, items, sectionNotes }) {
    return (
        <div className="p-8 font-sans text-sm" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
            <style>{`
                @media print {
                    @page { 
                        margin: 0.5in 0.5in 0.75in 0.5in;
                        size: letter;
                        @bottom-left {
                            content: "${checklist.checklist_number}";
                            font-size: 10px;
                            color: #666;
                        }
                        @bottom-right {
                            content: "Page " counter(page) " of " counter(pages);
                            font-size: 10px;
                            color: #666;
                        }
                    }
                    body { 
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        counter-reset: page;
                    }
                    .page-break { 
                        page-break-after: always; 
                        break-after: always;
                    }
                    .page-break-before {
                        page-break-before: always;
                        break-before: always;
                    }
                    .avoid-break {
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }
                    .section-header { 
                        background-color: #3b82f6 !important; 
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        color: white !important;
                        font-size: 15px !important;
                    }
                    .table-header {
                        background-color: #f3f4f6 !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .print-footer {
                        position: fixed;
                        bottom: 0;
                        left: 0;
                        right: 0;
                        height: 30px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 0 0.5in;
                        font-size: 10px;
                        color: #666;
                        border-top: 1px solid #e5e7eb;
                    }
                    * {
                        box-sizing: border-box;
                    }
                }
            `}</style>

            {/* Header */}
            <div className="flex justify-between items-start mb-4 pb-3 border-b-2 border-gray-300">
                <div>
                    <img src={COMPANY_LOGO_URL} alt="Company Logo" className="h-10 mb-1" style={{ height: '40px' }} />
                    <h1 className="text-xl font-bold mt-1">Maintenance Checklist</h1>
                </div>
                <div className="text-right" style={{ minWidth: '250px' }}>
                    <p className="mb-0.5"><strong>Checklist #:</strong> {checklist.checklist_number}</p>
                    <p className="mb-0.5"><strong>Date:</strong> {format(new Date(checklist.visit_date), 'MMM d, yyyy')}</p>
                    <p className="mb-0.5"><strong>Customer:</strong> {customer?.company_name}</p>
                    {technicians.length > 0 && (
                        <p className="mb-0.5"><strong>Technicians:</strong> {technicians.map(t => t.full_name).join(', ')}</p>
                    )}
                </div>
            </div>

            {/* General Notes */}
            {checklist.notes && (
                <div className="mb-4 avoid-break">
                    <p className="font-bold mb-1 text-sm">General Notes:</p>
                    <div className="border border-gray-300 p-2 bg-gray-50 min-h-[40px] text-sm">
                        {checklist.notes}
                    </div>
                </div>
            )}

            {/* Machines and Sections */}
            {Object.entries(groupedItems).map(([machineId, data], machineIndex) => (
                <div key={machineId}>
                    {machineIndex > 0 && <div className="page-break"></div>}
                    
                    <h2 className="text-lg font-bold mb-2 mt-3 pb-1 border-b-2 border-gray-400">
                        Machine: {data.machine.model} (S/N: {data.machine.serial_number})
                    </h2>

                    {Object.entries(data.sections).map(([sectionName, sectionItems]) => {
                        const isGroupedSection = sectionItems.some(i => i.instance_label);
                        // Pagination is an explicit per-section choice made in the template editor
                        // ("Start this section on a new page") -- there's no automatic break between
                        // sections anymore, so compact sections can share a page instead of each
                        // claiming one regardless of how little content it has.
                        const forceNewPage = sectionItems[0]?.force_new_page;
                        const wrapperClass = `mb-4 avoid-break${forceNewPage ? ' page-break-before' : ''}`;

                        if (isGroupedSection) {
                            const orderedItems = [...sectionItems].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
                            const taskKeys = [...new Set(orderedItems.map(i => i.task_key))];
                            const instanceLabels = [...new Set(orderedItems.map(i => i.instance_label))];
                            const cellFor = (instanceLabel, taskKey) =>
                                orderedItems.find(i => i.instance_label === instanceLabel && i.task_key === taskKey);

                            return (
                                <div key={sectionName} className={wrapperClass}>
                                    <div className="section-header bg-blue-600 text-white p-1.5 font-bold mb-1" style={{ fontSize: '15px' }}>
                                        {sectionName}
                                    </div>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #d1d5db', marginBottom: '6px' }}>
                                        <thead>
                                            <tr className="table-header bg-gray-100">
                                                <th style={{ border: '1px solid #d1d5db', padding: '3px 4px', textAlign: 'left', fontWeight: 'bold', fontSize: '12px' }}>Instance</th>
                                                {taskKeys.map(tk => {
                                                    const sample = orderedItems.find(i => i.task_key === tk);
                                                    return (
                                                        <th key={tk} style={{ border: '1px solid #d1d5db', padding: '3px 4px', textAlign: 'left', fontWeight: 'bold', fontSize: '12px' }}>
                                                            {sample?.task_description}
                                                        </th>
                                                    );
                                                })}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {instanceLabels.map((label, rowIndex) => (
                                                <tr key={label} style={{ backgroundColor: rowIndex % 2 === 0 ? 'white' : '#f9fafb' }}>
                                                    <td style={{ border: '1px solid #d1d5db', padding: '3px 4px', fontSize: '12px', fontWeight: 500 }}>{label}</td>
                                                    {taskKeys.map(tk => {
                                                        const item = cellFor(label, tk);
                                                        if (!item) return <td key={tk} style={{ border: '1px solid #d1d5db', padding: '3px 4px' }} />;
                                                        return (
                                                            <td key={tk} style={{ border: '1px solid #d1d5db', padding: '3px 4px', fontSize: '12px', verticalAlign: 'top' }}>
                                                                {item.task_type === 'checkbox' && (
                                                                    <span style={{ fontSize: '15px', fontWeight: 'bold' }}>{item.completed ? '☑' : '☐'}</span>
                                                                )}
                                                                {item.task_type === 'multiple_choice' && (
                                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 10px' }}>
                                                                        {(item.options || []).map(option => (
                                                                            <div key={option} style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                                                                                <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{isOptionSelected(item.response_value, option) ? '☑' : '☐'}</span>
                                                                                <span style={isOptionSelected(item.response_value, option) ? { fontWeight: 'bold' } : undefined}>{option}</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                                {item.task_type === 'text' && (
                                                                    <div style={{ borderBottom: '1px solid #9ca3af', minHeight: '16px', fontWeight: 500 }}>
                                                                        {item.response_value || ''}
                                                                    </div>
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <div style={{ border: '1px solid #d1d5db', padding: '6px 8px', backgroundColor: '#f9fafb' }}>
                                        <p style={{ fontWeight: 'bold', marginBottom: '3px', fontSize: '12px' }}>Section Notes:</p>
                                        <div style={{ minHeight: '32px', borderBottom: '1px solid #d1d5db', paddingBottom: '2px' }}>
                                            {sectionNotes[machineId]?.[sectionName] || ''}
                                        </div>
                                    </div>
                                </div>
                            );
                        }

                        return (
                        <div key={sectionName} className={wrapperClass}>
                            {/* Section Header */}
                            <div className="section-header bg-blue-600 text-white p-1.5 font-bold mb-1" style={{ fontSize: '15px' }}>
                                {sectionName}
                            </div>

                            {/* Tasks Table */}
                            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #d1d5db', marginBottom: '6px' }}>
                                <thead>
                                    <tr className="table-header bg-gray-100">
                                        <th style={{ border: '1px solid #d1d5db', padding: '3px 4px', textAlign: 'left', width: '22%', fontWeight: 'bold', fontSize: '12px' }}>Category</th>
                                        <th style={{ border: '1px solid #d1d5db', padding: '3px 4px', textAlign: 'left', fontWeight: 'bold', fontSize: '12px' }}>Task</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sectionItems.map((item, itemIndex) => (
                                        <tr key={item.id} style={{ backgroundColor: itemIndex % 2 === 0 ? 'white' : '#f9fafb' }}>
                                            <td style={{ border: '1px solid #d1d5db', padding: '3px 4px', verticalAlign: 'top', fontSize: '12px' }}>
                                                {/* Checkbox tasks */}
                                                {item.task_type === 'checkbox' && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <span style={{ fontSize: '15px', fontWeight: 'bold' }}>{item.completed ? '☑' : '☐'}</span>
                                                        <span>{item.category}</span>
                                                    </div>
                                                )}
                                                {/* Non-checkbox tasks */}
                                                {item.task_type !== 'checkbox' && <span>{item.category}</span>}
                                            </td>
                                            <td style={{ border: '1px solid #d1d5db', padding: '3px 4px', fontSize: '12px' }}>
                                                <p style={{ fontWeight: '500', marginBottom: '3px' }}>{item.task_description}</p>
                                                
                                                {/* Multiple choice options */}
                                                {item.task_type === 'multiple_choice' && (
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: '2px' }}>
                                                        {(item.options || []).map(option => (
                                                            <div key={option} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                <span style={{ fontSize: '15px', fontWeight: 'bold' }}>{isOptionSelected(item.response_value, option) ? '☑' : '☐'}</span>
                                                                <span style={isOptionSelected(item.response_value, option) ? { fontWeight: 'bold' } : undefined}>{option}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                
                                                {/* Text input field */}
                                                {item.task_type === 'text' && (
                                                    <div style={{ borderBottom: '1px solid #9ca3af', marginTop: '4px', minHeight: '16px', fontWeight: 500 }}>
                                                        {item.response_value || ''}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* Section Notes */}
                            <div style={{ border: '1px solid #d1d5db', padding: '6px 8px', backgroundColor: '#f9fafb' }}>
                                <p style={{ fontWeight: 'bold', marginBottom: '3px', fontSize: '12px' }}>Section Notes:</p>
                                <div style={{ minHeight: '32px', borderBottom: '1px solid #d1d5db', paddingBottom: '2px' }}>
                                    {sectionNotes[machineId]?.[sectionName] || ''}
                                </div>
                            </div>
                        </div>
                        );
                    })}
                </div>
            ))}

            {/* Signature Section */}
            <div style={{ marginTop: '24px', paddingTop: '12px', borderTop: '2px solid #4b5563' }} className="avoid-break">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, marginRight: '40px' }}>
                        <p style={{ marginBottom: '6px', fontWeight: 'bold' }}>Technician Signature:</p>
                        <div style={{ borderBottom: '2px solid #6b7280', width: '280px', height: '32px' }}></div>
                    </div>
                    <div style={{ flex: 1, textAlign: 'right' }}>
                        <p style={{ marginBottom: '6px', fontWeight: 'bold' }}>Date Completed:</p>
                        <div style={{ borderBottom: '2px solid #6b7280', width: '200px', height: '32px', marginLeft: 'auto' }}></div>
                    </div>
                </div>
            </div>

            {/* Print Footer */}
            <div className="print-footer hidden print:flex">
                <span>{checklist.checklist_number}</span>
                <span>Page <span className="page-number"></span></span>
            </div>
        </div>
    );
}
