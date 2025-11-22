
import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { addTenantId, addTenantIdBulk } from '@/components/utils/tenant';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Upload, Plus, CheckCircle, AlertTriangle, Loader2, FileText, X, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function SetupStep({ step, onComplete, onSkip, existingData }) {
    const [activeTab, setActiveTab] = useState('sample');
    const [importing, setImporting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const fileInputRef = useRef(null);
    
    // Manual entry state
    const [manualRecords, setManualRecords] = useState([]);
    const [currentRecord, setCurrentRecord] = useState({});
    const [specialtyInput, setSpecialtyInput] = useState('');

    const handleDownloadTemplate = () => {
        const blob = new Blob([step.csvTemplate], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${step.entity}_template.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    const handleImportCSV = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setImporting(true);
        setError('');
        setSuccess('');

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target.result;
                const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
                
                if (lines.length <= 1) {
                    throw new Error('CSV file is empty or only contains headers.');
                }

                const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
                const records = [];

                for (let i = 1; i < lines.length; i++) {
                    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
                    const record = {};
                    
                    headers.forEach((header, index) => {
                        let value = values[index] || '';
                        
                        // Convert boolean strings
                        if (value.toLowerCase() === 'true') value = true;
                        else if (value.toLowerCase() === 'false') value = false;
                        
                        // Check if value is a string before using .includes()
                        if (typeof value === 'string' && value.includes(';')) {
                            value = value.split(';').map(v => v.trim());
                        }
                        
                        record[header] = value;
                    });
                    
                    records.push(record);
                }

                if (records.length === 0) {
                    throw new Error('No records found in CSV file.');
                }

                // Add tenant_id to all records
                const recordsWithTenant = await addTenantIdBulk(records);
                await base44.entities[step.entity].bulkCreate(recordsWithTenant);
                
                setSuccess(`Successfully imported ${records.length} records!`);
                setTimeout(() => {
                    onComplete(step.id, records);
                }, 1500);

            } catch (err) {
                setError(err.message || 'Failed to import CSV file.');
                console.error('Import error:', err);
            } finally {
                setImporting(false);
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            }
        };
        
        reader.onerror = () => {
            setError('Failed to read file.');
            setImporting(false);
        };
        
        reader.readAsText(file);
    };

    const handleUseSampleData = async () => {
        setImporting(true);
        setError('');
        setSuccess('');

        try {
            // Add tenant_id to all sample data
            const sampleDataWithTenant = await addTenantIdBulk(step.sampleData);
            await base44.entities[step.entity].bulkCreate(sampleDataWithTenant);
            setSuccess(`Successfully added ${step.sampleData.length} sample records!`);
            setTimeout(() => {
                onComplete(step.id, step.sampleData);
            }, 1500);
        } catch (err) {
            setError(err.message || 'Failed to add sample data.');
        } finally {
            setImporting(false);
        }
    };

    const handleAddManualRecord = () => {
        const isEmpty = step.fields.some(field => {
            // Check for required fields based on renderManualEntryField logic
            const isOptional = field === 'description' || field === 'email' || field === 'specialties'; // specialties is optional, handled separately
            if (isOptional) return false;

            const value = currentRecord[field];
            return !value || (typeof value === 'string' && value.trim() === '');
        });

        if (isEmpty) {
            setError('Please fill in all required fields before adding.');
            return;
        }

        setManualRecords([...manualRecords, { ...currentRecord }]);
        setCurrentRecord({});
        setSpecialtyInput('');
        setError('');
    };

    const handleRemoveManualRecord = (index) => {
        setManualRecords(manualRecords.filter((_, i) => i !== index));
    };

    const handleSaveManualRecords = async () => {
        if (manualRecords.length === 0) {
            setError('Please add at least one record before saving.');
            return;
        }

        setImporting(true);
        setError('');
        setSuccess('');

        try {
            // Add tenant_id to all manual records
            const recordsWithTenant = await addTenantIdBulk(manualRecords);
            await base44.entities[step.entity].bulkCreate(recordsWithTenant);
            setSuccess(`Successfully added ${manualRecords.length} records!`);
            setTimeout(() => {
                onComplete(step.id, manualRecords);
            }, 1500);
        } catch (err) {
            setError(err.message || 'Failed to save records.');
        } finally {
            setImporting(false);
        }
    };

    const handleAddSpecialty = () => {
        if (specialtyInput.trim()) {
            const currentSpecialties = currentRecord.specialties || [];
            setCurrentRecord({
                ...currentRecord,
                specialties: [...currentSpecialties, specialtyInput.trim()]
            });
            setSpecialtyInput('');
        }
    };

    const handleRemoveSpecialty = (specialty) => {
        setCurrentRecord({
            ...currentRecord,
            specialties: (currentRecord.specialties || []).filter(s => s !== specialty)
        });
    };

    const renderManualEntryField = (field) => {
        if (field === 'specialties') {
            return (
                <div key={field}>
                    <Label htmlFor={field}>Specialties (optional)</Label>
                    <div className="flex gap-2 mb-2">
                        <Input
                            id={field}
                            placeholder="Add a specialty..."
                            value={specialtyInput}
                            onChange={(e) => setSpecialtyInput(e.target.value)}
                            onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddSpecialty();
                                }
                            }}
                        />
                        <Button type="button" onClick={handleAddSpecialty} size="sm">
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {(currentRecord.specialties || []).map(specialty => (
                            <Badge key={specialty} variant="secondary" className="cursor-pointer" onClick={() => handleRemoveSpecialty(specialty)}>
                                {specialty} <X className="ml-1 h-3 w-3" />
                            </Badge>
                        ))}
                    </div>
                </div>
            );
        }

        if (field === 'is_usd') {
            return (
                <div key={field} className="flex items-center space-x-2">
                    <Checkbox
                        id={field}
                        checked={currentRecord[field] || false}
                        onCheckedChange={(checked) => setCurrentRecord({ ...currentRecord, [field]: checked })}
                    />
                    <Label htmlFor={field} className="cursor-pointer">
                        This supplier sells in US Dollars
                    </Label>
                </div>
            );
        }

        return (
            <div key={field}>
                <Label htmlFor={field}>
                    {field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    {field !== 'description' && field !== 'email' && field !== 'specialties' ? ' *' : ''}
                </Label>
                <Input
                    id={field}
                    placeholder={`Enter ${field.replace(/_/g, ' ')}`}
                    value={currentRecord[field] || ''}
                    onChange={(e) => setCurrentRecord({ ...currentRecord, [field]: e.target.value })}
                />
            </div>
        );
    };

    const handleSkip = () => {
        onSkip();
    };

    return (
        <div className="space-y-6">
            {error && (
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {success && (
                <Alert className="bg-green-50 border-green-200 text-green-800">
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>{success}</AlertDescription>
                </Alert>
            )}

            {step.note && (
                <Alert className="bg-blue-50 border-blue-200">
                    <FileText className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800">{step.note}</AlertDescription>
                </Alert>
            )}

            {existingData && existingData.length > 0 && (
                <Alert className="bg-yellow-50 border-yellow-200">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <AlertDescription className="text-yellow-800">
                        You already have {existingData.length} {step.title.toLowerCase()} in your database. 
                        Adding more data will append to existing records.
                    </AlertDescription>
                </Alert>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="sample">Sample Data</TabsTrigger>
                    <TabsTrigger value="manual">Manual Entry</TabsTrigger>
                    <TabsTrigger value="import">Import CSV</TabsTrigger>
                    <TabsTrigger value="template">Template</TabsTrigger>
                </TabsList>

                <TabsContent value="sample" className="space-y-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                        <h3 className="font-semibold mb-3">Sample Data Preview:</h3>
                        <div className="bg-white rounded border overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        {step.fields.map(field => (
                                            <th key={field} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                {field.replace(/_/g, ' ')}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {step.sampleData.map((row, idx) => (
                                        <tr key={idx}>
                                            {step.fields.map(field => (
                                                <td key={field} className="px-4 py-2 text-sm text-gray-900">
                                                    {Array.isArray(row[field]) ? row[field].join(', ') : row[field]?.toString()}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <Button
                            onClick={handleUseSampleData}
                            disabled={importing}
                            className="flex-1"
                            size="lg"
                        >
                            {importing ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Adding...</>
                            ) : (
                                <><Plus className="mr-2 h-4 w-4" /> Use This Sample Data</>
                            )}
                        </Button>
                        <Button
                            onClick={handleSkip}
                            variant="outline"
                            size="lg"
                        >
                            Skip This Step
                        </Button>
                    </div>
                </TabsContent>

                <TabsContent value="manual" className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                        <p className="text-sm text-blue-800">
                            Add items one at a time. You can add as many as you need, then save them all at once.
                        </p>
                    </div>

                    <div className="bg-white border rounded-lg p-6 space-y-4">
                        <h3 className="font-semibold text-lg mb-4">Add New {step.title.slice(0, -1)}</h3>
                        
                        {step.fields.map(field => renderManualEntryField(field))}

                        <Button onClick={handleAddManualRecord} className="w-full" size="lg">
                            <Plus className="mr-2 h-4 w-4" /> Add to List
                        </Button>
                    </div>

                    {manualRecords.length > 0 && (
                        <div className="bg-gray-50 border rounded-lg p-4">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="font-semibold">Added Records ({manualRecords.length})</h3>
                                <Button
                                    onClick={handleSaveManualRecords}
                                    disabled={importing}
                                    size="sm"
                                >
                                    {importing ? (
                                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                                    ) : (
                                        <><Save className="mr-2 h-4 w-4" /> Save All Records</>
                                    )}
                                </Button>
                            </div>
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {manualRecords.map((record, idx) => (
                                    <div key={idx} className="bg-white p-3 rounded border flex justify-between items-start">
                                        <div className="space-y-1 text-sm">
                                            {step.fields.map(field => (
                                                <div key={field}>
                                                    <span className="font-medium text-gray-600">{field.replace(/_/g, ' ')}: </span>
                                                    <span className="text-gray-900">
                                                        {Array.isArray(record[field]) 
                                                            ? record[field].join(', ') 
                                                            : record[field]?.toString() || 'N/A'}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleRemoveManualRecord(idx)}
                                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <Button
                        onClick={handleSkip}
                        variant="outline"
                        size="lg"
                        className="w-full"
                    >
                        Skip This Step
                    </Button>
                </TabsContent>

                <TabsContent value="import" className="space-y-4">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                        <p className="text-lg font-medium text-gray-700 mb-2">Upload Your CSV File</p>
                        <p className="text-sm text-gray-500 mb-4">
                            Make sure your CSV file matches the template format
                        </p>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv"
                            onChange={handleImportCSV}
                            className="hidden"
                            id="csv-upload"
                        />
                        <Button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={importing}
                            size="lg"
                        >
                            {importing ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importing...</>
                            ) : (
                                <><Upload className="mr-2 h-4 w-4" /> Choose CSV File</>
                            )}
                        </Button>
                    </div>
                    <Button
                        onClick={handleSkip}
                        variant="outline"
                        size="lg"
                        className="w-full"
                    >
                        Skip This Step
                    </Button>
                </TabsContent>

                <TabsContent value="template" className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                        <h3 className="font-semibold text-lg mb-2 text-blue-900">Download CSV Template</h3>
                        <p className="text-blue-800 mb-4">
                            Download a pre-formatted CSV template with the correct column headers. 
                            Fill it out with your data and import it in the Import CSV tab.
                        </p>
                        <Button onClick={handleDownloadTemplate} size="lg" className="w-full sm:w-auto">
                            <Download className="mr-2 h-4 w-4" /> Download {step.title} Template
                        </Button>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-semibold mb-2">Required Fields:</h4>
                        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                            {step.fields.filter(field => field !== 'description' && field !== 'email' && field !== 'specialties').map(field => (
                                <li key={field}>{field.replace(/_/g, ' ')}</li>
                            ))}
                            {/* Optionally list optional fields if needed */}
                            {step.fields.filter(field => field === 'description' || field === 'email' || field === 'specialties').length > 0 && (
                                <>
                                    <h4 className="font-semibold mt-4 mb-2">Optional Fields:</h4>
                                    {step.fields.filter(field => field === 'description' || field === 'email' || field === 'specialties').map(field => (
                                        <li key={field}>{field.replace(/_/g, ' ')}</li>
                                    ))}
                                </>
                            )}
                        </ul>
                    </div>
                    <Button
                        onClick={handleSkip}
                        variant="outline"
                        size="lg"
                        className="w-full"
                    >
                        Skip This Step
                    </Button>
                </TabsContent>
            </Tabs>
        </div>
    );
}
