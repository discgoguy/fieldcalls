import React, { useState } from "react";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, ArrowLeftRight, Wrench, Loader2 } from "lucide-react";
import { createPageUrl } from "@/utils";

// shortages: [{ part_id, part, needed, ownStock, buildable, available, shortfall }]
// onBuild(partId, buildQuantity) => Promise — should build the assembly and resolve
//   once the part's on-hand stock has been updated. Errors are shown inline.
export default function InsufficientStockDialog({ open, onOpenChange, shortages, onBuild }) {
    const [buildingPartId, setBuildingPartId] = useState(null);
    const [buildError, setBuildError] = useState("");

    const handleGoToBorrowedParts = () => {
        window.location.href = createPageUrl('InternalPartMovements');
    };

    const handleBuild = async (shortage) => {
        setBuildError("");
        setBuildingPartId(shortage.part_id);
        try {
            const buildQuantity = Math.min(shortage.shortfall, shortage.buildable);
            await onBuild(shortage.part_id, buildQuantity);
        } catch (e) {
            setBuildError(e.message || `Failed to build ${shortage.part?.part_name || 'assembly'}.`);
        } finally {
            setBuildingPartId(null);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent className="max-w-lg">
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2 text-red-700">
                        <AlertTriangle className="h-5 w-5" />
                        Not Enough Inventory
                    </AlertDialogTitle>
                    <AlertDialogDescription asChild>
                        <div className="space-y-3 text-sm text-gray-700">
                            <p>The following part(s) don't have enough stock on hand to fulfill this order:</p>
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>

                {buildError && (
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>{buildError}</AlertDescription>
                    </Alert>
                )}

                <div className="space-y-3 max-h-[50vh] overflow-y-auto">
                    {(shortages || []).map(s => (
                        <div key={s.part_id} className="p-3 border rounded-lg bg-red-50 border-red-200">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-semibold text-gray-900">{s.part?.part_name || 'Unknown Part'}</p>
                                    <p className="text-xs text-gray-500">{s.part?.part_number}</p>
                                </div>
                                <div className="text-right text-sm">
                                    <p>Needed: <span className="font-semibold">{s.needed}</span></p>
                                    <p className="text-gray-600">On hand: {s.ownStock}</p>
                                    {s.part?.is_assembly && (
                                        <p className="text-gray-600">Buildable: {s.buildable}</p>
                                    )}
                                </div>
                            </div>
                            {s.part?.is_assembly && s.buildable > 0 && (
                                <div className="mt-2 pt-2 border-t border-red-200">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="border-blue-300 text-blue-700 hover:bg-blue-50"
                                        disabled={buildingPartId === s.part_id}
                                        onClick={() => handleBuild(s)}
                                    >
                                        {buildingPartId === s.part_id ? (
                                            <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Building...</>
                                        ) : (
                                            <><Wrench className="h-3.5 w-3.5 mr-1.5" />Build {Math.min(s.shortfall, s.buildable)} unit(s) from components</>
                                        )}
                                    </Button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <p className="text-xs text-gray-500">
                    If this part is needed urgently, it may be possible to borrow it from Manufacturing.
                </p>

                <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                    <Button type="button" variant="outline" onClick={handleGoToBorrowedParts} className="sm:mr-auto">
                        <ArrowLeftRight className="h-4 w-4 mr-2" />
                        Go to Borrowed Parts
                    </Button>
                    <AlertDialogCancel>Close &amp; Adjust Order</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
