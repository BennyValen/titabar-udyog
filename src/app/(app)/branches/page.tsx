"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Modal } from "@/components/ui/modal";
import { api, ApiError } from "@/lib/fetcher";
import { cn, normalizePhone } from "@/lib/utils";
import { modalFieldKeyDown, setModalFieldRef } from "@/lib/modal-field-nav";
import { Skeleton, SkeletonTable } from "@/components/ui/skeleton";

interface BranchUser {
  id: string;
  name: string;
  phone: string;
  isActive: boolean;
}

interface Branch {
  id: string;
  name: string;
  code: string;
  phone?: string | null;
  isActive: boolean;
  branchUser: BranchUser | null;
}

interface AdminUser {
  id: string;
  name: string;
  phone: string;
  role: string;
  isActive: boolean;
}

type ModalMode = "add" | "edit" | "admin" | null;

interface BranchForm {
  name: string;
  code: string;
  phone: string;
  username: string;
  password: string;
  confirmPassword: string;
  isActive: boolean;
}

interface CredentialsForm {
  username: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

const emptyForm = (): BranchForm => ({
  name: "",
  code: "",
  phone: "",
  username: "",
  password: "",
  confirmPassword: "",
  isActive: true,
});

const emptyCredentials = (): CredentialsForm => ({
  username: "",
  phone: "",
  password: "",
  confirmPassword: "",
});

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [modal, setModal] = useState<ModalMode>(null);
  const [editId, setEditId] = useState("");
  const [adminEditId, setAdminEditId] = useState("");
  const [form, setForm] = useState<BranchForm>(emptyForm());
  const [adminForm, setAdminForm] = useState<CredentialsForm>(emptyCredentials());
  const [passwordError, setPasswordError] = useState("");
  const [adminPasswordError, setAdminPasswordError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 5000);
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [branchData, userData] = await Promise.all([
        api<{ branches: Branch[] }>("/api/branches"),
        api<{ users: AdminUser[] }>("/api/users"),
      ]);
      setBranches(branchData.branches);
      setAdmins(userData.users.filter((u) => u.role === "ADMIN"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const closeModal = () => {
    setModal(null);
    setEditId("");
    setAdminEditId("");
    setForm(emptyForm());
    setAdminForm(emptyCredentials());
    setPasswordError("");
    setAdminPasswordError("");
  };

  const openAdd = () => {
    setForm(emptyForm());
    setPasswordError("");
    setEditId("");
    setModal("add");
  };

  const openEdit = (b: Branch) => {
    setEditId(b.id);
    setForm({
      name: b.name,
      code: b.code,
      phone: b.phone || "",
      username: b.branchUser?.name ?? b.name,
      password: "",
      confirmPassword: "",
      isActive: b.isActive,
    });
    setPasswordError("");
    setModal("edit");
  };

  const openAdminEdit = (admin: AdminUser) => {
    setAdminEditId(admin.id);
    setAdminForm({
      username: admin.name,
      phone: admin.phone,
      password: "",
      confirmPassword: "",
    });
    setAdminPasswordError("");
    setModal("admin");
  };

  const validatePasswords = (
    password: string,
    confirmPassword: string,
    requirePassword: boolean,
    setError: (msg: string) => void
  ) => {
    const pwd = password.trim();
    const confirm = confirmPassword.trim();

    if (requirePassword) {
      if (!pwd || !confirm) {
        setError("Password and confirm password are required");
        return false;
      }
    }
    if (pwd || confirm) {
      if (pwd !== confirm) {
        setError("Passwords do not match");
        return false;
      }
      if (pwd.length < 4) {
        setError("Password must be at least 4 characters");
        return false;
      }
    }
    setError("");
    return true;
  };

  const validateBranchPhone = (phone: string, setError: (msg: string) => void) => {
    const digits = normalizePhone(phone);
    if (!digits || digits.length < 10) {
      setError("Phone must be at least 10 digits");
      return null;
    }
    return digits;
  };

  const saveAdd = async () => {
    if (!form.name.trim()) {
      setPasswordError("Branch name is required");
      return;
    }
    if (!form.code.trim()) {
      setPasswordError("Branch code is required");
      return;
    }
    const phone = validateBranchPhone(form.phone, setPasswordError);
    if (!phone) return;
    if (!validatePasswords(form.password, form.confirmPassword, true, setPasswordError)) return;

    setSaving(true);
    try {
      await api("/api/branches", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          code: form.code.trim(),
          phone,
          username: form.username.trim() || form.name.trim(),
          password: form.password.trim(),
        }),
      });
      closeModal();
      await load();
      toast("Branch created successfully");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to create branch";
      setPasswordError(message);
      toast(message);
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    if (!editId) return;
    if (!form.name.trim()) {
      setPasswordError("Branch name is required");
      return;
    }
    const phone = validateBranchPhone(form.phone, setPasswordError);
    if (!phone) return;
    if (!validatePasswords(form.password, form.confirmPassword, false, setPasswordError)) return;

    setSaving(true);
    try {
      const loginName = form.username.trim() || form.name.trim();
      const payload: Record<string, unknown> = {
        name: loginName,
        phone,
        isActive: form.isActive,
        username: loginName,
      };
      const pwd = form.password.trim();
      if (pwd) payload.password = pwd;

      const data = await api<{ branch: Branch }>(`/api/branches/${editId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      setBranches((prev) =>
        prev.map((b) => (b.id === editId ? { ...b, ...data.branch } : b))
      );
      closeModal();
      await load();
      toast("Branch updated successfully");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to update branch";
      setPasswordError(message);
      toast(message);
    } finally {
      setSaving(false);
    }
  };

  const saveAdminEdit = async () => {
    if (!adminEditId) return;
    const phone = validateBranchPhone(adminForm.phone, setAdminPasswordError);
    if (!phone) return;
    if (!adminForm.username.trim()) {
      setAdminPasswordError("Name is required");
      return;
    }
    if (!validatePasswords(adminForm.password, adminForm.confirmPassword, false, setAdminPasswordError)) {
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: adminForm.username.trim(),
        phone,
      };
      const pwd = adminForm.password.trim();
      if (pwd) payload.password = pwd;

      const data = await api<{ user: AdminUser }>(`/api/users/${adminEditId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      setAdmins((prev) =>
        prev.map((a) => (a.id === adminEditId ? { ...a, ...data.user } : a))
      );
      closeModal();
      await load();
      toast("Admin updated successfully");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to update admin";
      setAdminPasswordError(message);
      toast(message);
    } finally {
      setSaving(false);
    }
  };

  const patchForm = (patch: Partial<BranchForm>) => {
    setForm((prev) => {
      const next = { ...prev, ...patch };
      if (patch.name !== undefined && patch.username === undefined) {
        next.username = patch.name;
      }
      if (patch.username !== undefined && patch.name === undefined) {
        next.name = patch.username;
      }
      return next;
    });
    if (passwordError) setPasswordError("");
  };

  const patchAdminForm = (patch: Partial<CredentialsForm>) => {
    setAdminForm((prev) => ({ ...prev, ...patch }));
    if (adminPasswordError) setAdminPasswordError("");
  };

  const deleteBranch = async (branch: Branch) => {
    if (!confirm(`Delete branch "${branch.name}"? This cannot be undone.`)) return;
    try {
      await api(`/api/branches/${branch.id}`, { method: "DELETE" });
      setBranches((prev) => prev.filter((b) => b.id !== branch.id));
      toast("Branch deleted successfully");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Failed to delete branch");
    }
  };

  return (
    <div className="space-y-6">
      {toastMsg && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg bg-slate-900 px-4 py-3 text-sm text-white shadow-lg">
          {toastMsg}
        </div>
      )}

      <div>
        <h1 className="text-xl font-bold">Settings</h1>
        <p className="text-sm text-muted">Manage branches and admin account</p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Branches</h2>
          <Button onClick={openAdd}>Add Branch</Button>
        </div>

        <Card>
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Phone</TH>
                <TH>Code</TH>
                <TH>Status</TH>
                <TH className="text-center">Actions</TH>
              </TR>
            </THead>
            {loading ? (
              <SkeletonTable rows={4} cols={5} />
            ) : (
              <TBody>
                {branches.map((b) => (
                <TR key={b.id}>
                  <TD className="font-medium">{b.name}</TD>
                  <TD>{b.phone || "—"}</TD>
                  <TD>{b.code}</TD>
                  <TD>{b.isActive ? "Active" : "Inactive"}</TD>
                  <TD className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(b)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => deleteBranch(b)}>
                        Delete
                      </Button>
                    </div>
                  </TD>
                </TR>
                ))}
              </TBody>
            )}
          </Table>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-bold">Admin</h2>

        <Card>
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Phone</TH>
                <TH>Actions</TH>
              </TR>
            </THead>
            {loading ? (
              <SkeletonTable rows={2} cols={3} />
            ) : (
              <TBody>
                {admins.map((admin) => (
                <TR key={admin.id}>
                  <TD className="font-medium">{admin.name}</TD>
                  <TD>{admin.phone}</TD>
                  <TD>
                    <Button size="sm" variant="ghost" onClick={() => openAdminEdit(admin)}>
                      Edit
                    </Button>
                  </TD>
                </TR>
                ))}
              </TBody>
            )}
          </Table>
        </Card>
      </div>

      <Modal
        open={modal === "add"}
        onClose={closeModal}
        title="Add Branch"
        onSubmit={saveAdd}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={closeModal} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </>
        }
      >
        <BranchFormFields
          mode="add"
          form={form}
          passwordError={passwordError}
          onChange={patchForm}
          onSubmit={saveAdd}
        />
      </Modal>

