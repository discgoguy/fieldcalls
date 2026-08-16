import React from 'react';
import { format } from '@/lib/dateUtils';
import { COMPANY_LOGO_URL } from '@/components/constants'; // Use the main color logo URL

const SHIP_TO_ADDRESS = {
    name: "FieldCalls Inc.",
    address: "163 Zack Road",
    cityStateZip: "Lutes Mountain, NB E1G 2V1",
    country: "Canada"
};

export default function PurchaseOrderPrintLayout({ purchaseOrder, supplier }) {
    if (!purchaseOrder || !supplier) return null;

    const { items, po_number, order_date, payment_type, shipping_method, subtotal, tax_amount, total_amount, approved_by_user_name } = purchaseOrder;

    return (
        <div style={{ padding: '20px', fontFamily: 'Arial, Helvetica, sans-serif' }}>
            <style>{`
              @media print {
                body { 
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
              }
            `}</style>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', paddingBottom: '12px', borderBottom: '2px solid #d1d5db' }}>
                <div>
                    <img 
                        src={COMPANY_LOGO_URL} 
                        alt="Company Logo" 
                        style={{ height: '40px', marginBottom: '0' }}
                    />
                </div>
                <div style={{ textAlign: 'right' }}>
                    <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: '0' }}>PURCHASE ORDER</h1>
                    <p style={{ fontSize: '18px', margin: '4px 0 0 0' }}>{po_number}</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '20px', fontSize: '14px' }}>
                <div>
                    <h2 style={{ fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Vendor</h2>
                    <address style={{ fontStyle: 'normal' }}>
                        <p style={{ fontWeight: 'bold' }}>{supplier.name}</p>
                        <p style={{ whiteSpace: 'pre-wrap' }}>{supplier.address}</p>
                        <p>{supplier.phone}</p>
                    </address>
                </div>
                <div>
                    <h2 style={{ fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Ship To</h2>
                     <address style={{ fontStyle: 'normal' }}>
                        <p style={{ fontWeight: 'bold' }}>{SHIP_TO_ADDRESS.name}</p>
                        <p>{SHIP_TO_ADDRESS.address}</p>
                        <p>{SHIP_TO_ADDRESS.cityStateZip}</p>
                        <p>{SHIP_TO_ADDRESS.country}</p>
                    </address>
                </div>
            </div>

             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px', marginBottom: '20px', fontSize: '14px', borderTop: '1px solid #d1d5db', borderBottom: '1px solid #d1d5db', paddingTop: '8px', paddingBottom: '8px' }}>
                <div><strong style={{ color: '#6b7280' }}>PO Number:</strong> {po_number}</div>
                <div><strong style={{ color: '#6b7280' }}>Order Date:</strong> {format(new Date(order_date), 'MMM d, yyyy')}</div>
                <div><strong style={{ color: '#6b7280' }}>Payment Terms:</strong> {payment_type}</div>
                <div><strong style={{ color: '#6b7280' }}>Shipping Method:</strong> {shipping_method || 'N/A'}</div>
             </div>

            <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
                <thead style={{ backgroundColor: '#f3f4f6' }}>
                    <tr>
                        <th style={{ padding: '8px', textAlign: 'left', fontWeight: '600', borderBottom: '2px solid #d1d5db' }}>Description</th>
                        <th style={{ padding: '8px', textAlign: 'right', fontWeight: '600', borderBottom: '2px solid #d1d5db' }}>Qty</th>
                        <th style={{ padding: '8px', textAlign: 'right', fontWeight: '600', borderBottom: '2px solid #d1d5db' }}>Unit Cost</th>
                        <th style={{ padding: '8px', textAlign: 'right', fontWeight: '600', borderBottom: '2px solid #d1d5db' }}>Total</th>
                    </tr>
                </thead>
                <tbody>
                    {(items || []).map((item, index) => (
                        <tr key={index}>
                            <td style={{ padding: '8px', borderBottom: '1px solid #e5e7eb' }}>{item.description}</td>
                            <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>{item.quantity_ordered}</td>
                            <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>${(item.unit_cost || 0).toFixed(2)}</td>
                            <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: '600' }}>${(item.total_cost || 0).toFixed(2)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '16px' }}>
                <div style={{ fontSize: '14px' }}>
                    {approved_by_user_name && (
                        <div>
                            <p style={{ fontWeight: '600' }}>Approved by:</p>
                            <div style={{ marginTop: '32px', borderBottom: '1px solid #9ca3af', width: '192px' }}>
                                <p style={{ fontStyle: 'italic', textAlign: 'center' }}>{approved_by_user_name}</p>
                            </div>
                            <p style={{ fontSize: '12px', color: '#6b7280', textAlign: 'center', width: '192px' }}>(Signature)</p>
                        </div>
                    )}
                </div>
                <div style={{ width: '256px', fontSize: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><span style={{ color: '#4b5563' }}>Subtotal:</span><span>${(subtotal || 0).toFixed(2)}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><span style={{ color: '#4b5563' }}>Tax:</span><span>${(tax_amount || 0).toFixed(2)}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '16px', borderTop: '1px solid #d1d5db', paddingTop: '8px', marginTop: '4px' }}><span>Total:</span><span>${(total_amount || 0).toFixed(2)}</span></div>
                </div>
            </div>
        </div>
    );
}