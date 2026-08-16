import React, { useState, useEffect } from 'react';
import { MachineType, MaintenanceTemplate, Part, Category, Setting } from '@/api/entities';
import { applySortSettings, sortArray } from '@/components/utils/sortUtils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Plus, Copy, Trash2, Save, Loader2, CheckCircle, AlertTriangle, Settings, Layers, Ungroup, GripVertical } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const TASK_CATEGORIES = ['Inspection', 'Lubrication', 'Cleaning', 'Adjustment', 'Testing', 'Replacement', 'Other'];
const TASK_TYPES = ['checkbox', 'multiple_choice', 'text'];
const DEFAULT_OPTIONS = ['Good', 'Replaced', 'Needs Attention', 'N/A'];

const slugify = (str) => (str || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'x';

// Ensures every task has a stable, unique task_key before saving. Existing,
// still-unique keys are left untouched (so historical checklist items keep
// resolving correctly); missing keys (new tasks) or collisions (e.g. from
// "Duplicate Section" copying a task_key along with the task) get a fresh,
// unique key generated.
const normalizeTaskKeys = (sectionsInput) => {
    const usedKeys = new Set();
    return sectionsInput.map(section => ({
        ...section,
        tasks: (section.tasks || []).map((task, taskIdx) => {
            let key = task.task_key;
            if (!key || usedKeys.has(key)) {
                const base = `${slugify(section.section_name)}__${slugify(task.description)}__${taskIdx}`;
                let candidate = base;
                let suffix = 0;
                while (usedKeys.has(candidate)) {
                    suffix += 1;
                    candidate = `${base}_${suffix}`;
                }
                key = candidate;
            }
            usedKeys.add(key);
            return { ...task, task_key: key };
        })
    }));
};

// Task-grouping: given the section names a set of merged tasks came from,
// strip the longest common trailing sequence of words (reading from the
// end), so "Top Left Spindle Arm" / "Top Right Spindle Arm" -> "Top Left" /
// "Top Right" (common trailing "Spindle Arm" removed), not just the single
// differing word. Falls back to the full original name if nothing is left
// after stripping (e.g. two identical names were selected by mistake).
const computeInstanceLabels = (sectionNames) => {
    const wordArrays = sectionNames.map(n => (n || '').trim().split(/\s+/).filter(Boolean));
    const minLen = Math.min(...wordArrays.map(w => w.length));
    let commonSuffixLen = 0;
    for (let i = 1; i <= minLen; i++) {
        const wordsAtPos = wordArrays.map(w => (w[w.length - i] || '').toLowerCase());
        if (wordsAtPos.every(w => w === wordsAtPos[0])) {
            commonSuffixLen = i;
        } else {
            break;
        }
    }
    return wordArrays.map((w, idx) => {
        const remaining = w.slice(0, w.length - commonSuffixLen).join(' ').trim();
        return remaining || sectionNames[idx];
    });
};

// Flags fields that differ across a set of tasks being merged into a group,
// since only one version can become the shared, canonical definition.
const checkTaskConflicts = (tasks) => {
    if (tasks.length < 2) return [];
    const first = tasks[0];
    const conflicts = [];
    const fields = [
        ['options', t => JSON.stringify(t.options || [])],
        ['category', t => t.category],
        ['response type', t => t.task_type],
        ['auto-add parts', t => JSON.stringify(t.part_triggers || [])],
    ];
    fields.forEach(([label, getter]) => {
        const firstVal = getter(first);
        if (tasks.some(t => getter(t) !== firstVal)) {
            conflicts.push(label);
        }
    });
    return conflicts;
};

// Generic drag handle + sortable wrapper, reused for reordering sections,
// tasks within a section, and options within a task.
function SortableRow({ id, children, handleClassName }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };
    return (
        <div ref={setNodeRef} style={style} className="flex items-start gap-1">
            <button
                type="button"
                {...attributes}
                {...listeners}
                className={`shrink-0 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 touch-none ${handleClassName || 'mt-3'}`}
                title="Drag to reorder"
            >
                <GripVertical className="h-4 w-4" />
            </button>
            <div className="flex-1 min-w-0">{children}</div>
        </div>
    );
}

