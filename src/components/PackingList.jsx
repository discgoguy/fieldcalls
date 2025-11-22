import React, { useState, useEffect } from "react";
import { base44 } from '@/api/base44Client';
import { withTenantFilter } from '@/components/utils/tenant';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function PackingList({ order }) {
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

  if (!order) {
    return null;
  }

  const { customer, orderData, parts } = order;

  return (
    <div className="print-container p-8 font-sans">
      <header className="flex justify-between items-start mb-8">
        <div className="flex items-start">
          {companyInfo.logo ? (
            <img 
              src={companyInfo.logo} 
              alt={companyInfo.name || "Company Logo"} 
              className="h-16 mr-4 object-contain"
            />
          ) : (
            <div className="h-16 w-32 bg-gray-200 mr-4 flex items-center justify-center text-gray-500 text-xs">
              No Logo
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold mb-2">Packing List</h1>
            {companyInfo.name && <p className="font-semibold">{companyInfo.name}</p>}
            {companyInfo.address && <p className="text-sm text-gray-600 whitespace-pre-line">{companyInfo.address}</p>}
            {companyInfo.phone && <p className="text-sm text-gray-600">{companyInfo.phone}</p>}
            {companyInfo.website && <p className="text-sm text-gray-600">{companyInfo.website}</p>}
          </div>
        </div>
        <div className="text-right">
          <p><strong>Date:</strong> {new Date(orderData.date).toLocaleDateString()}</p>
          <p><strong>PO Number:</strong> {orderData.purchase_order_number || 'N/A'}</p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <h2 className="text-lg font-semibold mb-2 border-b pb-1">Ship To:</h2>
          <address className="not-italic">
            <strong>{customer.company_name}</strong><br />
            {customer.contact_person && <>{customer.contact_person}<br /></>}
            {customer.address}<br />
            {customer.phone}
          </address>
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-2 border-b pb-1">Order Details:</h2>
          <p><strong>Shipping Method:</strong> {orderData.shipment_method || 'N/A'}</p>
          <p><strong>Tracking Number:</strong> {orderData.tracking_number || 'N/A'}</p>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-1/2">Part Name</TableHead>
            <TableHead>Part Number</TableHead>
            <TableHead>Machine</TableHead>
            <TableHead className="text-right">Quantity</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {parts.map((part, index) => (
            <TableRow key={index}>
              <TableCell className="font-medium">{part.part_name}</TableCell>
              <TableCell>{part.part_number}</TableCell>
              <TableCell>{part.machine_model || 'N/A'}</TableCell>
              <TableCell className="text-right">{part.quantity}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      
      {orderData.notes && (
          <div className="mt-8">
              <h3 className="font-semibold">Notes:</h3>
              <p className="text-sm text-gray-700">{orderData.notes}</p>
          </div>
      )}

      <footer className="mt-12 text-center text-xs text-gray-500">
        <p>Thank you for your business!</p>
      </footer>
    </div>
  );
}