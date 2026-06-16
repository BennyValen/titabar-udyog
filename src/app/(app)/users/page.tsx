"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Modal } from "@/components/ui/modal";
import { api } from "@/lib/fetcher";

interface User {
  id: string;
  name: string;
  phone: string;
  role: string;
  isActive: boolean;
  branch?: { name: string; code: string } | null;
}

interface Branch {
  id: string;
  name: string;
  code: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [modal, setModal] = useState<"add" | "reset" | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState({
    name: "",
    phone: "",
    password: "",
    role: "BRANCH_USER",
    branchId: "",
  });
  const [newPassword, setNewPassword] = useState("");

  const load = () => api<{ users: User[] }>("/api/users").then((d) => setUsers(d.users));

  useEffect(() => {
    load();
    api<{ branches: Branch[] }>("/api/branches").then((d) => setBranches(d.branches));
  }, []);

  const save = async () => {
    await api("/api/users", {
      method: "POST",
      body: JSON.stringify({
        ...form,
        branchId: form.role === "ADMIN" ? null : form.branchId,
      }),
    });
    setModal(null);
    setForm({ name: "", phone: "", password: "", role: "BRANCH_USER", branchId: "" });
    load();
  };

  const resetPassword = async () => {
    await api(`/api/users/${selectedId}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ password: newPassword }),
    });
    setModal(null);
    setNewPassword("");
  };

  const deactivate = async (id: string) => {
    if (!confirm("Deactivate user?")) return;
    await api(`/api/users/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Users</h1>
          <p className="text-sm text-muted">Manage login accounts</p>
        </div>
        <Button onClick={() => setModal("add")}>Add User</Button>
      </div>

      <Card>
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Phone</TH>
              <TH>Role</TH>
              <TH>Branch</TH>
              <TH>Status</TH>
              <TH>Actions</TH>
            </TR>
          </THead>
          <TBody>
            {users.map((u) => (
              <TR key={u.id}>
                <TD className="font-medium">{u.name}</TD>
                <TD>{u.phone}</TD>
                <TD>{u.role}</TD>
                <TD>{u.branch ? `${u.branch.name} (${u.branch.code})` : "—"}</TD>
                <TD>{u.isActive ? "Active" : "Inactive"}</TD>
                <TD>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { setSelectedId(u.id); setModal("reset"); }}
                    >
                      Reset PW
                    </Button>
                    {u.isActive && (
                      <Button size="sm" variant="danger" onClick={() => deactivate(u.id)}>
                        Deactivate
                      </Button>
                    )}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>

      <Modal
        open={modal === "add"}
        onClose={() => setModal(null)}
        title="Add User"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="BRANCH_USER">Branch User</option>
            <option value="ADMIN">Admin</option>
          </Select>
          {form.role === "BRANCH_USER" && (
            <Select value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">Select branch</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </Select>
          )}
        </div>
      </Modal>

      <Modal
        open={modal === "reset"}
        onClose={() => setModal(null)}
        title="Reset Password"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button>
            <Button onClick={resetPassword}>Reset</Button>
          </>
        }
      >
        <Input type="password" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
      </Modal>
    </div>
  );
}
