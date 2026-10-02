export const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");

export const fdate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "–";

// <input type="date"> ko yyyy-mm-dd chahiye
export const dateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

export const withDates = (obj, keys) => {
  const out = { ...obj };
  keys.forEach((k) => {
    out[k] = dateInput(obj?.[k]);
  });
  return out;
};

export const SITE_STATUS = [
  { value: "planning", label: "Planning" },
  { value: "ongoing", label: "Ongoing" },
  { value: "on_hold", label: "On hold" },
  { value: "completed", label: "Completed" },
];

export const STAGE_STATUS = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
];

export const MATERIAL_STATUS = [
  { value: "planned", label: "Planned" },
  { value: "ordered", label: "Ordered" },
  { value: "delivered", label: "Delivered at site" },
  { value: "used", label: "Used" },
];

export const PAY_MODES = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "bank", label: "Bank transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Other" },
];

export const STAGE_COLOR = { pending: "default", in_progress: "warning", completed: "success" };
export const SITE_COLOR = { planning: "default", ongoing: "warning", on_hold: "error", completed: "success" };
export const MAT_COLOR = { planned: "default", ordered: "info", delivered: "warning", used: "success" };

export const labelOf = (list, value) => list.find((o) => o.value === value)?.label || value;

/* ---------- workers / attendance / payroll ---------- */

export const WAGE_TYPES = [
  { value: "daily", label: "Per day" },
  { value: "monthly", label: "Per month" },
];

export const WORKER_STATUS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export const ATTENDANCE_STATUS = [
  { value: "present", label: "Present" },
  { value: "half_day", label: "Half day" },
  { value: "absent", label: "Absent" },
  { value: "leave", label: "Leave" },
];

export const ATTENDANCE_COLOR = { present: "success", half_day: "warning", absent: "error", leave: "default" };

// <input type="date"> ke liye aaj ki date
export const todayInput = () => dateInput(new Date());

// Quick-tap chip amounts on the crew attendance link
export const OT_QUICK_HOURS = [1, 2, 3, 4];
export const LUNCH_QUICK_AMOUNTS = [30, 50, 80, 100];

// Auto overtime rate when the admin leaves it blank: a day's wage spread over working hours
export const autoOvertimeRate = (wageType, wageRate, workingHours) => {
  const dailyRate = wageType === "monthly" ? (Number(wageRate) || 0) / 30 : Number(wageRate) || 0;
  const hours = Number(workingHours) || 0;
  return hours > 0 ? Math.round((dailyRate / hours) * 100) / 100 : 0;
};

/* ---------- payroll report periods ---------- */

const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const iso = (d) => dateInput(d);

export const PERIOD_PRESETS = [
  {
    label: "This week",
    range: () => {
      const now = new Date();
      const day = now.getDay(); // 0 = Sunday
      const mondayOffset = day === 0 ? -6 : 1 - day;
      const start = addDays(now, mondayOffset);
      return { from: iso(start), to: iso(now) };
    },
  },
  {
    label: "1st – 15th",
    range: () => {
      const now = new Date();
      return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(new Date(now.getFullYear(), now.getMonth(), 15)) };
    },
  },
  {
    label: "16th – month end",
    range: () => {
      const now = new Date();
      return { from: iso(new Date(now.getFullYear(), now.getMonth(), 16)), to: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
    },
  },
  {
    label: "This month",
    range: () => {
      const now = new Date();
      return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
    },
  },
  { label: "All time", range: () => ({ from: "", to: "" }) },
];

// Turns an array of plain objects into a downloadable CSV file.
export const downloadCsv = (filename, rows) => {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};