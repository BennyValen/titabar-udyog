"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BranchSelector } from "@/components/branch-selector";
import { api } from "@/lib/fetcher";
import { formatQty } from "@/lib/utils";

interface DashboardStats {
  branches: number;
  totalItems: number;
  pendingOrders: number;
  submittedOrders: number;
  recentMovements: Array<{
    id: string;
    movementType: string;
    quantity: number;
    createdAt: string;
    inventoryItem: { name: string };
    branch?: { name: string; code: string };
    createdBy: { name: string };
  }>;
  lowStockItems: Array<{
    id: string;
    availableQty: number;
    inventoryItem: { name: string; unit: string };
    branch?: { name: string; code: string };
  }>;
  branchSummaries: Array<{
    id: string;
    name: string;
    code: string;
    pendingOrders: number;
    stockItems: number;
    totalOnHand: number;
    totalReserved: number;
    totalAvailable: number;
  }>;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [branchId, setBranchId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const q = branchId ? `?branchId=${branchId}` : "";
    api<{ branches: number; totalItems: number; pendingOrders: number; submittedOrders: number; recentMovements: DashboardStats["recentMovements"]; lowStockItems: DashboardStats["lowStockItems"]; branchSummaries: DashboardStats["branchSummaries"] }>(
      `/api/dashboard/stats${q}`
    )
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [branchId]);

  if (loading) return <p className="text-sm text-muted">Loading dashboard...</p>;
  if (!stats) return <p className="text-sm text-danger">Failed to load dashboard</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted">Live overview across branches</p>
        </div>
        <BranchSelector value={branchId} onChange={setBranchId} className="w-48" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-xs text-muted">Branches</p>
          <p className="text-2xl font-bold">{stats.branches}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Stock Items</p>
          <p className="text-2xl font-bold">{stats.totalItems}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Pending Orders</p>
          <p className="text-2xl font-bold text-warning">{stats.pendingOrders}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Submitted Orders</p>
          <p className="text-2xl font-bold text-success">{stats.submittedOrders}</p>
        </Card>
      </div>

      {stats.branchSummaries.length > 0 && (
        <Card title="Branch Summary">
          <Table>
            <THead>
              <TR>
                <TH>Branch</TH>
                <TH>Pending Orders</TH>
                <TH>Stock Items</TH>
                <TH>On Hand</TH>
                <TH>Reserved</TH>
                <TH>Available</TH>
              </TR>
            </THead>
            <TBody>
              {stats.branchSummaries.map((b) => (
                <TR key={b.id}>
                  <TD>
                    {b.name} <span className="text-muted">({b.code})</span>
                  </TD>
                  <TD>{b.pendingOrders}</TD>
                  <TD>{b.stockItems}</TD>
                  <TD>{formatQty(b.totalOnHand)}</TD>
                  <TD>{formatQty(b.totalReserved)}</TD>
                  <TD>{formatQty(b.totalAvailable)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Low Stock Alerts">
          {stats.lowStockItems.length === 0 ? (
            <p className="text-sm text-muted">No low stock items</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Item</TH>
                  <TH>Branch</TH>
                  <TH>Available</TH>
                </TR>
              </THead>
              <TBody>
                {stats.lowStockItems.map((s) => (
                  <TR key={s.id}>
                    <TD>
                      {s.inventoryItem.name} ({s.inventoryItem.unit})
                    </TD>
                    <TD>{s.branch?.code}</TD>
                    <TD className="text-danger font-medium">{formatQty(s.availableQty)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>

        <Card title="Recent Movements">
          <Table>
            <THead>
              <TR>
                <TH>Type</TH>
                <TH>Item</TH>
                <TH>Qty</TH>
                <TH>By</TH>
              </TR>
            </THead>
            <TBody>
              {stats.recentMovements.map((m) => (
                <TR key={m.id}>
                  <TD>
                    <Badge status={m.movementType} />
                  </TD>
                  <TD>{m.inventoryItem.name}</TD>
                  <TD>{formatQty(Number(m.quantity))}</TD>
                  <TD className="text-xs text-muted">{m.createdBy.name}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
