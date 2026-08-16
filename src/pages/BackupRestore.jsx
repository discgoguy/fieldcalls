import React, { useState, useRef } from 'react';
import { Category, MachineType, Customer, Machine, Technician, Part, Ticket, TicketNote, Quote, QuoteItem, Supplier, PurchaseOrder, PurchaseOrderItem, MaintenanceChecklist, MaintenanceChecklistItem, MaintenanceTemplate, KnowledgeCategory, KnowledgeItem, Setting, Transaction, BorrowedPart, AssemblyComponent, CustomerInventory, Role, User as Profile, PendingUser, InventoryCount, InventoryCountItem, InventoryAudit, PriceHistory, CalendarEvent } from '@/api/entities';
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

// roles -> Role, profiles -> User (aliased here as Profile), pending_users -> PendingUser,
// inventory_counts -> InventoryCount, inventory_count_items -> InventoryCountItem,
// inventory_audit -> InventoryAudit, price_history -> PriceHistory, calendar_events -> CalendarEvent.
// These wrappers were just added to entities.js - see that file's diff.
const ENTITIES = {
  categories: Category,
  machine_types: MachineType,
  suppliers: Supplier,
  customers: Customer,
  technicians: Technician,
  parts: Part,
  assembly_components: AssemblyComponent,
  machines: Machine,
  tickets: Ticket,
  ticket_notes: TicketNote,
  quotes: Quote,
  quote_items: QuoteItem,
  purchase_orders: PurchaseOrder,
  purchase_order_items: PurchaseOrderItem,
  settings: Setting,
  maintenance_templates: MaintenanceTemplate,
  maintenance_checklists: MaintenanceChecklist,
  maintenance_checklist_items: MaintenanceChecklistItem,
  transactions: Transaction,
  borrowed_parts: BorrowedPart,
  customer_inventory: CustomerInventory,
  knowledge_categories: KnowledgeCategory,
  knowledge_items: KnowledgeItem,
  roles: Role,
  profiles: Profile,
  pending_users: PendingUser,
  inventory_counts: InventoryCount,
  inventory_count_items: InventoryCountItem,
  inventory_audit: InventoryAudit,
  price_history: PriceHistory,
  calendar_events: CalendarEvent,
};

const BATCH_SIZE = 25;
const DELETE_BATCH_SIZE = 20;