export default function MaintenanceTemplatesPage() {
    const [machineTypes, setMachineTypes] = useState([]);
    const [parts, setParts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [sortSettings, setSortSettings] = useState(null);
    const [templates, setTemplates] = useState([]);
    const [selectedMachineType, setSelectedMachineType] = useState('');
    const [currentTemplate, setCurrentTemplate] = useState(null);
    const [sections, setSections] = useState([]);
    const [partCategoryFilters, setPartCategoryFilters] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Task grouping (merge tasks from different sections into one shared,
    // repeated-per-instance task).
    const [groupSelectMode, setGroupSelectMode] = useState(false);
    const [selectedTaskRefs, setSelectedTaskRefs] = useState([]); // [{ sectionIndex, taskIndex }]
    const [showMergeDialog, setShowMergeDialog] = useState(false);
    const [mergeCandidates, setMergeCandidates] = useState([]); // [{ sectionIndex, taskIndex, sectionName, task }]
    const [mergeInstanceLabels, setMergeInstanceLabels] = useState([]);
    const [mergeCanonicalIndex, setMergeCanonicalIndex] = useState(0);
    const [mergeError, setMergeError] = useState('');

    const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [mtData, partData, categoryData, templateData, settings] = await Promise.all([
                MachineType.list(),
                Part.list(),
                Category.list(),
                MaintenanceTemplate.list(),
                applySortSettings()
            ]);
            setMachineTypes(mtData || []);
            setParts(partData || []);
            setCategories(categoryData || []);
            setTemplates(templateData || []);
            setSortSettings(settings);
        } catch (e) {
            setError('Failed to load data.');
        } finally {
            setLoading(false);
        }
    };

    const sortedCategories = sortArray(categories, sortSettings?.categories || 'name_asc');
    const sortedParts = sortArray(parts, sortSettings?.parts || { primary: 'part_name_asc', secondary: 'none' });

    const partCategoryFilterKey = (sectionIndex, taskIndex, ruleIndex, partIndex) =>
        `${sectionIndex}_${taskIndex}_${ruleIndex}_${partIndex}`;

    const handleMachineTypeChange = (machineType) => {
        setSelectedMachineType(machineType);
        const existingTemplate = templates.find(t => t.machine_type === machineType);
        if (existingTemplate) {
            setCurrentTemplate(existingTemplate);
            setSections(existingTemplate.sections || []);
        } else {
            setCurrentTemplate(null);
            setSections([]);
        }
        setGroupSelectMode(false);
        setSelectedTaskRefs([]);
    };

    const addSection = () => {
        setSections([...sections, {
            section_name: '',
            tasks: []
        }]);
    };

    // Build a grouped (repeating-instance) section directly, without first
    // creating one-off tasks elsewhere and merging them.
    const addGroupedSection = () => {
        setSections([...sections, {
            section_name: 'New Grouped Section',
            instances: ['Instance 1', 'Instance 2'],
            tasks: []
        }]);
    };

    const updateSectionName = (sectionIndex, name) => {
        const newSections = [...sections];
        newSections[sectionIndex].section_name = name;
        setSections(newSections);
    };

    const updateSectionForceNewPage = (sectionIndex, value) => {
        const newSections = [...sections];
        newSections[sectionIndex].force_new_page = value;
        setSections(newSections);
    };

    const duplicateSection = (sectionIndex) => {
        const sectionToCopy = sections[sectionIndex];
        const duplicated = JSON.parse(JSON.stringify(sectionToCopy));
        duplicated.section_name = `${duplicated.section_name} (Copy)`;
        setSections([...sections, duplicated]);
    };

    const deleteSection = (sectionIndex) => {
        setSections(sections.filter((_, i) => i !== sectionIndex));
    };

    const handleSectionDragEnd = (event) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = parseInt(String(active.id).replace('section-', ''));
        const newIndex = parseInt(String(over.id).replace('section-', ''));
        setSections(prev => arrayMove(prev, oldIndex, newIndex));
    };

    const addTask = (sectionIndex) => {
        const newSections = [...sections];
        newSections[sectionIndex].tasks.push({
            description: '',
            category: 'Inspection',
            task_type: 'checkbox',
            options: [],
            part_triggers: []
        });
        setSections(newSections);
    };

    const updateTask = (sectionIndex, taskIndex, field, value) => {
        const newSections = [...sections];
        newSections[sectionIndex].tasks[taskIndex][field] = value;

        // If task type changes to multiple_choice and no options, set defaults
        if (field === 'task_type' && value === 'multiple_choice' && newSections[sectionIndex].tasks[taskIndex].options.length === 0) {
            newSections[sectionIndex].tasks[taskIndex].options = [...DEFAULT_OPTIONS];
        }

        setSections(newSections);
    };

    const handleTaskDragEnd = (sectionIndex) => (event) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const prefix = `task-${sectionIndex}-`;
        const oldIndex = parseInt(String(active.id).replace(prefix, ''));
        const newIndex = parseInt(String(over.id).replace(prefix, ''));
        const newSections = [...sections];
        newSections[sectionIndex].tasks = arrayMove(newSections[sectionIndex].tasks, oldIndex, newIndex);
        setSections(newSections);
    };

    const addOption = (sectionIndex, taskIndex) => {
        const newSections = [...sections];
        newSections[sectionIndex].tasks[taskIndex].options.push('');
        setSections(newSections);
    };

    const updateOption = (sectionIndex, taskIndex, optionIndex, value) => {
        const newSections = [...sections];
        newSections[sectionIndex].tasks[taskIndex].options[optionIndex] = value;
        setSections(newSections);
    };

    const removeOption = (sectionIndex, taskIndex, optionIndex) => {
        const newSections = [...sections];
        newSections[sectionIndex].tasks[taskIndex].options.splice(optionIndex, 1);
        setSections(newSections);
    };

    const handleOptionDragEnd = (sectionIndex, taskIndex) => (event) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const prefix = `option-${sectionIndex}-${taskIndex}-`;
        const oldIndex = parseInt(String(active.id).replace(prefix, ''));
        const newIndex = parseInt(String(over.id).replace(prefix, ''));
        const newSections = [...sections];
        newSections[sectionIndex].tasks[taskIndex].options = arrayMove(newSections[sectionIndex].tasks[taskIndex].options, oldIndex, newIndex);
        setSections(newSections);
    };

    const deleteTask = (sectionIndex, taskIndex) => {
        const newSections = [...sections];
        newSections[sectionIndex].tasks.splice(taskIndex, 1);
        setSections(newSections);
    };

    // ---- Part-trigger rules ----
    const addTriggerRule = (sectionIndex, taskIndex) => {
        const newSections = [...sections];
        const task = newSections[sectionIndex].tasks[taskIndex];
        task.part_triggers = [...(task.part_triggers || []), { trigger_response: '', parts: [{ part_id: '', quantity: 1 }] }];
        setSections(newSections);
    };

    const removeTriggerRule = (sectionIndex, taskIndex, ruleIndex) => {
        const newSections = [...sections];
        const task = newSections[sectionIndex].tasks[taskIndex];
        task.part_triggers = task.part_triggers.filter((_, i) => i !== ruleIndex);
        setSections(newSections);
    };

    const updateTriggerResponse = (sectionIndex, taskIndex, ruleIndex, value) => {
        const newSections = [...sections];
        newSections[sectionIndex].tasks[taskIndex].part_triggers[ruleIndex].trigger_response = value;
        setSections(newSections);
    };

    const addPartToRule = (sectionIndex, taskIndex, ruleIndex) => {
        const newSections = [...sections];
        const rule = newSections[sectionIndex].tasks[taskIndex].part_triggers[ruleIndex];
        rule.parts = [...(rule.parts || []), { part_id: '', quantity: 1 }];
        setSections(newSections);
    };

    const removePartFromRule = (sectionIndex, taskIndex, ruleIndex, partIndex) => {
        const newSections = [...sections];
        const rule = newSections[sectionIndex].tasks[taskIndex].part_triggers[ruleIndex];
        rule.parts = rule.parts.filter((_, i) => i !== partIndex);
        setSections(newSections);
    };

    const updateRulePart = (sectionIndex, taskIndex, ruleIndex, partIndex, field, value) => {
        const newSections = [...sections];
        const rule = newSections[sectionIndex].tasks[taskIndex].part_triggers[ruleIndex];
        rule.parts[partIndex] = { ...rule.parts[partIndex], [field]: value };
        setSections(newSections);
    };

    const updatePartCategoryFilter = (sectionIndex, taskIndex, ruleIndex, partIndex, category) => {
        const key = partCategoryFilterKey(sectionIndex, taskIndex, ruleIndex, partIndex);
        setPartCategoryFilters(prev => ({ ...prev, [key]: category }));
    };

    // ---- Task grouping ----
    const toggleGroupSelectMode = () => {
        setGroupSelectMode(!groupSelectMode);
        setSelectedTaskRefs([]);
        setMergeError('');
    };

    const toggleTaskSelection = (sectionIndex, taskIndex) => {
        setSelectedTaskRefs(prev => {
            const exists = prev.some(r => r.sectionIndex === sectionIndex && r.taskIndex === taskIndex);
            if (exists) {
                return prev.filter(r => !(r.sectionIndex === sectionIndex && r.taskIndex === taskIndex));
            }
            return [...prev, { sectionIndex, taskIndex }];
        });
    };

    const isTaskSelected = (sectionIndex, taskIndex) =>
        selectedTaskRefs.some(r => r.sectionIndex === sectionIndex && r.taskIndex === taskIndex);

    const openMergeDialog = () => {
        setMergeError('');
        const candidates = selectedTaskRefs.map(({ sectionIndex, taskIndex }) => ({
            sectionIndex,
            taskIndex,
            sectionName: sections[sectionIndex].section_name || `Section ${sectionIndex + 1}`,
            task: sections[sectionIndex].tasks[taskIndex],
        }));

        const descriptions = candidates.map(c => (c.task.description || '').trim().toLowerCase());
        const allMatch = descriptions.every(d => d === descriptions[0] && d !== '');
        if (!allMatch) {
            const distinct = [...new Set(candidates.map(c => c.task.description || '(blank)'))];
            setMergeError(`Selected tasks must have the same description to be grouped. Found: ${distinct.join(', ')}`);
            return;
        }

        setMergeCandidates(candidates);
        setMergeInstanceLabels(computeInstanceLabels(candidates.map(c => c.sectionName)));
        setMergeCanonicalIndex(0);
        setShowMergeDialog(true);
    };

    const updateMergeInstanceLabel = (index, value) => {
        setMergeInstanceLabels(prev => prev.map((label, i) => (i === index ? value : label)));
    };

    const confirmMerge = () => {
        const canonicalTask = { ...mergeCandidates[mergeCanonicalIndex].task };
        delete canonicalTask.task_key; // regenerated fresh on save, scoped to the new group section

        const newGroupedSection = {
            section_name: mergeCandidates[0].task.description,
            instances: mergeInstanceLabels,
            tasks: [canonicalTask],
        };

        // Remove the merged tasks from their original sections (sections stay
        // in place even if they end up empty -- nothing auto-deletes them,
        // though empty sections are skipped when creating future checklists).
        const newSections = sections.map((sec, si) => ({
            ...sec,
            tasks: sec.tasks.filter((_, ti) => !selectedTaskRefs.some(r => r.sectionIndex === si && r.taskIndex === ti)),
        }));
        newSections.push(newGroupedSection);

        setSections(newSections);
        setShowMergeDialog(false);
        setSelectedTaskRefs([]);
        setGroupSelectMode(false);
    };

    // ---- Editing an existing group ----
    const addInstance = (sectionIndex) => {
        const newSections = [...sections];
        const instances = newSections[sectionIndex].instances || [];
        newSections[sectionIndex].instances = [...instances, `New Instance ${instances.length + 1}`];
        setSections(newSections);
    };

    const updateInstanceLabel = (sectionIndex, instanceIndex, value) => {
        const newSections = [...sections];
        newSections[sectionIndex].instances[instanceIndex] = value;
        setSections(newSections);
    };

    const removeInstance = (sectionIndex, instanceIndex) => {
        const newSections = [...sections];
        newSections[sectionIndex].instances = newSections[sectionIndex].instances.filter((_, i) => i !== instanceIndex);
        setSections(newSections);
    };

    // Converts a grouped section back into one standalone section per
    // instance (each carrying its own copy of every shared task) -- the
    // reverse of merging.
    const dissolveGroup = (sectionIndex) => {
        const section = sections[sectionIndex];
        const newSections = sections.filter((_, i) => i !== sectionIndex);
        (section.instances || []).forEach(instanceLabel => {
            const tasksCopy = JSON.parse(JSON.stringify(section.tasks || [])).map(t => {
                delete t.task_key;
                return t;
            });
            newSections.push({
                section_name: instanceLabel,
                tasks: tasksCopy,
            });
        });
        setSections(newSections);
    };

    const handleSave = async () => {
        if (!selectedMachineType) {
            setError('Please select a machine type.');
            return;
        }

        if (sections.length === 0) {
            setError('Please add at least one section.');
            return;
        }

        setSaving(true);
        setError('');
        setSuccess('');

        try {
            const normalizedSections = normalizeTaskKeys(sections);
            const templateData = {
                machine_type: selectedMachineType,
                sections: normalizedSections
            };

            if (currentTemplate) {
                await MaintenanceTemplate.update(currentTemplate.id, templateData);
                setSuccess('Template updated successfully!');
            } else {
                await MaintenanceTemplate.create(templateData);
                setSuccess('Template created successfully!');
            }

            await loadData();
            setTimeout(() => setSuccess(''), 4000);
        } catch (e) {
            setError(e.message || 'Failed to save template.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!currentTemplate) return;

        try {
            await MaintenanceTemplate.delete(currentTemplate.id);
            setSuccess('Template deleted successfully!');
            setSelectedMachineType('');
            setCurrentTemplate(null);
            setSections([]);
            await loadData();
            setTimeout(() => setSuccess(''), 4000);
        } catch (e) {
            setError('Failed to delete template.');
        }
    };

    if (loading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin" /></div>;
    }

    // Shared editor for one task's fields (description, category, type,
    // options, auto-add parts). Used both for a normal section's task list
    // and for a grouped section's single shared task.
    const renderTaskFields = (sectionIndex, taskIndex, task) => (
        <div className="space-y-3">
            <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                    <Label>Task Description</Label>
                    <Input
                        value={task.description}
                        onChange={(e) => updateTask(sectionIndex, taskIndex, 'description', e.target.value)}
                        placeholder="e.g., Check motor connections"
                    />
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteTask(sectionIndex, taskIndex)}
                >
                    <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label>Category</Label>
                    <Select
                        value={task.category}
                        onValueChange={(value) => updateTask(sectionIndex, taskIndex, 'category', value)}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {TASK_CATEGORIES.map(cat => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label>Response Type</Label>
                    <Select
                        value={task.task_type}
                        onValueChange={(value) => updateTask(sectionIndex, taskIndex, 'task_type', value)}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="checkbox">Simple Checkbox</SelectItem>
                            <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                            <SelectItem value="text">Text Input</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {task.task_type === 'multiple_choice' && (
                <div>
                    <Label>Options</Label>
                    <DndContext
                        sensors={dndSensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleOptionDragEnd(sectionIndex, taskIndex)}
                    >
                        <SortableContext
                            items={task.options.map((_, i) => `option-${sectionIndex}-${taskIndex}-${i}`)}
                            strategy={verticalListSortingStrategy}
                        >
                            <div className="space-y-2 mt-2">
                                {task.options.map((option, optionIndex) => (
                                    <SortableRow key={optionIndex} id={`option-${sectionIndex}-${taskIndex}-${optionIndex}`} handleClassName="mt-2.5">
                                        <div className="flex gap-2">
                                            <Input
                                                value={option}
                                                onChange={(e) => updateOption(sectionIndex, taskIndex, optionIndex, e.target.value)}
                                                placeholder="Option text"
                                            />
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeOption(sectionIndex, taskIndex, optionIndex)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </SortableRow>
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                    <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => addOption(sectionIndex, taskIndex)}
                    >
                        <Plus className="h-4 w-4 mr-2" />Add Option
                    </Button>
                </div>
            )}

            <div className="border-t pt-3 space-y-3">
                <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Auto-Add Parts (Optional)</Label>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addTriggerRule(sectionIndex, taskIndex)}
                    >
                        <Plus className="h-3.5 w-3.5 mr-1.5" />Add Trigger Rule
                    </Button>
                </div>
                <p className="text-xs text-gray-500">
                    Each rule adds part(s) when this task's response matches — useful when different machine styles need different parts for the same task.
                </p>

                {(task.part_triggers || []).map((rule, ruleIndex) => (
                    <div key={ruleIndex} className="border rounded-md p-3 bg-gray-50 space-y-2">
                        <div className="flex items-end gap-3">
                            <div className="flex-1">
                                <Label className="text-xs">Trigger Response</Label>
                                <Input
                                    value={rule.trigger_response}
                                    onChange={(e) => updateTriggerResponse(sectionIndex, taskIndex, ruleIndex, e.target.value)}
                                    placeholder="e.g., Replaced"
                                />
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeTriggerRule(sectionIndex, taskIndex, ruleIndex)}
                            >
                                <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                        </div>

                        {(rule.parts || []).map((rulePart, partIndex) => {
                            const filterKey = partCategoryFilterKey(sectionIndex, taskIndex, ruleIndex, partIndex);
                            const selectedPart = parts.find(p => p.id === rulePart.part_id);
                            const activeCategory = partCategoryFilters[filterKey] ?? (selectedPart?.category || '');
                            const filteredParts = activeCategory
                                ? sortedParts.filter(p => p.category === activeCategory)
                                : sortedParts;
                            return (
                                <div key={partIndex} className="grid grid-cols-12 gap-2 items-end pl-3 border-l-2 border-gray-200">
                                    <div className="col-span-3">
                                        <Label className="text-xs">Category</Label>
                                        <Select
                                            value={activeCategory || '__all__'}
                                            onValueChange={(value) => updatePartCategoryFilter(sectionIndex, taskIndex, ruleIndex, partIndex, value === '__all__' ? '' : value)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="All categories" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="__all__">All Categories</SelectItem>
                                                {sortedCategories.map(c => (
                                                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="col-span-5">
                                        <Label className="text-xs">Part</Label>
                                        <Select
                                            value={rulePart.part_id || ''}
                                            onValueChange={(value) => updateRulePart(sectionIndex, taskIndex, ruleIndex, partIndex, 'part_id', value)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select part" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {filteredParts.map(p => (
                                                    <SelectItem key={p.id} value={p.id}>{p.part_name} ({p.part_number})</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="col-span-2">
                                        <Label className="text-xs">Quantity</Label>
                                        <Input
                                            type="number"
                                            value={rulePart.quantity}
                                            onChange={(e) => updateRulePart(sectionIndex, taskIndex, ruleIndex, partIndex, 'quantity', parseInt(e.target.value) || 1)}
                                            min="1"
                                        />
                                    </div>
                                    <div className="col-span-2 flex gap-1">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removePartFromRule(sectionIndex, taskIndex, ruleIndex, partIndex)}
                                        >
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addPartToRule(sectionIndex, taskIndex, ruleIndex)}
                        >
                            <Plus className="h-3.5 w-3.5 mr-1.5" />Add Another Part to This Rule
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center">
                    <Settings className="mr-2" />
                    Maintenance Templates
                </CardTitle>
                <CardDescription>Create and manage maintenance checklist templates for different machine types. Drag the grip handle on any section, task, or option to reorder it.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
                {success && <Alert className="bg-green-50 border-green-200 text-green-800"><CheckCircle className="h-4 w-4" /><AlertDescription>{success}</AlertDescription></Alert>}

                <div className="flex gap-4 items-end">
                    <div className="flex-1">
                        <Label>Machine Type</Label>
                        <Select value={selectedMachineType} onValueChange={handleMachineTypeChange}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select machine type" />
                            </SelectTrigger>
                            <SelectContent>
                                {machineTypes.sort((a, b) => a.name.localeCompare(b.name)).map(mt => (
                                    <SelectItem key={mt.id} value={mt.name}>{mt.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button onClick={addSection} disabled={!selectedMachineType}>
                        <Plus className="mr-2 h-4 w-4" />Add Section
                    </Button>
                    <Button onClick={addGroupedSection} disabled={!selectedMachineType} variant="outline">
                        <Layers className="mr-2 h-4 w-4" />Add Grouped Section
                    </Button>
                    {selectedMachineType && sections.length > 0 && (
                        <Button
                            variant={groupSelectMode ? 'default' : 'outline'}
                            onClick={toggleGroupSelectMode}
                        >
                            <Layers className="mr-2 h-4 w-4" />
                            {groupSelectMode ? 'Cancel Grouping' : 'Group Tasks'}
                        </Button>
                    )}
                </div>

                {groupSelectMode && (
                    <Alert className="bg-blue-50 border-blue-200 text-blue-900">
                        <Layers className="h-4 w-4" />
                        <AlertDescription>
                            Select the same task from each section you want to combine (e.g. "Blade Shaft Bearings (6002)" under
                            each spindle section), then click Merge. Selected tasks must all have the identical description.
                            {selectedTaskRefs.length > 0 && (
                                <div className="mt-2 flex items-center gap-3">
                                    <span className="font-medium">{selectedTaskRefs.length} task(s) selected</span>
                                    <Button size="sm" onClick={openMergeDialog} disabled={selectedTaskRefs.length < 2}>
                                        Merge Into Group
                                    </Button>
                                </div>
                            )}
                            {mergeError && <p className="text-red-700 mt-2">{mergeError}</p>}
                        </AlertDescription>
                    </Alert>
                )}

                {selectedMachineType && sections.length > 0 && (
                    <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
                        <SortableContext items={sections.map((_, i) => `section-${i}`)} strategy={verticalListSortingStrategy}>
                            <Accordion type="multiple" className="w-full">
                                {sections.map((section, sectionIndex) => {
                                    const isGrouped = (section.instances || []).length > 0;
                                    return (
                                    <SortableRow key={sectionIndex} id={`section-${sectionIndex}`} handleClassName="mt-4">
                                    <AccordionItem value={`section-${sectionIndex}`}>
                                        <AccordionTrigger className="hover:no-underline">
                                            <div className="flex items-center justify-between w-full pr-4">
                                                <span className="font-medium flex items-center gap-2">
                                                    {isGrouped && <Layers className="h-4 w-4 text-blue-600" />}
                                                    {section.section_name || `Section ${sectionIndex + 1}`}
                                                    {isGrouped && <span className="text-xs font-normal text-gray-500">({section.instances.length} instances)</span>}
                                                    {section.force_new_page && <span className="text-xs font-normal text-gray-400">(new page)</span>}
                                                </span>
                                                <div className="flex gap-2">
                                                    {!isGrouped && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                duplicateSection(sectionIndex);
                                                            }}
                                                        >
                                                            <Copy className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                    {isGrouped && (
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    title="Dissolve group back into separate sections"
                                                                >
                                                                    <Ungroup className="h-4 w-4" />
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>Dissolve Group?</AlertDialogTitle>
                                                                    <AlertDialogDescription>
                                                                        This splits "{section.section_name}" back into {section.instances.length} separate sections, one per instance, each with its own copy of this task. This only affects the template going forward.
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                    <AlertDialogAction onClick={() => dissolveGroup(sectionIndex)}>
                                                                        Dissolve
                                                                    </AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    )}
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <Trash2 className="h-4 w-4 text-red-500" />
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Delete Section?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    This will permanently delete this section and all its tasks.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => deleteSection(sectionIndex)} className="bg-red-600 hover:bg-red-700">
                                                                    Delete
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </div>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent>
                                            <div className="space-y-4 pt-4">
                                                <div>
                                                    <Label>Section Name</Label>
                                                    <Input
                                                        value={section.section_name}
                                                        onChange={(e) => updateSectionName(sectionIndex, e.target.value)}
                                                        placeholder="e.g., Electrical System"
                                                    />
                                                </div>

                                                <label className="flex items-center gap-2 cursor-pointer text-sm">
                                                    <Checkbox
                                                        checked={!!section.force_new_page}
                                                        onCheckedChange={(checked) => updateSectionForceNewPage(sectionIndex, !!checked)}
                                                    />
                                                    Start this section on a new page when printed
                                                </label>

                                                {isGrouped && (
                                                    <div className="border rounded-lg p-4 bg-blue-50 space-y-3">
                                                        <div className="flex items-center justify-between">
                                                            <Label className="text-base font-semibold">Instances</Label>
                                                            <Button variant="outline" size="sm" onClick={() => addInstance(sectionIndex)}>
                                                                <Plus className="h-3.5 w-3.5 mr-1.5" />Add Instance
                                                            </Button>
                                                        </div>
                                                        <p className="text-xs text-gray-600">
                                                            Each instance gets its own row when technicians complete this section's tasks — e.g. one row per spindle. Every task added below applies to all instances.
                                                        </p>
                                                        <div className="space-y-2">
                                                            {(section.instances || []).map((instance, instanceIndex) => (
                                                                <div key={instanceIndex} className="flex gap-2">
                                                                    <Input
                                                                        value={instance}
                                                                        onChange={(e) => updateInstanceLabel(sectionIndex, instanceIndex, e.target.value)}
                                                                    />
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={() => removeInstance(sectionIndex, instanceIndex)}
                                                                    >
                                                                        <Trash2 className="h-4 w-4 text-red-500" />
                                                                    </Button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="space-y-3">
                                                    <Label className="text-base font-semibold">{isGrouped ? 'Shared Tasks' : 'Tasks'}</Label>
                                                    <DndContext
                                                        sensors={dndSensors}
                                                        collisionDetection={closestCenter}
                                                        onDragEnd={handleTaskDragEnd(sectionIndex)}
                                                    >
                                                        <SortableContext
                                                            items={section.tasks.map((_, i) => `task-${sectionIndex}-${i}`)}
                                                            strategy={verticalListSortingStrategy}
                                                        >
                                                            <div className="space-y-3">
                                                                {section.tasks.map((task, taskIndex) => (
                                                                    <SortableRow key={taskIndex} id={`task-${sectionIndex}-${taskIndex}`}>
                                                                        <Card className="p-4">
                                                                            <div className="flex gap-3">
                                                                                {groupSelectMode && !isGrouped && (
                                                                                    <Checkbox
                                                                                        className="mt-1.5"
                                                                                        checked={isTaskSelected(sectionIndex, taskIndex)}
                                                                                        onCheckedChange={() => toggleTaskSelection(sectionIndex, taskIndex)}
                                                                                    />
                                                                                )}
                                                                                <div className="flex-1">
                                                                                    {renderTaskFields(sectionIndex, taskIndex, task)}
                                                                                </div>
                                                                            </div>
                                                                        </Card>
                                                                    </SortableRow>
                                                                ))}
                                                            </div>
                                                        </SortableContext>
                                                    </DndContext>
                                                    <Button
                                                        variant="outline"
                                                        onClick={() => addTask(sectionIndex)}
                                                    >
                                                        <Plus className="mr-2 h-4 w-4" />Add Task
                                                    </Button>
                                                </div>
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                    </SortableRow>
                                    );
                                })}
                            </Accordion>
                        </SortableContext>
                    </DndContext>
                )}

                {selectedMachineType && sections.length > 0 && (
                    <div className="flex gap-2 justify-end pt-4 border-t">
                        {currentTemplate && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive">Delete Template</Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Template?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will permanently delete this template. This action cannot be undone.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                                            Delete
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : <><Save className="mr-2 h-4 w-4" />Save Template</>}
                        </Button>
                    </div>
                )}
            </CardContent>

            <Dialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Merge Into Group: {mergeCandidates[0]?.task?.description}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        {(() => {
                            const conflicts = checkTaskConflicts(mergeCandidates.map(c => c.task));
                            return conflicts.length > 0 && (
                                <Alert className="bg-amber-50 border-amber-200 text-amber-900">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertDescription>
                                        These tasks differ in: <strong>{conflicts.join(', ')}</strong>. Pick which one's settings to keep as the shared version below — the others' settings for these fields will be discarded.
                                    </AlertDescription>
                                </Alert>
                            );
                        })()}

                        <div>
                            <Label>Use Settings From</Label>
                            <Select value={String(mergeCanonicalIndex)} onValueChange={(v) => setMergeCanonicalIndex(parseInt(v))}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {mergeCandidates.map((c, i) => (
                                        <SelectItem key={i} value={String(i)}>{c.sectionName}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>Instance Labels</Label>
                            <p className="text-xs text-gray-500 mb-2">Auto-generated from each task's original section — edit any of these before confirming.</p>
                            <div className="space-y-2">
                                {mergeInstanceLabels.map((label, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <Input value={label} onChange={(e) => updateMergeInstanceLabel(i, e.target.value)} />
                                        <span className="text-xs text-gray-400 w-32 truncate">was: {mergeCandidates[i]?.sectionName}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowMergeDialog(false)}>Cancel</Button>
                        <Button onClick={confirmMerge}>Confirm Merge</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
