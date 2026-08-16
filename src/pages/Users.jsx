import { useState, useEffect } from "react";
import { supabase } from "@/api/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { UserPlus, Users, Wrench, Mail, RefreshCw, Link2, RotateCcw, KeyRound } from "lucide-react";

const invokeApi = async (fn, body) => {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`/api/${fn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify(body),
  });
  return res.json();
};

const roleColors = {
  admin: "bg-purple-100 text-purple-800",
  technician: "bg-blue-100 text-blue-800",
  sales: "bg-amber-100 text-amber-800",
  customer: "bg-green-100 text-green-800",
};

export default function UsersPage() {
  const [users, setUsers]           = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [profiles, setProfiles]     = useState([]);
  const [roles, setRoles]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState(null);

  // Modals
  const [inviteOpen, setInviteOpen]           = useState(false);
  const [editOpen, setEditOpen]               = useState(false);
  const [techInviteOpen, setTechInviteOpen]   = useState(false);
  const [selectedTech, setSelectedTech]       = useState(null);

  // Forms
  const [invite, setInvite] = useState({ email: "", full_name: "", role: "technician", role_id: "", customer_id: "", technician_id: "" });
  const [editUser, setEditUser] = useState(null);

  // ── Load data ────────────────────────────────────────────────────────────
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [profilesRes, techRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("*").order("full_name"),
        supabase.from("technicians").select("id,full_name,email,department,phone,active,technician_code").order("full_name"),
        supabase.from("roles").select("*").order("name"),
      ]);

      const profileData = profilesRes.data || [];
      const techData    = techRes.data    || [];
      const rolesData   = rolesRes.data   || [];

      setProfiles(profileData);
      setRoles(rolesData);

      // Build user list from profiles (registered users)
      setUsers(profileData);

      // Deduplicate technicians: prefer the one with an email (69768d3c... prefix)
      // and filter to unique names keeping the one with email
      const emailMap = {};
      techData.forEach((t) => {
        const key = t.full_name?.toLowerCase().trim();
        if (!emailMap[key] || (t.email && !emailMap[key].email)) {
          emailMap[key] = t;
        }
      });
      setTechnicians(Object.values(emailMap).filter((t) => t.active !== false));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // ── Derived: techs without a linked profile ──────────────────────────────
  const linkedTechIds = new Set(profiles.map((p) => p.technician_id).filter(Boolean));
  // Also match by email
  const profileEmails = new Set(profiles.map((p) => p.email?.toLowerCase()).filter(Boolean));
  const unlinkedTechs = technicians.filter((t) => {
    const alreadyLinked = linkedTechIds.has(t.id);
    const emailExists   = t.email && profileEmails.has(t.email.toLowerCase());
    return !alreadyLinked && !emailExists;
  });

  // ── Invite new user ───────────────────────────────────────────────────────
  const handleInvite = async () => {
    if (!invite.email || !invite.full_name) return;
    setSaving(true);
    try {
      const res = await invokeApi("sendPortalInvitation", {
        email:        invite.email,
        full_name:    invite.full_name,
        role:         invite.role,
        role_id:      invite.role_id || null,
        customer_id:  invite.customer_id || null,
        technician_id: invite.technician_id || null,
      });
      if (res.success) {
        setInviteOpen(false);
        setInvite({ email: "", full_name: "", role: "technician", role_id: "", customer_id: "", technician_id: "" });
        loadData();
      } else {
        setError(res.error || "Invite failed");
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Invite from technician row ─────────────────────────────────────────
  const openTechInvite = (tech) => {
    setSelectedTech(tech);
    setInvite({
      email:         tech.email || "",
      full_name:     tech.full_name,
      role:          "technician",
      role_id:       "",
      customer_id:   "",
      technician_id: tech.id,
    });
    setTechInviteOpen(true);
  };

  const handleTechInvite = async () => {
    if (!invite.email || !invite.full_name) return;
    setSaving(true);
    try {
      const res = await invokeApi("sendPortalInvitation", {
        email:         invite.email,
        full_name:     invite.full_name,
        role:          invite.role,
        role_id:       invite.role_id || null,
        customer_id:   null,
        technician_id: invite.technician_id,
      });
      if (res.success) {
        setTechInviteOpen(false);
        setSelectedTech(null);
        loadData();
      } else {
        setError(res.error || "Invite failed");
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Edit user ──────────────────────────────────────────────────────────
  const openEdit = (user) => {
    setEditUser({ ...user });
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      const res = await invokeApi("manageUser", {
        action: "update",
        userId: editUser.id,
        updates: {
          full_name:     editUser.full_name,
          role:          editUser.role,
          role_id:       editUser.role_id || null,
          department:    editUser.department || null,
          phone:         editUser.phone || null,
          technician_id: editUser.technician_id || null,
        },
      });
      if (res.success) {
        setEditOpen(false);
        loadData();
      } else {
        setError(res.error || "Update failed");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm("Remove this user? This cannot be undone.")) return;
    setSaving(true);
    try {
      await invokeApi("manageUser", { action: "delete", userId });
      loadData();
    } finally {
      setSaving(false);
    }
  };

  const handleResendInvite = async (user) => {
    setSaving(true);
    setError(null);
    try {
      const res = await invokeApi("sendPortalInvitation", {
        email:         user.email,
        full_name:     user.full_name,
        role:          user.role || "technician",
        role_id:       user.role_id || null,
        technician_id: user.technician_id || null,
      });
      if (!res.success) setError(res.error || "Resend failed");
      else alert(`Invite resent to ${user.email}`);
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async (user) => {
    if (!window.confirm(`Send a password reset email to ${user.email}?`)) return;
    setSaving(true);
    setError(null);
    try {
      const res = await invokeApi("manageUser", { action: "resetPassword", email: user.email });
      if (!res.success) setError(res.error || "Reset failed");
      else alert(`Password reset email sent to ${user.email}`);
    } finally {
      setSaving(false);
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────
  const getRoleName = (roleId) => roles.find((r) => r.id === roleId)?.name;
  const getTechName = (techId) => technicians.find((t) => t.id === techId)?.full_name;

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage portal access for team members and customers.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={() => { setInvite({ email: "", full_name: "", role: "technician", role_id: "", customer_id: "", technician_id: "" }); setInviteOpen(true); }}>
            <UserPlus className="w-4 h-4 mr-1.5" />
            Invite User
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-2">
          {error}
        </div>
      )}

      {/* ── Active Users Table ── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-gray-500" />
          <h2 className="text-base font-semibold text-gray-800">Portal Users</h2>
          <span className="text-xs text-gray-400">({users.length})</span>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="text-xs">Name</TableHead>
                <TableHead className="text-xs">Email</TableHead>
                <TableHead className="text-xs">Base Role</TableHead>
                <TableHead className="text-xs">Custom Role</TableHead>
                <TableHead className="text-xs">Department</TableHead>
                <TableHead className="text-xs">Linked Tech</TableHead>
                <TableHead className="text-xs w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-gray-400 py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-gray-400 py-8">
                    No users yet
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => (
                  <TableRow key={u.id} className="hover:bg-gray-50">
                    <TableCell className="font-medium text-sm">{u.full_name || "—"}</TableCell>
                    <TableCell className="text-sm text-gray-600">{u.email}</TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${roleColors[u.role] || "bg-gray-100 text-gray-700"}`}>
                        {u.role || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {getRoleName(u.role_id)
                        ? <Badge className="bg-indigo-100 text-indigo-800 text-xs">{getRoleName(u.role_id)}</Badge>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">{u.department || "—"}</TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {u.technician_id
                        ? <span className="flex items-center gap-1 text-blue-600 text-xs"><Link2 className="w-3 h-3" />{getTechName(u.technician_id) || u.technician_id.slice(0, 8) + "…"}</span>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => openEdit(u)}>
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-amber-600 hover:text-amber-800" onClick={() => handleResendInvite(u)} disabled={saving} title="Resend invite email">
                          <RotateCcw className="w-3 h-3 mr-1" />Resend
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-blue-600 hover:text-blue-800" onClick={() => handleResetPassword(u)} disabled={saving} title="Send password reset email">
                          <KeyRound className="w-3 h-3 mr-1" />Reset PW
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-red-500 hover:text-red-700" onClick={() => handleDelete(u.id)}>
                          Remove
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* ── Technicians Without Accounts ── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Wrench className="w-4 h-4 text-amber-500" />
          <h2 className="text-base font-semibold text-gray-800">Technicians Without Portal Access</h2>
          <span className="text-xs text-gray-400">({unlinkedTechs.length})</span>
        </div>

        {unlinkedTechs.length === 0 ? (
          <div className="border rounded-lg p-6 text-center text-sm text-gray-400 bg-gray-50">
            All active technicians have portal accounts.
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-amber-50">
                  <TableHead className="text-xs">Name</TableHead>
                  <TableHead className="text-xs">Email</TableHead>
                  <TableHead className="text-xs">Department</TableHead>
                  <TableHead className="text-xs">Phone</TableHead>
                  <TableHead className="text-xs w-36">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unlinkedTechs.map((t) => (
                  <TableRow key={t.id} className="hover:bg-amber-50/50">
                    <TableCell className="font-medium text-sm">{t.full_name}</TableCell>
                    <TableCell className="text-sm text-gray-600">{t.email || <span className="text-gray-300">—</span>}</TableCell>
                    <TableCell className="text-sm text-gray-600">{t.department || "—"}</TableCell>
                    <TableCell className="text-sm text-gray-600">{t.phone || "—"}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                        onClick={() => openTechInvite(t)}
                      >
                        <Mail className="w-3 h-3 mr-1" />
                        Send Invite
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* ── Invite Modal (generic) ── */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invite New User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Full Name *</Label>
              <Input value={invite.full_name} onChange={(e) => setInvite((p) => ({ ...p, full_name: e.target.value }))} placeholder="Jane Doe" />
            </div>
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input type="email" value={invite.email} onChange={(e) => setInvite((p) => ({ ...p, email: e.target.value }))} placeholder="jane@fieldcalls.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Base Role</Label>
              <Select value={invite.role} onValueChange={(v) => setInvite((p) => ({ ...p, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="technician">Technician</SelectItem>
                  <SelectItem value="sales">Sales</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {roles.length > 0 && (
              <div className="space-y-1.5">
                <Label>Custom Role (optional)</Label>
                <Select value={invite.role_id || "none"} onValueChange={(v) => setInvite((p) => ({ ...p, role_id: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="— None —" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Link to Technician (optional)</Label>
              <Select value={invite.technician_id || "none"} onValueChange={(v) => setInvite((p) => ({ ...p, technician_id: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="— Not linked —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Not linked —</SelectItem>
                  {technicians.map((t) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={handleInvite} disabled={saving || !invite.email || !invite.full_name}>
              {saving ? "Sending…" : "Send Invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Tech Invite Modal ── */}
      <Dialog open={techInviteOpen} onOpenChange={setTechInviteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invite {selectedTech?.full_name}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500 -mt-1">
            This will create a portal account linked to the <strong>{selectedTech?.full_name}</strong> technician record.
          </p>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Full Name *</Label>
              <Input value={invite.full_name} onChange={(e) => setInvite((p) => ({ ...p, full_name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input type="email" value={invite.email} onChange={(e) => setInvite((p) => ({ ...p, email: e.target.value }))} placeholder="technician@fieldcalls.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Custom Role (optional)</Label>
              <Select value={invite.role_id || "none"} onValueChange={(v) => setInvite((p) => ({ ...p, role_id: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="— None —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="p-3 bg-blue-50 rounded-md text-xs text-blue-700 flex items-start gap-2">
              <Link2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              Account will be automatically linked to technician ID <code className="font-mono">{selectedTech?.id?.slice(0, 12)}…</code>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setTechInviteOpen(false); setSelectedTech(null); }}>Cancel</Button>
            <Button onClick={handleTechInvite} disabled={saving || !invite.email || !invite.full_name}>
              {saving ? "Sending…" : "Send Invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit User Modal ── */}
      {editUser && (
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Full Name</Label>
                <Input value={editUser.full_name || ""} onChange={(e) => setEditUser((p) => ({ ...p, full_name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Base Role</Label>
                <Select value={editUser.role || "technician"} onValueChange={(v) => setEditUser((p) => ({ ...p, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="technician">Technician</SelectItem>
                    <SelectItem value="sales">Sales</SelectItem>
                    <SelectItem value="customer">Customer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {roles.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Custom Role</Label>
                  <Select value={editUser.role_id || "none"} onValueChange={(v) => setEditUser((p) => ({ ...p, role_id: v === "none" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder="— None —" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Department</Label>
                <Input value={editUser.department || ""} onChange={(e) => setEditUser((p) => ({ ...p, department: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={editUser.phone || ""} onChange={(e) => setEditUser((p) => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Link to Technician</Label>
                <Select value={editUser.technician_id || "none"} onValueChange={(v) => setEditUser((p) => ({ ...p, technician_id: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="— Not linked —" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Not linked —</SelectItem>
                    {technicians.map((t) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button onClick={handleEdit} disabled={saving}>
                {saving ? "Saving…" : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
}
