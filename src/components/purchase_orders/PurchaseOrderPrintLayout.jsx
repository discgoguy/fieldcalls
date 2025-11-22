import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { withTenantFilter } from '@/components/utils/tenant';
import { format } from 'date-fns';

export default function PurchaseOrderPrintLayout({ purchaseOrder, supplier }) {
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

    if (!purchaseOrder || !supplier) return null;

    const { items, po_number, order_date, payment_type, shipping_method, subtotal, tax_amount, total_amount, approved_by_user_name } = purchaseOrder;

    return (
        <div className="print-container p-8 font-sans bg-white">
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
                    <h1 className="text-3xl font-bold">PURCHASE ORDER</h1>
                    <p className="text-lg">{po_number}</p>
                </div>
            </header>

            <div className="grid grid-cols-2 gap-8 mb-8 text-sm">
                <div>
                    <h2 className="font-semibold text-gray-500 uppercase tracking-wide mb-1">Vendor</h2>
                    <address className="not-italic">
                        <p className="font-bold">{supplier.name}</p>
                        <p className="whitespace-pre-wrap">{supplier.address}</p>
                        <p>{supplier.phone}</p>
                    </address>
                </div>
                <div>
                    <h2 className="font-semibold text-gray-500 uppercase tracking-wide mb-1">Ship To</h2>
                    <address className="not-italic">
                        {companyInfo.name && <p className="font-bold">{companyInfo.name}</p>}
                        {companyInfo.address && <p className="whitespace-pre-line">{companyInfo.address}</p>}
                        {companyInfo.phone && <p>{companyInfo.phone}</p>}
                    </address>
                </div>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-8 text-sm border-y py-2">
                <div><strong className="text-gray-500">PO Number:</strong> {po_number}</div>
                <div><strong className="text-gray-500">Order Date:</strong> {format(new Date(order_date), 'MMM d, yyyy')}</div>
                <div><strong className="text-gray-500">Payment Terms:</strong> {payment_type}</div>
                <div><strong className="text-gray-500">Shipping Method:</strong> {shipping_method || 'N/A'}</div>
            </div>

            <table className="w-full text-sm border-collapse">
                <thead className="bg-gray-100">
                    <tr>
                        <th className="p-2 text-left font-semibold border-b-2">Description</th>
                        <th className="p-2 text-right font-semibold border-b-2">Qty</th>
                        <th className="p-2 text-right font-semibold border-b-2">Unit Cost</th>
                        <th className="p-2 text-right font-semibold border-b-2">Total</th>
                    </tr>
                </thead>
                <tbody>
                    {(items || []).map((item, index) => (
                        <tr key={index}>
                            <td className="p-2 border-b">{item.description}</td>
                            <td className="p-2 text-right border-b">{item.quantity_ordered}</td>
                            <td className="p-2 text-right border-b">${(item.unit_cost || 0).toFixed(2)}</td>
                            <td className="p-2 text-right border-b font-semibold">${(item.total_cost || 0).toFixed(2)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            
            <div className="flex justify-between items-end mt-4">
                <div className="text-sm">
                    {approved_by_user_name && (
                        <div>
                            <p className="font-semibold">Approved by:</p>
                            <div className="mt-8 border-b border-gray-400 w-48">
                                <p className="italic text-center">{approved_by_user_name}</p>
                            </div>
                            <p className="text-xs text-gray-500 text-center w-48">(Signature)</p>
                        </div>
                    )}
                </div>
                <div className="w-64 space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-gray-600">Subtotal:</span><span>${(subtotal || 0).toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-600">Tax:</span><span>${(tax_amount || 0).toFixed(2)}</span></div>
                    <div className="flex justify-between font-bold text-base border-t pt-2 mt-1"><span >Total:</span><span>${(total_amount || 0).toFixed(2)}</span></div>
                </div>
            </div>
        </div>
    );
}