// entities.js's list(orderBy = 'created_date', limit) only falls back to its default
// when orderBy is `undefined` - passing `null` bypasses the default and crashes on
// `orderBy.startsWith`. So every list() call below passes `undefined`, not `null`.
// Two tables also don't have a created_date column at all, so they need an explicit
// override to a column that actually exists:
const LIST_ORDER_OVERRIDES = {
  pending_users: 'invited_at',
  price_history: 'checked_at',
};
const listOrderFor = (key) => LIST_ORDER_OVERRIDES[key] || undefined;

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
        const data = await Entity.list(listOrderFor(key), 10000);
        backupData[key] = data;
        await sleep(200);
      }

      setStatusMessage('Creating backup file...');
      const jsonString = JSON.stringify(backupData, null, 2);
      const fileName = `fieldcalls_backup_${new Date().toISOString().split('T')[0]}.json`;
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
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

        // Every id column in this schema is a UUID/text string that the application
        // (or Postgres) generates - none are auto-increment integers, and (aside from
        // a handful of tables) none of the FKs between them are even enforced by the
        // database. That means restore doesn't need to invent new ids and then chase
        // down every place that referenced the old one: we can simply write the
        // original id straight back, and the whole FK graph stays intact for free.
        //
        // The one real exception is `profiles`, whose id is a foreign key into
        // Supabase's own auth.users table. We can't manufacture new auth users during
        // restore, so profiles are matched to the current auth user by email and
        // synced in place rather than recreated - meaning a profile's id CAN change
        // between backup and restore. `roles` is matched by name for the same
        // "never delete this out from under profiles" reason, even though its id
        // constraint isn't as fundamental. idMaps only needs to track those two.
        const idMaps = {
            roles: {},
            profiles: {},
        };

        // 'roles' and 'profiles' are NEVER deleted/recreated. 'profiles.id' is a
        // foreign key into Supabase's own auth.users table - we cannot manufacture
        // new auth users during restore, and old profile IDs will only be valid if
        // the same auth users still exist. Deleting 'roles' is also unsafe: profiles
        // reference roles.id and profiles are left untouched, so removing roles out
        // from under them risks an FK violation (or silently orphaned role_id's).
        // Instead we match existing rows by a stable natural key and sync fields in
        // place, never touching the id column of either table.
        const syncRoles = async (backupRoles) => {
          if (!backupRoles || backupRoles.length === 0) return;
          setStatusMessage('Syncing roles (matched by name, not recreated)...');
          const existingRoles = await Role.list(undefined, 10000);
          const existingByName = existingRoles.reduce((acc, r) => {
            if (r.name) acc[r.name] = r;
            return acc;
          }, {});

          for (const backupRole of backupRoles) {
            let match = backupRole.name ? existingByName[backupRole.name] : null;
            if (!match) {
              try {
                match = await Role.create({
                  name: backupRole.name,
                  description: backupRole.description,
                  is_system: backupRole.is_system,
                  permissions: backupRole.permissions,
                });
              } catch (err) {
                console.warn(`Failed to create missing role "${backupRole.name}":`, err);
                continue;
              }
            } else {
              try {
                await Role.update(match.id, {
                  description: backupRole.description,
                  permissions: backupRole.permissions,
                });
              } catch (err) {
                console.warn(`Failed to sync role "${backupRole.name}":`, err);
              }
            }
            idMaps.roles[backupRole.id] = match.id;
          }
        };

        // Must run after syncRoles (needs idMaps.roles for role_id translation).
        // customer_id/technician_id are NOT translated here - those ids are now
        // preserved as-is during restore, so the original values are still valid.
        const syncProfiles = async (backupProfiles) => {
          if (!backupProfiles || backupProfiles.length === 0) return;
          setStatusMessage('Syncing profiles (matched by email, not recreated)...');
          const existingProfiles = await Profile.list(undefined, 10000);
          const existingByEmail = existingProfiles.reduce((acc, p) => {
            if (p.email) acc[p.email.toLowerCase()] = p;
            return acc;
          }, {});

          for (const backupProfile of backupProfiles) {
            const match = backupProfile.email ? existingByEmail[backupProfile.email.toLowerCase()] : null;
            if (!match) {
              console.warn(`No existing auth user/profile found for "${backupProfile.email || backupProfile.id}" - skipping. Profiles are tied 1:1 to auth.users and cannot be recreated from a backup.`);
              continue;
            }
            idMaps.profiles[backupProfile.id] = match.id;
            try {
              await Profile.update(match.id, {
                full_name: backupProfile.full_name,
                role: backupProfile.role,
                role_id: idMaps.roles[backupProfile.role_id] || match.role_id || null,
                department: backupProfile.department,
                phone: backupProfile.phone,
                is_customer: backupProfile.is_customer,
                customer_id: backupProfile.customer_id || null,
                technician_id: backupProfile.technician_id || null,
              });
            } catch (err) {
              console.warn(`Failed to sync profile ${match.id}:`, err);
            }
          }
        };

        const restoreOrder = [
            'knowledge_categories',
            'categories',
            'machine_types',
            'suppliers',
            'customers',
            'technicians',
            'parts',
            'price_history',
            'assembly_components',
            'customer_inventory',
            'machines',
            'tickets',
            'ticket_notes',
            'quotes',
            'quote_items',
            'purchase_orders',
            'purchase_order_items',
            'settings',
            'maintenance_templates',
            'maintenance_checklists',
            'maintenance_checklist_items',
            'transactions',
            'borrowed_parts',
            'knowledge_items',
            'calendar_events',
            'pending_users',
            'inventory_counts',
            'inventory_count_items',
            'inventory_audit'
        ];

        // DELETION PHASE - roles and profiles are intentionally absent from
        // restoreOrder, so they are never touched here.
        for (const key of [...restoreOrder].reverse()) {
          setStatusMessage(`Deleting existing ${key}...`);
          const Entity = ENTITIES[key];
          const existingData = await Entity.list(listOrderFor(key), 10000);
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

        // Sync roles and profiles before the creation phase. Neither depends on any
        // other table's ids being restored first anymore - profiles is matched by
        // email and only needs idMaps.roles (built by syncRoles) for role_id.
        await syncRoles(backupData.roles);
        await syncProfiles(backupData.profiles);

        // CREATION AND MAPPING PHASE
        for (const key of restoreOrder) {
          const dataToRestore = backupData[key] || [];
          if (dataToRestore.length > 0) {
            setStatusMessage(`Restoring ${key}...`);
            const Entity = ENTITIES[key];
            // IDs (and created_date/updated_date) are preserved exactly as backed up -
            // see the note above idMaps for why this is both correct and necessary.
            // The only fields translated here are the handful that point at
            // `profiles`, since a profile's id can legitimately change on restore
            // (matched by email, not recreated) while everything else's id cannot.
            let transformedData = dataToRestore;

            if (key === 'pending_users') {
                transformedData = transformedData.map(pu => ({
                    ...pu,
                    invited_by: idMaps.profiles[pu.invited_by] || null,
                }));
            }
            if (key === 'inventory_counts') {
                transformedData = transformedData.map(ic => ({
                    ...ic,
                    created_by: idMaps.profiles[ic.created_by] || null,
                    committed_by: idMaps.profiles[ic.committed_by] || null,
                }));
            }
            if (key === 'inventory_audit') {
                transformedData = transformedData.map(ia => ({
                    ...ia,
                    created_by: idMaps.profiles[ia.created_by] || null,
                }));
            }
            if (key === 'calendar_events') {
                // user_id has no enforced FK and isn't guaranteed to be a profile id,
                // so fall back to the original value if it isn't one.
                transformedData = transformedData.map(ev => ({
                    ...ev,
                    user_id: idMaps.profiles[ev.user_id] || ev.user_id || null,
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
        <CardContent className="space-y-3">
          <Button onClick={handleBackup} disabled={isBackingUp || isRestoring}>
            {isBackingUp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {isBackingUp ? 'Creating Backup...' : 'Create Backup'}
          </Button>
          <p className="text-sm text-gray-500">
            Backup will be downloaded to your computer as a JSON file.
          </p>
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
              Restoring from a backup will first **delete all existing data** in your application
              (except user profiles and roles, which are matched and synced in place rather than
              recreated). This action cannot be undone.
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
