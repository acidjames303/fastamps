import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function StepClient({ form, setForm }) {
  const update = (k, v) => setForm({ ...form, [k]: v });
  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Campaign name *</Label>
          <Input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Q3 Construction Outreach" />
        </div>
        <div className="space-y-1.5">
          <Label>Client name *</Label>
          <Input value={form.client_name} onChange={(e) => update("client_name", e.target.value)} placeholder="Acme Ltd" />
        </div>
        <div className="space-y-1.5">
          <Label>Client reference</Label>
          <Input value={form.client_reference} onChange={(e) => update("client_reference", e.target.value)} placeholder="ACME-2026-01" />
        </div>
        <div className="space-y-1.5">
          <Label>Reporting frequency</Label>
          <select className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={form.reporting_frequency} onChange={(e) => update("reporting_frequency", e.target.value)}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="fortnightly">Fortnightly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Objective</Label>
        <Input value={form.objective} onChange={(e) => update("objective", e.target.value)} placeholder="Book 10 meetings with residential developers" />
      </div>
      <div className="space-y-1.5">
        <Label>Offer / proposition</Label>
        <Input value={form.offer} onChange={(e) => update("offer", e.target.value)} placeholder="Free 30-min consultation on compliance" />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Start date *</Label>
          <Input type="date" value={form.start_date} onChange={(e) => update("start_date", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>End date</Label>
          <Input type="date" value={form.end_date} onChange={(e) => update("end_date", e.target.value)} />
        </div>
      </div>
    </div>
  );
}