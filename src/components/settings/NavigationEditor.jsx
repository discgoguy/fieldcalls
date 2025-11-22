import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { 
    GripVertical, Plus, Trash2, Edit2, Check, X, 
    LayoutDashboard, Users, Wrench, Package, FileText,
    ShoppingCart, BarChart3, Settings, ClipboardList, 
    DollarSign, Truck, CheckSquare, BookOpen, Crown, Sparkles
} from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const iconMap = {
    LayoutDashboard, Users, Wrench, Package, FileText,
    ShoppingCart, BarChart3, Settings, ClipboardList,
    DollarSign, Truck, CheckSquare, BookOpen, Crown, Sparkles
};

export default function NavigationEditor({ config, onChange }) {
    const [editingSection, setEditingSection] = useState(null);
    const [editingSectionName, setEditingSectionName] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState(null);

    const handleDragEnd = (result) => {
        if (!result.destination) return;

        const { source, destination, type } = result;

        if (type === 'section') {
            // Reordering sections
            const newSections = Array.from(config.sections);
            const [removed] = newSections.splice(source.index, 1);
            newSections.splice(destination.index, 0, removed);
            
            onChange({ ...config, sections: newSections });
        } else if (type === 'item') {
            // Moving items between sections or within the same section
            const sourceSection = config.sections.find(s => s.id === source.droppableId);
            const destSection = config.sections.find(s => s.id === destination.droppableId);
            
            if (!sourceSection || !destSection) return;

            if (source.droppableId === destination.droppableId) {
                // Moving within the same section
                const newItems = Array.from(sourceSection.items);
                const [removed] = newItems.splice(source.index, 1);
                newItems.splice(destination.index, 0, removed);
                
                const newSections = config.sections.map(section =>
                    section.id === sourceSection.id ? { ...section, items: newItems } : section
                );
                
                onChange({ ...config, sections: newSections });
            } else {
                // Moving to a different section
                const sourceItems = Array.from(sourceSection.items);
                const destItems = Array.from(destSection.items);
                
                const [removed] = sourceItems.splice(source.index, 1);
                destItems.splice(destination.index, 0, removed);
                
                const newSections = config.sections.map(section => {
                    if (section.id === sourceSection.id) {
                        return { ...section, items: sourceItems };
                    }
                    if (section.id === destSection.id) {
                        return { ...section, items: destItems };
                    }
                    return section;
                });
                
                onChange({ ...config, sections: newSections });
            }
        }
    };

    const handleToggleItem = (sectionId, itemId) => {
        const newSections = config.sections.map(section => {
            if (section.id === sectionId) {
                return {
                    ...section,
                    items: section.items.map(item => 
                        item.id === itemId ? { ...item, visible: !item.visible } : item
                    )
                };
            }
            return section;
        });
        
        onChange({ ...config, sections: newSections });
    };

    const handleToggleSection = (sectionId) => {
        const newSections = config.sections.map(section => 
            section.id === sectionId ? { ...section, visible: !section.visible } : section
        );
        
        onChange({ ...config, sections: newSections });
    };

    const handleAddSection = () => {
        const newSection = {
            id: `section_${Date.now()}`,
            name: 'New Section',
            type: 'custom',
            visible: true,
            items: []
        };
        
        onChange({ ...config, sections: [...config.sections, newSection] });
    };

    const handleEditSection = (sectionId, newName) => {
        const newSections = config.sections.map(section => 
            section.id === sectionId ? { ...section, name: newName } : section
        );
        
        onChange({ ...config, sections: newSections });
        setEditingSection(null);
        setEditingSectionName('');
    };

    const handleDeleteSection = (sectionId) => {
        const section = config.sections.find(s => s.id === sectionId);
        
        // If section has items, move them to the first available section
        if (section && section.items.length > 0) {
            const targetSection = config.sections.find(s => s.id !== sectionId);
            if (targetSection) {
                const newSections = config.sections.map(s => {
                    if (s.id === targetSection.id) {
                        return { ...s, items: [...s.items, ...section.items] };
                    }
                    return s;
                }).filter(s => s.id !== sectionId);
                
                onChange({ ...config, sections: newSections });
            }
        } else {
            // No items, just remove the section
            const newSections = config.sections.filter(s => s.id !== sectionId);
            onChange({ ...config, sections: newSections });
        }
        
        setDeleteConfirm(null);
    };

    const startEditSection = (section) => {
        setEditingSection(section.id);
        setEditingSectionName(section.name);
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                        Drag and drop to reorder sections and items. You can also move items between sections!
                    </p>
                    <Button onClick={handleAddSection} variant="outline" size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Section
                    </Button>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800">
                        💡 <strong>Tip:</strong> Drag navigation items between sections to reorganize your menu. 
                        Create custom sections to group related features together.
                    </p>
                </div>
            </div>

            <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="sections" type="section">
                    {(provided) => (
                        <div
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                            className="space-y-3"
                        >
                            {config.sections.map((section, sectionIndex) => (
                                <Draggable
                                    key={section.id}
                                    draggableId={section.id}
                                    index={sectionIndex}
                                >
                                    {(provided, snapshot) => (
                                        <Card
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            className={`${
                                                snapshot.isDragging ? 'shadow-lg' : ''
                                            } ${!section.visible ? 'opacity-60' : ''}`}
                                        >
                                            <CardHeader className="pb-3">
                                                <div className="flex items-center gap-3">
                                                    <div {...provided.dragHandleProps}>
                                                        <GripVertical className="h-5 w-5 text-gray-400 cursor-grab" />
                                                    </div>
                                                    
                                                    {editingSection === section.id ? (
                                                        <div className="flex items-center gap-2 flex-1">
                                                            <Input
                                                                value={editingSectionName}
                                                                onChange={(e) => setEditingSectionName(e.target.value)}
                                                                className="h-8"
                                                                autoFocus
                                                            />
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => handleEditSection(section.id, editingSectionName)}
                                                            >
                                                                <Check className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => {
                                                                    setEditingSection(null);
                                                                    setEditingSectionName('');
                                                                }}
                                                            >
                                                                <X className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <CardTitle className="text-base flex-1">
                                                                {section.name}
                                                                {section.type && (
                                                                    <span className="ml-2 text-xs font-normal text-gray-500">
                                                                        ({section.type})
                                                                    </span>
                                                                )}
                                                            </CardTitle>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => startEditSection(section)}
                                                            >
                                                                <Edit2 className="h-4 w-4" />
                                                            </Button>
                                                        </>
                                                    )}
                                                    
                                                    <div className="flex items-center gap-2">
                                                        <Label htmlFor={`section-${section.id}`} className="text-sm">
                                                            Visible
                                                        </Label>
                                                        <Switch
                                                            id={`section-${section.id}`}
                                                            checked={section.visible}
                                                            onCheckedChange={() => handleToggleSection(section.id)}
                                                        />
                                                    </div>
                                                    
                                                    {section.type === 'custom' && (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => setDeleteConfirm(section.id)}
                                                            className="text-red-600 hover:text-red-700"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </CardHeader>
                                            
                                            <CardContent className="pt-0">
                                                <Droppable droppableId={section.id} type="item">
                                                    {(provided, snapshot) => (
                                                        <div
                                                            {...provided.droppableProps}
                                                            ref={provided.innerRef}
                                                            className={`space-y-2 min-h-[60px] rounded-lg transition-colors ${
                                                                snapshot.isDraggingOver ? 'bg-blue-50 border-2 border-dashed border-blue-300' : 'bg-gray-50/50'
                                                            } ${section.items.length === 0 ? 'p-4' : 'p-2'}`}
                                                        >
                                                            {section.items.length === 0 && (
                                                                <p className="text-sm text-gray-400 text-center">
                                                                    Drag items here
                                                                </p>
                                                            )}
                                                            {section.items.map((item, itemIndex) => (
                                                                <Draggable
                                                                    key={item.id}
                                                                    draggableId={`item-${item.id}`}
                                                                    index={itemIndex}
                                                                >
                                                                    {(provided, snapshot) => (
                                                                        <div
                                                                            ref={provided.innerRef}
                                                                            {...provided.draggableProps}
                                                                            className={`
                                                                                flex items-center gap-3 p-3 border rounded-lg bg-white
                                                                                ${snapshot.isDragging ? 'shadow-lg' : ''}
                                                                                ${!item.visible ? 'opacity-50' : ''}
                                                                            `}
                                                                        >
                                                                            <div {...provided.dragHandleProps}>
                                                                                <GripVertical className="h-4 w-4 text-gray-400 cursor-grab" />
                                                                            </div>
                                                                            
                                                                            {item.icon && iconMap[item.icon] && 
                                                                                React.createElement(iconMap[item.icon], { 
                                                                                    className: "h-4 w-4 text-gray-600" 
                                                                                })
                                                                            }
                                                                            
                                                                            <span className="flex-1 text-sm font-medium">
                                                                                {item.name}
                                                                            </span>
                                                                            
                                                                            <div className="flex items-center gap-2">
                                                                                <Label htmlFor={`item-${item.id}`} className="text-sm">
                                                                                    Show
                                                                                </Label>
                                                                                <Switch
                                                                                    id={`item-${item.id}`}
                                                                                    checked={item.visible}
                                                                                    onCheckedChange={() => handleToggleItem(section.id, item.id)}
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </Draggable>
                                                            ))}
                                                            {provided.placeholder}
                                                        </div>
                                                    )}
                                                </Droppable>
                                            </CardContent>
                                        </Card>
                                    )}
                                </Draggable>
                            ))}
                            {provided.placeholder}
                        </div>
                    )}
                </Droppable>
            </DragDropContext>

            <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Section?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {config.sections.find(s => s.id === deleteConfirm)?.items.length > 0 
                                ? "This section contains navigation items. They will be moved to the first available section."
                                : "This will permanently delete this empty section."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => handleDeleteSection(deleteConfirm)}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}