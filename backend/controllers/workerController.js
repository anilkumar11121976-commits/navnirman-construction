const Site = require("../models/Site");
const Worker = require("../models/Worker");
const { presentWorker } = require("../utils/payroll");

const pick = (body, fields) =>
  Object.fromEntries(fields.filter((f) => body[f] !== undefined).map((f) => [f, body[f]]));

const cleanProfile = (b) => {
  const d = pick(b, ["name", "phone", "role", "wageType", "status"]);
  if (b.wageRate !== undefined) d.wageRate = Number(b.wageRate) || 0;
  if (b.workingHours !== undefined) d.workingHours = Number(b.workingHours) || 0;
  if (b.overtimeRate !== undefined) d.overtimeRate = Number(b.overtimeRate) || 0;
  return d;
};

// GET /api/workers — the reusable worker list: how many sites each is on, and their
// combined due / advance across those sites (each site's own ledger stays separate).
const getWorkers = async (req, res, next) => {
  try {
    const profiles = await Worker.find().sort({ name: 1 });
    const sites = await Site.find(
      { "workers.profileId": { $in: profiles.map((p) => p._id) } },
      { workers: 1 }
    );

    const list = profiles.map((p) => {
      let siteCount = 0;
      let due = 0;
      let advance = 0;
      sites.forEach((s) => {
        const match = s.workers.find((w) => w.profileId && String(w.profileId) === String(p._id));
        if (match) {
          siteCount += 1;
          const presented = presentWorker(match);
          due += presented.due;
          advance += presented.advance;
        }
      });
      return { ...p.toObject(), siteCount, due, advance };
    });

    res.json({ success: true, workers: list });
  } catch (err) {
    next(err);
  }
};

// POST /api/workers
const createWorker = async (req, res, next) => {
  try {
    if (!req.body.name || !req.body.name.trim()) {
      return res.status(400).json({ success: false, message: "Worker name is required" });
    }
    const dupe = await Worker.findDuplicate(req.body.name, req.body.phone);
    if (dupe) {
      return res.status(409).json({
        success: false,
        message: `"${dupe.name}" is already in your worker list${dupe.phone ? ` (${dupe.phone})` : ""}. Pick them from the list instead of adding again.`,
      });
    }
    const worker = await Worker.create(cleanProfile(req.body));
    res.status(201).json({ success: true, worker });
  } catch (err) {
    next(err);
  }
};

// PUT /api/workers/:id — updates the shared profile's defaults only. Any site a worker
// is already assigned to keeps its own values — edit those from inside that site.
const updateWorker = async (req, res, next) => {
  try {
    if (req.body.name || req.body.phone) {
      const dupe = await Worker.findDuplicate(req.body.name, req.body.phone, req.params.id);
      if (dupe) {
        return res.status(409).json({
          success: false,
          message: `"${dupe.name}" is already in your worker list${dupe.phone ? ` (${dupe.phone})` : ""}. Choose a different name/phone.`,
        });
      }
    }
    const worker = await Worker.findByIdAndUpdate(req.params.id, cleanProfile(req.body), { new: true });
    if (!worker) return res.status(404).json({ success: false, message: "Worker not found" });
    res.json({ success: true, worker });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/workers/:id — removes the shared profile only. It does NOT touch any
// site's own worker record, attendance or payments — those are untouched.
const deleteWorker = async (req, res, next) => {
  try {
    const worker = await Worker.findByIdAndDelete(req.params.id);
    if (!worker) return res.status(404).json({ success: false, message: "Worker not found" });
    res.json({ success: true, message: "Worker profile deleted" });
  } catch (err) {
    next(err);
  }
};

// GET /api/workers/:id/sites — every site this worker is assigned to, with that site's own pay
const getWorkerSites = async (req, res, next) => {
  try {
    const worker = await Worker.findById(req.params.id);
    if (!worker) return res.status(404).json({ success: false, message: "Worker not found" });

    const sites = await Site.find({ "workers.profileId": worker._id }, { name: 1, location: 1, status: 1, workers: 1 });
    const rows = sites.map((s) => {
      const match = s.workers.find((w) => w.profileId && String(w.profileId) === String(worker._id));
      const presented = presentWorker(match);
      return {
        siteId: s._id,
        siteName: s.name,
        siteLocation: s.location,
        siteStatus: s.status,
        workerId: match._id,
        earned: presented.earned,
        lunch: presented.lunch,
        paid: presented.paid,
        due: presented.due,
        advance: presented.advance,
      };
    });

    res.json({ success: true, worker, sites: rows });
  } catch (err) {
    next(err);
  }
};

module.exports = { getWorkers, createWorker, updateWorker, deleteWorker, getWorkerSites };
