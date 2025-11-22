import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { withTenantFilter } from '@/components/utils/tenant';
import { format } from 'date-fns';

export default function ChecklistPrintLayout({ checklist, customer, machines, technicians, groupedItems, items, sectionNotes }) {
    const [companyInfo, setCompanyInfo] = useState({
        name: '',
        address: '',
        phone: '',
        website: '',
        logo: ''
    });

    useEffect(() => {
        const loadCompanyInfo = async () => {
            try {
                const filter = await withTenantFilter();
                const settings = await base44.entities.Setting.filter(filter);
                
                const info = {};
                settings.forEach(setting => {
                    if (setting.key === 'company_name') info.name = setting.value;
                    if (setting.key === 'company_address') info.address = setting.value;
                    if (setting.key === 'company_phone') info.phone = setting.value;
                    if (setting.key === 'company_website') info.website = setting.value;
                    if (setting.key === 'company_logo') info.logo = setting.value;
                });
                
                setCompanyInfo(info);
            } catch (error) {
                console.error('Failed to load company info:', error);
            }
        };
        
        loadCompanyInfo();
    }, []);

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
                    .avoid-break {
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }
                    .section-header { 
                        background-color: #3b82f6 !important; 
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        color: white !important;
                        font-size: 18px !important;
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
            <div className="flex justify-between items-start mb-6 pb-4 border-b-2 border-gray-300">
                <div className="flex flex-col items-start">
                    {companyInfo.logo ? (
                        <img 
                            src={companyInfo.logo} 
                            alt={companyInfo.name || "Company Logo"} 
                            className="h-12 mb-3 object-contain"
                            style={{ height: '48px' }}
                        />
                    ) : (
                        <div style={{ height: '48px', width: '128px', backgroundColor: '#e5e7eb', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#6b7280' }}>
                            No Logo
                        </div>
                    )}
                    <div className="text-left">
                        {companyInfo.name && <p style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '2px' }}>{companyInfo.name}</p>}
                        {companyInfo.address && <p style={{ fontSize: '12px', color: '#4b5563', whiteSpace: 'pre-line' }}>{companyInfo.address}</p>}
                        {companyInfo.phone && <p style={{ fontSize: '12px', color: '#4b5563' }}>{companyInfo.phone}</p>}
                        {companyInfo.website && <p style={{ fontSize: '12px', color: '#4b5563' }}>{companyInfo.website}</p>}
                    </div>
                </div>
                <div className="text-right" style={{ minWidth: '250px' }}>
                    <h1 className="text-2xl font-bold mb-2">Maintenance Checklist</h1>
                    <p className="mb-1"><strong>Checklist #:</strong> {checklist.checklist_number}</p>
                    <p className="mb-1"><strong>Date:</strong> {format(new Date(checklist.visit_date), 'MMM d, yyyy')}</p>
                    <p className="mb-1"><strong>Customer:</strong> {customer?.company_name}</p>
                    {technicians.length > 0 && (
                        <p className="mb-1"><strong>Technicians:</strong> {technicians.map(t => t.full_name).join(', ')}</p>
                    )}
                </div>
            </div>

            {/* General Notes */}
            {checklist.notes && (
                <div className="mb-6 avoid-break">
                    <p className="font-bold mb-2">General Notes:</p>
                    <div className="border border-gray-300 p-3 bg-gray-50 min-h-[60px]">
                        {checklist.notes}
                    </div>
                </div>
            )}

            {/* Machines and Sections */}
            {Object.entries(groupedItems).map(([machineId, data], machineIndex) => (
                <div key={machineId}>
                    {machineIndex > 0 && <div className="page-break"></div>}
                    
                    <h2 className="text-xl font-bold mb-4 mt-6 pb-2 border-b-2 border-gray-400">
                        Machine: {data.machine.model} (S/N: {data.machine.serial_number})
                    </h2>

                    {Object.entries(data.sections).map(([sectionName, sectionItems], sectionIndex) => (
                        <div key={sectionName} className="mb-8 avoid-break">
                            {/* Section Header */}
                            <div className="section-header bg-blue-600 text-white p-3 font-bold mb-2" style={{ fontSize: '18px' }}>
                                {sectionName}
                            </div>

                            {/* Tasks Table */}
                            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #d1d5db', marginBottom: '12px' }}>
                                <thead>
                                    <tr className="table-header bg-gray-100">
                                        <th style={{ border: '1px solid #d1d5db', padding: '4px', textAlign: 'left', width: '25%', fontWeight: 'bold', fontSize: '14px' }}>Category</th>
                                        <th style={{ border: '1px solid #d1d5db', padding: '4px', textAlign: 'left', fontWeight: 'bold', fontSize: '14px' }}>Task</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sectionItems.map((item, itemIndex) => (
                                        <tr key={item.id} style={{ backgroundColor: itemIndex % 2 === 0 ? 'white' : '#f9fafb' }}>
                                            <td style={{ border: '1px solid #d1d5db', padding: '4px', verticalAlign: 'top', fontSize: '14px' }}>
                                                {/* Checkbox tasks */}
                                                {item.task_type === 'checkbox' && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ fontSize: '18px', fontWeight: 'bold' }}>☐</span>
                                                        <span>{item.category}</span>
                                                    </div>
                                                )}
                                                {/* Non-checkbox tasks */}
                                                {item.task_type !== 'checkbox' && <span>{item.category}</span>}
                                            </td>
                                            <td style={{ border: '1px solid #d1d5db', padding: '4px', fontSize: '14px' }}>
                                                <p style={{ fontWeight: '500', marginBottom: '8px' }}>{item.task_description}</p>
                                                
                                                {/* Multiple choice options */}
                                                {item.task_type === 'multiple_choice' && (
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '8px' }}>
                                                        {(item.options || []).map(option => (
                                                            <div key={option} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                <span style={{ fontSize: '18px', fontWeight: 'bold' }}>☐</span>
                                                                <span>{option}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                
                                                {/* Text input field */}
                                                {item.task_type === 'text' && (
                                                    <div style={{ borderBottom: '1px solid #9ca3af', marginTop: '12px', height: '24px' }}></div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* Section Notes */}
                            <div style={{ border: '1px solid #d1d5db', padding: '12px', backgroundColor: '#f9fafb', marginBottom: '20px' }}>
                                <p style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}>Section Notes:</p>
                                <div style={{ minHeight: '80px', borderBottom: '1px solid #d1d5db', paddingBottom: '4px' }}>
                                    {sectionNotes[machineId]?.[sectionName] || ''}
                                </div>
                            </div>

                            {/* Page break after each section except the last one */}
                            {sectionIndex < Object.keys(data.sections).length - 1 && (
                                <div className="page-break"></div>
                            )}
                        </div>
                    ))}
                </div>
            ))}

            {/* Signature Section */}
            <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '2px solid #4b5563' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, marginRight: '40px' }}>
                        <p style={{ marginBottom: '8px', fontWeight: 'bold' }}>Technician Signature:</p>
                        <div style={{ borderBottom: '2px solid #6b7280', width: '280px', height: '40px' }}></div>
                    </div>
                    <div style={{ flex: 1, textAlign: 'right' }}>
                        <p style={{ marginBottom: '8px', fontWeight: 'bold' }}>Date Completed:</p>
                        <div style={{ borderBottom: '2px solid #6b7280', width: '200px', height: '40px', marginLeft: 'auto' }}></div>
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