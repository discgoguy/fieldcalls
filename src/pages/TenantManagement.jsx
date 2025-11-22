
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { 
  Loader2, AlertTriangle, CheckCircle, Shield, Users, 
  Plus, Trash2, Building, TrendingUp, Clock, Database, Mail, Edit 
} from 'lucide-react';
import { differenceInDays, format, parseISO } from 'date-fns';

// CHANGE THIS TO YOUR EMAIL - Only this email can access this page
const SUPER_ADMIN_EMAIL = 'discgoguy@gmail.com';

export default function TenantManagement() {
    const [currentUser, setCurrentUser] = useState(null);
    const [tenants, setTenants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [editingTenant, setEditingTenant] = useState(null);

    const [updateData, setUpdateData] = useState({
        subscription_status: 'trial',
        trial_days: 30
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        setError('');
        
        try {
            const user = await base44.auth.me();
            setCurrentUser(user);

            // Check if user is super admin
            if (user.email !== SUPER_ADMIN_EMAIL) {
                setError('Access Denied: You do not have permission to view this page.');
                setLoading(false);
                return;
            }

            // Call backend function to get tenant data (uses service role)
            const response = await base44.functions.invoke('getTenantData', {});
            
            if (response.data.error) {
                throw new Error(response.data.error);
            }

            setTenants(response.data.tenants || []);
        } catch (e) {
            setError(`Failed to load tenant data: ${e.message}`);
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenEditDialog = (tenant) => {
        setEditingTenant(tenant);
        setUpdateData({
            subscription_status: tenant.subscription_status || 'trial',
            trial_days: 30
        });
        setIsEditDialogOpen(true);
    };

    const handleUpdateUser = async (e) => {
        e.preventDefault();
        setIsUpdating(true);
        setError('');
        setSuccessMessage('');

        try {
            if (!editingTenant || !editingTenant.owner) {
                throw new Error('No user selected to update');
            }

            const today = new Date();
            const trialEnd = new Date();
            trialEnd.setDate(trialEnd.getDate() + parseInt(updateData.trial_days));

            const userData = {
                subscription_status: updateData.subscription_status
            };

            // If setting to trial, update trial dates
            if (updateData.subscription_status === 'trial') {
                userData.trial_start_date = today.toISOString().split('T')[0];
                userData.trial_end_date = trialEnd.toISOString().split('T')[0];
            }

            // Use service role to update user
            await base44.asServiceRole.entities.User.update(editingTenant.owner.id, userData);

            setSuccessMessage(`${editingTenant.owner.email} updated successfully!`);
            setIsEditDialogOpen(false);
            
            await loadData();
            setTimeout(() => setSuccessMessage(''), 4000);
        } catch (e) {
            setError(`Failed to update user: ${e.message}`);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleDeleteUser = async (userId, userEmail) => {
        try {
            const response = await base44.functions.invoke('deleteTenantUser', {
                userId,
                userEmail
            });

            if (response.data.error) {
                throw new Error(response.data.error);
            }

            setSuccessMessage(response.data.message || 'User deleted successfully');
            await loadData();
            setTimeout(() => setSuccessMessage(''), 4000);
        } catch (e) {
            setError(`Failed to delete user: ${e.message}`);
        }
    };

    const handleOpenInviteUsers = () => {
        // Open Base44 dashboard in new tab to invite users
        window.open('https://app.base44.com/apps', '_blank');
        setSuccessMessage('Opening Base44 dashboard. You can invite specific users there if needed.');
        setTimeout(() => setSuccessMessage(''), 8000);
    };

    const getTrialDaysRemaining = (trialEndDate) => {
        if (!trialEndDate) return null;
        const days = differenceInDays(parseISO(trialEndDate), new Date());
        return days;
    };

    const getStatusBadge = (subscription_status, trialDaysRemaining) => {
        if (subscription_status === 'active') {
            return <Badge className="bg-green-100 text-green-800">Active Subscriber</Badge>;
        }
        if (subscription_status === 'trial') {
            if (trialDaysRemaining === null) {
                return <Badge className="bg-gray-100 text-gray-800">Trial (No End Date)</Badge>;
            }
            if (trialDaysRemaining < 0) {
                return <Badge variant="destructive">Trial Expired</Badge>;
            }
            if (trialDaysRemaining <= 3) {
                return <Badge className="bg-orange-100 text-orange-800">Trial ({trialDaysRemaining}d left)</Badge>;
            }
            return <Badge className="bg-blue-100 text-blue-800">Trial ({trialDaysRemaining}d left)</Badge>;
        }
        return <Badge variant="secondary">{subscription_status}</Badge>;
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Loader2 className="w-8 h-8 animate-spin" />
                <span className="ml-3">Loading tenant data...</span>
            </div>
        );
    }

    if (error && currentUser?.email !== SUPER_ADMIN_EMAIL) {
        return (
            <Card className="max-w-2xl mx-auto mt-8">
                <CardContent className="pt-6">
                    <Alert variant="destructive">
                        <Shield className="h-4 w-4" />
                        <AlertTitle>Access Denied</AlertTitle>
                        <AlertDescription>
                            {error}
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle className="flex items-center">
                                <Shield className="mr-2 h-6 w-6" />
                                Tenant Management Dashboard
                            </CardTitle>
                            <CardDescription>
                                Monitor all customer accounts, trial status, and usage metrics
                            </CardDescription>
                        </div>
                        <Button onClick={handleOpenInviteUsers} variant="outline">
                            <Mail className="mr-2 h-4 w-4" />
                            Invite Specific Users
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <Alert className="bg-blue-50 border-blue-200">
                        <Mail className="h-4 w-4 text-blue-600" />
                        <AlertTitle className="text-blue-900">How Users Join Your Platform</AlertTitle>
                        <AlertDescription className="text-blue-800">
                            <div className="space-y-3 mt-2">
                                <div>
                                    <p className="font-semibold">Self-Signup (Primary Method):</p>
                                    <ol className="list-decimal list-inside space-y-1 ml-2">
                                        <li>Users visit FieldCalls.com and click "Start Free Trial"</li>
                                        <li>They create a Base44 account (email + password)</li>
                                        <li>After signup, they're prompted to initialize their 30-day trial</li>
                                        <li>They appear here automatically with full access</li>
                                    </ol>
                                </div>
                                <div className="pt-2 border-t border-blue-300">
                                    <p className="font-semibold">Direct Invitation (Optional):</p>
                                    <p className="ml-2">Click "Invite Specific Users" above to invite someone directly through the Base44 dashboard</p>
                                </div>
                            </div>
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>

            {successMessage && (
                <Alert className="bg-green-50 border-green-200 text-green-800">
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>{successMessage}</AlertDescription>
                </Alert>
            )}

            {error && currentUser?.email === SUPER_ADMIN_EMAIL && (
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Total Tenants</p>
                                <p className="text-2xl font-bold">{tenants.length}</p>
                            </div>
                            <Building className="h-8 w-8 text-blue-500" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Active Subscribers</p>
                                <p className="text-2xl font-bold">
                                    {tenants.filter(t => t.subscription_status === 'active').length}
                                </p>
                            </div>
                            <TrendingUp className="h-8 w-8 text-green-500" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Trial Users</p>
                                <p className="text-2xl font-bold">
                                    {tenants.filter(t => t.subscription_status === 'trial').length}
                                </p>
                            </div>
                            <Clock className="h-8 w-8 text-orange-500" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">With Data</p>
                                <p className="text-2xl font-bold">
                                    {tenants.filter(t => t.data_counts?.has_data).length}
                                </p>
                            </div>
                            <Database className="h-8 w-8 text-purple-500" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tenants Table */}
            <Card>
                <CardHeader>
                    <CardTitle>All Customer Accounts</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Company</TableHead>
                                    <TableHead>Owner</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Users</TableHead>
                                    <TableHead>Data Created</TableHead>
                                    <TableHead>Last Activity</TableHead>
                                    <TableHead>Created</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {tenants.map((tenant) => {
                                    const trialDays = getTrialDaysRemaining(tenant.trial_end_date);
                                    return (
                                        <TableRow key={tenant.tenant_id}>
                                            <TableCell className="font-medium">
                                                {tenant.company_name}
                                                <p className="text-xs text-gray-500">{tenant.tenant_id.substring(0, 8)}...</p>
                                            </TableCell>
                                            <TableCell>
                                                {tenant.owner ? (
                                                    <>
                                                        <p className="font-medium">{tenant.owner.full_name}</p>
                                                        <p className="text-xs text-gray-500">{tenant.owner.email}</p>
                                                    </>
                                                ) : (
                                                    <span className="text-gray-400">No owner</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {getStatusBadge(tenant.subscription_status, trialDays)}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1">
                                                    <Users className="h-4 w-4 text-gray-400" />
                                                    <span>{tenant.users.length}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="space-y-1 text-sm">
                                                    <div>Customers: {tenant.data_counts?.customers || 0}</div>
                                                    <div>Parts: {tenant.data_counts?.parts || 0}</div>
                                                    <div>Transactions: {tenant.data_counts?.transactions || 0}</div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {tenant.last_activity ? (
                                                    <span className="text-sm">
                                                        {format(parseISO(tenant.last_activity), 'MMM d, yyyy')}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400">Never</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {tenant.created_date ? (
                                                    <span className="text-sm">
                                                        {format(parseISO(tenant.created_date), 'MMM d, yyyy')}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex gap-1">
                                                    {tenant.owner && (
                                                        <>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="sm"
                                                                onClick={() => handleOpenEditDialog(tenant)}
                                                            >
                                                                <Edit className="h-4 w-4" />
                                                            </Button>
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button variant="ghost" size="sm">
                                                                        <Trash2 className="h-4 w-4 text-red-500" />
                                                                    </Button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>Delete User?</AlertDialogTitle>
                                                                        <AlertDialogDescription>
                                                                            This will delete {tenant.owner.email} and remove their access.
                                                                            This action cannot be undone.
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                        <AlertDialogAction
                                                                            onClick={() => handleDeleteUser(tenant.owner.id, tenant.owner.email)}
                                                                            className="bg-red-600 hover:bg-red-700"
                                                                        >
                                                                            Delete
                                                                        </AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                                {tenants.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan="8" className="text-center py-8 text-gray-500">
                                            No tenants found
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Edit User Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Update User Subscription</DialogTitle>
                    </DialogHeader>
                    {editingTenant && (
                        <form onSubmit={handleUpdateUser} className="space-y-4 pt-4">
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <p className="text-sm font-medium">{editingTenant.owner?.full_name}</p>
                                <p className="text-xs text-gray-500">{editingTenant.owner?.email}</p>
                            </div>
                            <div>
                                <Label htmlFor="subscription_status">Subscription Status</Label>
                                <Select 
                                    value={updateData.subscription_status} 
                                    onValueChange={(value) => setUpdateData({...updateData, subscription_status: value})}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="trial">Trial</SelectItem>
                                        <SelectItem value="active">Active Subscription</SelectItem>
                                        <SelectItem value="expired">Expired</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {updateData.subscription_status === 'trial' && (
                                <div>
                                    <Label htmlFor="trial_days">Trial Duration (Days)</Label>
                                    <Input
                                        id="trial_days"
                                        type="number"
                                        value={updateData.trial_days}
                                        onChange={(e) => setUpdateData({...updateData, trial_days: e.target.value})}
                                        min="1"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Trial will start today and end in {updateData.trial_days} days
                                    </p>
                                </div>
                            )}
                            <Button type="submit" disabled={isUpdating} className="w-full">
                                {isUpdating ? (
                                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Updating...</>
                                ) : (
                                    'Update User'
                                )}
                            </Button>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