      <Modal
        open={modal === "edit"}
        onClose={closeModal}
        title="Edit Branch"
        onSubmit={saveEdit}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={closeModal} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </>
        }
      >
        <BranchFormFields
          mode="edit"
          form={form}
          passwordError={passwordError}
          onChange={patchForm}
          onSubmit={saveEdit}
        />
      </Modal>

      <Modal
        open={modal === "admin"}
        onClose={closeModal}
        title="Edit Admin"
        onSubmit={saveAdminEdit}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={closeModal} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </>
        }
      >
        <AdminEditFields
          form={adminForm}
          passwordError={adminPasswordError}
          onChange={patchAdminForm}
          onSubmit={saveAdminEdit}
        />
      </Modal>
    </div>
  );
}

function AdminEditFields({
  form,
  passwordError,
  onChange,
  onSubmit,
}: {
  form: CredentialsForm;
  passwordError: string;
  onChange: (patch: Partial<CredentialsForm>) => void;
  onSubmit: () => void;
}) {
  const fieldRefs = useRef<Array<HTMLInputElement | HTMLButtonElement | null>>([]);
  const fieldKeyDown = useCallback(
    (index: number) => (e: React.KeyboardEvent) =>
      modalFieldKeyDown(e, fieldRefs.current, index, onSubmit),
    [onSubmit]
  );

  return (
    <div className="space-y-5">
      {passwordError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{passwordError}</p>
      )}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Phone</p>
        <Input
          ref={(el) => setModalFieldRef(fieldRefs.current, 0, el)}
          placeholder="Phone"
          value={form.phone}
          onChange={(e) => onChange({ phone: e.target.value })}
          onKeyDown={fieldKeyDown(0)}
        />
      </div>
      <LoginCredentialsFields
        mode="edit"
        username={form.username}
        password={form.password}
        confirmPassword={form.confirmPassword}
        passwordError={passwordError}
        onChange={onChange}
        fieldRefs={fieldRefs}
        fieldStartIndex={1}
        onLastFieldEnter={onSubmit}
        showInlineError={false}
      />
    </div>
  );
}

