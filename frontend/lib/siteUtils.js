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