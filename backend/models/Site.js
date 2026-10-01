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
    // private link so the client can view progress without logging in
    share: {
      token: { type: String, default: null },
      enabled: { type: Boolean, default: false },
      showMaterials: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

siteSchema.index({ "share.token": 1 }, { sparse: true });
siteSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("Site", siteSchema);