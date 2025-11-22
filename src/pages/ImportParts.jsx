
import React, { useState, useEffect } from "react";
import { Part } from "@/entities/Part";
import { Category } from "@/entities/Category";
import { MachineType } from "@/entities/MachineType";
import { UploadFile, ExtractDataFromUploadedFile } from "@/integrations/Core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, Download, CheckCircle, AlertTriangle, Loader2, FileText } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const BATCH_SIZE = 50; // Define batch size for bulk operations

export default function ImportPartsPage() {
    const [categories, setCategories] = useState([]);
    const [machineTypes, setMachineTypes] = useState([]);
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [previewData, setPreviewData] = useState([]);
    const [importResults, setImportResults] = useState(null);
    const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const [categoryData, machineTypeData] = await Promise.all([
                    Category.list(),
                    MachineType.list()
                ]);
                setCategories(categoryData || []);
                setMachineTypes(machineTypeData || []);
            } catch (e) {
                setError("Failed to load categories or machine types for validation.");
                console.error(e);
            }
        };
        loadInitialData();
    }, []);

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile && selectedFile.type === 'text/csv') {
            setFile(selectedFile);
            setError("");
            setPreviewData([]);
            setImportResults(null);
            setSuccess("");
            setImportProgress({ current: 0, total: 0 });
        } else {
            setError("Please select a valid CSV file.");
            setFile(null);
        }
    };

    const handlePreview = async () => {
        if (!file) {
            setError("Please select a CSV file first.");
            return;
        }

        setLoading(true);
        setError("");
        setPreviewData([]);
        
        try {
            const uploadResult = await UploadFile({ file });
            const extractResult = await ExtractDataFromUploadedFile({
                file_url: uploadResult.file_url,
                json_schema: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            part_name: { type: "string" },
                            part_number: { type: "string" },
                            supplier: { type: "string" },
                            cost: { type: "string" },
                            markup_percentage: { type: "string" },
                            sales_price: { type: "string" },
                            nonsa_price: { type: "string" },
                            quantity_in_inventory: { type: "string" },
                            reorder_level: { type: "string" },
                            category: { type: "string" },
                            compatible_machine_types: { type: "string" },
                            description: { type: "string" }
                        },
                        required: ["part_name", "part_number", "cost", "quantity_in_inventory", "category"]
                    }
                }
            });

            if (extractResult.status === "error") {
                let errorMessage = extractResult.details || "Failed to parse CSV file";
                
                // Check for encoding issues
                if (errorMessage.includes("Invalid unicode") || errorMessage.includes("encoding")) {
                    errorMessage = "CSV file encoding issue detected. Please ensure your CSV file is saved in UTF-8 encoding. " +
                                 "If using Excel: Save As → More Options → Tools → Web Options → Encoding → UTF-8. " +
                                 "Or try opening the CSV in a text editor like Notepad and saving as UTF-8.";
                }
                
                throw new Error(errorMessage);
            }
            
            const categoryNames = categories.map(c => c.name.toLowerCase());
            const machineTypeNames = machineTypes.map(mt => mt.name.toLowerCase());

            const validatedData = extractResult.output.map((part, index) => {
                const categoryMatch = categoryNames.includes(part.category?.toLowerCase());
                const typesInCsv = (part.compatible_machine_types || "").split(',').map(t => t.trim()).filter(Boolean);
                const machineTypesMatch = typesInCsv.every(t => machineTypeNames.includes(t.toLowerCase()));
                
                let validation_status = 'valid';
                if (!categoryMatch) validation_status = 'invalid_category';
                else if (!machineTypesMatch) validation_status = 'invalid_machine_type';

                return { ...part, row_number: index + 2, validation_status };
            });

            setPreviewData(validatedData);
            
        } catch (e) {
            setError("Failed to process CSV file: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleImport = async () => {
        const validParts = previewData.filter(p => p.validation_status === 'valid');
        if (validParts.length === 0) {
            setError("No valid parts to import. Please check the preview for errors.");
            return;
        }

        setLoading(true);
        setError("");
        setSuccess("");
        setImportProgress({ current: 0, total: validParts.length });

        const importErrors = [];
        let successCount = 0;
        
        const partsToCreate = validParts.map(part => ({
            part_name: part.part_name,
            part_number: part.part_number,
            supplier: part.supplier || "",
            cost: parseFloat(part.cost) || 0,
            markup_percentage: parseFloat(part.markup_percentage) || 50,
            sales_price: parseFloat(part.sales_price) || (parseFloat(part.cost) * (1 + (parseFloat(part.markup_percentage) || 50) / 100)),
            nonsa_price: part.nonsa_price ? parseFloat(part.nonsa_price) : null,
            quantity_in_inventory: parseInt(part.quantity_in_inventory) || 0,
            reorder_level: parseInt(part.reorder_level) || 10,
            category: part.category,
            compatible_machine_types: (part.compatible_machine_types || "").split(',').map(t => t.trim()).filter(Boolean),
            description: part.description || ""
        }));

        for (let i = 0; i < partsToCreate.length; i += BATCH_SIZE) {
            const batch = partsToCreate.slice(i, i + BATCH_SIZE);
            try {
                // Assuming Part.bulkCreate exists and can handle an array of part objects
                await Part.bulkCreate(batch);
                successCount += batch.length;
            } catch (error) {
                 // If bulkCreate fails, try creating parts individually within the batch
                 for(const part of batch) {
                    try {
                       await Part.create(part);
                       successCount++;
                    } catch (singleError) {
                        // Find the original row number from previewData for better error reporting
                        const originalRow = validParts.find(p => p.part_number === part.part_number);
                        importErrors.push({
                            row: originalRow?.row_number || 'N/A', // Fallback if row_number isn't found
                            part_number: part.part_number,
                            error: singleError.message
                        });
                    }
                }
            }
            // Update progress after each batch
            setImportProgress({ current: i + batch.length, total: partsToCreate.length });
            // Add a small delay between batches to prevent overwhelming the server
            if (i + BATCH_SIZE < partsToCreate.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        // Calculate total failed by subtracting successful imports from valid parts count
        const failedImportsCount = validParts.length - successCount;
        setImportResults({ successful: successCount, failed: failedImportsCount, importErrors });
        
        if (successCount > 0) {
            setSuccess(`Successfully imported ${successCount} parts!`);
        }
        if (importErrors.length > 0 || failedImportsCount > 0) {
            setError("Some parts failed to import. Check the import results for details.");
        }
        
        setPreviewData([]);
        setFile(null);
        setLoading(false);
        setImportProgress({ current: 0, total: 0 });
    };

    const downloadTemplate = () => {
        const csvContent = "part_name,part_number,supplier,cost,markup_percentage,sales_price,nonsa_price,quantity_in_inventory,reorder_level,category,compatible_machine_types,description\n" +
                           "Sample Part,P-123,Sample Supplier,100,50,150,140,50,10,Bearings,\"Press,Conveyor\",A sample part for demonstration";
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'parts_import_template.csv';
        a.click();
        window.URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><Upload className="mr-2" />Import Parts from CSV</CardTitle>
                    <CardDescription>Upload a CSV file to bulk-add parts to your inventory.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {error && <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
                    {success && <Alert className="bg-green-50 border-green-200 text-green-800"><AlertTitle>Success</AlertTitle><AlertDescription>{success}</AlertDescription></Alert>}
                    {importProgress.total > 0 && loading && (
                        <Alert className="bg-blue-50 border-blue-200 text-blue-800">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <AlertTitle>Importing...</AlertTitle>
                            <AlertDescription>Processing part {importProgress.current} of {importProgress.total}</AlertDescription>
                        </Alert>
                    )}
                    <div className="flex items-center justify-between">
                        <div className="flex-1 mr-4">
                            <Label htmlFor="csv-file">Select CSV File</Label>
                            <Input id="csv-file" type="file" accept=".csv" onChange={handleFileChange} className="mt-2" />
                        </div>
                        <Button variant="outline" onClick={downloadTemplate}><Download className="mr-2 h-4 w-4" />Download Template</Button>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={handlePreview} disabled={!file || loading} variant="outline">
                            {loading && importProgress.total === 0 ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</> : <><FileText className="mr-2 h-4 w-4" />Preview Data</>}
                        </Button>
                        {previewData.length > 0 && (
                            <Button onClick={handleImport} disabled={loading || previewData.filter(p => p.validation_status === 'valid').length === 0}>
                                {loading && importProgress.total > 0 ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importing...</> : <><Upload className="mr-2 h-4 w-4" />Import {previewData.filter(p => p.validation_status === 'valid').length} Parts</>}
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {previewData.length > 0 && (
                <Card>
                    <CardHeader><CardTitle>Preview Import Data</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Part Name</TableHead><TableHead>Part Number</TableHead><TableHead>Category</TableHead><TableHead>Machine Types</TableHead><TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {previewData.map((part) => (
                                    <TableRow key={part.row_number} className={part.validation_status === 'valid' ? 'bg-green-50' : 'bg-red-50'}>
                                        <TableCell>{part.part_name}</TableCell>
                                        <TableCell>{part.part_number}</TableCell>
                                        <TableCell>{part.category}</TableCell>
                                        <TableCell>{part.compatible_machine_types}</TableCell>
                                        <TableCell>
                                            {part.validation_status === 'valid' ? <Badge className="bg-green-100 text-green-800">✓ Valid</Badge> : <Badge variant="destructive">✗ {part.validation_status.replace('_', ' ')}</Badge>}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {importResults && (
                <Card><CardHeader><CardTitle>Import Results</CardTitle></CardHeader>
                    <CardContent>
                        <p><strong>Successfully imported:</strong> {importResults.successful} parts</p>
                        {importResults.failed > 0 && <>
                            <p className="text-red-600"><strong>Failed to import:</strong> {importResults.failed} parts</p>
                            <ul className="list-disc list-inside text-sm text-red-600 mt-2">
                                {/* Display validation errors from preview stage */}
                                {(previewData.filter(p => p.validation_status !== 'valid')).map(p => <li key={`fail-validation-${p.row_number}`}>Row {p.row_number}: {p.part_number} - Reason: Invalid {p.validation_status.split('_')[1]}</li>)}
                                {/* Display import errors from the actual import process */}
                                {importResults.importErrors.map(e => <li key={`err-import-${e.row}-${e.part_number}`}>Row {e.row}: {e.part_number} - Error: {e.error}</li>)}
                            </ul>
                        </>}
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>CSV Format Requirements</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2 text-sm">
                        <p><strong>Required columns:</strong></p>
                        <ul className="list-disc list-inside ml-4">
                            <li><code>part_name</code> - Name of the part</li>
                            <li><code>part_number</code> - Unique part number</li>
                            <li><code>cost</code> - Cost price (numeric)</li>
                            <li><code>quantity_in_inventory</code> - Current stock quantity (numeric)</li>
                            <li><code>category</code> - Must match an existing category exactly</li>
                        </ul>
                        <p><strong>Optional columns:</strong></p>
                        <ul className="list-disc list-inside ml-4">
                            <li><code>supplier</code> - Part supplier name</li>
                            <li><code>markup_percentage</code> - Markup percentage (numeric, default: 50)</li>
                            <li><code>sales_price</code> - Sales price (numeric, auto-calculated if not provided)</li>
                            <li><code>nonsa_price</code> - Non-SA sales price (numeric)</li>
                            <li><code>reorder_level</code> - Reorder threshold (numeric, default: 10)</li>
                            <li><code>compatible_machine_types</code> - Comma-separated list of machine types</li>
                            <li><code>description</code> - Part description</li>
                        </ul>
                        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mt-4">
                            <p className="text-blue-800 font-medium">📄 File Format Requirements:</p>
                            <ul className="list-disc list-inside ml-4 text-blue-700 mt-2">
                                <li>File must be saved in <strong>UTF-8 encoding</strong></li>
                                <li>Use comma (,) as column separator</li>
                                <li>If using Excel: Save As → CSV (Comma delimited) → More Options → Tools → Web Options → Encoding → UTF-8</li>
                                <li>Machine types in the <code>compatible_machine_types</code> column should be comma-separated</li>
                            </ul>
                        </div>
                        <div className="bg-orange-50 border border-orange-200 rounded-md p-3 mt-2">
                            <p className="text-orange-800 font-medium">⚠️ Common Issues:</p>
                            <ul className="list-disc list-inside ml-4 text-orange-700 mt-2">
                                <li>CSV encoding errors: Save your file in UTF-8 format</li>
                                <li>Category names must match existing categories exactly (case-insensitive)</li>
                                <li>Machine type names must match existing machine types exactly (case-insensitive)</li>
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
