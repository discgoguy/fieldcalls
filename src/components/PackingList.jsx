import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { COMPANY_LOGO_URL } from "@/components/constants"; 

// This component is styled for printing and will be hidden from the screen view.
export default function PackingList({ order }) {
  if (!order) {
    return null;
  }

  const { customer, orderData, parts } = order;

  return (
    <div style={{ padding: '32px', fontFamily: 'Arial, Helvetica, sans-serif' }}>
      <style>{`
        @media print {
          body { 
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', paddingBottom: '16px', borderBottom: '2px solid #d1d5db' }}>
        <div>
          <img 
            src={COMPANY_LOGO_URL} 
            alt="FieldCalls" 
            style={{ height: '48px', marginBottom: '8px' }}
          />
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '8px' }}>Packing List</h1>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ marginBottom: '4px' }}><strong>Date:</strong> {new Date(orderData.date).toLocaleDateString()}</p>
          <p><strong>PO Number:</strong> {orderData.purchase_order_number || 'N/A'}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', borderBottom: '1px solid #d1d5db', paddingBottom: '4px' }}>Ship To:</h2>
          <address style={{ fontStyle: 'normal' }}>
            <strong>{customer.company_name}</strong><br />
            {customer.contact_person && <>{customer.contact_person}<br /></>}
            {customer.address}<br />
            {customer.phone}
          </address>
        </div>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', borderBottom: '1px solid #d1d5db', paddingBottom: '4px' }}>Order Details:</h2>
          <p><strong>Shipping Method:</strong> {orderData.shipment_method || 'N/A'}</p>
          <p><strong>Tracking Number:</strong> {orderData.tracking_number || 'N/A'}</p>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
        <thead>
          <tr style={{ backgroundColor: '#f3f4f6' }}>
            <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #d1d5db', width: '50%' }}>Part Name</th>
            <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #d1d5db' }}>Part Number</th>
            <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #d1d5db' }}>Machine</th>
            <th style={{ padding: '8px', textAlign: 'right', borderBottom: '2px solid #d1d5db' }}>Quantity</th>
          </tr>
        </thead>
        <tbody>
          {parts.map((part, index) => (
            <tr key={index}>
              <td style={{ padding: '8px', borderBottom: '1px solid #e5e7eb', fontWeight: '500' }}>{part.part_name}</td>
              <td style={{ padding: '8px', borderBottom: '1px solid #e5e7eb' }}>{part.part_number}</td>
              <td style={{ padding: '8px', borderBottom: '1px solid #e5e7eb' }}>{part.machine_model || 'N/A'}</td>
              <td style={{ padding: '8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>{part.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {orderData.notes && (
          <div style={{ marginTop: '32px' }}>
              <h3 style={{ fontWeight: '600' }}>Notes:</h3>
              <p style={{ fontSize: '14px', color: '#374151' }}>{orderData.notes}</p>
          </div>
      )}

      <footer style={{ marginTop: '48px', textAlign: 'center', fontSize: '12px', color: '#6b7280' }}>
        <p>Thank you for your business!</p>
      </footer>
    </div>
  );
}