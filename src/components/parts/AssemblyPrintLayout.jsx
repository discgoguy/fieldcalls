import React from 'react';

export default function AssemblyPrintLayout({ assemblyPart, components, parts }) {
    const componentsList = components.map(comp => {
        const part = parts.find(p => p.id === comp.component_part_id);
        return {
            name: part?.part_name || 'Unknown Part',
            number: part?.part_number || 'N/A',
            quantity: comp.quantity_required
        };
    });

    return (
        <div className="assembly-print-content" style={{ position: 'fixed', top: 0, left: 0, width: '100%', background: 'white', zIndex: 9999 }}>
            <style>{`
                @media screen {
                    .assembly-print-content { display: none; }
                }
                @media print {
                    body * { visibility: hidden; }
                    .assembly-print-content, .assembly-print-content * { 
                        visibility: visible; 
                    }
                    .assembly-print-content { 
                        position: static !important;
                        display: block !important;
                        width: 100% !important;
                    }
                    table {
                        page-break-inside: auto !important;
                        width: 100%;
                    }
                    tr {
                        page-break-inside: avoid !important;
                        page-break-after: auto !important;
                    }
                    thead {
                        display: table-header-group !important;
                    }
                    tbody {
                        display: table-row-group !important;
                    }
                    @page { 
                        margin: 0.5in;
                        size: letter;
                    }
                }
            `}</style>
            
            <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
                <div style={{ borderBottom: '3px solid #2563eb', paddingBottom: '15px', marginBottom: '30px' }}>
                    <h1 style={{ color: '#1e40af', margin: '0 0 10px 0', fontSize: '28px' }}>Assembly Parts List</h1>
                    <div style={{ color: '#6b7280', fontSize: '14px', margin: '5px 0' }}>Part: {assemblyPart.part_name}</div>
                    <div style={{ color: '#6b7280', fontSize: '14px', margin: '5px 0' }}>Part Number: {assemblyPart.part_number}</div>
                </div>

                <div style={{ background: '#f3f4f6', padding: '15px', borderRadius: '8px', margin: '20px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', margin: '8px 0' }}>
                        <span style={{ fontWeight: '600', color: '#374151' }}>Date:</span>
                        <span>{new Date().toLocaleDateString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', margin: '8px 0' }}>
                        <span style={{ fontWeight: '600', color: '#374151' }}>Total Components:</span>
                        <span>{componentsList.length}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', margin: '8px 0' }}>
                        <span style={{ fontWeight: '600', color: '#374151' }}>Category:</span>
                        <span>{assemblyPart.category || 'N/A'}</span>
                    </div>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
                    <thead style={{ background: '#2563eb', color: 'white' }}>
                        <tr>
                            <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px', width: '60px' }}>✓</th>
                            <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>Part Name</th>
                            <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px' }}>Part Number</th>
                            <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.5px', width: '100px' }}>Quantity</th>
                        </tr>
                    </thead>
                    <tbody>
                        {componentsList.map((comp, idx) => (
                            <tr key={idx}>
                                <td style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>
                                    <span style={{ width: '20px', height: '20px', border: '2px solid #9ca3af', display: 'inline-block', borderRadius: '3px' }}></span>
                                </td>
                                <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>{comp.name}</td>
                                <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>{comp.number}</td>
                                <td style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#2563eb', borderBottom: '1px solid #e5e7eb' }}>{comp.quantity}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '2px solid #e5e7eb', color: '#6b7280', fontSize: '12px' }}>
                    <p><strong>Instructions:</strong> Gather all components listed above before beginning assembly. Check off each part as collected.</p>
                    <p>Printed on {new Date().toLocaleString()}</p>
                </div>
            </div>
        </div>
    );
}