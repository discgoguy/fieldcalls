import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/api/supabaseClient";
import { Department, Task, Timecard, TimecardEntry, User } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import {
  Clock, Plus, Trash2, Edit, Save, X, ChevronDown, ChevronUp,
  Building2, ClipboardList, BarChart3, Calendar, Users, Search
} from "lucide-react";
import { format, startOfWeek, endOfWeek, parseISO, subWeeks, eachDayOfInterval, isWeekend } from "date-fns";

// ─── Helpers ────────────────────────────────────────────────────────────────

function today() {
  return format(new Date(), "yyyy-MM-dd");
}

function formatDate(d) {
  try { return format(parseISO(d), "MMM dd, yyyy"); } catch { return d; }
}

// ─── Entry Row (inside the timecard form) ───────────────────────────────────

function EntryRow({ entry, index, departments, tasksByDept, onChange, onRemove }) {
  const deptTasks = tasksByDept[entry.department_id] || [];

  return (
    <div className="border rounded-md p-3 bg-gray-50 space-y-2">
      {/* Top row: Department + Task + Hours + Remove */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
        {/* Department */}
        <div className="sm:col-span-4">
          <Label className="text-xs mb-1 block">Department</Label>
          <Select
            value={entry.department_id || ""}
            onValueChange={(val) => onChange(index, "department_id", val)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select dept..." />
            </SelectTrigger>
            <SelectContent>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Task */}
        <div className="sm:col-span-5">
          <Label className="text-xs mb-1 block">Task</Label>
          <Select
            value={entry.task_id || ""}
            onValueChange={(val) => onChange(index, "task_id", val)}
            disabled={!entry.department_id}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select task..." />
            </SelectTrigger>
            <SelectContent>
              {deptTasks.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Hours + Remove in same row on mobile */}
        <div className="sm:col-span-2">
          <Label className="text-xs mb-1 block">Hours</Label>
          <div className="flex gap-2 items-center">
            <Input
              type="number"
              min="0"
              max="24"
              step="0.5"
              value={entry.hours}
              onChange={(e) => onChange(index, "hours", e.target.value)}
              placeholder="0"
              className="flex-1"
            />
            {/* Remove button — visible on mobile inline, hidden on sm+ */}
            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden text-red-400 hover:text-red-600 flex-shrink-0"
              onClick={() => onRemove(index)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Remove — hidden on mobile (shown inline above), visible on sm+ */}
        <div className="hidden sm:flex sm:col-span-1 justify-center">
          <Button
            variant="ghost"
            size="icon"
            className="text-red-400 hover:text-red-600"
            onClick={() => onRemove(index)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Notes — full width below */}
      <div>
        <Label className="text-xs mb-1 block">Notes (optional)</Label>
        <Textarea
          value={entry.notes || ""}
          onChange={(e) => onChange(index, "notes", e.target.value)}
          placeholder="Add notes for this task..."
          className="resize-none text-sm"
          rows={2}
        />
      </div>
    </div>
  );
}

// ─── Timecard Form Dialog ────────────────────────────────────────────────────

function TimecardFormDialog({ open, onClose, onSaved, existing, departments, tasksByDept, currentUser }) {
  const isEdit = !!existing;
  const [date, setDate] = useState(existing?.date || today());
  const [notes, setNotes] = useState(existing?.notes || "");
  const [entries, setEntries] = useState(
    existing?.entries?.length
      ? existing.entries.map((e) => ({ ...e }))
      : [{ department_id: "", task_id: "", hours: "", notes: "" }]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const totalHours = entries.reduce((sum, e) => sum + (parseFloat(e.hours) || 0), 0);

  function addEntry() {
    setEntries([...entries, { department_id: "", task_id: "", hours: "", notes: "" }]);
  }

  function removeEntry(i) {
    if (entries.length === 1) return;
    setEntries(entries.filter((_, idx) => idx !== i));
  }

  function changeEntry(i, field, value) {
    const updated = [...entries];
    updated[i] = { ...updated[i], [field]: value };
    // Reset task when department changes
    if (field === "department_id") updated[i].task_id = "";
    setEntries(updated);
  }

  async function handleSave() {
    setError("");
    if (!date) { setError("Please select a date."); return; }
    const valid = entries.every((e) => e.department_id && e.task_id && parseFloat(e.hours) > 0);
    if (!valid) { setError("Each entry needs a department, task, and hours greater than 0."); return; }

    setSaving(true);
    try {
      let timecardId;

      if (isEdit) {
        // Update timecard
        await Timecard.update(existing.id, { date, total_hours: totalHours, notes });
        timecardId = existing.id;
        // Delete old entries and recreate
        const { error: delErr } = await supabase
          .from("timecard_entries")
          .delete()
          .eq("timecard_id", timecardId);
        if (delErr) throw delErr;
      } else {
        // Create new timecard
        const tc = await Timecard.create({
          user_id: currentUser.id,
          date,
          total_hours: totalHours,
          notes,
        });
        timecardId = tc.id;
      }

      // Create entries
      const entryPayloads = entries.map((e) => ({
        timecard_id: timecardId,
        department_id: e.department_id,
        task_id: e.task_id,
        hours: parseFloat(e.hours),
        notes: e.notes || "",
      }));
      await TimecardEntry.bulkCreate(entryPayloads);

      onSaved();
      onClose();
    } catch (e) {
      if (e.message?.includes("duplicate") || e.code === "23505") {
        setError("You already have a timecard for this date. Please edit the existing one.");
      } else {
        setError(e.message || "Failed to save timecard.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Timecard" : "Add Timecard Entry"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
            </div>
            <div className="flex items-center gap-2 mt-5">
              <Clock className="w-5 h-5 text-blue-600" />
              <span className="text-lg font-bold text-blue-600">{totalHours.toFixed(1)}h total</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tasks</Label>
            {entries.map((entry, i) => (
              <EntryRow
                key={i}
                index={i}
                entry={entry}
                departments={departments}
                tasksByDept={tasksByDept}
                onChange={changeEntry}
                onRemove={removeEntry}
              />
            ))}
            <Button variant="outline" size="sm" onClick={addEntry} className="w-full mt-1">
              <Plus className="w-4 h-4 mr-2" /> Add Task
            </Button>
          </div>

          <div>
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="General notes for this day..." className="mt-1" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : <><Save className="w-4 h-4 mr-2" />{isEdit ? "Update" : "Save"}</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── My Timecard Tab ─────────────────────────────────────────────────────────

function MyTimecardTab({ currentUser, departments, tasksByDept }) {
  const [timecards, setTimecards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [dateFrom, setDateFrom] = useState(format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"));

  async function load() {
    if (!currentUser) return;
    setLoading(true);
    try {
      const { data: tcs, error } = await supabase
        .from("timecards")
        .select("*")
        .eq("user_id", currentUser.id)
        .gte("date", dateFrom)
        .lte("date", dateTo)
        .order("date", { ascending: false });
      if (error) throw error;

      // Load entries for each timecard
      const ids = tcs.map((t) => t.id);
      let entries = [];
      if (ids.length) {
        const { data: ents } = await supabase
          .from("timecard_entries")
          .select("*")
          .in("timecard_id", ids);
        entries = ents || [];
      }

      const result = tcs.map((tc) => ({
        ...tc,
        entries: entries.filter((e) => e.timecard_id === tc.id),
      }));
      setTimecards(result);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [currentUser, dateFrom, dateTo]);

  async function handleDelete(id) {
    if (!confirm("Delete this timecard entry?")) return;
    await Timecard.delete(id);
    load();
  }

  function getTaskName(taskId) {
    for (const tasks of Object.values(tasksByDept)) {
      const t = tasks.find((t) => t.id === taskId);
      if (t) return t.name;
    }
    return taskId;
  }

  function getDeptName(deptId) {
    const d = departments.find((d) => d.id === deptId);
    return d ? d.name : deptId;
  }

  const totalWeekHours = timecards.reduce((sum, tc) => sum + (parseFloat(tc.total_hours) || 0), 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">My Timecard</h2>
          <p className="text-sm text-gray-500">Track your daily hours by task</p>
        </div>
        <Button onClick={() => { setEditingCard(null); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Add Entry
        </Button>
      </div>

      {/* Date filter */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex gap-3 flex-wrap">
              <div>
                <Label className="text-xs">From</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="mt-1 w-36 sm:w-40" />
              </div>
              <div>
                <Label className="text-xs">To</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="mt-1 w-36 sm:w-40" />
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => {
                setDateFrom(format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"));
                setDateTo(format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"));
              }}>This Week</Button>
              <Button variant="outline" size="sm" onClick={() => {
                const lastWeek = subWeeks(new Date(), 1);
                setDateFrom(format(startOfWeek(lastWeek, { weekStartsOn: 1 }), "yyyy-MM-dd"));
                setDateTo(format(endOfWeek(lastWeek, { weekStartsOn: 1 }), "yyyy-MM-dd"));
              }}>Last Week</Button>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <span className="font-bold text-blue-700 text-lg">{totalWeekHours.toFixed(1)}h</span>
              <span className="text-sm text-gray-500">in period</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {loading ? (
        <p className="text-center text-gray-400 py-8">Loading...</p>
      ) : timecards.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No entries for this period.</p>
          <Button variant="outline" className="mt-3" onClick={() => setShowForm(true)}>Add your first entry</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {timecards.map((tc) => (
            <Card key={tc.id} className="overflow-hidden">
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedId(expandedId === tc.id ? null : tc.id)}
              >
                <div className="flex items-center gap-4">
                  <div>
                    <p className="font-semibold text-gray-800">{formatDate(tc.date)}</p>
                    <p className="text-xs text-gray-500">{tc.entries?.length || 0} task{tc.entries?.length !== 1 ? "s" : ""}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className="bg-blue-100 text-blue-800 text-sm px-3">
                    {parseFloat(tc.total_hours).toFixed(1)}h
                  </Badge>
                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setEditingCard(tc); setShowForm(true); }}>
                    <Edit className="w-4 h-4 text-gray-400 hover:text-blue-600" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDelete(tc.id); }}>
                    <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                  </Button>
                  {expandedId === tc.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>
              </div>

              {expandedId === tc.id && (
                <div className="border-t bg-gray-50 px-4 py-3">
                  {/* Stack layout on mobile, table on sm+ */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-500 uppercase">
                          <th className="text-left pb-2">Department</th>
                          <th className="text-left pb-2">Task</th>
                          <th className="text-left pb-2">Hours</th>
                          <th className="text-left pb-2">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tc.entries.map((e) => (
                          <tr key={e.id} className="border-t">
                            <td className="py-1 pr-4">{getDeptName(e.department_id)}</td>
                            <td className="py-1 pr-4">{getTaskName(e.task_id)}</td>
                            <td className="py-1 pr-4 font-medium">{parseFloat(e.hours).toFixed(1)}h</td>
                            <td className="py-1 text-gray-500">{e.notes || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Mobile stacked cards */}
                  <div className="sm:hidden space-y-2">
                    {tc.entries.map((e) => (
                      <div key={e.id} className="flex justify-between items-start text-sm border-t pt-2">
                        <div>
                          <p className="font-medium">{getTaskName(e.task_id)}</p>
                          <p className="text-xs text-gray-500">{getDeptName(e.department_id)}</p>
                          {e.notes && <p className="text-xs text-gray-400 mt-0.5">{e.notes}</p>}
                        </div>
                        <Badge className="bg-blue-100 text-blue-800 ml-3 flex-shrink-0">{parseFloat(e.hours).toFixed(1)}h</Badge>
                      </div>
                    ))}
                  </div>
                  {tc.notes && <p className="mt-2 text-xs text-gray-500 italic">Note: {tc.notes}</p>}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {showForm && (
        <TimecardFormDialog
          open={showForm}
          onClose={() => { setShowForm(false); setEditingCard(null); }}
          onSaved={load}
          existing={editingCard}
          departments={departments}
          tasksByDept={tasksByDept}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}

// ─── Management Tab (admin only) ─────────────────────────────────────────────

function ManagementTab({ departments, tasks, loadMasterData }) {
  const [activeTab, setActiveTab] = useState("departments");

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b pb-2 overflow-x-auto">
        {[
          { key: "departments", label: "Departments", icon: Building2 },
          { key: "tasks", label: "Tasks", icon: ClipboardList },
          { key: "reports", label: "Reports", icon: BarChart3 },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors flex-shrink-0 ${
              activeTab === key ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {activeTab === "departments" && (
        <DepartmentsPanel departments={departments} onRefresh={loadMasterData} />
      )}
      {activeTab === "tasks" && (
        <TasksPanel tasks={tasks} departments={departments} onRefresh={loadMasterData} />
      )}
      {activeTab === "reports" && (
        <ReportsPanel departments={departments} tasks={tasks} />
      )}
    </div>
  );
}

// ─── Departments Panel ────────────────────────────────────────────────────────

function DepartmentsPanel({ departments, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function openNew() { setEditing(null); setName(""); setDescription(""); setError(""); setShowForm(true); }
  function openEdit(d) { setEditing(d); setName(d.name); setDescription(d.description || ""); setError(""); setShowForm(true); }

  async function handleSave() {
    if (!name.trim()) return;
    setError("");
    setSaving(true);
    try {
      if (editing) {
        await Department.update(editing.id, { name: name.trim(), description, updated_date: new Date().toISOString() });
      } else {
        await Department.create({ name: name.trim(), description, active: true });
      }
      onRefresh();
      setShowForm(false);
    } catch (e) {
      if (e.code === "23505") {
        setError(`A department named "${name.trim()}" already exists.`);
      } else {
        setError(e.message || "Failed to save.");
      }
    } finally { setSaving(false); }
  }

  async function toggleActive(d) {
    await Department.update(d.id, { active: !d.active });
    onRefresh();
  }

  async function handleDelete(id) {
    if (!confirm("Delete this department? All tasks in it will also be deleted.")) return;
    await Department.delete(id);
    onRefresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-gray-700">Departments</h3>
        <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" /> New Department</Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Department name" className="mt-1" autoFocus />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description" className="mt-1" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : editing ? "Update" : "Create"}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {departments.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-gray-400">No departments yet.</TableCell></TableRow>
            )}
            {departments.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.name}</TableCell>
                <TableCell className="text-gray-500">{d.description || "—"}</TableCell>
                <TableCell>
                  <Badge className={d.active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"}>
                    {d.active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(d)}><Edit className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => toggleActive(d)}>
                      {d.active ? <X className="w-4 h-4 text-orange-500" /> : <Save className="w-4 h-4 text-green-500" />}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(d.id)}><Trash2 className="w-4 h-4 text-red-400" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Tasks Panel ──────────────────────────────────────────────────────────────

function TasksPanel({ tasks, departments, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [deptId, setDeptId] = useState("");
  const [filterDept, setFilterDept] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function openNew() { setEditing(null); setName(""); setDescription(""); setDeptId(""); setError(""); setShowForm(true); }
  function openEdit(t) { setEditing(t); setName(t.name); setDescription(t.description || ""); setDeptId(t.department_id); setError(""); setShowForm(true); }

  async function handleSave() {
    if (!name.trim() || !deptId) return;
    setError("");
    setSaving(true);
    try {
      if (editing) {
        await Task.update(editing.id, { name: name.trim(), description, department_id: deptId, updated_date: new Date().toISOString() });
      } else {
        await Task.create({ name: name.trim(), description, department_id: deptId, active: true });
      }
      onRefresh();
      setShowForm(false);
    } catch (e) {
      if (e.code === "23505") {
        setError(`A task named "${name.trim()}" already exists in this department.`);
      } else {
        setError(e.message || "Failed to save.");
      }
    } finally { setSaving(false); }
  }

  async function toggleActive(t) {
    await Task.update(t.id, { active: !t.active });
    onRefresh();
  }

  async function handleDelete(id) {
    if (!confirm("Delete this task?")) return;
    await Task.delete(id);
    onRefresh();
  }

  function getDeptName(id) {
    return departments.find((d) => d.id === id)?.name || "—";
  }

  const filtered = tasks
    .filter((t) => filterDept === "all" || t.department_id === filterDept)
    .filter((t) => !searchText.trim() || t.name.toLowerCase().includes(searchText.toLowerCase()) || (t.description || "").toLowerCase().includes(searchText.toLowerCase()));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-700">Tasks</h3>
          <Select value={filterDept} onValueChange={setFilterDept}>
            <SelectTrigger className="w-44 h-8 text-sm">
              <SelectValue placeholder="All departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search tasks..."
              className="pl-8 h-8 text-sm w-48"
            />
            {searchText && (
              <button onClick={() => setSearchText("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
        <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" /> New Task</Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Department</Label>
                <Select value={deptId} onValueChange={setDeptId}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>
                    {departments.filter((d) => d.active).map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Task Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Task name" className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description" className="mt-1" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={saving || !name.trim() || !deptId}>{saving ? "Saving..." : editing ? "Update" : "Create"}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Task</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-gray-400">{searchText || filterDept !== "all" ? "No tasks match your search." : "No tasks yet."}</TableCell></TableRow>
            )}
            {filtered.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell>{getDeptName(t.department_id)}</TableCell>
                <TableCell className="text-gray-500">{t.description || "—"}</TableCell>
                <TableCell>
                  <Badge className={t.active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"}>
                    {t.active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(t)}><Edit className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => toggleActive(t)}>
                      {t.active ? <X className="w-4 h-4 text-orange-500" /> : <Save className="w-4 h-4 text-green-500" />}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(t.id)}><Trash2 className="w-4 h-4 text-red-400" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Multi-Select Filter ─────────────────────────────────────────────────────

function MultiSelectFilter({ label, options, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const allSelected = selected.length === 0;
  const displayLabel = allSelected
    ? `All ${label}`
    : selected.length === 1
      ? (options.find((o) => o.value === selected[0])?.label ?? "1 selected")
      : `${selected.length} selected`;

  function toggle(value) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full sm:w-48 h-10 px-3 text-sm border border-input rounded-md bg-background hover:bg-accent"
      >
        <span className="truncate text-left">{displayLabel}</span>
        <ChevronDown className="w-4 h-4 ml-2 text-muted-foreground flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-52 bg-white border border-gray-200 rounded-md shadow-lg max-h-64 overflow-y-auto">
          <div className="p-1">
            <button
              type="button"
              onClick={() => onChange([])}
              className={`w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 ${allSelected ? "font-semibold text-blue-600" : "text-gray-500"}`}
            >
              All {label}
            </button>
            <div className="border-t my-1" />
            {options.map((opt) => (
              <label key={opt.value} title={opt.label} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 rounded cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.includes(opt.value)}
                  onChange={() => toggle(opt.value)}
                  className="rounded accent-blue-600"
                />
                <span className="truncate">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Reports Panel ────────────────────────────────────────────────────────────

function ReportsPanel({ departments, tasks }) {
  const [reportType, setReportType] = useState("employee");
  const [dateFrom, setDateFrom]     = useState(format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"));
  const [dateTo, setDateTo]         = useState(format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"));
  const [data, setData]             = useState([]);
  const [users, setUsers]           = useState([]);         // all users (for name lookup)
  const [companyUsers, setCompanyUsers] = useState([]);     // non-customers only (for dropdown)
  const [loading, setLoading]       = useState(false);
  // Multi-select filters (empty array = "all")
  const [filterEmployees, setFilterEmployees] = useState([]);
  const [filterDepts, setFilterDepts]         = useState([]);
  const [filterTasks, setFilterTasks]         = useState([]);
  // Detail mode: exactly 1 employee + 1 task selected
  const [detailMode, setDetailMode]           = useState(false);
  // Summary data
  const [absentHours, setAbsentHours]         = useState(0);
  const [companyEmployeeCount, setCompanyEmployeeCount] = useState(0);
  // Track if report has been run at least once
  const [hasRun, setHasRun]                   = useState(false);

  useEffect(() => {
    User.list().then((all) => {
      setUsers(all || []);
      const company = (all || []).filter((u) => u.role !== "customer" && !u.is_customer);
      setCompanyUsers(company);
      setCompanyEmployeeCount(company.length);
    }).catch(console.error);
  }, []);

  // Auto-refresh when filters change — only after first manual run
  useEffect(() => {
    if (hasRun) runReport();
  }, [filterEmployees, filterDepts, filterTasks, dateFrom, dateTo, reportType]);

  // ── Expected hours ──────────────────────────────────────────────────────────

  function calcExpectedHours(count = 1) {
    try {
      const days = eachDayOfInterval({ start: parseISO(dateFrom), end: parseISO(dateTo) });
      const workDays = days.filter((d) => !isWeekend(d)).length;
      return workDays * 8 * count;
    } catch { return 0; }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function getUserName(id) {
    const u = users.find((u) => u.id === id);
    return u?.full_name || u?.email || id;
  }
  function getTaskName(id) { return tasks.find((t) => t.id === id)?.name || "—"; }
  function getDeptNameByTask(taskId) {
    const t = tasks.find((t) => t.id === taskId);
    if (!t) return "—";
    return departments.find((d) => d.id === t.department_id)?.name || "—";
  }

  // Tasks filtered by selected departments
  function tasksForSelectedDepts() {
    if (filterDepts.length === 0) return tasks;
    return tasks.filter((t) => filterDepts.includes(t.department_id));
  }

  // ── Run Report ──────────────────────────────────────────────────────────────

  async function runReport() {
    setLoading(true);
    setData([]);
    setAbsentHours(0);
    const isDetail = filterEmployees.length === 1 && filterTasks.length === 1;
    setDetailMode(isDetail);

    const absentDeptId = departments.find((d) => d.name.toLowerCase() === "absent")?.id;
    const noFilters    = filterDepts.length === 0 && filterTasks.length === 0;

    try {
      let tcQuery = supabase.from("timecards").select("*").gte("date", dateFrom).lte("date", dateTo);
      if (filterEmployees.length > 0) tcQuery = tcQuery.in("user_id", filterEmployees);
      const { data: tcs } = await tcQuery;

      const ids = (tcs || []).map((t) => t.id);
      let allEntries = [];
      let entries    = [];
      if (ids.length) {
        const { data: allEnts } = await supabase.from("timecard_entries").select("*").in("timecard_id", ids);
        allEntries = allEnts || [];
        entries = allEntries.filter((e) => {
          if (filterTasks.length > 0 && !filterTasks.includes(e.task_id)) return false;
          if (filterDepts.length > 0 && !filterDepts.includes(e.department_id)) return false;
          return true;
        });
      }

      // Absent hours — only when no dept/task filter active
      if (absentDeptId && noFilters) {
        const absent = allEntries
          .filter((e) => e.department_id === absentDeptId)
          .reduce((s, e) => s + (parseFloat(e.hours) || 0), 0);
        setAbsentHours(absent);
      }

      if (isDetail) {
        const tcById = Object.fromEntries((tcs || []).map((tc) => [tc.id, tc]));
        const rows = entries.map((e) => {
          const tc = tcById[e.timecard_id] || {};
          return { date: tc.date, user_id: tc.user_id, task_id: e.task_id, department_id: e.department_id, hours: parseFloat(e.hours) || 0, notes: e.notes || "" };
        }).sort((a, b) => (a.date > b.date ? 1 : -1));
        setData(rows);
      } else if (reportType === "employee") {
        const byUser = {};
        for (const tc of tcs || []) {
          const tcEntries = entries.filter((e) => e.timecard_id === tc.id);
          if (!noFilters && tcEntries.length === 0) continue;
          const hoursForTc = !noFilters
            ? tcEntries.reduce((s, e) => s + (parseFloat(e.hours) || 0), 0)
            : parseFloat(tc.total_hours) || 0;
          if (!byUser[tc.user_id]) byUser[tc.user_id] = { user_id: tc.user_id, total_hours: 0, days: 0, noEntry: false };
          byUser[tc.user_id].total_hours += hoursForTc;
          byUser[tc.user_id].days += 1;
        }
        // Fill in employees with no entries — only when no dept/task filter active
        if (noFilters) {
          const employeesToShow = filterEmployees.length > 0
            ? companyUsers.filter((u) => filterEmployees.includes(u.id))
            : companyUsers;
          for (const u of employeesToShow) {
            if (!byUser[u.id]) byUser[u.id] = { user_id: u.id, total_hours: 0, days: 0, noEntry: true };
          }
        }
        setData(Object.values(byUser).sort((a, b) => {
          if (a.noEntry && !b.noEntry) return 1;
          if (!a.noEntry && b.noEntry) return -1;
          return b.total_hours - a.total_hours;
        }));
      } else {
        const byTask = {};
        for (const e of entries) {
          if (!byTask[e.task_id]) byTask[e.task_id] = { task_id: e.task_id, total_hours: 0, count: 0 };
          byTask[e.task_id].total_hours += parseFloat(e.hours) || 0;
          byTask[e.task_id].count += 1;
        }
        setData(Object.values(byTask).sort((a, b) => b.total_hours - a.total_hours));
      }
    } finally {
      setLoading(false);
      setHasRun(true);
    }
  }

  // ── Variance helpers ────────────────────────────────────────────────────────

  // Expected/Variance only shown when no dept or task filter is active
  const showSummary   = filterDepts.length === 0 && filterTasks.length === 0;
  // Expected count: specific employees selected → use that count; otherwise full company
  const expectedEmpCount = filterEmployees.length > 0 ? filterEmployees.length : companyEmployeeCount;
  const expectedHours = calcExpectedHours(expectedEmpCount);
  const grossWorked   = data.reduce((s, r) => s + (r.total_hours ?? r.hours ?? 0), 0);
  const totalWorked   = grossWorked - absentHours;
  const variance      = totalWorked - expectedHours;

  function varianceStyle() {
    if (variance < 0)   return { badge: "bg-red-100 text-red-700",    label: "Deficit" };
    if (variance === 0) return { badge: "bg-green-100 text-green-700", label: "On Target" };
    return { badge: "bg-orange-100 text-orange-700", label: "Overtime" };
  }

  // ── Export helpers ──────────────────────────────────────────────────────────

  function getReportTitle() {
    const type = detailMode ? "Detail" : reportType === "employee" ? "By Employee" : "By Task";
    return `Timecard Report – ${type} (${dateFrom} to ${dateTo})`;
  }

  function getTableData() {
    // Summary rows appended only when showSummary is true
    const summaryBlock = showSummary ? [
      ["", "", "", ""],
      ...(absentHours > 0 ? [["Absent Hours", "", "", `-${absentHours.toFixed(1)}h`]] : []),
      ["Expected Hours", "", "", `${expectedHours}h`],
      ["Total Worked",   "", "", `${totalWorked.toFixed(1)}h`],
      ["Variance",       "", "", `${variance >= 0 ? "+" : ""}${variance.toFixed(1)}h`],
    ] : [];

    if (detailMode) {
      const detailSummary = showSummary ? [
        ["", "", "", "", "", ""],
        ...(absentHours > 0 ? [["Absent Hours", "", "", "", `-${absentHours.toFixed(1)}h`, ""]] : []),
        ["Expected Hours", "", "", "", `${expectedHours}h`, ""],
        ["Total Worked",   "", "", "", `${totalWorked.toFixed(1)}h`, ""],
        ["Variance",       "", "", "", `${variance >= 0 ? "+" : ""}${variance.toFixed(1)}h`, ""],
      ] : [];
      return {
        headers: ["Date", "Employee", "Task", "Department", "Hours", "Notes"],
        rows: [
          ...data.map((r) => [formatDate(r.date), getUserName(r.user_id), getTaskName(r.task_id), getDeptNameByTask(r.task_id), `${r.hours.toFixed(1)}h`, r.notes || ""]),
          ...detailSummary,
        ],
      };
    }
    if (reportType === "employee") {
      return {
        headers: ["Employee", "Days Logged", "Avg / Day", "Total Hours"],
        rows: [
          ...data.map((r) => r.noEntry
            ? [getUserName(r.user_id), "—", "—", "No Entry"]
            : [getUserName(r.user_id), r.days, `${(r.total_hours / r.days).toFixed(1)}h`, `${r.total_hours.toFixed(1)}h`]
          ),
          ...summaryBlock,
        ],
      };
    }
    return {
      headers: ["Task", "Department", "Entries", "Total Hours"],
      rows: [
        ...data.map((r) => [getTaskName(r.task_id), getDeptNameByTask(r.task_id), r.count, `${r.total_hours.toFixed(1)}h`]),
        ...summaryBlock,
      ],
    };
  }

  async function exportExcel() {
    const { utils, writeFile } = await import("xlsx");
    const { headers, rows } = getTableData();
    const wb = utils.book_new();
    const ws = utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = headers.map(() => ({ wch: 22 }));
    utils.book_append_sheet(wb, ws, "Report");
    writeFile(wb, `timecard_report_${dateFrom}_${dateTo}.xlsx`);
  }

  async function exportPDF() {
    const { default: jsPDF }    = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc   = new jsPDF({ orientation: "landscape" });
    const title = getReportTitle();
    const { headers, rows } = getTableData();
    doc.setFontSize(14); doc.setTextColor(30, 64, 175);
    doc.text(title, 14, 18);
    doc.setFontSize(9); doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${format(new Date(), "MMM dd, yyyy HH:mm")}`, 14, 25);
    const expectedPerPerson = calcExpectedHours(1);
    autoTable(doc, {
      startY: 30, head: [headers], body: rows,
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [239, 246, 255] },
      margin: { left: 14, right: 14 },
      didParseCell: (hookData) => {
        if (reportType !== "employee" || detailMode || hookData.section !== "body") return;
        const row = data[hookData.row.index];
        if (!row) return;
        if (row.noEntry) {
          // Entire row red
          hookData.cell.styles.fillColor = [254, 226, 226];
          hookData.cell.styles.textColor = [185, 28, 28];
        } else if (showSummary && hookData.column.index === 3) {
          // Only Total Hours cell colored — only when no dept/task filter active
          const diff = row.total_hours - expectedPerPerson;
          if (diff < -2) {
            hookData.cell.styles.fillColor = [254, 226, 226];
            hookData.cell.styles.textColor = [185, 28, 28];
            hookData.cell.styles.fontStyle = "bold";
          } else if (diff > 2) {
            hookData.cell.styles.fillColor = [255, 237, 213];
            hookData.cell.styles.textColor = [194, 65, 12];
            hookData.cell.styles.fontStyle = "bold";
          }
        }
      },
    });
    doc.save(`timecard_report_${dateFrom}_${dateTo}.pdf`);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const vs = varianceStyle();

  return (
    <div className="space-y-4">

      {/* ── Filtros ── */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap items-end gap-3">

            {/* Report Type */}
            <div className="w-full lg:w-auto">
              <Label className="text-xs">Report Type</Label>
              <Select value={reportType} onValueChange={(val) => { setReportType(val); setData([]); setFilterEmployees([]); setFilterDepts([]); setFilterTasks([]); }}>
                <SelectTrigger className="mt-1 w-full lg:w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee"><Users className="w-4 h-4 inline mr-2" />By Employee</SelectItem>
                  <SelectItem value="task"><ClipboardList className="w-4 h-4 inline mr-2" />By Task</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date range */}
            <div className="w-full lg:w-auto">
              <Label className="text-xs">From</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="mt-1 w-full lg:w-40" />
            </div>
            <div className="w-full lg:w-auto">
              <Label className="text-xs">To</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="mt-1 w-full lg:w-40" />
            </div>

            {/* Employee filter */}
            <div className="w-full lg:w-auto">
              <Label className="text-xs">Employee</Label>
              <div className="mt-1">
                <MultiSelectFilter
                  label="Employees"
                  options={companyUsers.map((u) => ({ value: u.id, label: u.full_name || u.email }))}
                  selected={filterEmployees}
                  onChange={setFilterEmployees}
                />
              </div>
            </div>

            {/* Department filter */}
            <div className="w-full lg:w-auto">
              <Label className="text-xs">Department</Label>
              <div className="mt-1">
                <MultiSelectFilter
                  label="Departments"
                  options={departments.map((d) => ({ value: d.id, label: d.name }))}
                  selected={filterDepts}
                  onChange={(val) => { setFilterDepts(val); setFilterTasks([]); }}
                />
              </div>
            </div>

            {/* Task filter */}
            <div className="w-full lg:w-auto">
              <Label className="text-xs">Task</Label>
              <div className="mt-1">
                <MultiSelectFilter
                  label="Tasks"
                  options={tasksForSelectedDepts().map((t) => {
                    const deptName = departments.find((d) => d.id === t.department_id)?.name || "";
                    return { value: t.id, label: deptName ? `${t.name} / ${deptName}` : t.name };
                  })}
                  selected={filterTasks}
                  onChange={setFilterTasks}
                />
              </div>
            </div>
          </div>

          {/* Action row */}
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <Button onClick={runReport} disabled={loading} className="w-full sm:w-auto">
              {loading ? "Loading..." : <><BarChart3 className="w-4 h-4 mr-2" />Run Report</>}
            </Button>

            {/* Expected hours pill — solo cuando todos los filtros están en "all" */}
            {data.length > 0 && showSummary && (
              <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-md text-sm text-gray-600">
                <Clock className="w-4 h-4" />
                <span>Expected: <strong>{expectedHours}h</strong></span>
                <span className="text-gray-400 hidden sm:inline">({expectedEmpCount} employee{expectedEmpCount !== 1 ? "s" : ""} × {calcExpectedHours(1)}h)</span>
              </div>
            )}

            {/* Export buttons */}
            {data.length > 0 && (
              <div className="flex gap-2 sm:ml-auto flex-wrap">
                <Button variant="outline" size="sm" onClick={exportExcel} className="text-green-700 border-green-300 hover:bg-green-50">
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>
                  </svg>
                  Export Excel
                </Button>
                <Button variant="outline" size="sm" onClick={exportPDF} className="text-red-700 border-red-300 hover:bg-red-50">
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>
                  </svg>
                  Export PDF
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Tabla ── */}
      {data.length > 0 && (
        <>
          {detailMode && (
            <p className="text-xs text-blue-600 font-medium px-1">
              Showing day-by-day detail for {filterEmployees.length === 1 ? getUserName(filterEmployees[0]) : "selected employee"} — {filterTasks.length === 1 ? getTaskName(filterTasks[0]) : "selected task"}
            </p>
          )}
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {detailMode ? (
                  <>
                    <TableHead>Date</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Task</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Notes</TableHead>
                  </>
                ) : reportType === "employee" ? (
                  <>
                    <TableHead>Employee</TableHead>
                    <TableHead>Days Logged</TableHead>
                    <TableHead>Avg / Day</TableHead>
                    <TableHead>Total Hours</TableHead>
                  </>
                ) : (
                  <>
                    <TableHead>Task</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Entries</TableHead>
                    <TableHead>Total Hours</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, i) => (
                <TableRow key={i} className={row.noEntry ? "bg-red-50" : ""}>
                  {detailMode ? (
                    <>
                      <TableCell className="font-medium">{formatDate(row.date)}</TableCell>
                      <TableCell>{getUserName(row.user_id)}</TableCell>
                      <TableCell>{getTaskName(row.task_id)}</TableCell>
                      <TableCell>{getDeptNameByTask(row.task_id)}</TableCell>
                      <TableCell><Badge className="bg-blue-100 text-blue-800">{row.hours.toFixed(1)}h</Badge></TableCell>
                      <TableCell className="text-gray-500">{row.notes || "—"}</TableCell>
                    </>
                  ) : reportType === "employee" ? (
                    <>
                      <TableCell className={`font-medium ${row.noEntry ? "text-red-600" : ""}`}>{getUserName(row.user_id)}</TableCell>
                      <TableCell className={row.noEntry ? "text-red-400" : ""}>{row.noEntry ? "—" : row.days}</TableCell>
                      <TableCell className={row.noEntry ? "text-red-400" : ""}>{row.noEntry ? "—" : `${(row.total_hours / row.days).toFixed(1)}h`}</TableCell>
                      <TableCell>
                        {row.noEntry ? (
                          <Badge className="bg-red-100 text-red-700">No Entry</Badge>
                        ) : (() => {
                          const diff = row.total_hours - calcExpectedHours(1);
                          const cls = showSummary && diff < -2
                            ? "bg-red-100 text-red-700"
                            : showSummary && diff > 2
                              ? "bg-orange-100 text-orange-700"
                              : "bg-blue-100 text-blue-800";
                          return <Badge className={cls}>{row.total_hours.toFixed(1)}h</Badge>;
                        })()}
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell className="font-medium">{getTaskName(row.task_id)}</TableCell>
                      <TableCell>{getDeptNameByTask(row.task_id)}</TableCell>
                      <TableCell>{row.count}</TableCell>
                      <TableCell><Badge className="bg-blue-100 text-blue-800">{row.total_hours.toFixed(1)}h</Badge></TableCell>
                    </>
                  )}
                </TableRow>
              ))}

              {/* ── Summary footer ── */}
              <TableRow className="border-t-2 border-gray-300 bg-gray-50">
                <TableCell colSpan={detailMode ? 4 : 2} className="font-semibold text-gray-500 text-xs uppercase tracking-wide">
                  Summary
                </TableCell>
                <TableCell className="text-right text-xs text-gray-500 font-medium">Total Worked</TableCell>
                <TableCell><Badge className="bg-blue-100 text-blue-800">{grossWorked.toFixed(1)}h</Badge></TableCell>
              </TableRow>
              {showSummary && (
                <>
                  {absentHours > 0 && (
                    <TableRow className="bg-gray-50">
                      <TableCell colSpan={detailMode ? 4 : 2} />
                      <TableCell className="text-right text-xs text-gray-500 font-medium">Absent</TableCell>
                      <TableCell><Badge className="bg-yellow-100 text-yellow-700">-{absentHours.toFixed(1)}h</Badge></TableCell>
                    </TableRow>
                  )}
                  <TableRow className="bg-gray-50">
                    <TableCell colSpan={detailMode ? 4 : 2} />
                    <TableCell className="text-right text-xs text-gray-500 font-medium">Expected</TableCell>
                    <TableCell><Badge className="bg-gray-100 text-gray-700">{expectedHours}h</Badge></TableCell>
                  </TableRow>
                  <TableRow className="bg-gray-50">
                    <TableCell colSpan={detailMode ? 4 : 2} />
                    <TableCell className="text-right text-xs font-semibold">Variance</TableCell>
                    <TableCell>
                      <Badge className={vs.badge}>
                        {variance >= 0 ? "+" : ""}{variance.toFixed(1)}h — {vs.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
          </div>
        </>
      )}

      {data.length === 0 && !loading && (
        <p className="text-center text-gray-400 py-8">Run the report to see results.</p>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TimeCardPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [tasksByDept, setTasksByDept] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
        setCurrentUser({ ...user, ...profile, full_name: profile?.full_name || user.email, role: profile?.role || "admin" });
      } catch (e) { console.error(e); }
      await loadMasterData();
      setLoading(false);
    }
    init();
  }, []);

  async function loadMasterData() {
    const [depts, allTasks] = await Promise.all([
      Department.list(),
      Task.list(),
    ]);
    setDepartments(depts || []);
    setTasks(allTasks || []);

    // Group active tasks by department
    const grouped = {};
    for (const t of allTasks || []) {
      if (!t.active) continue;
      if (!grouped[t.department_id]) grouped[t.department_id] = [];
      grouped[t.department_id].push(t);
    }
    setTasksByDept(grouped);
  }

  const isAdmin = currentUser?.role === "admin";

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Clock className="w-8 h-8 animate-spin text-blue-500" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Clock className="w-8 h-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Time Card</h1>
          <p className="text-sm text-gray-500">Track your work hours by task and department</p>
        </div>
      </div>

      <Tabs defaultValue="my-timecard">
        <TabsList>
          <TabsTrigger value="my-timecard"><Clock className="w-4 h-4 mr-2" />My Timecard</TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="management"><Building2 className="w-4 h-4 mr-2" />Management</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="my-timecard" className="mt-4">
          <MyTimecardTab
            currentUser={currentUser}
            departments={departments}
            tasksByDept={tasksByDept}
          />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="management" className="mt-4">
            <ManagementTab
              departments={departments}
              tasks={tasks}
              loadMasterData={loadMasterData}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
