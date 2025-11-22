
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Briefcase, Loader2, AlertTriangle, CheckCircle, Pencil, Trash2, UserPlus, Mail, Copy } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
} from "@/components/ui/alert-dialog";

export default function UsersPage() {
    const [users, setUsers] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [isEditFormOpen, setIsEditFormOpen] = useState(false);
    const [isInviteFormOpen, setIsInviteFormOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [invitationLink, setInvitationLink] = useState("");
    const [userData, setUserData] = useState({
        full_name: "",
        email: "",
        role: "user",
        job_position: "",
        department: "",
        phone: ""
    });
    const [inviteData, setInviteData] = useState({
        email: "",
        full_name: "",
        intended_role: "user"
    });

    const loadUsers = async () => {
        setLoading(true);
        try {
            const me = await base44.auth.me();
            setCurrentUser(me);
            
            if (!me.tenant_id) {
                setError("Your account is not properly initialized. Please visit the Setup page.");
                setLoading(false);
                return;
            }

            // Use backend function to get team members (handles permissions with asServiceRole)
            const response = await base44.functions.invoke('getTeamMembers');
            
            if (response.data.error) {
                throw new Error(response.data.error);
            }
            
            setUsers(response.data.users || []);
        } catch (e) {
            setError("Failed to load users. " + (e.message || "Please try again."));
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadUsers();
    }, []);

    const handleOpenEditForm = (user = null) => {
        setError("");
        if (user) {
            setEditingUser(user);
            setUserData({
                full_name: user.full_name || "",
                email: user.email || "",
                role: user.role || "user",
                job_position: user.job_position || "",
                department: user.department || "",
                phone: user.phone || ""
            });
        }
        setIsEditFormOpen(true);
    };
    
    const handleCloseEditForm = () => {
        setIsEditFormOpen(false);
        setEditingUser(null);
    };

    const handleOpenInviteForm = () => {
        setError("");
        setSuccessMessage("");
        setInvitationLink("");
        setInviteData({
            email: "",
            full_name: "",
            intended_role: "user"
        });
        setIsInviteFormOpen(true);
    };

    const handleCloseInviteForm = () => {
        setIsInviteFormOpen(false);
        setInvitationLink("");
    };

    const handleSaveUser = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError("");
        setSuccessMessage("");

        const isAdmin = currentUser?.role === 'admin' || currentUser?.is_tenant_owner;

        // Admins can update anyone in their tenant, users can only update themselves
        if (!editingUser || (!isAdmin && currentUser?.id !== editingUser.id)) {
            setError("You do not have permission to perform this action.");
            setIsSubmitting(false);
            return;
        }

        try {
            const updateData = {
                job_position: userData.job_position,
                department: userData.department,
                phone: userData.phone,
            };
            
            // Only admins can change roles
            if (isAdmin) {
                updateData.role = userData.role;
            }
            
            await base44.entities.User.update(editingUser.id, updateData);
            setSuccessMessage("User successfully updated!");
            
            handleCloseEditForm();
            await loadUsers();
            setTimeout(() => setSuccessMessage(""), 4000);
        } catch (e) {
            setError(e.message || "Failed to save user.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleInviteUser = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError("");
        setSuccessMessage("");
        setInvitationLink("");

        try {
            const response = await base44.functions.invoke('inviteTeamMember', inviteData);
            
            if (response.data.error) {
                throw new Error(response.data.error);
            }

            if (response.data.user_existed) {
                // User was added immediately
                setSuccessMessage(response.data.message);
                handleCloseInviteForm();
                await loadUsers();
                setTimeout(() => setSuccessMessage(""), 4000);
            } else {
                // Invitation was sent
                setSuccessMessage(response.data.message);
                setInvitationLink(response.data.invitation_link);
                // Don't close the form so they can copy the link
            }
        } catch (e) {
            setError(e.message || "Failed to process invitation.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCopyLink = () => {
        navigator.clipboard.writeText(invitationLink);
        setSuccessMessage("Invitation link copied to clipboard!");
        setTimeout(() => setSuccessMessage(""), 3000);
    };

    const handleDeleteUser = async (userId) => {
        const isAdmin = currentUser?.role === 'admin' || currentUser?.is_tenant_owner;
        
        if (!isAdmin) {
             setError("You do not have permission to delete users.");
             return;
        }
        if (userId === currentUser?.id) {
             setError("You cannot delete your own account.");
             return;
        }
        try {
            await base44.entities.User.delete(userId);
            setSuccessMessage("User deleted.");
            await loadUsers();
            setTimeout(() => setSuccessMessage(""), 4000);
        } catch (e) {
            setError("Failed to delete user.");
        }
    };

    const isAdmin = currentUser?.role === 'admin' || currentUser?.is_tenant_owner;
    
    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="flex items-center"><Briefcase className="mr-2" />Team Members</CardTitle>
                        <CardDescription>Manage your team members and their roles.</CardDescription>
                    </div>
                    {isAdmin && (
                        <Dialog open={isInviteFormOpen} onOpenChange={setIsInviteFormOpen}>
                            <DialogTrigger asChild>
                                <Button onClick={handleOpenInviteForm}>
                                    <UserPlus className="mr-2 h-4 w-4" />
                                    Invite User
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Invite New Team Member</DialogTitle>
                                </DialogHeader>
                                
                                {invitationLink ? (
                                    <div className="space-y-4 pt-4">
                                        {successMessage && (
                                            <Alert className="bg-green-50 border-green-200">
                                                <CheckCircle className="h-4 w-4 text-green-600" />
                                                <AlertTitle className="text-green-900">Invitation Sent!</AlertTitle>
                                                <AlertDescription className="text-green-800">
                                                    An email has been sent to {inviteData.email} with the invitation link.
                                                </AlertDescription>
                                            </Alert>
                                        )}
                                        
                                        <div>
                                            <Label>Invitation Link (optional - already emailed)</Label>
                                            <div className="flex gap-2 mt-2">
                                                <Input 
                                                    value={invitationLink} 
                                                    readOnly 
                                                    className="bg-gray-50"
                                                />
                                                <Button 
                                                    type="button" 
                                                    variant="outline"
                                                    onClick={handleCopyLink}
                                                >
                                                    <Copy className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">
                                                You can share this link manually if needed. It expires in 7 days.
                                            </p>
                                        </div>

                                        <Button 
                                            onClick={() => {
                                                handleCloseInviteForm();
                                                loadUsers();
                                            }} 
                                            className="w-full"
                                        >
                                            Done
                                        </Button>
                                    </div>
                                ) : (
                                    <form onSubmit={handleInviteUser} className="space-y-4 pt-4">
                                        <Alert className="bg-blue-50 border-blue-200">
                                            <Mail className="h-4 w-4 text-blue-600" />
                                            <AlertTitle className="text-blue-900 font-semibold">How It Works</AlertTitle>
                                            <AlertDescription className="text-blue-800">
                                                We'll send an invitation email with a secure link. If they already have an account, 
                                                they'll be added to your team immediately. Otherwise, they'll create an account first.
                                            </AlertDescription>
                                        </Alert>

                                        <div>
                                            <Label htmlFor="invite_email">Email Address *</Label>
                                            <Input 
                                                id="invite_email"
                                                type="email"
                                                value={inviteData.email}
                                                onChange={(e) => setInviteData({...inviteData, email: e.target.value})}
                                                placeholder="user@example.com"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor="invite_name">Full Name *</Label>
                                            <Input 
                                                id="invite_name"
                                                value={inviteData.full_name}
                                                onChange={(e) => setInviteData({...inviteData, full_name: e.target.value})}
                                                placeholder="John Doe"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor="invite_role">Role</Label>
                                            <Select 
                                                value={inviteData.intended_role} 
                                                onValueChange={(value) => setInviteData({...inviteData, intended_role: value})}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select a role" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="user">User</SelectItem>
                                                    <SelectItem value="admin">Admin</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {error && (
                                            <Alert variant="destructive">
                                                <AlertTriangle className="h-4 w-4" />
                                                <AlertDescription>{error}</AlertDescription>
                                            </Alert>
                                        )}

                                        <div className="flex gap-2">
                                            <Button type="button" variant="outline" onClick={handleCloseInviteForm} className="flex-1">
                                                Cancel
                                            </Button>
                                            <Button type="submit" disabled={isSubmitting} className="flex-1">
                                                {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Sending...</> : "Send Invitation"}
                                            </Button>
                                        </div>
                                    </form>
                                )}
                            </DialogContent>
                        </Dialog>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {successMessage && !invitationLink && <Alert className="bg-green-50 border-green-200 text-green-800"><CheckCircle className="h-4 w-4" /><AlertDescription>{successMessage}</AlertDescription></Alert>}
                {error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
                
                {loading ? (
                    <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin" /></div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Job Position</TableHead>
                                <TableHead>Department</TableHead>
                                <TableHead>Phone</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.length > 0 ? users.map(user => (
                                <TableRow key={user.id}>
                                    <TableCell className="font-medium">{user.full_name}</TableCell>
                                    <TableCell>{user.email}</TableCell>
                                    <TableCell>
                                        <Badge variant={user.role === 'admin' ? 'destructive' : 'secondary'}>
                                            {user.role}
                                        </Badge>
                                        {user.is_tenant_owner && (
                                            <Badge className="ml-2 bg-purple-100 text-purple-800">Owner</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>{user.job_position || 'N/A'}</TableCell>
                                    <TableCell>{user.department || 'N/A'}</TableCell>
                                    <TableCell>{user.phone || 'N/A'}</TableCell>
                                    <TableCell className="text-right">
                                        {isAdmin || currentUser?.id === user.id ? (
                                            <div className="flex justify-end gap-2">
                                                 <Button variant="ghost" size="icon" onClick={() => handleOpenEditForm(user)}><Pencil className="h-4 w-4" /></Button>
                                                {isAdmin && currentUser?.id !== user.id && (
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-red-500" /></Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    This will permanently delete the user "{user.full_name}". This action cannot be undone.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handleDeleteUser(user.id)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                )}
                                            </div>
                                        ) : null}
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow><TableCell colSpan="7" className="text-center">No users found.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
            
            <Dialog open={isEditFormOpen} onOpenChange={setIsEditFormOpen}>
                 <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit User: {userData.full_name}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSaveUser} className="space-y-4 pt-4">
                        <Input value={userData.email} readOnly disabled className="bg-gray-100" />

                        {isAdmin && (
                             <div>
                                <Label htmlFor="role">Role</Label>
                                <Select value={userData.role} onValueChange={(value) => setUserData({...userData, role: value})}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="admin">Admin</SelectItem>
                                        <SelectItem value="user">User</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        <div>
                            <Label htmlFor="job_position">Job Position</Label>
                            <Input id="job_position" value={userData.job_position} onChange={(e) => setUserData({...userData, job_position: e.target.value})} />
                        </div>
                        <div>
                            <Label htmlFor="department">Department</Label>
                            <Input id="department" value={userData.department} onChange={(e) => setUserData({...userData, department: e.target.value})} />
                        </div>
                        <div>
                            <Label htmlFor="phone">Phone</Label>
                            <Input id="phone" type="tel" value={userData.phone} onChange={(e) => setUserData({...userData, phone: e.target.value})} />
                        </div>
                        
                        <Button type="submit" disabled={isSubmitting} className="w-full">
                            {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</> : "Update User"}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
