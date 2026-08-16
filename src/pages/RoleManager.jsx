import React, { useState, useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Plus, Pencil, Shield, CheckCircle, AlertTriangle, ChevronRight } from 'lucide-react';

const ALL_PAGES = [
  { key: 'Overview',              label: 'Overview / Dashboard' },
  { key: 'Tickets',               label: 'Tickets' },
  { key: 'OnSiteService',         label: 'On-Site Service' },
  { key: 'PartsOrder',            label: 'Parts Order' },
  { key: 'PastOrders',            label: 'Order History' },
  { key: 'Parts',                 label: 'Parts / Inventory' },
  { key: 'Customers',             label: 'Customers' },
  { key: 'Machines',              label: 'Machines' },
  { key: 'Technicians',           label: 'Technicians' },
  { key: 'Suppliers',             label: 'Suppliers' },
  { key: 'Categories',            label: 'Categories' },
  { key: 'PurchaseOrders',        label: 'Purchase Orders' },
  { key: 'Quotes',                label: 'Quotes' },
  { key: 'Transactions',          label: 'Transactions' },
  { key: 'MaintenanceChecklists', label: 'Maintenance Checklists' },
  { key: 'MaintenanceTemplates',  label: 'Maintenance Templates' },
  { key: 'KnowledgeBase',         label: 'Knowledge Base' },
  { key: 'InternalPartMovements', label: 'Internal Part Movements' },
  { key: 'InventoryCount',        label: 'Inventory Count' },
  { key: 'InventoryAudit',        label: 'Inventory Audit Log' },
  { key: 'Reports',               label: 'Reports' },
  { key: 'Export',                label: 'Export' },
  { key: 'BackupRestore',         label: 'Backup & Restore' },
  { key: 'Users',                 label: 'User Management' },
  { key: 'MachineTypes',          label: 'Machine Types' },
  { key: 'Settings',              label: 'Settings' },
];

const ACCESS_LEVELS = [
  { value: 'none',  label: 'No Access', color: 'bg-gray-100 text-gray-500' },
  { value: 'view',  label: 'View',      color: 'bg-blue-100 text-blue-700' },
  { value: 'edit',  label: 'Edit',      color: 'bg-green-100 text-green-700' },
  { value: 'full',  label: 'Full',      color: 'bg-purple-100 text-purple-700' },
];

export default function RoleManager() {
  const [roles, setRoles]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState('');
  const [editingRole, setEditingRole] = useState(null);
  const [showNewRole, setShowNewRole] = useState(false);
  const [newRole, setNewRole]       = useState({ name: '', description: '', permissions: { pages: {}, actions: {} } });

  const loadRoles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('roles').select('*').order('name');
      if (error) throw error;
      setRoles(data || []);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadRoles(); }, []);

  const showSuccess = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 4000); };

  const handleSaveRole = async (role, isNew = false) => {
    setSaving(true);
    setError('');
    try {
      if (isNew) {
        const { error } = await supabase.from('roles').insert([{
          name: role.name,
          description: role.description,
          permissions: role.permissions,
        }]);
        if (error) throw error;
        setShowNewRole(false);
        setNewRole({ name: '', description: '', permissions: { pages: {}, actions: {} } });
        showSuccess(`Role "${role.name}" created.`);
      } else {
        const { error } = await supabase.from('roles').update({
          name: role.name,
          description: role.description,
          permissions: role.permissions,
          updated_date: new Date().toISOString(),
        }).eq('id', role.id);
        if (error) throw error;
        setEditingRole(null);
        showSuccess(`Role "${role.name}" updated.`);
      }
      await loadRoles();
    } catch(e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const setPageAccess = (role, setRole, pageKey, level) => {
    setRole(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        pages: { ...(prev.permissions.pages || {}), [pageKey]: level === 'none' ? undefined : level }
      }
    }));
  };

  const RoleEditor = ({ role, setRole, onSave, onCancel, isNew }) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Role Name</Label>
          <Input value={role.name} onChange={e => setRole(p => ({ ...p, name: e.target.value }))}
            placeholder="e.g. Field Technician" />
        </div>
        <div className="space-y-1.5">
          <Label>Description</Label>
          <Input value={role.description || ''} onChange={e => setRole(p => ({ ...p, description: e.target.value }))}
            placeholder="Brief description" />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Shield className="h-4 w-4" /> Page Access
        </Label>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Page</th>
                {ACCESS_LEVELS.map(l => (
                  <th key={l.value} className="text-center px-2 py-2 font-medium text-gray-600 w-20">{l.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {ALL_PAGES.map((page, i) => {
                const current = role.permissions?.pages?.[page.key] || 'none';
                return (
                  <tr key={page.key} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="px-3 py-2 text-gray-700">{page.label}</td>
                    {ACCESS_LEVELS.map(level => (
                      <td key={level.value} className="text-center px-2 py-2">
                        <button
                          onClick={() => setPageAccess(role, setRole, page.key, level.value)}
                          className={`w-5 h-5 rounded-full border-2 transition-all ${
                            current === level.value
                              ? 'border-slate-800 bg-slate-800'
                              : 'border-gray-300 bg-white hover:border-slate-400'
                          }`}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(role, isNew)} disabled={saving || !role.name}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {isNew ? 'Create Role' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <Shield className="h-8 w-8" /> Role Manager
          </h1>
          <p className="text-gray-500 mt-1">Define roles and control which pages each role can access.</p>
        </div>
        <Button onClick={() => setShowNewRole(true)}>
          <Plus className="h-4 w-4 mr-2" /> New Role
        </Button>
      </div>

      {success && <Alert className="bg-green-50 border-green-200"><CheckCircle className="h-4 w-4 text-green-600" /><AlertDescription className="text-green-800">{success}</AlertDescription></Alert>}
      {error   && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}

      {/* New role form */}
      {showNewRole && (
        <Card>
          <CardHeader><CardTitle>New Role</CardTitle></CardHeader>
          <CardContent>
            <RoleEditor role={newRole} setRole={setNewRole}
              onSave={handleSaveRole} onCancel={() => setShowNewRole(false)} isNew={true} />
          </CardContent>
        </Card>
      )}

      {/* Role list */}
      <div className="space-y-3">
        {roles.map(role => (
          <Card key={role.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">{role.name}</CardTitle>
                  {role.is_system && <Badge className="bg-gray-100 text-gray-600 text-xs">System</Badge>}
                </div>
                <Button size="sm" variant="outline" onClick={() => setEditingRole(editingRole?.id === role.id ? null : { ...role })}>
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  {editingRole?.id === role.id ? 'Cancel' : 'Edit'}
                </Button>
              </div>
              {role.description && <CardDescription>{role.description}</CardDescription>}
              {editingRole?.id !== role.id && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {Object.entries(role.permissions?.pages || {}).map(([page, level]) => {
                    const pageLabel = ALL_PAGES.find(p => p.key === page)?.label || page;
                    const levelCfg = ACCESS_LEVELS.find(l => l.value === level);
                    return (
                      <span key={page} className={`text-xs px-2 py-0.5 rounded-full ${levelCfg?.color || 'bg-gray-100'}`}>
                        {pageLabel} — {levelCfg?.label}
                      </span>
                    );
                  })}
                  {Object.keys(role.permissions?.pages || {}).length === 0 && (
                    <span className="text-xs text-gray-400">No pages assigned</span>
                  )}
                </div>
              )}
            </CardHeader>
            {editingRole?.id === role.id && (
              <CardContent>
                <RoleEditor role={editingRole} setRole={setEditingRole}
                  onSave={handleSaveRole} onCancel={() => setEditingRole(null)} isNew={false} />
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
