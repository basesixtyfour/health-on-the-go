"use client";

import { useEffect, useState } from "react";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Pencil } from "lucide-react";
import { VALID_SPECIALTIES } from "@/lib/types";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface DoctorProfile {
    specialties: string[];
    timezone: string | null;
}

interface User {
    id: string;
    name: string;
    email: string;
    role: "PATIENT" | "DOCTOR" | "ADMIN";
    emailVerified: boolean;
    createdAt: string;
    doctorProfile?: DoctorProfile | null;
}

interface UsersPageProps {
    initialRoleFilter?: "PATIENT" | "DOCTOR" | "ADMIN";
    initialSearch?: string;
}

export default function UsersPage({ initialRoleFilter, initialSearch }: UsersPageProps) {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [limit] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [search, setSearch] = useState(initialSearch || "");
    const [roleFilter, setRoleFilter] = useState<string | undefined>(initialRoleFilter);

    // Doctor Promotion Modal State
    const [isDoctorModalOpen, setIsDoctorModalOpen] = useState(false);
    const [selectedUserForDoctor, setSelectedUserForDoctor] = useState<string | null>(null);
    const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>(["GENERAL"]);

    // Edit Specialties Modal State
    const [isEditSpecialtiesOpen, setIsEditSpecialtiesOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);

    async function fetchUsers() {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
                query: search
            });
            if (roleFilter) {
                params.set('role', roleFilter);
            }
            const res = await fetch(`/api/v1/admin/users?${params}`);
            if (!res.ok) throw new Error("Failed to fetch users");
            const raw = await res.json();
            setUsers(raw.data);
            setTotalPages(raw.meta.totalPages);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        const timeout = setTimeout(fetchUsers, 300);
        return () => clearTimeout(timeout);
    }, [page, search, roleFilter]);

    async function handleRoleChange(userId: string, newRole: string) {
        if (newRole === "DOCTOR") {
            setSelectedUserForDoctor(userId);
            setSelectedSpecialties(["GENERAL"]);
            setIsDoctorModalOpen(true);
            return;
        }

        if (!confirm(`Are you sure you want to change this user's role to ${newRole}?`)) return;
        await executeRoleChange(userId, newRole);
    }

    async function executeRoleChange(userId: string, newRole: string, specialties?: string[]) {
        try {
            const body: any = { userId, role: newRole };
            if (specialties && specialties.length > 0) body.specialties = specialties;

            const res = await fetch("/api/v1/admin/users", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (!res.ok) throw new Error("Failed to update user");

            alert("User updated successfully");
            setIsDoctorModalOpen(false);
            setIsEditSpecialtiesOpen(false);
            fetchUsers();
        } catch (error) {
            console.error(error);
            alert("Failed to update user");
        }
    }

    async function updateDoctorSpecialties(userId: string, specialties: string[]) {
        try {
            const res = await fetch("/api/v1/admin/users", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, specialties }),
            });

            if (!res.ok) throw new Error("Failed to update specialties");

            alert("Specialties updated successfully");
            setIsEditSpecialtiesOpen(false);
            fetchUsers();
        } catch (error) {
            console.error(error);
            alert("Failed to update specialties");
        }
    }

    const confirmMakeDoctor = () => {
        if (selectedUserForDoctor && selectedSpecialties.length > 0) {
            executeRoleChange(selectedUserForDoctor, "DOCTOR", selectedSpecialties);
        }
    };

    const openEditSpecialties = (user: User) => {
        setEditingUser(user);
        setSelectedSpecialties(user.doctorProfile?.specialties || []);
        setIsEditSpecialtiesOpen(true);
    };

    const toggleSpecialty = (specialty: string) => {
        setSelectedSpecialties(prev =>
            prev.includes(specialty)
                ? prev.filter(s => s !== specialty)
                : [...prev, specialty]
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">
                        {roleFilter ? `${roleFilter.charAt(0) + roleFilter.slice(1).toLowerCase()}s` : 'Users'}
                    </h1>
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
                                setPage(1);
                                setSearch(e.target.value);
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Role Filter Buttons */}
            <div className="flex gap-2 flex-wrap">
                <Button
                    variant={!roleFilter ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setRoleFilter(undefined); setPage(1); }}
                >
                    All Users
                </Button>
                <Button
                    variant={roleFilter === "PATIENT" ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setRoleFilter("PATIENT"); setPage(1); }}
                >
                    Patients
                </Button>
                <Button
                    variant={roleFilter === "DOCTOR" ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setRoleFilter("DOCTOR"); setPage(1); }}
                >
                    Doctors
                </Button>
                <Button
                    variant={roleFilter === "ADMIN" ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setRoleFilter("ADMIN"); setPage(1); }}
                >
                    Admins
                </Button>
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
                        header: "Specialties",
                        accessorKey: "doctorProfile",
                        cell: (u) => (
                            u.role === "DOCTOR" ? (
                                <div className="flex items-center gap-2">
                                    <div className="flex flex-wrap gap-1">
                                        {u.doctorProfile?.specialties?.length ? (
                                            u.doctorProfile.specialties.map((s: string) => (
                                                <Badge key={s} variant="outline" className="text-xs">
                                                    {s}
                                                </Badge>
                                            ))
                                        ) : (
                                            <span className="text-muted-foreground text-xs">No specialties</span>
                                        )}
                                    </div>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6"
                                        onClick={() => openEditSpecialties(u)}
                                    >
                                        <Pencil className="h-3 w-3" />
                                    </Button>
                                </div>
                            ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                            )
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

            {/* Make Doctor Modal */}
            <Dialog open={isDoctorModalOpen} onOpenChange={setIsDoctorModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Make User a Doctor</DialogTitle>
                        <DialogDescription>
                            Select specialties for the new doctor profile.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4">
                        <label className="text-sm font-medium mb-3 block">Select Specialties</label>
                        <div className="flex flex-wrap gap-2">
                            {VALID_SPECIALTIES.map((s) => (
                                <Button
                                    key={s}
                                    type="button"
                                    size="sm"
                                    variant={selectedSpecialties.includes(s) ? "default" : "outline"}
                                    onClick={() => toggleSpecialty(s)}
                                >
                                    {s.charAt(0) + s.slice(1).toLowerCase()}
                                </Button>
                            ))}
                        </div>
                        {selectedSpecialties.length === 0 && (
                            <p className="text-sm text-red-500 mt-2">Please select at least one specialty</p>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDoctorModalOpen(false)}>Cancel</Button>
                        <Button onClick={confirmMakeDoctor} disabled={selectedSpecialties.length === 0}>
                            Confirm Promotion
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Specialties Modal */}
            <Dialog open={isEditSpecialtiesOpen} onOpenChange={setIsEditSpecialtiesOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Doctor Specialties</DialogTitle>
                        <DialogDescription>
                            Update specialties for {editingUser?.name}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4">
                        <label className="text-sm font-medium mb-3 block">Select Specialties</label>
                        <div className="flex flex-wrap gap-2">
                            {VALID_SPECIALTIES.map((s) => (
                                <Button
                                    key={s}
                                    type="button"
                                    size="sm"
                                    variant={selectedSpecialties.includes(s) ? "default" : "outline"}
                                    onClick={() => toggleSpecialty(s)}
                                >
                                    {s.charAt(0) + s.slice(1).toLowerCase()}
                                </Button>
                            ))}
                        </div>
                        {selectedSpecialties.length === 0 && (
                            <p className="text-sm text-red-500 mt-2">Please select at least one specialty</p>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditSpecialtiesOpen(false)}>Cancel</Button>
                        <Button
                            onClick={() => editingUser && updateDoctorSpecialties(editingUser.id, selectedSpecialties)}
                            disabled={selectedSpecialties.length === 0}
                        >
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
