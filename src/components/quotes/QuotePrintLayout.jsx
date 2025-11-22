import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { withTenantFilter } from '@/components/utils/tenant';
import { format } from 'date-fns';

export default function QuotePrintLayout({ quote, customer }) {
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

    if (!quote) return null;

    return (
        <div className="print-container p-8 font-sans">
            <header className="flex justify-between items-start mb-8">
                <div className="flex flex-col items-start">
                    {companyInfo.logo ? (
                        <img 
                            src={companyInfo.logo} 
                            alt={companyInfo.name || "Company Logo"} 
                            className="h-16 mb-4 object-contain"
                        />
                    ) : (
                        <div className="h-16 w-32 bg-gray-200 mb-4 flex items-center justify-center text-gray-500 text-xs">
                            No Logo
                        </div>
                    )}
                    <div className="text-left">
                        {companyInfo.name && <p className="font-bold text-base">{companyInfo.name}</p>}
                        {companyInfo.address && <p className="text-sm text-gray-600 whitespace-pre-line">{companyInfo.address}</p>}
                        {companyInfo.phone && <p className="text-sm text-gray-600">{companyInfo.phone}</p>}
                        {companyInfo.website && <p className="text-sm text-gray-600">{companyInfo.website}</p>}
                    </div>
                </div>
                <div className="text-right">
                    <h1 className="text-3xl font-bold">Quote</h1>
                    <p className="text-lg text-gray-600">{quote.quote_number}</p>
                    <div className="mt-4 text-sm">
                        {quote.created_date && <p><strong>Date:</strong> {format(new Date(quote.created_date), 'MMM d, yyyy')}</p>}
                        {quote.valid_until && <p><strong>Valid Until:</strong> {format(new Date(quote.valid_until), 'MMM d, yyyy')}</p>}
                    </div>
                </div>
            </header>

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