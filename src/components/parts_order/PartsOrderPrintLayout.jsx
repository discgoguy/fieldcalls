import React from 'react';
import { format } from '@/lib/dateUtils';
import { COMPANY_LOGO_URL } from '@/components/constants';

export default function PartsOrderPrintLayout({ order, parts, machines, customers, printMode }) {
    if (!order) return null;

    const customer = customers.find(c => c.id === order.customer_id);

    const getPartDetails = (part_id) => parts.find(p => p.id === part_id);
    const getMachineDetails = (machine_id) => machines.find(m => m.id === machine_id);

    const baseStyle = { fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '13px', color: '#111', padding: '32px' };

    if (printMode === 'packing') {
        return (
            <div style={baseStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', paddingBottom: '16px', borderBottom: '2px solid #d1d5db' }}>
                    <div>
                        <img src={COMPANY_LOGO_URL} alt="Logo" style={{ height: '48px', marginBottom: '8px' }} />
                        <h1 style={{ fontSize: '22px', fontWeight: 'bold', margin: 0 }}>Packing List</h1>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <p style={{ margin: '2px 0' }}><strong>Order ID:</strong> {order.order_id}</p>
                        <p style={{ margin: '2px 0' }}><strong>Date:</strong> {format(new Date(order.date), 'MMMM dd, yyyy')}</p>
                        {order.purchase_order_number && <p style={{ margin: '2px 0' }}><strong>PO #:</strong> {order.purchase_order_number}</p>}
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '28px' }}>
                    <div>
                        <h2 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', borderBottom: '1px solid #d1d5db', paddingBottom: '4px' }}>Ship To:</h2>
                        <address style={{ fontStyle: 'normal', lineHeight: '1.6' }}>
                            <strong>{customer?.company_name || 'N/A'}</strong><br />
                            {customer?.contact_person && <>{customer.contact_person}<br /></>}
                            {customer?.address && <>{customer.address}<br /></>}
                            {customer?.phone && <>{customer.phone}<br /></>}
                        </address>
                    </div>
                    <div>
                        <h2 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', borderBottom: '1px solid #d1d5db', paddingBottom: '4px' }}>Shipment Details:</h2>
                        <p style={{ margin: '4px 0' }}><strong>Method:</strong> {order.shipment_method || 'N/A'}</p>
                        <p style={{ margin: '4px 0' }}><strong>Tracking #:</strong> {order.tracking_number || 'N/A'}</p>
                        {order.technician_name && <p style={{ margin: '4px 0' }}><strong>Technician:</strong> {order.technician_name}</p>}
                    </div>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f3f4f6' }}>
                            <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #d1d5db' }}>Part Name</th>
                            <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #d1d5db' }}>Part #</th>
                            <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #d1d5db' }}>Machine</th>
                            <th style={{ padding: '8px', textAlign: 'center', borderBottom: '2px solid #d1d5db' }}>Qty</th>
                            <th style={{ padding: '8px', textAlign: 'center', borderBottom: '2px solid #d1d5db' }}>✓</th>
                        </tr>
                    </thead>
                    <tbody>
                        {order.parts.map((part, idx) => {
                            const pd = getPartDetails(part.part_id);
                            const md = getMachineDetails(part.machine_id);
                            return (
                                <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f9fafb' }}>
                                    <td style={{ padding: '8px', borderBottom: '1px solid #e5e7eb', fontWeight: '500' }}>{pd?.part_name || 'Unknown'}</td>
                                    <td style={{ padding: '8px', borderBottom: '1px solid #e5e7eb', fontFamily: 'monospace', fontSize: '12px' }}>{pd?.part_number || 'N/A'}</td>
                                    <td style={{ padding: '8px', borderBottom: '1px solid #e5e7eb' }}>{md ? `${md.model} (S/N: ${md.serial_number})` : '—'}</td>
                                    <td style={{ padding: '8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>{part.quantity}</td>
                                    <td style={{ padding: '8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center', fontSize: '18px' }}>☐</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {order.notes && (
                    <div style={{ marginTop: '24px', padding: '12px', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '4px' }}>
                        <strong>Notes:</strong>
                        <p style={{ margin: '4px 0 0', color: '#374151' }}>{order.notes}</p>
                    </div>
                )}

                <footer style={{ marginTop: '48px', textAlign: 'center', fontSize: '12px', color: '#6b7280', borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
                    <p>Thank you for your business!</p>
                </footer>
            </div>
        );
    }

    // Summary / report mode
    return (
        <div style={baseStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', paddingBottom: '16px', borderBottom: '2px solid #1e3a5f' }}>
                <div>
                    <img src={COMPANY_LOGO_URL} alt="Logo" style={{ height: '48px', marginBottom: '8px' }} />
                    <h1 style={{ fontSize: '22px', fontWeight: 'bold', margin: 0 }}>Parts Order Summary</h1>
                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#6b7280' }}>Generated: {format(new Date(), 'MMM dd, yyyy')}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: '2px 0', fontFamily: 'monospace', fontWeight: 'bold', color: '#1d4ed8', fontSize: '16px' }}>{order.order_id}</p>
                    <p style={{ margin: '2px 0' }}>{format(new Date(order.date), 'MMMM dd, yyyy')}</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '28px' }}>
                <div>
                    <h2 style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Customer</h2>
                    <p style={{ fontWeight: '600', fontSize: '15px', margin: '0 0 4px' }}>{customer?.company_name || 'N/A'}</p>
                    {customer?.contact_person && <p style={{ margin: '2px 0', color: '#374151' }}>{customer.contact_person}</p>}
                    {customer?.phone && <p style={{ margin: '2px 0', color: '#374151' }}>{customer.phone}</p>}
                </div>
                <div>
                    <h2 style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Order Details</h2>
                    {order.purchase_order_number && <p style={{ margin: '2px 0' }}><strong>PO #:</strong> {order.purchase_order_number}</p>}
                    {order.technician_name && <p style={{ margin: '2px 0' }}><strong>Technician:</strong> {order.technician_name}</p>}
                    {order.shipment_method && <p style={{ margin: '2px 0' }}><strong>Shipping:</strong> {order.shipment_method}</p>}
                    {order.tracking_number && <p style={{ margin: '2px 0' }}><strong>Tracking #:</strong> {order.tracking_number}</p>}
                    {order.shipping_cost > 0 && <p style={{ margin: '2px 0' }}><strong>Shipping Cost:</strong> ${order.shipping_cost.toFixed(2)}</p>}
                </div>
            </div>

            <h2 style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Parts Ordered</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
                <thead>
                    <tr style={{ backgroundColor: '#1e3a5f', color: '#fff' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Part Name</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Part #</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Machine</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center' }}>Qty</th>
                    </tr>
                </thead>
                <tbody>
                    {order.parts.map((part, idx) => {
                        const pd = getPartDetails(part.part_id);
                        const md = getMachineDetails(part.machine_id);
                        return (
                            <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f9fafb' }}>
                                <td style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb', fontWeight: '500' }}>{pd?.part_name || 'Unknown'}</td>
                                <td style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb', fontFamily: 'monospace', fontSize: '12px' }}>{pd?.part_number || 'N/A'}</td>
                                <td style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb' }}>{md ? `${md.model} (S/N: ${md.serial_number})` : '—'}</td>
                                <td style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>{part.quantity}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            {order.notes && (
                <div style={{ padding: '12px', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '4px' }}>
                    <strong>Notes:</strong>
                    <p style={{ margin: '4px 0 0', color: '#374151' }}>{order.notes}</p>
                </div>
            )}
        </div>
    );
}