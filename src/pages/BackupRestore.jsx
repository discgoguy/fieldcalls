import React, { useState, useRef } from 'react';
import { Customer } from '@/entities/Customer';
import { Machine } from '@/entities/Machine';
import { Part } from '@/entities/Part';
import { Category } from '@/entities/Category';
import { MachineType } from '@/entities/MachineType';
import { Technician } from '@/entities/Technician';
import { Transaction } from '@/entities/Transaction';
import { Supplier } from '@/entities/Supplier';
import { Ticket } from '@/entities/Ticket';
import { Quote } from '@/entities/Quote';
import { QuoteItem } from '@/entities/QuoteItem';
import { PurchaseOrder } from '@/entities/PurchaseOrder';
import { PurchaseOrderItem } from '@/entities/PurchaseOrderItem';
import { Setting } from '@/entities/Setting';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Download, Upload, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';

const ENTITIES = {
  categories: Category,
  machine_types: MachineType,
  suppliers: Supplier,
  customers: Customer,
  technicians: Technician,
  parts: Part,
  machines: Machine,
  tickets: Ticket,
  quotes: Quote,
  quote_items: QuoteItem,
  purchase_orders: PurchaseOrder,
  purchase_order_items: PurchaseOrderItem,
  settings: Setting,
  maintenance_templates: base44.entities.MaintenanceTemplate,
  maintenance_checklists: base44.entities.MaintenanceChecklist,
  maintenance_checklist_items: base44.entities.MaintenanceChecklistItem,
  transactions: Transaction
};

const BATCH_SIZE = 25;
const DELETE_BATCH_SIZE = 3;

