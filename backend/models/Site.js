const mongoose = require("mongoose");

const imageSchema = new mongoose.Schema({
  url: String,
  publicId: String,
  caption: { type: String, default: "" },
  uploadedAt: { type: Date, default: Date.now },
});

const materialSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  quantity: { type: Number, default: 0 },
  unit: { type: String, default: "" }, // bag, kg, ton, nos, sqft...
  rate: { type: Number, default: null }, // null = price not known yet
  supplier: { type: String, default: "", trim: true },
  location: { type: String, default: "", trim: true }, // where it is stored / where it was used
  status: { type: String, enum: ["planned", "ordered", "delivered", "used"], default: "planned" },
  expectedDate: { type: Date, default: null }, // when it will arrive / be used
  notes: { type: String, default: "" },
});

// Any money spent on a stage that is not a material (labour, transport, machinery rent...)
const expenseSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0 },
  date: { type: Date, default: Date.now },
  note: { type: String, default: "" },
});

const stageSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: "" },
  weight: { type: Number, default: 1, min: 0 }, // how much this stage counts towards overall progress
  status: { type: String, enum: ["pending", "in_progress", "completed"], default: "pending" },
  progress: { type: Number, default: 0, min: 0, max: 100 },
  plannedStart: { type: Date, default: null },
  plannedEnd: { type: Date, default: null },
  actualStart: { type: Date, default: null },
  actualEnd: { type: Date, default: null },
  notes: { type: String, default: "" },
  materials: [materialSchema],
  expenses: [expenseSchema],
  photos: [imageSchema], // photos of this stage, shown to the client
  costVisible: { type: Boolean, default: false }, // show this stage's spend to the client?
});

const paymentSchema = new mongoose.Schema({
  amount: { type: Number, required: true, min: 0 },
  date: { type: Date, default: Date.now },
  mode: { type: String, enum: ["cash", "upi", "bank", "cheque", "other"], default: "cash" },
  reference: { type: String, default: "" }, // cheque no / UTR
  note: { type: String, default: "" },
});

// One entry per calendar day ("YYYY-MM-DD") for a worker — upserted by date.
// dailyRate/overtimeRate are a SNAPSHOT of the worker's wage settings at the moment
// the entry was first created — so editing a worker's wage later never rewrites what
// earlier days were worth. lunchAmount is entered fresh each day (it's a benefit paid
// to the worker that day — ADDED to what's owed to them, on top of wage + overtime).
const attendanceSchema = new mongoose.Schema(
  {
    date: { type: String, required: true }, // "YYYY-MM-DD"
    status: { type: String, enum: ["present", "absent", "half_day", "leave"], default: "present" },
    checkIn: { type: String, default: "" }, // "HH:mm", set by the worker or the admin
    overtimeHours: { type: Number, default: 0, min: 0 },
    lunchAmount: { type: Number, default: 0, min: 0 }, // ₹ given to this worker for lunch that day — added to pay
    note: { type: String, default: "" },
    markedBy: { type: String, enum: ["worker", "admin"], default: "worker" },
    markedByName: { type: String, default: "", trim: true }, // who actually filled it in, on the public link
    dailyRate: { type: Number, default: null }, // snapshot: effective per-day wage on this date
    overtimeRate: { type: Number, default: null }, // snapshot: ₹/hour on this date
    locked: { type: Boolean, default: false }, // true once covered by a settlement — can't edit/delete
    photo: { url: String, publicId: String }, // optional selfie, taken on the public link
    location: { lat: Number, lng: Number }, // optional GPS, taken on the public link
  },
  { timestamps: true }
);

const workerPaymentSchema = new mongoose.Schema({
  amount: { type: Number, required: true, min: 0 },
  date: { type: Date, default: Date.now },
  mode: { type: String, enum: ["cash", "upi", "bank", "cheque", "other"], default: "cash" },
  note: { type: String, default: "" },
});

// A snapshot taken when the admin "closes the hisaab" up to a date — for record-keeping.
// Attendance up to toDate gets locked once this is created.
const settlementSchema = new mongoose.Schema(
  {
    toDate: { type: String, required: true }, // "YYYY-MM-DD" — everything up to and including this is locked
    days: { type: Number, default: 0 },
    earned: { type: Number, default: 0 }, // gross: wage + overtime, before lunch
    lunch: { type: Number, default: 0 }, // total lunch benefit for the period — added to pay
    paid: { type: Number, default: 0 },
    balance: { type: Number, default: 0 }, // earned + lunch - paid. Negative = paid in advance.
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

const workerSchema = new mongoose.Schema(
  {
    // Links back to the reusable Worker profile this was assigned from (if any) —
    // so the same person can be added to other sites without retyping their details.
    // Attendance, pay and balance always stay on THIS site-worker, never on the profile.
    profileId: { type: mongoose.Schema.Types.ObjectId, ref: "Worker", default: null },
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: "", trim: true },
    role: { type: String, default: "", trim: true }, // mason, helper, electrician...
    wageType: { type: String, enum: ["daily", "monthly"], default: "daily" },
    wageRate: { type: Number, default: 0, min: 0 }, // per day, or per month if wageType is "monthly"
    workingHours: { type: Number, default: 8, min: 0 }, // standard hours per day, before overtime
    // ₹ per overtime hour. 0/empty means "auto" — calculated as dailyRate / workingHours.
    overtimeRate: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    attendance: [attendanceSchema],
    payments: [workerPaymentSchema],
    settlements: [settlementSchema],
    lockedThrough: { type: String, default: null }, // "YYYY-MM-DD" — attendance up to here can't be edited
  },
  { timestamps: true }
);

const updateSchema = new mongoose.Schema({
  stageId: { type: mongoose.Schema.Types.ObjectId, default: null },
  text: { type: String, default: "" },
  photos: [imageSchema],
  date: { type: Date, default: Date.now },
});

const siteSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // e.g. "Sharma Residence"
    clientName: { type: String, default: "", trim: true },
    clientPhone: { type: String, default: "", trim: true },
    location: { type: String, default: "", trim: true },
    status: { type: String, enum: ["planning", "ongoing", "on_hold", "completed"], default: "ongoing" },
    startDate: { type: Date, default: null },
    expectedEndDate: { type: Date, default: null },
    contractValue: { type: Number, default: 0, min: 0 }, // total agreed amount
    notes: { type: String, default: "" },
    stages: [stageSchema],
    payments: [paymentSchema],
    updates: [updateSchema],
    workers: [workerSchema],
    // private link so the client can view progress without logging in
    share: {
      token: { type: String, default: null },
      enabled: { type: Boolean, default: false },
      showMaterials: { type: Boolean, default: false },
    },
    // one link for the whole crew's attendance — meant for the munshi/supervisor to
    // mark everyone from a single page. No login, no salary shown.
    workersShare: {
      token: { type: String, default: null },
      enabled: { type: Boolean, default: false },
      pin: { type: String, default: null }, // optional 4-digit PIN gate
    },
  },
  { timestamps: true }
);

siteSchema.index({ "share.token": 1 }, { sparse: true });
siteSchema.index({ "workersShare.token": 1 }, { sparse: true });
siteSchema.index({ "workers.profileId": 1 }, { sparse: true });
siteSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("Site", siteSchema);