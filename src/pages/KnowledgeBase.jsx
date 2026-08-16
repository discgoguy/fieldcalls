import React, { useState, useEffect } from "react";
import { supabase } from '@/api/supabaseClient';
import { MachineType, KnowledgeCategory, KnowledgeItem, User } from '@/api/entities';
import { UploadFile } from '@/api/integrations';
import { Link } from 'react-router-dom';
import { 
    Folder, FileText, Video, ChevronRight, Home, Plus, 
    Search, Filter, PlayCircle, File, ArrowLeft, 
    Book, Wrench, Scroll, Shield, HelpCircle, MoreVertical, Trash2, Edit, FileEdit, Grid, List, FolderInput, Pencil, CheckSquare, Square, MoveRight, Tag
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import PdfThumbnail from "@/components/PdfThumbnail";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function KnowledgeBase() {
    const [currentCategory, setCurrentCategory] = useState(null); // null = root
    const [categories, setCategories] = useState([]);
    const [items, setItems] = useState([]);
    const [machineTypes, setMachineTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [filterMachine, setFilterMachine] = useState("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [breadcrumbs, setBreadcrumbs] = useState([]);
    const [viewMode, setViewMode] = useState("grid");

    // Modals
    const [isAddCatOpen, setIsAddCatOpen] = useState(false);
    const [isAddItemOpen, setIsAddItemOpen] = useState(false);
    const [isEditItemOpen, setIsEditItemOpen] = useState(false);
    const [viewingItem, setViewingItem] = useState(null);
    const [editingItem, setEditingItem] = useState(null);

    // Multiselect bulk actions
    const [selectedItems, setSelectedItems] = useState(new Set());
    const [isBulkMoveOpen, setIsBulkMoveOpen] = useState(false);
    const [bulkTargetCategory, setBulkTargetCategory] = useState('root');
    const [bulkTargetMachineType, setBulkTargetMachineType] = useState('');
    const [bulkAction, setBulkAction] = useState('category'); // 'category' or 'machine_type'
    const [isBulkSaving, setIsBulkSaving] = useState(false);

    // Forms
    const [newCatName, setNewCatName] = useState("");
    const [newItem, setNewItem] = useState({ title: "", description: "", type: "document", url: "", machine_type_id: "all" });
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        initialize();
    }, []);

    const initialize = async () => {
        try {
            const currentUser = await (async () => { const { data: { user } } = await supabase.auth.getUser(); const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(); return { ...user, ...profile, full_name: profile?.full_name || user.email, role: profile?.role || "admin" }; })();
            setUser(currentUser);
            
            const [cats, its, mTypes] = await Promise.all([
                KnowledgeCategory.list(),
                KnowledgeItem.list(),
                MachineType.list()
            ]);

            setCategories(cats);
            setItems(its);
            setMachineTypes(mTypes.sort((a, b) => a.name.localeCompare(b.name)));

            // Seed Data if empty and user is admin (or just check if empty globally)
            if ((!cats || cats.length === 0) && !currentUser.is_customer) {
                await seedData();
            }
        } catch (e) {
            console.error("Error loading KB:", e);
        } finally {
            setLoading(false);
        }
    };

    const seedData = async () => {
        // Root Categories
        const roots = [
            { name: "Training Videos", icon: "Video" },
            { name: "User Manuals", icon: "Book" },
            { name: "Wiring Diagrams", icon: "Scroll" },
            { name: "Troubleshooting", icon: "Wrench" },
            { name: "Documentation", icon: "FileText" }
        ];

        const createdRoots = {};

        for (const r of roots) {
            const cat = await KnowledgeCategory.create({ name: r.name, icon: r.icon, parent_id: null });
            createdRoots[r.name] = cat;
        }

        // Subcategories
        const subs = [
            { name: "Machine Manuals", parent: "User Manuals" },
            { name: "Component Manuals", parent: "User Manuals" },
            { name: "Videos", parent: "Troubleshooting" },
            { name: "Guides", parent: "Troubleshooting" },
            { name: "Settings", parent: "Troubleshooting" },
            { name: "Letters of Guarantee", parent: "Documentation" },
            { name: "Safety Data Sheets", parent: "Documentation" },
            { name: "Certifications", parent: "Documentation" }
        ];

        for (const s of subs) {
            if (createdRoots[s.parent]) {
                await KnowledgeCategory.create({ name: s.name, parent_id: createdRoots[s.parent].id });
            }
        }
        
        // Refresh
        const newCats = await KnowledgeCategory.list();
        setCategories(newCats);
    };

    const handleCategoryClick = (cat) => {
        setCurrentCategory(cat);
        setBreadcrumbs([...breadcrumbs, cat]);
        setFilterMachine("all"); 
    };

    const handleBreadcrumbClick = (index) => {
        if (index === -1) {
            setCurrentCategory(null);
            setBreadcrumbs([]);
        } else {
            const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
            setBreadcrumbs(newBreadcrumbs);
            setCurrentCategory(newBreadcrumbs[newBreadcrumbs.length - 1]);
        }
    };

    const handleAddCategory = async () => {
        if (!newCatName) return;
        await KnowledgeCategory.create({
            name: newCatName,
            parent_id: currentCategory ? currentCategory.id : null
        });
        setIsAddCatOpen(false);
        setNewCatName("");
        const cats = await KnowledgeCategory.list();
        setCategories(cats);
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploading(true);
        try {
            const res = await UploadFile({ file });
            if (res && res.file_url) {
                setNewItem({ ...newItem, url: res.file_url });
            }
        } catch (err) {
            console.error("Upload failed", err);
            alert("File upload failed");
        } finally {
            setUploading(false);
        }
    };

    const handleAddItem = async () => {
        if (!newItem.title) return;
        if (newItem.type !== 'article' && !newItem.url) return;
        
        await KnowledgeItem.create({
            title: newItem.title,
            description: newItem.description,
            item_type: newItem.type,
            url: newItem.type === 'article' ? null : newItem.url,
            content: newItem.type === 'article' ? newItem.content : null,
            category_id: currentCategory ? currentCategory.id : null,
            machine_type_ids: newItem.machine_type_id === "all" ? [] : [newItem.machine_type_id]
        });
        setIsAddItemOpen(false);
        setNewItem({ title: "", description: "", type: "document", url: "", content: "", machine_type_id: "all" });
        const its = await KnowledgeItem.list();
        setItems(its);
    };
    
    const handleDeleteItem = async (id) => {
        if(!confirm("Are you sure you want to delete this item?")) return;
        await KnowledgeItem.delete(id);
        const its = await KnowledgeItem.list();
        setItems(its);
    }
    
    const handleEditItem = (item) => {
        setEditingItem({
            ...item,
            machine_type_id: (item.machine_type_ids && item.machine_type_ids.length > 0) ? item.machine_type_ids[0] : "all",
            category_id: item.category_id || null
        });
        setIsEditItemOpen(true);
    }
    
    const handleUpdateItem = async () => {
        if (!editingItem.title) return;
        const itemType = editingItem.type || editingItem.item_type;
        if (itemType !== 'article' && !editingItem.url) return;
        
        await KnowledgeItem.update(editingItem.id, {
            title: editingItem.title,
            description: editingItem.description,
            item_type: itemType,
            url: itemType === 'article' ? null : editingItem.url,
            content: itemType === 'article' ? editingItem.content : null,
            category_id: editingItem.category_id,
            machine_type_ids: editingItem.machine_type_id === "all" ? [] : [editingItem.machine_type_id]
        });
        setIsEditItemOpen(false);
        setEditingItem(null);
        const its = await KnowledgeItem.list();
        setItems(its);
    }
    
    const toggleItemSelection = (itemId, e) => {
        e.stopPropagation();
        setSelectedItems(prev => {
            const next = new Set(prev);
            if (next.has(itemId)) next.delete(itemId);
            else next.add(itemId);
            return next;
        });
    };

    const selectAll = () => setSelectedItems(new Set(visibleItems.map(i => i.id)));
    const clearSelection = () => setSelectedItems(new Set());

    const handleBulkSave = async () => {
        setIsBulkSaving(true);
        try {
            const updates = [...selectedItems].map(id => {
                const payload = {};
                if (bulkAction === 'category') {
                    payload.category_id = bulkTargetCategory === 'root' ? null : bulkTargetCategory;
                } else {
                    payload.machine_type_ids = bulkTargetMachineType === 'all' ? [] : [bulkTargetMachineType];
                }
                return KnowledgeItem.update(id, payload);
            });
            await Promise.all(updates);
            const its = await KnowledgeItem.list();
            setItems(its);
            setSelectedItems(new Set());
            setIsBulkMoveOpen(false);
        } catch (e) {
            alert('Failed to update items: ' + (e.message || 'Unknown error'));
        } finally {
            setIsBulkSaving(false);
        }
    };

    const handleDeleteCategory = async (id) => {
        if(!confirm("Are you sure? This will delete the category and all subcategories/items.")) return;
        // Recursive delete logic would be better on backend, but simple one here
        await KnowledgeCategory.delete(id);
        const cats = await KnowledgeCategory.list();
        setCategories(cats);
    }

    // Filter Logic
    const visibleCategories = categories.filter(c => c.parent_id === (currentCategory ? currentCategory.id : null));
    
    const visibleItems = items.filter(i => {
        const inCategory = i.category_id === (currentCategory ? currentCategory.id : null);
        const matchesSearch = i.title.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesMachine = filterMachine === "all" || (i.machine_type_ids && i.machine_type_ids.includes(filterMachine));
        return inCategory && matchesSearch && matchesMachine;
    });

    const getIcon = (iconName) => {
        const icons = { Video, Book, Scroll, Wrench, FileText };
        return icons[iconName] || Folder;
    };

    const getYouTubeId = (url) => {
        if (!url) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    const renderMediaViewer = () => {
        if (!viewingItem) return null;

        let content;
        if (viewingItem.item_type === 'article') {
            content = (
                <div className="w-full max-h-[70vh] overflow-y-auto">
                    <div className="prose prose-slate max-w-none p-6 bg-white rounded-lg">
                        {viewingItem.content ? (
                            <div className="whitespace-pre-wrap">{viewingItem.content}</div>
                        ) : (
                            <p className="text-gray-400 italic">No content available</p>
                        )}
                    </div>
                </div>
            );
        } else if (viewingItem.item_type === 'video') {
            let embedUrl = viewingItem.url;
            const ytId = getYouTubeId(embedUrl);
            if (ytId) {
                embedUrl = `https://www.youtube.com/embed/${ytId}`;
            }
            content = (
                <div className="aspect-video w-full bg-black rounded-lg overflow-hidden">
                    {ytId || embedUrl.includes("embed") ? (
                        <iframe 
                            src={embedUrl} 
                            className="w-full h-full" 
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                            allowFullScreen
                        />
                    ) : (
                        <video controls src={embedUrl} className="w-full h-full" />
                    )}
                </div>
            );
        } else if (viewingItem.item_type === 'document') {
            const docUrl = viewingItem.url || viewingItem.file_url;
            // Use Google Docs Viewer for PDFs to prevent forced downloads
            const isPdf = docUrl?.toLowerCase().includes('.pdf');
            
            content = (
                <div className="w-full h-[80vh] bg-gray-100 rounded-lg overflow-hidden">
                     <iframe 
                        src={isPdf ? `https://docs.google.com/gview?url=${encodeURIComponent(docUrl)}&embedded=true` : docUrl}
                        className="w-full h-full border-0"
                        title="Document Viewer"
                    />
                </div>
            );
        } else {
            // External link
            window.open(viewingItem.url, '_blank');
            setViewingItem(null);
            return null;
        }

        return (
            <Dialog open={!!viewingItem} onOpenChange={() => setViewingItem(null)}>
                <DialogContent className={`max-w-5xl ${viewingItem.item_type === 'document' ? 'h-[90vh]' : ''}`}>
                    <DialogHeader>
                        <DialogTitle>{viewingItem.title}</DialogTitle>
                    </DialogHeader>
                    {content}
                    <p className="text-sm text-gray-500 mt-2">{viewingItem.description}</p>
                </DialogContent>
            </Dialog>
        );
    };

    if (loading) return <div className="flex justify-center items-center h-screen"><Loader2 className="w-8 h-8 animate-spin" /></div>;

    const isAdmin = user && !user.is_customer;

    return (
        <div className="space-y-6 p-6 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Knowledge Base</h1>
                    <p className="text-gray-500">Documentation, manuals, and training resources.</p>
                </div>
                <div className="flex gap-2 items-center w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                        <Input 
                            placeholder="Search items..." 
                            className="pl-8" 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                        />
                    </div>
                    <div className="flex gap-1 border rounded-md p-1">
                        <Button 
                            variant={viewMode === "grid" ? "secondary" : "ghost"} 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => setViewMode("grid")}
                        >
                            <Grid className="h-4 w-4" />
                        </Button>
                        <Button 
                            variant={viewMode === "list" ? "secondary" : "ghost"} 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => setViewMode("list")}
                        >
                            <List className="h-4 w-4" />
                        </Button>
                    </div>
                    {isAdmin && (
                         <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline">Manage <Plus className="ml-2 h-4 w-4"/></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuItem onClick={() => setIsAddCatOpen(true)}>
                                    <Folder className="mr-2 h-4 w-4" /> Add Category
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setIsAddItemOpen(true)} disabled={!currentCategory}>
                                    <File className="mr-2 h-4 w-4" /> Add Item Here
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            </div>

            {/* Breadcrumbs & Filters */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-white p-3 rounded-lg shadow-sm border gap-4">
                <div className="flex items-center overflow-x-auto w-full md:w-auto">
                    <Button variant="ghost" size="sm" className="p-1 mr-2" onClick={() => handleBreadcrumbClick(-1)}>
                        <Home className="h-4 w-4" />
                    </Button>
                    {breadcrumbs.map((crumb, index) => (
                        <div key={crumb.id} className="flex items-center text-sm whitespace-nowrap">
                            <ChevronRight className="h-4 w-4 text-gray-400 mx-1" />
                            <button 
                                onClick={() => handleBreadcrumbClick(index)}
                                className={`hover:underline ${index === breadcrumbs.length - 1 ? 'font-semibold text-gray-900' : 'text-gray-600'}`}
                            >
                                {crumb.name}
                            </button>
                        </div>
                    ))}
                </div>
                
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <Filter className="h-4 w-4 text-gray-500" />
                    <Select value={filterMachine} onValueChange={setFilterMachine}>
                        <SelectTrigger className="w-full md:w-[200px] h-9">
                            <SelectValue placeholder="Filter by Machine" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Machines</SelectItem>
                            {machineTypes.sort((a, b) => a.name.localeCompare(b.name)).map(m => (
                                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Categories Grid */}
            {visibleCategories.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {visibleCategories.map(cat => {
                        const Icon = getIcon(cat.icon);
                        return (
                            <Card key={cat.id} className="hover:shadow-md transition-shadow cursor-pointer group" onClick={() => handleCategoryClick(cat)}>
                                <CardContent className="p-6 flex items-center gap-4">
                                    <div className="p-3 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-100 transition-colors">
                                        <Icon className="h-6 w-6" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-gray-900">{cat.name}</h3>
                                        <p className="text-xs text-gray-500">{cat.description || "View contents"}</p>
                                    </div>
                                    {isAdmin && (
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-500" onClick={(e) => {e.stopPropagation(); handleDeleteCategory(cat.id)}}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Bulk Action Toolbar */}
            {selectedItems.size > 0 && (
                <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <span className="text-sm font-medium text-blue-800">{selectedItems.size} item{selectedItems.size > 1 ? 's' : ''} selected</span>
                    <Button size="sm" variant="outline" onClick={() => setIsBulkMoveOpen(true)} className="border-blue-300 text-blue-700 hover:bg-blue-100">
                        <MoveRight className="h-4 w-4 mr-1" /> Move / Reclassify
                    </Button>
                    <Button size="sm" variant="ghost" onClick={clearSelection} className="text-blue-600 hover:bg-blue-100 ml-auto">
                        Clear selection
                    </Button>
                </div>
            )}

            {/* Select All when items exist */}
            {visibleItems.length > 0 && isAdmin && (
                <div className="flex items-center gap-2">
                    <button onClick={selectedItems.size === visibleItems.length ? clearSelection : selectAll}
                        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700">
                        {selectedItems.size === visibleItems.length && visibleItems.length > 0
                            ? <CheckSquare className="h-4 w-4 text-blue-500" />
                            : <Square className="h-4 w-4" />}
                        {selectedItems.size === visibleItems.length && visibleItems.length > 0 ? 'Deselect all' : 'Select all'}
                    </button>
                </div>
            )}

            {/* Items List */}
            {visibleItems.length > 0 ? (
                <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6" : "space-y-3"}>
                    {visibleItems.map(item => {
                        const ytId = item.item_type === 'video' ? getYouTubeId(item.url) : null;
                        let thumbnailUrl = ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : null;
                        let isImage = false;
                        let isPdf = false;
                        
                        // Check if document is an image or PDF
                        if (item.item_type === 'document' && item.url) {
                            const url = item.url.toLowerCase();
                            if (url.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/)) {
                                thumbnailUrl = item.url;
                                isImage = true;
                            } else if (url.match(/\.pdf$/)) {
                                isPdf = true;
                                thumbnailUrl = item.url; // Try direct URL first
                            }
                        }
                        
                        const isSelected = selectedItems.has(item.id);
                        return viewMode === "grid" ? (
                            <div key={item.id} className="relative">
                                {isAdmin && (
                                    <button onClick={(e) => toggleItemSelection(item.id, e)}
                                        className="absolute top-2 left-2 z-10 bg-white rounded shadow p-0.5" style={{zIndex:10}}>
                                        {isSelected ? <CheckSquare className="h-5 w-5 text-blue-500" /> : <Square className="h-5 w-5 text-gray-400" />}
                                    </button>
                                )}
                            <Card className={`overflow-hidden hover:shadow-lg transition-all duration-300 group border-0 shadow-md flex flex-col h-full ${isSelected ? 'ring-2 ring-blue-400' : ''}`}>
                                {/* Graphical Header / Thumbnail */}
                                <div 
                                    className="h-40 w-full bg-gray-100 relative flex items-center justify-center overflow-hidden cursor-pointer group-hover:opacity-90 transition-opacity"
                                    onClick={() => setViewingItem(item)}
                                >
                                    {isImage && thumbnailUrl ? (
                                        <>
                                            <img 
                                                src={thumbnailUrl} 
                                                alt={item.title} 
                                                className="w-full h-full object-cover"
                                            />
                                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center group-hover:bg-black/10 transition-colors" />
                                        </>
                                    ) : ytId && thumbnailUrl ? (
                                        <>
                                            <img src={thumbnailUrl} alt={item.title} className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center group-hover:bg-black/10 transition-colors">
                                                <div className="bg-white/90 rounded-full p-3 shadow-lg transform group-hover:scale-110 transition-transform">
                                                    <PlayCircle className="h-8 w-8 text-red-600 fill-current" />
                                                </div>
                                            </div>
                                        </>
                                    ) : isPdf && item.url ? (
                                        <PdfThumbnail url={item.url} className="w-full h-full" />
                                    ) : (
                                        <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${
                                            item.item_type === 'video' ? 'from-red-50 to-red-100' : 
                                            item.item_type === 'document' ? 'from-blue-50 to-indigo-100' : 
                                            item.item_type === 'article' ? 'from-green-50 to-emerald-100' :
                                            'from-gray-50 to-gray-200'
                                        }`}>
                                            {item.item_type === 'video' ? (
                                                <Video className="h-16 w-16 text-red-300" />
                                            ) : item.item_type === 'document' ? (
                                                <FileText className="h-16 w-16 text-blue-300" />
                                            ) : item.item_type === 'article' ? (
                                                <FileEdit className="h-16 w-16 text-green-300" />
                                            ) : (
                                                <Link className="h-16 w-16 text-gray-300" />
                                            )}
                                            {/* Center Icon Overlay */}
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                {item.item_type === 'video' && <PlayCircle className="h-10 w-10 text-red-500/80" />}
                                                {item.item_type === 'document' && <Search className="h-8 w-8 text-blue-500/50" />}
                                                {item.item_type === 'article' && <FileEdit className="h-10 w-10 text-green-500/80" />}
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* Admin Actions Overlay */}
                                    {isAdmin && (
                                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                            <Button variant="secondary" size="icon" className="h-8 w-8 shadow-sm bg-white hover:bg-gray-100" onClick={(e) => { e.stopPropagation(); handleEditItem(item); }}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button variant="destructive" size="icon" className="h-8 w-8 shadow-sm" onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id); }}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                <CardContent className="p-4 flex-1 flex flex-col">
                                    <div className="flex-1">
                                        <h4 className="font-bold text-gray-900 mb-2 line-clamp-2 leading-tight" title={item.title}>
                                            {item.title}
                                        </h4>
                                        <p className="text-sm text-gray-500 line-clamp-2 mb-3">
                                            {item.description}
                                        </p>
                                    </div>
                                    
                                    <div className="flex items-center justify-between pt-3 border-t mt-auto">
                                        <div className="flex gap-2">
                                            {item.item_type === 'video' ? (
                                                <Badge variant="secondary" className="bg-red-50 text-red-700 hover:bg-red-100">
                                                    <Video className="h-3 w-3 mr-1" /> Video
                                                </Badge>
                                            ) : item.item_type === 'article' ? (
                                                <Badge variant="secondary" className="bg-green-50 text-green-700 hover:bg-green-100">
                                                    <FileEdit className="h-3 w-3 mr-1" /> Article
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100">
                                                    <FileText className="h-3 w-3 mr-1" /> Doc
                                                </Badge>
                                            )}
                                        </div>
                                        
                                        {item.machine_type_ids && item.machine_type_ids.length > 0 && (
                                            <span className="text-xs text-gray-400 truncate max-w-[120px]">
                                                {machineTypes.find(m => m.id === item.machine_type_ids[0])?.name}
                                            </span>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                            </div>
                        ) : (
                            <Card key={item.id} className="overflow-hidden hover:shadow-md transition-all group border shadow-sm">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-4">
                                        {/* Thumbnail */}
                                        <div 
                                            className="h-20 w-32 bg-gray-100 rounded flex-shrink-0 flex items-center justify-center overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                                            onClick={() => setViewingItem(item)}
                                        >
                                            {isImage && thumbnailUrl ? (
                                                <img src={thumbnailUrl} alt={item.title} className="w-full h-full object-cover" />
                                            ) : ytId && thumbnailUrl ? (
                                                <div className="relative w-full h-full">
                                                    <img src={thumbnailUrl} alt={item.title} className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                                                        <PlayCircle className="h-6 w-6 text-white" />
                                                    </div>
                                                </div>
                                            ) : isPdf ? (
                                                <div className="relative w-full h-full bg-white">
                                                    <FileText className="h-8 w-8 text-blue-400 absolute inset-0 m-auto" />
                                                    <Badge className="absolute bottom-1 right-1 bg-red-600 text-white text-xs">PDF</Badge>
                                                </div>
                                            ) : (
                                                <div className={`w-full h-full flex items-center justify-center ${
                                                    item.item_type === 'video' ? 'bg-red-50' : 
                                                    item.item_type === 'document' ? 'bg-blue-50' : 
                                                    item.item_type === 'article' ? 'bg-green-50' : 'bg-gray-50'
                                                }`}>
                                                    {item.item_type === 'video' ? <Video className="h-8 w-8 text-red-400" /> :
                                                     item.item_type === 'article' ? <FileEdit className="h-8 w-8 text-green-400" /> :
                                                     <FileText className="h-8 w-8 text-blue-400" />}
                                                </div>
                                            )}
                                        </div>
                                        
                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-semibold text-gray-900 truncate mb-1">{item.title}</h4>
                                            <p className="text-sm text-gray-500 line-clamp-1 mb-2">{item.description}</p>
                                            <div className="flex items-center gap-2">
                                                {item.item_type === 'video' ? (
                                                    <Badge variant="secondary" className="bg-red-50 text-red-700 text-xs">
                                                        <Video className="h-3 w-3 mr-1" /> Video
                                                    </Badge>
                                                ) : item.item_type === 'article' ? (
                                                    <Badge variant="secondary" className="bg-green-50 text-green-700 text-xs">
                                                        <FileEdit className="h-3 w-3 mr-1" /> Article
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="secondary" className="bg-blue-50 text-blue-700 text-xs">
                                                        <FileText className="h-3 w-3 mr-1" /> Doc
                                                    </Badge>
                                                )}
                                                {item.machine_type_ids && item.machine_type_ids.length > 0 && (
                                                    <span className="text-xs text-gray-400">
                                                        {machineTypes.find(m => m.id === item.machine_type_ids[0])?.name}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        
                                        {/* Actions */}
                                        {isAdmin && (
                                            <div className="flex gap-1">
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleEditItem(item); }}>
                                                    <Edit className="h-4 w-4 text-gray-500" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id); }}>
                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            ) : (
                visibleCategories.length === 0 && (
                    <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed">
                        <p className="text-gray-500">No items found in this category.</p>
                        {isAdmin && <Button variant="link" onClick={() => setIsAddItemOpen(true)}>Add your first item</Button>}
                    </div>
                )
            )}

            {renderMediaViewer()}

            {/* Add Category Modal */}
            <Dialog open={isAddCatOpen} onOpenChange={setIsAddCatOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Add New Category</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Category Name</Label>
                            <Input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="e.g., Manuals" />
                        </div>
                        {currentCategory && <p className="text-sm text-gray-500">Adding sub-category to: <strong>{currentCategory.name}</strong></p>}
                    </div>
                    <DialogFooter>
                        <Button onClick={handleAddCategory}>Create Category</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Item Modal */}
            <Dialog open={isEditItemOpen} onOpenChange={setIsEditItemOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Edit Item</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Type</Label>
                            <Select value={editingItem?.item_type || editingItem?.type || "document"} onValueChange={v => setEditingItem({ ...editingItem, item_type: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="article">Article (Text)</SelectItem>
                                    <SelectItem value="document">Document</SelectItem>
                                    <SelectItem value="video">Video</SelectItem>
                                    <SelectItem value="link">External Link</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Title</Label>
                            <Input value={editingItem?.title || ""} onChange={e => setEditingItem({ ...editingItem, title: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Input value={editingItem?.description || ""} onChange={e => setEditingItem({ ...editingItem, description: e.target.value })} />
                        </div>
                        
                        {(editingItem?.item_type === 'article' || editingItem?.type === 'article') ? (
                            <div className="space-y-2">
                                <Label>Article Content</Label>
                                <textarea
                                    value={editingItem?.content || ""}
                                    onChange={e => setEditingItem({ ...editingItem, content: e.target.value })}
                                    className="w-full min-h-[300px] p-3 border rounded-md"
                                    placeholder="Write your article content here..."
                                />
                            </div>
                        ) : (editingItem?.item_type === 'document' || editingItem?.type === 'document') ? (
                            <div className="space-y-2">
                                <Label>File URL or Upload New</Label>
                                <Input value={editingItem?.url || ""} onChange={e => setEditingItem({ ...editingItem, url: e.target.value })} placeholder="https://..." />
                                <div className="flex gap-2">
                                    <Input type="file" onChange={async (e) => {
                                        const file = e.target.files[0];
                                        if (!file) return;
                                        setUploading(true);
                                        try {
                                            const res = await UploadFile({ file });
                                            if (res && res.file_url) {
                                                setEditingItem({ ...editingItem, url: res.file_url });
                                            }
                                        } catch (err) {
                                            console.error("Upload failed", err);
                                            alert("File upload failed");
                                        } finally {
                                            setUploading(false);
                                        }
                                    }} disabled={uploading} />
                                    {uploading && <Loader2 className="animate-spin h-5 w-5" />}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <Label>{(editingItem?.item_type === 'video' || editingItem?.type === 'video') ? 'Video URL (YouTube/Vimeo)' : 'URL'}</Label>
                                <Input value={editingItem?.url || ""} onChange={e => setEditingItem({ ...editingItem, url: e.target.value })} placeholder="https://..." />
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>Category</Label>
                            <Select value={editingItem?.category_id || "none"} onValueChange={v => setEditingItem({ ...editingItem, category_id: v === "none" ? null : v })}>
                                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">No Category (Root)</SelectItem>
                                    {categories.map(cat => (
                                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div className="space-y-2">
                            <Label>Machine Type (Optional Filter)</Label>
                            <Select value={editingItem?.machine_type_id || "all"} onValueChange={v => setEditingItem({ ...editingItem, machine_type_id: v })}>
                                <SelectTrigger><SelectValue placeholder="Applies to all machines" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Machines</SelectItem>
                                    {machineTypes.map(m => (
                                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button 
                            onClick={handleUpdateItem} 
                            disabled={uploading || !editingItem?.title || ((editingItem?.item_type !== 'article' && editingItem?.type !== 'article') && !editingItem?.url)}
                        >
                            Update Item
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add Item Modal */}
            <Dialog open={isAddItemOpen} onOpenChange={setIsAddItemOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Add New Item</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Type</Label>
                            <Select value={newItem.type} onValueChange={v => setNewItem({ ...newItem, type: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="article">Article (Text)</SelectItem>
                                    <SelectItem value="document">Document</SelectItem>
                                    <SelectItem value="video">Video</SelectItem>
                                    <SelectItem value="link">External Link</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Title</Label>
                            <Input value={newItem.title} onChange={e => setNewItem({ ...newItem, title: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Input value={newItem.description} onChange={e => setNewItem({ ...newItem, description: e.target.value })} />
                        </div>
                        
                        {newItem.type === 'article' ? (
                            <div className="space-y-2">
                                <Label>Article Content</Label>
                                <textarea
                                    value={newItem.content || ""}
                                    onChange={e => setNewItem({ ...newItem, content: e.target.value })}
                                    className="w-full min-h-[300px] p-3 border rounded-md"
                                    placeholder="Write your article content here..."
                                />
                            </div>
                        ) : newItem.type === 'document' ? (
                            <div className="space-y-2">
                                <Label>Upload File</Label>
                                <div className="flex gap-2">
                                    <Input type="file" onChange={handleFileUpload} disabled={uploading} />
                                    {uploading && <Loader2 className="animate-spin h-5 w-5" />}
                                </div>
                                {newItem.url && <p className="text-xs text-green-600">File uploaded!</p>}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <Label>{newItem.type === 'video' ? 'Video URL (YouTube/Vimeo)' : 'URL'}</Label>
                                <Input value={newItem.url} onChange={e => setNewItem({ ...newItem, url: e.target.value })} placeholder="https://..." />
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>Machine Type (Optional Filter)</Label>
                            <Select value={newItem.machine_type_id} onValueChange={v => setNewItem({ ...newItem, machine_type_id: v })}>
                                <SelectTrigger><SelectValue placeholder="Applies to all machines" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Machines</SelectItem>
                                    {machineTypes.sort((a, b) => a.name.localeCompare(b.name)).map(m => (
                                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleAddItem} disabled={uploading || !newItem.title || (newItem.type !== 'article' && !newItem.url)}>Add Item</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Bulk Move / Reclassify Modal */}
            <Dialog open={isBulkMoveOpen} onOpenChange={setIsBulkMoveOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Update {selectedItems.size} item{selectedItems.size > 1 ? 's' : ''}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="flex gap-2">
                            <Button size="sm" variant={bulkAction === 'category' ? 'default' : 'outline'} onClick={() => setBulkAction('category')}>
                                <FolderInput className="h-4 w-4 mr-1" /> Move to category
                            </Button>
                            <Button size="sm" variant={bulkAction === 'machine_type' ? 'default' : 'outline'} onClick={() => setBulkAction('machine_type')}>
                                <Tag className="h-4 w-4 mr-1" /> Change machine type
                            </Button>
                        </div>

                        {bulkAction === 'category' ? (
                            <div className="space-y-2">
                                <Label>Target category</Label>
                                <Select value={bulkTargetCategory} onValueChange={setBulkTargetCategory}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="root">— Root (no category) —</SelectItem>
                                        {categories.map(c => (
                                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <Label>Target machine type</Label>
                                <Select value={bulkTargetMachineType} onValueChange={setBulkTargetMachineType}>
                                    <SelectTrigger><SelectValue placeholder="Select machine type" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All machine types</SelectItem>
                                        {machineTypes.map(mt => (
                                            <SelectItem key={mt.id} value={mt.id}>{mt.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsBulkMoveOpen(false)}>Cancel</Button>
                        <Button onClick={handleBulkSave} disabled={isBulkSaving}>
                            {isBulkSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Update {selectedItems.size} item{selectedItems.size > 1 ? 's' : ''}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}