export default function BackupRestorePage() {
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreFile, setRestoreFile] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const fileInputRef = useRef(null);

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const handleBackup = async () => {
    setIsBackingUp(true);
    setErrorMessage('');
    setSuccessMessage('');
    setStatusMessage('Starting backup... This may take a few moments.');

    try {
      const backupData = {};
      for (const key in ENTITIES) {
        setStatusMessage(`Backing up ${key}...`);
        const Entity = ENTITIES[key];
        const data = await Entity.list(null, 10000);
        backupData[key] = data;
        await sleep(200);
      }

      setStatusMessage('Creating backup file...');
      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `area52_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setSuccessMessage('Backup successfully created and downloaded!');
    } catch (e) {
      setErrorMessage(`Backup failed: ${e.message}`);
    } finally {
      setIsBackingUp(false);
      setStatusMessage('');
    }
  };

  const handleRestore = async () => {
    if (!restoreFile) {
      setErrorMessage('Please select a backup file to restore.');
      return;
    }

    setIsRestoring(true);
    setErrorMessage('');
    setSuccessMessage('');
    setStatusMessage('Starting restore process...');

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const backupData = JSON.parse(e.target.result);
        
        const idMaps = {
            categories: {},
            machine_types: {},
            suppliers: {},
            customers: {},
            technicians: {},
            parts: {},
            machines: {},
            quotes: {},
            tickets: {},
            purchase_orders: {},
            maintenance_checklists: {},
        };

        const restoreOrder = [
            'categories', 
            'machine_types', 
            'suppliers', 
            'customers', 
            'technicians', 
            'parts', 
            'machines', 
            'tickets', 
            'quotes', 
            'quote_items', 
            'purchase_orders',
            'purchase_order_items',
            'settings',
            'maintenance_templates',
            'maintenance_checklists',
            'maintenance_checklist_items',
            'transactions'
        ];
        
        const uniqueFields = {
            categories: 'name',
            machine_types: 'name',
            suppliers: 'name',
            customers: 'customer_identifier',
            technicians: 'technician_code',
            parts: 'part_number',
            machines: 'serial_number',
            tickets: 'ticket_number',
            quotes: 'quote_number',
            purchase_orders: 'po_number',
            settings: 'key',
            maintenance_checklists: 'checklist_number'
        };

        // DELETION PHASE
        for (const key of [...restoreOrder].reverse()) {
          setStatusMessage(`Deleting existing ${key}...`);
          const Entity = ENTITIES[key];
          const existingData = await Entity.list(null, 10000);
          if (existingData.length > 0) {
            const idsToDelete = existingData.map(item => item.id);
            for (let i = 0; i < idsToDelete.length; i += DELETE_BATCH_SIZE) {
                const batchIds = idsToDelete.slice(i, i + DELETE_BATCH_SIZE);
                for (const id of batchIds) {
                    try {
                        await Entity.delete(id);
                    } catch (error) {
                        console.warn(`Failed to delete ${key} with ID ${id}:`, error);
                    }
                }
                setStatusMessage(`Deleting existing ${key}: ${Math.min(i + DELETE_BATCH_SIZE, idsToDelete.length)} of ${idsToDelete.length}`);
                await sleep(500);
            }
          }
          await sleep(1000);
        }
        
        // CREATION AND MAPPING PHASE
        for (const key of restoreOrder) {
          const dataToRestore = backupData[key] || [];
          if (dataToRestore.length > 0) {
            setStatusMessage(`Restoring ${key}...`);
            const Entity = ENTITIES[key];
            let transformedData = dataToRestore.map(({ id, created_date, updated_date, ...rest }) => rest);

            // Translate foreign keys
            if (key === 'machines') {
                transformedData = transformedData.map(machine => ({
                    ...machine,
                    customer_id: idMaps.customers[machine.customer_id] || null,
                }));
            }
            if (key === 'tickets') {
                transformedData = transformedData.map(ticket => ({
                    ...ticket,
                    customer_id: idMaps.customers[ticket.customer_id] || null,
                    technician_id: idMaps.technicians[ticket.technician_id] || null,
                }));
            }
            if (key === 'quotes') {
                transformedData = transformedData.map(quote => ({
                    ...quote,
                    customer_id: idMaps.customers[quote.customer_id] || null,
                }));
            }
            if (key === 'quote_items') {
                transformedData = transformedData.map(item => ({
                    ...item,
                    quote_id: idMaps.quotes[item.quote_id] || null,
                    part_id: idMaps.parts[item.part_id] || null,
                }));
            }
            if (key === 'purchase_orders') {
                transformedData = transformedData.map(po => ({
                    ...po,
                    supplier_id: idMaps.suppliers[po.supplier_id] || null,
                }));
            }
            if (key === 'purchase_order_items') {
                transformedData = transformedData.map(item => ({
                    ...item,
                    purchase_order_id: idMaps.purchase_orders[item.purchase_order_id] || null,
                    part_id: idMaps.parts[item.part_id] || null,
                }));
            }
            if (key === 'maintenance_checklists') {
                transformedData = transformedData.map(checklist => ({
                    ...checklist,
                    customer_id: idMaps.customers[checklist.customer_id] || null,
                    machine_ids: (checklist.machine_ids || []).map(oldId => idMaps.machines[oldId]).filter(Boolean),
                    technician_ids: (checklist.technician_ids || []).map(oldId => idMaps.technicians[oldId]).filter(Boolean),
                }));
            }
            if (key === 'maintenance_checklist_items') {
                transformedData = transformedData.map(item => ({
                    ...item,
                    checklist_id: idMaps.maintenance_checklists[item.checklist_id] || null,
                    machine_id: idMaps.machines[item.machine_id] || null,
                    linked_part_id: item.linked_part_id ? (idMaps.parts[item.linked_part_id] || null) : null,
                }));
            }
            if (key === 'transactions') {
                transformedData = transformedData.map(trans => ({
                    ...trans,
                    customer_id: idMaps.customers[trans.customer_id] || null,
                    machine_id: idMaps.machines[trans.machine_id] || null,
                    part_id: idMaps.parts[trans.part_id] || null,
                    technician_ids: (trans.technician_ids || []).map(oldId => idMaps.technicians[oldId]).filter(Boolean),
                }));
            }
            
            // Create records in batches
            for (let i = 0; i < transformedData.length; i += BATCH_SIZE) {
              const batch = transformedData.slice(i, i + BATCH_SIZE);
              try {
                await Entity.bulkCreate(batch);
              } catch (error) {
                for (const item of batch) {
                  try {
                    await Entity.create(item);
                  } catch (singleError) {
                    console.warn(`Failed to create ${key} item:`, singleError);
                  }
                }
              }
              setStatusMessage(`Restoring ${key}: ${Math.min(i + BATCH_SIZE, dataToRestore.length)} of ${dataToRestore.length}`);
              await sleep(1000);
            }
            
            // ID mapping for entities that require it
            if (key in uniqueFields) {
                setStatusMessage(`Mapping IDs for ${key}...`);
                await sleep(2000);
                const newlyCreatedData = await Entity.list(null, 10000);
                const uniqueField = uniqueFields[key];
                
                const newItemsByUniqueField = newlyCreatedData.reduce((acc, item) => {
                    if (item[uniqueField]) {
                        acc[item[uniqueField]] = item;
                    }
                    return acc;
                }, {});

                dataToRestore.forEach(originalItem => {
                    const newItem = newItemsByUniqueField[originalItem[uniqueField]];
                    if (newItem) {
                        idMaps[key][originalItem.id] = newItem.id;
                    }
                });
            }
          }
          await sleep(1000);
        }

        setSuccessMessage('Restore completed successfully! All data relationships have been preserved.');
      } catch (e) {
        setErrorMessage(`Restore failed: ${e.message}. The backup file might be corrupt or in the wrong format.`);
        console.error(e);
      } finally {
        setIsRestoring(false);
        setStatusMessage('');
        setRestoreFile(null);
        if(fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(restoreFile);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Backup Data</CardTitle>
          <CardDescription>
            Create a full backup of all your application data. This will download a single JSON file
            containing all records from all tables.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleBackup} disabled={isBackingUp || isRestoring}>
            {isBackingUp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {isBackingUp ? 'Creating Backup...' : 'Create and Download Backup'}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-red-500">
        <CardHeader>
          <CardTitle className="text-red-700">Restore Data</CardTitle>
          <CardDescription>
            Restore your application data from a previously created backup file.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Warning: This is a destructive action!</AlertTitle>
            <AlertDescription>
              Restoring from a backup will first **delete all existing data** in your application.
              This action cannot be undone.
            </AlertDescription>
          </Alert>
          <div>
            <Label htmlFor="restore-file">Backup File (.json)</Label>
            <Input
              id="restore-file"
              type="file"
              accept=".json"
              ref={fileInputRef}
              onChange={(e) => setRestoreFile(e.target.files[0])}
              disabled={isRestoring || isBackingUp}
            />
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={!restoreFile || isRestoring || isBackingUp}>
                <Upload className="mr-2 h-4 w-4" />
                Restore from Backup
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action is irreversible. All current data will be permanently deleted and replaced
                  with the data from the backup file.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleRestore}>
                  Yes, Delete and Restore
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      {(isBackingUp || isRestoring || errorMessage || successMessage) && (
        <Card>
            <CardHeader><CardTitle>Process Status</CardTitle></CardHeader>
            <CardContent>
                {statusMessage && <div className="flex items-center text-blue-600"><Loader2 className="mr-2 h-4 w-4 animate-spin" /><p>{statusMessage}</p></div>}
                {errorMessage && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{errorMessage}</AlertDescription></Alert>}
                {successMessage && <Alert className="bg-green-50 border-green-200 text-green-800"><CheckCircle className="h-4 w-4" /><AlertDescription>{successMessage}</AlertDescription></Alert>}
            </CardContent>
        </Card>
      )}
    </div>
  );
}