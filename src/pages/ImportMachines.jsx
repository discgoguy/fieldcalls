
import React, { useState, useEffect } from "react";
import { Machine } from "@/entities/Machine";
import { Customer } from "@/entities/Customer";
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

const BATCH_SIZE = 50; // Define batch size for creation

export default function ImportMachinesPage() {
    const [customers, setCustomers] = useState([]);
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
                const [customerData, machineTypeData] = await Promise.all([
                    Customer.list(),
                    MachineType.list()
                ]);
                setCustomers(customerData || []);
                setMachineTypes(machineTypeData || []);
            } catch (e) {
                setError("Failed to load customers or machine types for matching.");
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
            setImportProgress({ current: 0, total: 0 }); // Reset progress on new file selection
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
        setImportProgress({ current: 0, total: 0 }); // Reset progress for preview

        try {
            // Upload the file first
            const uploadResult = await UploadFile({ file });
            
            // Extract data from the CSV
            const extractResult = await ExtractDataFromUploadedFile({
                file_url: uploadResult.file_url,
                json_schema: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            serial_number: { type: "string" },
                            model: { type: "string" },
                            machine_type: { type: "string" },
                            customer_name: { type: "string" },
                            installation_date: { type: "string" },
                            warranty_expiration: { type: "string" },
                            notes: { type: "string" }
                        },
                        required: ["serial_number", "model", "machine_type", "customer_name"]
                    }
                }
            });

            if (extractResult.status === "error") {
                throw new Error(extractResult.details || "Failed to parse CSV file");
            }

            // Match customer names to customer IDs
            const machinesWithCustomerIds = extractResult.output.map((machine, index) => {
                const matchingCustomer = customers.find(c => 
                    c.company_name.toLowerCase().trim() === machine.customer_name.toLowerCase().trim() ||
                    c.customer_identifier?.toLowerCase().trim() === machine.customer_name.toLowerCase().trim()
                );
                
                return {
                    ...machine,
                    customer_id: matchingCustomer?.id || null,
                    customer_match_status: matchingCustomer ? 'found' : 'not_found',
                    row_number: index + 1
                };
            });

            setPreviewData(machinesWithCustomerIds);
            
        } catch (e) {
            setError("Failed to process CSV file: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleImport = async () => {
        if (previewData.length === 0) {
            setError("No data to import. Please preview first.");
            return;
        }

        const validMachines = previewData.filter(m => m.customer_match_status === 'found');
        
        if (validMachines.length === 0) {
            setError("No machines with valid customer matches to import.");
            return;
        }

        setLoading(true);
        setError("");
        setSuccess("");
        // setImportProgress({ current: 0, total: validMachines.length }); // This will be set after machine type validation

        const importErrors = [];
        let successCount = 0;
        const validMachineTypeNames = machineTypes.map(mt => mt.name.toLowerCase());
        const machinesToCreate = []; // Holds machines that passed initial validation

        // First, prepare and validate all machines to be created (machine type)
        for (const machine of validMachines) {
            const machineTypeLowercase = machine.machine_type.toLowerCase();
            if (!validMachineTypeNames.includes(machineTypeLowercase)) {
                importErrors.push({
                    row: machine.row_number,
                    serial_number: machine.serial_number,
                    error: `Machine Type "${machine.machine_type}" does not exist.`
                });
                continue; // Skip adding to machinesToCreate if machine type is invalid
            }
            machinesToCreate.push({
                serial_number: machine.serial_number,
                model: machine.model,
                machine_type: machine.machine_type,
                customer_id: machine.customer_id,
                installation_date: machine.installation_date || null,
                warranty_expiration: machine.warranty_expiration || null,
                notes: machine.notes || ""
            });
        }
        
        // Update total for progress bar based on machines that passed initial validation
        setImportProgress({ current: 0, total: machinesToCreate.length });

        try {
            // Import machines in batches
            for (let i = 0; i < machinesToCreate.length; i += BATCH_SIZE) {
                const batch = machinesToCreate.slice(i, i + BATCH_SIZE);
                try {
                    await Machine.bulkCreate(batch);
                    successCount += batch.length;
                } catch (error) {
                    // If bulk fails, try one-by-one to identify the faulty record
                    for(const machine of batch) {
                        try {
                           await Machine.create(machine);
                           successCount++;
                        } catch (singleError) {
                            // Find the original machine in validMachines to get its row_number for the error
                            const originalRow = validMachines.find(m => m.serial_number === machine.serial_number);
                            importErrors.push({
                                row: originalRow?.row_number || 'N/A', // Use optional chaining for safety
                                serial_number: machine.serial_number,
                                error: singleError.message
                            });
                        }
                    }
                }
                
                setImportProgress({ current: i + batch.length, total: machinesToCreate.length });
                if (i + BATCH_SIZE < machinesToCreate.length) {
                    await new Promise(resolve => setTimeout(resolve, 500)); // Delay between batches
                }
            }

            const failedMatches = previewData.filter(m => m.customer_match_status === 'not_found');
            setImportResults({
                successful: successCount,
                failed: failedMatches.length + importErrors.length, // Total failures from customer match and import errors
                failedRows: failedMatches,
                importErrors: importErrors // This now includes machine type errors and individual API errors
            });

            if (successCount > 0) {
                setSuccess(`Successfully imported ${successCount} machines!`);
            }
            // Check if there are any failures from either customer match or import errors
            if (failedMatches.length > 0 || importErrors.length > 0) {
                setError(`${(failedMatches.length + importErrors.length)} machines failed to import.`);
            }
            
            setPreviewData([]);
            setFile(null);

        } catch (e) {
            setError("An unexpected error occurred during import: " + e.message);
        } finally {
            setLoading(false);
            setImportProgress({ current: 0, total: 0 });
        }
    };

    const downloadTemplate = () => {
        const csvContent = "serial_number,model,machine_type,customer_name,installation_date,warranty_expiration,notes\nSN001,Model X1,Press,Acme Corporation,2024-01-15,2025-01-15,Sample machine\nSN002,Model Y2,Conveyor,Tech Industries,2024-02-01,2025-02-01,Another sample";
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'machines_import_template.csv';
        a.click();
        window.URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center">
                        <Upload className="mr-2" />
                        Import Machines from CSV
                    </CardTitle>
                    <CardDescription>
                        Upload a CSV file with machine data. Customer names will be automatically matched to existing customers.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {error && (
                        <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {success && (
                        <Alert className="bg-green-50 border-green-200 text-green-800">
                            <CheckCircle className="h-4 w-4" />
                            <AlertTitle>Success</AlertTitle>
                            <AlertDescription>{success}</AlertDescription>
                        </Alert>
                    )}

                    {/* NEW: Display import progress */}
                    {importProgress.total > 0 && loading && (
                        <Alert className="bg-blue-50 border-blue-200 text-blue-800">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <AlertTitle>Importing...</AlertTitle>
                            <AlertDescription>
                                Processing machine {importProgress.current} of {importProgress.total}
                                <div className="w-full bg-blue-200 rounded-full h-2 mt-2">
                                    <div 
                                        className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                                        style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                                    ></div>
                                </div>
                            </AlertDescription>
                        </Alert>
                    )}

                    <div className="flex items-center justify-between">
                        <div className="flex-1 mr-4">
                            <Label htmlFor="csv-file">Select CSV File</Label>
                            <Input
                                id="csv-file"
                                type="file"
                                accept=".csv"
                                onChange={handleFileChange}
                                className="mt-2"
                            />
                        </div>
                        <Button
                            variant="outline"
                            onClick={downloadTemplate}
                            className="ml-2"
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Download Template
                        </Button>
                    </div>

                    <div className="flex gap-2">
                        <Button
                            onClick={handlePreview}
                            disabled={!file || loading}
                            variant="outline"
                        >
                            {/* Update text based on loading state and whether it's an import or preview */}
                            {loading && importProgress.total === 0 ? ( 
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <FileText className="mr-2 h-4 w-4" />
                                    Preview Data
                                </>
                            )}
                        </Button>

                        {previewData.length > 0 && (
                            <Button
                                onClick={handleImport}
                                disabled={loading || previewData.filter(m => m.customer_match_status === 'found').length === 0}
                            >
                                {/* Update text to show import progress */}
                                {loading && importProgress.total > 0 ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Importing... ({importProgress.current}/{importProgress.total})
                                    </>
                                ) : (
                                    <>
                                        <Upload className="mr-2 h-4 w-4" />
                                        Import {previewData.filter(m => m.customer_match_status === 'found').length} Machines
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Preview Data Table */}
            {previewData.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Preview Import Data</CardTitle>
                        <CardDescription>
                            Review the data before importing. Green rows will be imported, red rows have issues.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Row</TableHead>
                                    <TableHead>Serial Number</TableHead>
                                    <TableHead>Model</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Customer Name</TableHead>
                                    <TableHead>Match Status</TableHead>
                                    <TableHead>Installation Date</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {previewData.map((machine, index) => (
                                    <TableRow
                                        key={index}
                                        className={machine.customer_match_status === 'found' ? 'bg-green-50' : 'bg-red-50'}
                                    >
                                        <TableCell>{machine.row_number}</TableCell>
                                        <TableCell>{machine.serial_number}</TableCell>
                                        <TableCell>{machine.model}</TableCell>
                                        <TableCell>{machine.machine_type}</TableCell>
                                        <TableCell>{machine.customer_name}</TableCell>
                                        <TableCell>
                                            {machine.customer_match_status === 'found' ? (
                                                <Badge className="bg-green-100 text-green-800">✓ Found</Badge>
                                            ) : (
                                                <Badge variant="destructive">✗ No Match</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>{machine.installation_date || 'N/A'}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* Import Results */}
            {importResults && (
                <Card>
                    <CardHeader>
                        <CardTitle>Import Results</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <p><strong>Successfully imported:</strong> {importResults.successful} machines</p>
                            {importResults.failed > 0 && (
                                <>
                                    <p><strong>Failed to import:</strong> {importResults.failed} machines</p>
                                    <div className="mt-4">
                                        <h4 className="font-medium">Failed rows:</h4>
                                        <ul className="list-disc list-inside text-sm text-gray-600">
                                            {importResults.failedRows.map(row => (
                                                <li key={`match-error-${row.row_number}`}>
                                                    Row {row.row_number}: {row.serial_number} - Customer "{row.customer_name}" not found
                                                </li>
                                            ))}
                                            {importResults.importErrors && importResults.importErrors.map(error => (
                                                <li key={`import-error-${error.row}-${error.serial_number}`}>
                                                    Row {error.row}: {error.serial_number} - {error.error}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </>
                            )}
                        </div>
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
                            <li><code>serial_number</code> - Machine serial number</li>
                            <li><code>model</code> - Machine model</li>
                            <li><code>machine_type</code> - Must match an existing Machine Type exactly (case-insensitive).</li>
                            <li><code>customer_name</code> - Customer company name or identifier (must match existing customer exactly).</li>
                        </ul>
                        <p><strong>Optional columns:</strong></p>
                        <ul className="list-disc list-inside ml-4">
                            <li><code>installation_date</code> - Installation date (YYYY-MM-DD format)</li>
                            <li><code>warranty_expiration</code> - Warranty expiration date (YYYY-MM-DD format)</li>
                            <li><code>notes</code> - Additional notes</li>
                        </ul>
                        <p className="text-blue-600 mt-4">
                            💡 <strong>Tip:</strong> Customer names must match exactly with existing customers in your database. 
                            The system will also try to match against customer identifiers.
                        </p>
                        <p className="text-orange-600 mt-2">
                            ⚠️ <strong>Note:</strong> If a `machine_type` from your CSV does not match an existing type in the "Machine Types" page, the row will fail to import.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
