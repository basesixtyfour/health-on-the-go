"use client";

import { useEffect, useState } from "react";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { VALID_SPECIALTIES } from "@/lib/types";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface User {
    id: string;
    name: string;
    email: string;
    role: "PATIENT" | "DOCTOR" | "ADMIN";
    emailVerified: boolean;
    createdAt: string;
}

export default function UsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [limit] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [search, setSearch] = useState("");

    // Modal State
    const [isDoctorModalOpen, setIsDoctorModalOpen] = useState(false);
    const [selectedUserForDoctor, setSelectedUserForDoctor] = useState<string | null>(null);
    const [selectedSpecialty, setSelectedSpecialty] = useState("GENERAL");

    async function fetchUsers() {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
                query: search
            });
            const res = await fetch(`/api/v1/admin/users?${params}`);
            if (!res.ok) throw new Error("Failed to fetch users");
            const raw = await res.json();
            setUsers(raw.data);
            setTotalPages(raw.meta.totalPages);
        } catch (error) {
            console.error(error);
            // alert("Failed to load users");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        const timeout = setTimeout(fetchUsers, 300); // Debounce search
        return () => clearTimeout(timeout);
    }, [page, search]);

    async function handleRoleChange(userId: string, newRole: string) {
        // Intercept Doctor promotion for Modal
        if (newRole === "DOCTOR") {
            setSelectedUserForDoctor(userId);
            setSelectedSpecialty("GENERAL");
            setIsDoctorModalOpen(true);
            return;
        }

        if (!confirm(`Are you sure you want to change this user's role to ${newRole}?`)) return;

        await executeRoleChange(userId, newRole);
    }

    async function executeRoleChange(userId: string, newRole: string, specialty?: string) {
        try {
            const body: any = { userId, role: newRole };
            if (specialty) body.specialty = specialty;

            const res = await fetch("/api/v1/admin/users", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (!res.ok) throw new Error("Failed to update user role");

            alert("User role updated successfully");
            setIsDoctorModalOpen(false);
            fetchUsers(); // Refresh list
        } catch (error) {
            console.error(error);
            alert("Failed to update role");
        }
    }

    const confirmMakeDoctor = () => {
        if (selectedUserForDoctor) {
            executeRoleChange(selectedUserForDoctor, "DOCTOR", selectedSpecialty);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Users</h1>
                    <p className="text-muted-foreground">Manage system users and roles.</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative w-64">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search users..."
                            className="pl-9"
                            value={search}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                setPage(1); // Reset page on search
                                setSearch(e.target.value);
                            }}
                        />
                    </div>
                </div>
            </div>

            <DataTable
                loading={loading}
                data={users}
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                columns={[
                    { header: "Name", accessorKey: "name", cell: (u) => <div className="font-medium">{u.name}</div> },
                    { header: "Email", accessorKey: "email" },
                    {
                        header: "Role",
                        accessorKey: "role",
                        cell: (u) => (
                            <Badge variant={u.role === "ADMIN" ? "destructive" : u.role === "DOCTOR" ? "default" : "secondary"}>
                                {u.role}
                            </Badge>
                        )
                    },
                    {
                        header: "Actions",
                        cell: (u) => (
                            <div className="flex gap-2">
                                {u.role !== "ADMIN" && (
                                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleRoleChange(u.id, "ADMIN")}>
                                        Make Admin
                                    </Button>
                                )}
                                {u.role !== "DOCTOR" && (
                                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleRoleChange(u.id, "DOCTOR")}>
                                        Make Doctor
                                    </Button>
                                )}
                                {u.role !== "PATIENT" && (
                                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleRoleChange(u.id, "PATIENT")}>
                                        Demote
                                    </Button>
                                )}
                            </div>
                        )
                    }
                ]}
            />

            <Dialog open={isDoctorModalOpen} onOpenChange={setIsDoctorModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Make User a Doctor</DialogTitle>
                        <DialogDescription>
                            Select a specialty for the new doctor profile.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <label htmlFor="specialty" className="text-right text-sm font-medium">
                                Specialty
                            </label>
                            <select
                                id="specialty"
                                className="col-span-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={selectedSpecialty}
                                onChange={(e) => setSelectedSpecialty(e.target.value)}
                            >
                                {VALID_SPECIALTIES.map((s) => (
                                    <option key={s} value={s}>
                                        {s.charAt(0) + s.slice(1).toLowerCase()}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDoctorModalOpen(false)}>Cancel</Button>
                        <Button onClick={confirmMakeDoctor}>Confirm Promotion</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