function LoginCredentialsFields({
  mode,
  username,
  password,
  confirmPassword,
  passwordError,
  onChange,
  fieldRefs: externalFieldRefs,
  fieldStartIndex = 0,
  onLastFieldEnter,
  showInlineError = true,
}: {
  mode: "add" | "edit";
  username: string;
  password: string;
  confirmPassword: string;
  passwordError: string;
  onChange: (patch: Partial<CredentialsForm>) => void;
  fieldRefs?: React.MutableRefObject<Array<HTMLInputElement | HTMLButtonElement | null>>;
  fieldStartIndex?: number;
  onLastFieldEnter?: () => void;
  showInlineError?: boolean;
}) {
  const localFieldRefs = useRef<Array<HTMLInputElement | HTMLButtonElement | null>>([]);
  const fieldRefs = externalFieldRefs ?? localFieldRefs;
  const fieldKeyDown = useCallback(
    (index: number) => (e: React.KeyboardEvent) =>
      modalFieldKeyDown(e, fieldRefs.current, index, onLastFieldEnter),
    [fieldRefs, onLastFieldEnter]
  );

  const usernameIndex = fieldStartIndex;
  const passwordIndex = fieldStartIndex + 1;
  const confirmIndex = fieldStartIndex + 2;

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
        Login Credentials
      </p>
      <div className="space-y-3">
        <Input
          ref={(el) => setModalFieldRef(fieldRefs.current, usernameIndex, el)}
          placeholder={mode === "add" ? "Initial Username" : "Username / Name"}
          value={username}
          onChange={(e) => onChange({ username: e.target.value })}
          onKeyDown={fieldKeyDown(usernameIndex)}
        />
        <Input
          ref={(el) => setModalFieldRef(fieldRefs.current, passwordIndex, el)}
          type="password"
          placeholder={mode === "add" ? "Initial Password" : "New Password"}
          value={password}
          onChange={(e) => onChange({ password: e.target.value })}
          onKeyDown={fieldKeyDown(passwordIndex)}
        />
        <Input
          ref={(el) => setModalFieldRef(fieldRefs.current, confirmIndex, el)}
          type="password"
          placeholder="Confirm Password"
          value={confirmPassword}
          onChange={(e) => onChange({ confirmPassword: e.target.value })}
          onKeyDown={fieldKeyDown(confirmIndex)}
        />
        {showInlineError && passwordError && (
          <p className="text-sm text-red-600">{passwordError}</p>
        )}
        {mode === "edit" && (
          <p className="text-xs text-muted">Leave password blank to keep the current password.</p>
        )}
      </div>
    </div>
  );
}

