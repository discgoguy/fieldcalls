import React from 'react';
import { format } from '@/lib/dateUtils';
import { COMPANY_LOGO_URL } from '@/components/constants'; // Use the main color logo URL

// This component is styled for printing and will be hidden from the screen view.
export default function QuotePrintLayout({ quote, customer }) {
    if (!quote) return null;

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
                    <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginTop: '8px' }}>Quote</h1>
                    <p style={{ fontSize: '18px', color: '#4b5563' }}>{quote.quote_number}</p>
                </div>
                <div style={{ textAlign: 'right', fontSize: '14px' }}>
                    {quote.created_date && <p style={{ marginBottom: '4px' }}><strong>Date:</strong> {format(new Date(quote.created_date), 'MMM d, yyyy')}</p>}
                    {quote.valid_until && <p><strong>Valid Until:</strong> {format(new Date(quote.valid_until), 'MMM d, yyyy')}</p>}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-8 mb-8">
                <div>
                    <h2 className="text-lg font-semibold mb-2 border-b pb-1">Quote For:</h2>
                    <address className="not-italic">
                        <strong>{customer?.company_name}</strong>
                    </address>
                </div>
                <div>
                    <h2 className="text-lg font-semibold mb-2 border-b pb-1">Subject:</h2>
                    <p>{quote.subject}</p>
                </div>
            </div>

            <table className="w-full text-sm border-collapse">
                <thead className="bg-gray-100">
                    <tr>
                        <th className="p-2 text-left font-medium border">Description</th>
                        <th className="p-2 text-right font-medium border">Qty</th>
                        <th className="p-2 text-right font-medium border">Unit Price</th>
                        <th className="p-2 text-right font-medium border">Total</th>
                    </tr>
                </thead>
                <tbody>
                    {(quote.items || []).map((item, index) => (
                        <tr key={index}>
                            <td className="p-2 border-b">{item.description}</td>
                            <td className="p-2 text-right border-b">{item.quantity}</td>
                            <td className="p-2 text-right border-b">${(item.unit_price || 0).toFixed(2)}</td>
                            <td className="p-2 text-right border-b font-semibold">${(item.total_price || 0).toFixed(2)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            
            <div className="flex justify-end mt-4">
                <div className="w-64 space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-gray-600">Subtotal:</span><span>${(quote.subtotal || 0).toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-600">Tax ({quote.tax_rate || 0}%):</span><span>${(quote.tax_amount || 0).toFixed(2)}</span></div>
                    <div className="flex justify-between font-bold text-base border-t pt-2 mt-2"><span >Total:</span><span>${(quote.total_amount || 0).toFixed(2)}</span></div>
                </div>
            </div>

            {quote.notes && <div className="mt-8 pt-4 border-t">
                <h3 className="font-semibold text-base mb-1">Notes:</h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{quote.notes}</p>
            </div>}

            {quote.terms_and_conditions && <div className="mt-6">
                <h3 className="font-semibold text-base mb-1">Terms & Conditions:</h3>
                <p className="text-xs text-gray-600 whitespace-pre-wrap">{quote.terms_and_conditions}</p>
            </div>}

            <footer className="mt-12 text-center text-xs text-gray-500">
                <p>Thank you for your business!</p>
            </footer>
        </div>
    );
}