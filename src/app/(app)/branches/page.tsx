"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Modal } from "@/components/ui/modal";
import { api } from "@/lib/fetcher";

interface Branch {
  id: string;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  isActive: boolean;
  _count?: { users: number; orders: number };
}

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editId, setEditId] = useState("");
  const [form, setForm] = useState({ name: "", code: "", address: "", phone: "" });

  const load = () => api<{ branches: Branch[] }>("/api/branches").then((d) => setBranches(d.branches));

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (modal === "edit") {
      await api(`/api/branches/${editId}`, { method: "PATCH", body: JSON.stringify(form) });
    } else {
      await api("/api/branches", { method: "POST", body: JSON.stringify(form) });
    }
    setModal(null);
    setEditId("");
    setForm({ name: "", code: "", address: "", phone: "" });
    load();
  };

  const openEdit = (b: Branch) => {
    setEditId(b.id);
    setForm({ name: b.name, code: b.code, address: b.address || "", phone: b.phone || "" });
    setModal("edit");
  };

  const deactivate = async (id: string) => {
    if (!confirm("Deactivate branch?")) return;
    await api(`/api/branches/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Branches</h1>
          <p className="text-sm text-muted">Manage factory locations</p>
        </div>
        <Button onClick={() => { setForm({ name: "", code: "", address: "", phone: "" }); setModal("add"); }}>Add Branch</Button>
      </div>

      <Card>
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Code</TH>
              <TH>Phone</TH>
              <TH>Users</TH>
              <TH>Orders</TH>
              <TH>Status</TH>
              <TH>Actions</TH>
            </TR>
          </THead>
          <TBody>
            {branches.map((b) => (
              <TR key={b.id}>
                <TD className="font-medium">{b.name}</TD>
                <TD>{b.code}</TD>
                <TD>{b.phone || "—"}</TD>
                <TD>{b._count?.users ?? 0}</TD>
                <TD>{b._count?.orders ?? 0}</TD>
                <TD>{b.isActive ? "Active" : "Inactive"}</TD>
                <TD>
                  {b.isActive && (
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(b)}>Edit</Button>
                      <Button size="sm" variant="danger" onClick={() => deactivate(b.id)}>Deactivate</Button>
                    </div>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal === "edit" ? "Edit Branch" : "Add Branch"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input placeholder="Branch Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Code (e.g. MAIN)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
          <Input placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
      </Modal>
    </div>
  );
}
