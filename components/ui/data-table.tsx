"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Column<T> {
    header: string;
    accessorKey?: keyof T;
    cell?: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
    columns: Column<T>[];
    data: T[];
    loading?: boolean;
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

export function DataTable<T extends { id: string | number }>({
    columns,
    data,
    loading,
    page,
    totalPages,
    onPageChange,
}: DataTableProps<T>) {
    return (
        <div className="space-y-4">
            <div className="rounded-md border bg-white dark:bg-slate-950">
                <div className="relative w-full overflow-auto">
                    <table className="w-full caption-bottom text-sm text-left">
                        <thead className="[&_tr]:border-b">
                            <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                {columns.map((col, i) => (
                                    <th key={i} className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                                        {col.header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="[&_tr:last-child]:border-0">
                            {loading ? (
                                <tr>
                                    <td colSpan={columns.length} className="h-24 text-center">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                                    </td>
                                </tr>
                            ) : data.length === 0 ? (
                                <tr>
                                    <td colSpan={columns.length} className="h-24 text-center">
                                        No results.
                                    </td>
                                </tr>
                            ) : (
                                data.map((row) => (
                                    <tr key={row.id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                        {columns.map((col, i) => (
                                            <td key={i} className="p-4 align-middle">
                                                {col.cell ? col.cell(row) : (row[col.accessorKey as keyof T] as React.ReactNode)}
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            <div className="flex items-center justify-end space-x-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(page - 1)}
                    disabled={page <= 1 || loading}
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-sm font-medium">
                    Page {page} of {totalPages || 1}
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(page + 1)}
                    disabled={page >= totalPages || loading}
                >
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
