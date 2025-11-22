
import React, { useState } from 'react';
import { Transaction } from '@/entities/Transaction';
import { Customer } from '@/entities/Customer';
import { Part } from '@/entities/Part';
import { Technician } from '@/entities/Technician';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { format, subDays } from 'date-fns';
import { Calendar as CalendarIcon, FileText, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';

export default function ExportPage() {
  const [exportType, setExportType] = useState('transactions');
  const [isExporting, setIsExporting] = useState(false);
  const [status, setStatus] = useState({ message: '', type: '' });

  // Filters state
  const [dateRange, setDateRange] = useState({ from: subDays(new Date(), 30), to: new Date() });
  const [transactionType, setTransactionType] = useState('all');
  
  const convertToCSV = (data) => {
    if (!data || data.length === 0) return '';
    const headers = Object.keys(data[0]);
    const csvRows = [];
    csvRows.push(headers.join(','));

    for (const row of data) {
      const values = headers.map(header => {
        let cell = row[header] === null || row[header] === undefined ? '' : row[header];
        if (typeof cell === 'string') {
          cell = `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      });
      csvRows.push(values.join(','));
    }
    return csvRows.join('\n');
  };
  
  const downloadCSV = (csvString, filename) => {
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    setStatus({ message: `Exporting ${exportType}...`, type: 'info' });

    try {
      let dataToExport;
      let filename = `${exportType}_export_${new Date().toISOString().split('T')[0]}.csv`;

      switch (exportType) {
        case 'transactions': {
          let apiFilter = {};
          if (transactionType !== 'all') apiFilter.transaction_type = transactionType;
          
          const dateFilter = {};
          if (dateRange.from) {
            dateFilter.$gte = format(dateRange.from, 'yyyy-MM-dd');
          }
          if (dateRange.to) {
              const toDate = new Date(dateRange.to);
              toDate.setDate(toDate.getDate() + 1);
              dateFilter.$lt = format(toDate, 'yyyy-MM-dd');
          }
          apiFilter.date = dateFilter;
          
          const [transactions, customers, parts, technicians] = await Promise.all([
            Transaction.filter(apiFilter, "-date", 5000), // Limit to 5000 for performance
            Customer.list(null, 5000),
            Part.list(null, 5000),
            Technician.list(null, 5000)
          ]);
          
          const customerMap = customers.reduce((acc, c) => ({...acc, [c.id]: c}), {});
          const partMap = parts.reduce((acc, p) => ({...acc, [p.id]: p}), {});
          const technicianMap = technicians.reduce((acc, t) => ({...acc, [t.id]: t}), {});

          dataToExport = transactions.map(t => ({
            date: t.date ? format(new Date(t.date), 'yyyy-MM-dd') : '',
            transaction_type: t.transaction_type,
            customer_name: customerMap[t.customer_id]?.company_name || '',
            purchase_order_number: t.purchase_order_number,
            technician_names: (t.technician_ids || []).map(id => technicianMap[id]?.full_name).join('; '),
            part_name: partMap[t.part_id]?.part_name || '',
            part_number: partMap[t.part_id]?.part_number || '',
            quantity: t.quantity,
            travel_hours: t.travel_hours,
            onsite_hours: t.onsite_hours,
            kilometers: t.kilometers,
            food_expense: t.food_expense,
            hotel_expense: t.hotel_expense,
            tolls_expense: t.tolls_expense,
            shipment_method: t.shipment_method,
            tracking_number: t.tracking_number,
            shipping_cost: t.shipping_cost,
            total_cost: t.total_cost,
            service_call_id: t.service_call_id,
            order_id: t.order_id,
            notes: t.notes
          }));
          break;
        }
        case 'customers': {
          const customers = await Customer.list(null, 5000);
          dataToExport = customers.map(({ id, created_date, updated_date, ...rest }) => rest);
          break;
        }
        case 'parts': {
          const parts = await Part.list(null, 5000);
          dataToExport = parts.map(({ id, created_date, updated_date, ...rest }) => rest);
          break;
        }
        default:
          throw new Error('Invalid export type selected.');
      }
      
      if (!dataToExport || dataToExport.length === 0) {
        setStatus({ message: 'No data found for the selected criteria.', type: 'warning' });
        setIsExporting(false);
        return;
      }

      const csvString = convertToCSV(dataToExport);
      downloadCSV(csvString, filename);
      setStatus({ message: `Successfully exported ${dataToExport.length} records.`, type: 'success' });

    } catch (e) {
      setStatus({ message: `Export failed: ${e.message}`, type: 'error' });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center"><FileText className="mr-2" />Export Data</CardTitle>
        <CardDescription>
          Select the data type and apply filters to export records as a CSV file. Exports are limited to 5,000 records for performance.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="export-type">Data to Export</Label>
          <Select value={exportType} onValueChange={setExportType}>
            <SelectTrigger id="export-type" className="w-full md:w-[280px]">
              <SelectValue placeholder="Select data type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="transactions">Transactions</SelectItem>
              <SelectItem value="customers">Customers</SelectItem>
              <SelectItem value="parts">Parts</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {exportType === 'transactions' && (
          <div className="p-4 border rounded-lg space-y-4">
            <h3 className="font-semibold">Transaction Filters</h3>
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <Label>Date Range</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button id="date" variant={"outline"} className="w-[300px] justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>{format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}</>
                        ) : format(dateRange.from, "LLL dd, y")
                      ) : <span>Pick a date range</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={dateRange?.from}
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>Transaction Type</Label>
                <Select value={transactionType} onValueChange={setTransactionType}>
                  <SelectTrigger className="w-[240px]">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="on_site_service">On-Site Service</SelectItem>
                    <SelectItem value="service_expense">Service Expense</SelectItem>
                    <SelectItem value="parts_order">Parts Order</SelectItem>
                    <SelectItem value="shipping_expense">Shipping Expense</SelectItem>
                    <SelectItem value="inventory_addition">Inventory Addition</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        <Button onClick={handleExport} disabled={isExporting}>
          {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
          Export to CSV
        </Button>

        {status.message && (
          <Alert variant={status.type === 'error' ? 'destructive' : (status.type === 'success' ? 'default' : 'default')} 
                 className={status.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : ''}>
            {status.type === 'success' && <CheckCircle className="h-4 w-4" />}
            {status.type === 'error' && <AlertTriangle className="h-4 w-4" />}
            <AlertDescription>{status.message}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
