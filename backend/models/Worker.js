const mongoose = require("mongoose");

// A reusable worker profile — created once, then assigned to any number of sites
// without retyping their details. Attendance, pay and balance stay per-site
// (on Site.workers), this is just the shared identity + default wage settings.
const workerProfileSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: "", trim: true },
    role: { type: String, default: "", trim: true },
    wageType: { type: String, enum: ["daily", "monthly"], default: "daily" },
    wageRate: { type: Number, default: 0, min: 0 },
    workingHours: { type: Number, default: 8, min: 0 },
    overtimeRate: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true }
);

workerProfileSchema.index({ name: 1 });
workerProfileSchema.index({ phone: 1 }, { sparse: true });

// Finds an existing profile that's probably the same person: matched by phone when one
// is given (the stronger signal), else by an exact case-insensitive name match.
workerProfileSchema.statics.findDuplicate = function (name, phone, excludeId = null) {
  const filter = excludeId ? { _id: { $ne: excludeId } } : {};
  const trimmedPhone = (phone || "").trim();
  if (trimmedPhone) {
    return this.findOne({ ...filter, phone: trimmedPhone });
  }
  const escaped = (name || "").trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!escaped) return Promise.resolve(null);
  return this.findOne({ ...filter, name: new RegExp(`^${escaped}$`, "i") });
};

module.exports = mongoose.model("Worker", workerProfileSchema);