function BranchFormFields({
  mode,
  form,
  passwordError,
  onChange,
  onSubmit,
}: {
  mode: "add" | "edit";
  form: BranchForm;
  passwordError: string;
  onChange: (patch: Partial<BranchForm>) => void;
  onSubmit: () => void;
}) {
  const fieldRefs = useRef<Array<HTMLInputElement | HTMLButtonElement | null>>([]);
  const fieldKeyDown = useCallback(
    (index: number) => (e: React.KeyboardEvent) =>
      modalFieldKeyDown(e, fieldRefs.current, index, onSubmit),
    [onSubmit]
  );

  return (
    <div className="space-y-5">
      {passwordError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{passwordError}</p>
      )}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
          Branch Info
        </p>
        <div className="space-y-3">
          <Input
            ref={(el) => setModalFieldRef(fieldRefs.current, 0, el)}
            placeholder="Branch Name"
            value={form.name}
            onChange={(e) => onChange({ name: e.target.value })}
            onKeyDown={fieldKeyDown(0)}
          />
          <Input
            ref={(el) => setModalFieldRef(fieldRefs.current, 1, el)}
            placeholder="Phone"
            value={form.phone}
            onChange={(e) => onChange({ phone: e.target.value })}
            onKeyDown={fieldKeyDown(1)}
          />
          <Input
            ref={(el) => setModalFieldRef(fieldRefs.current, 2, el)}
            placeholder="Branch Code (e.g. MAIN)"
            value={form.code}
            readOnly={mode === "edit"}
            onChange={(e) => onChange({ code: e.target.value.toUpperCase() })}
            onKeyDown={fieldKeyDown(2)}
            className={cn(mode === "edit" && "bg-slate-50 text-muted")}
          />
        </div>
      </div>

      <LoginCredentialsFields
        mode={mode}
        username={form.username}
        password={form.password}
        confirmPassword={form.confirmPassword}
        passwordError={passwordError}
        onChange={onChange}
        fieldRefs={fieldRefs}
        fieldStartIndex={3}
        onLastFieldEnter={mode === "add" ? onSubmit : undefined}
        showInlineError={false}
      />

      {mode === "edit" && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Status</p>
          <div className="flex gap-2">
            <button
              ref={(el) => setModalFieldRef(fieldRefs.current, 6, el)}
              type="button"
              onClick={() => onChange({ isActive: true })}
              onKeyDown={fieldKeyDown(6)}
              className={cn(
                "rounded-md px-4 py-2 text-sm font-medium",
                form.isActive ? "bg-primary text-white" : "bg-slate-100 text-slate-700"
              )}
            >
              Active
            </button>
            <button
              ref={(el) => setModalFieldRef(fieldRefs.current, 7, el)}
              type="button"
              onClick={() => onChange({ isActive: false })}
              onKeyDown={fieldKeyDown(7)}
              className={cn(
                "rounded-md px-4 py-2 text-sm font-medium",
                !form.isActive ? "bg-primary text-white" : "bg-slate-100 text-slate-700"
              )}
            >
              Inactive
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
