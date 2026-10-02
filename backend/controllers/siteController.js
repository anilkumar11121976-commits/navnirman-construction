const crypto = require("crypto");
const cloudinary = require("../config/cloudinary");
const Site = require("../models/Site");
const Worker = require("../models/Worker");
const { currentRates, entryGross, workerGross, lunchUpto, paidUpto, presentWorker } = require("../utils/payroll");

const DEFAULT_STAGES = [
  "Excavation & foundation",
  "Plinth & DPC",
  "Columns, beams & slab",
  "Brickwork",
  "Plastering",
  "Electrical & plumbing",
  "Flooring & tiling",
  "Painting",
  "Finishing & handover",
];

/* ---------- helpers ---------- */

const pick = (body, fields) =>
  Object.fromEntries(fields.filter((f) => body[f] !== undefined).map((f) => [f, body[f]]));

const dateFields = (body, fields, out) =>
  fields.forEach((f) => {
    if (body[f] !== undefined) out[f] = body[f] || null; // "" becomes null
  });

const toBool = (v) => v === true || v === "true";

const cleanSite = (b) => {
  const d = pick(b, ["name", "clientName", "clientPhone", "location", "status", "notes"]);
  if (b.contractValue !== undefined) d.contractValue = Number(b.contractValue) || 0;
  dateFields(b, ["startDate", "expectedEndDate"], d);
  return d;
};

const cleanStage = (b) => {
  const d = pick(b, ["name", "description", "notes", "status"]);
  if (b.weight !== undefined) d.weight = Number(b.weight) || 1;
  if (b.progress !== undefined) d.progress = Math.min(100, Math.max(0, Number(b.progress) || 0));
  if (b.costVisible !== undefined) d.costVisible = toBool(b.costVisible);
  dateFields(b, ["plannedStart", "plannedEnd", "actualStart", "actualEnd"], d);
  return d;
};

const cleanMaterial = (b) => {
  const d = pick(b, ["name", "unit", "supplier", "location", "status", "notes"]);
  if (b.quantity !== undefined) d.quantity = Number(b.quantity) || 0;
  if (b.rate !== undefined) d.rate = b.rate === "" || b.rate === null ? null : Number(b.rate);
  dateFields(b, ["expectedDate"], d);
  return d;
};

// Keep progress and status consistent with each other
const syncStage = (st, body = {}) => {
  if (body.status === "completed" && body.progress === undefined) st.progress = 100;
  if (st.progress >= 100) {
    st.status = "completed";
    st.actualEnd = st.actualEnd || new Date();
  } else if (st.progress > 0 && st.status !== "in_progress") {
    st.status = "in_progress";
    st.actualStart = st.actualStart || new Date();
  }
};

const toImages = (files = []) => files.map((f) => ({ url: f.path, publicId: f.filename }));
const destroyImages = (imgs = []) =>
  Promise.all(imgs.map((i) => i.publicId && cloudinary.uploader.destroy(i.publicId).catch(() => {})));
const siteImages = (site) => [
  ...site.updates.flatMap((u) => u.photos),
  ...site.stages.flatMap((st) => st.photos),
];

const load = async (req, res) => {
  const site = await Site.findById(req.params.id);
  if (!site) res.status(404).json({ success: false, message: "Site not found" });
  return site;
};

// Build the API shape: totals, per-stage cost and (optionally) the client-safe view
const present = (doc, forClient = false) => {
  const s = doc.toObject();

  const totalWeight = s.stages.reduce((a, st) => a + (st.weight ?? 1), 0) || 1;
  s.overallProgress = Math.round(
    s.stages.reduce((a, st) => a + (st.progress || 0) * (st.weight ?? 1), 0) / totalWeight
  );
  s.paid = s.payments.reduce((a, p) => a + p.amount, 0);
  s.unpaid = Math.max(s.contractValue - s.paid, 0);

  const cost = { materials: 0, other: 0, total: 0, pricePending: 0 };
  s.stages.forEach((st) => {
    let materials = 0;
    let pending = 0;
    st.materials.forEach((m) => {
      if (m.rate == null) pending += 1;
      else {
        m.amount = m.rate * m.quantity;
        materials += m.amount;
      }
    });
    const other = st.expenses.reduce((a, e) => a + e.amount, 0);
    st.cost = { materials, other, total: materials + other, pricePending: pending };
    cost.materials += materials;
    cost.other += other;
    cost.pricePending += pending;
  });
  cost.total = cost.materials + cost.other;
  s.cost = cost;

  s.workers = s.workers.map(presentWorker);

  if (!forClient) return s;

  // The client only gets what is meant for them: no rates, suppliers, internal notes,
  // and a stage's cost only if the admin switched "show cost to client" on for it.
  const showMaterials = s.share.showMaterials;
  return {
    name: s.name,
    clientName: s.clientName,
    location: s.location,
    status: s.status,
    startDate: s.startDate,
    expectedEndDate: s.expectedEndDate,
    overallProgress: s.overallProgress,
    contractValue: s.contractValue,
    paid: s.paid,
    unpaid: s.unpaid,
    payments: s.payments.map(({ date, amount, mode }) => ({ date, amount, mode })),
    stages: s.stages.map((st) => ({
      _id: st._id,
      name: st.name,
      status: st.status,
      progress: st.progress,
      plannedStart: st.plannedStart,
      plannedEnd: st.plannedEnd,
      actualStart: st.actualStart,
      actualEnd: st.actualEnd,
      photos: st.photos.map(({ _id, url, caption, uploadedAt }) => ({ _id, url, caption, uploadedAt })),
      cost: st.costVisible
        ? { materials: st.cost.materials, other: st.cost.other, total: st.cost.total }
        : undefined,
      materials: showMaterials
        ? st.materials.map(({ name, quantity, unit, status, location, expectedDate }) => ({
            name, quantity, unit, status, location, expectedDate,
          }))
        : undefined,
    })),
    updates: s.updates.map(({ _id, stageId, text, photos, date }) => ({
      _id,
      stageId,
      text,
      date,
      photos: photos.map(({ _id: pid, url, caption }) => ({ _id: pid, url, caption })),
    })),
  };
};

/* ---------- sites ---------- */

// GET /api/sites
const getSites = async (req, res, next) => {
  try {
    const query = req.query.status ? { status: req.query.status } : {};
    const sites = await Site.find(query).sort({ createdAt: -1 });
    const list = sites.map((doc) => {
      const s = present(doc);
      return {
        _id: s._id,
        name: s.name,
        clientName: s.clientName,
        location: s.location,
        status: s.status,
        overallProgress: s.overallProgress,
        contractValue: s.contractValue,
        paid: s.paid,
        unpaid: s.unpaid,
        spent: s.cost.total,
        expectedEndDate: s.expectedEndDate,
        workerCount: s.workers.length,
        workersShare: s.workersShare,
      };
    });
    res.json({ success: true, sites: list });
  } catch (err) {
    next(err);
  }
};

// GET /api/sites/:id
const getSite = async (req, res, next) => {
  try {
    const site = await load(req, res);
    if (!site) return;
    res.json({ success: true, site: present(site) });
  } catch (err) {
    next(err);
  }
};

// POST /api/sites
const createSite = async (req, res, next) => {
  try {
    if (!req.body.name || !req.body.name.trim()) {
      return res.status(400).json({ success: false, message: "Site name is required" });
    }
    const data = cleanSite(req.body);
    data.stages = (Array.isArray(req.body.stages) && req.body.stages.length
      ? req.body.stages.map((s) => (typeof s === "string" ? s : s.name))
      : DEFAULT_STAGES
    ).map((name) => ({ name }));
    const site = await Site.create(data);
    res.status(201).json({ success: true, site: present(site) });
  } catch (err) {
    next(err);
  }
};

// PUT /api/sites/:id
const updateSite = async (req, res, next) => {
  try {
    const site = await load(req, res);
    if (!site) return;
    site.set(cleanSite(req.body));
    await site.save();
    res.json({ success: true, site: present(site) });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/sites/:id
const deleteSite = async (req, res, next) => {
  try {
    const site = await load(req, res);
    if (!site) return;
    await destroyImages(siteImages(site));
    await Site.findByIdAndDelete(site._id);
    res.json({ success: true, message: "Site deleted" });
  } catch (err) {
    next(err);
  }
};

/* ---------- stages ---------- */

// POST /api/sites/:id/stages
const addStage = async (req, res, next) => {
  try {
    const site = await load(req, res);
    if (!site) return;
    if (!req.body.name || !req.body.name.trim()) {
      return res.status(400).json({ success: false, message: "Stage name is required" });
    }
    site.stages.push(cleanStage(req.body));
    await site.save();
    res.status(201).json({ success: true, site: present(site) });
  } catch (err) {
    next(err);
  }
};

// PUT /api/sites/:id/stages/:stageId   (also used to toggle costVisible)
const updateStage = async (req, res, next) => {
  try {
    const site = await load(req, res);
    if (!site) return;
    const stage = site.stages.id(req.params.stageId);
    if (!stage) return res.status(404).json({ success: false, message: "Stage not found" });
    stage.set(cleanStage(req.body));
    syncStage(stage, req.body);
    await site.save();
    res.json({ success: true, site: present(site) });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/sites/:id/stages/:stageId
const deleteStage = async (req, res, next) => {
  try {
    const site = await load(req, res);
    if (!site) return;
    const stage = site.stages.id(req.params.stageId);
    if (!stage) return res.status(404).json({ success: false, message: "Stage not found" });
    await destroyImages(stage.photos);
    site.stages.pull(stage._id);
    await site.save();
    res.json({ success: true, site: present(site) });
  } catch (err) {
    next(err);
  }
};

/* ---------- stage photos ---------- */

// POST /api/sites/:id/stages/:stageId/photos   (multipart: photos[], caption)
const addStagePhotos = async (req, res, next) => {
  const photos = toImages(req.files);
  try {
    const site = await load(req, res);
    if (!site) return destroyImages(photos);
    const stage = site.stages.id(req.params.stageId);
    if (!stage) {
      await destroyImages(photos);
      return res.status(404).json({ success: false, message: "Stage not found" });
    }
    if (photos.length === 0) {
      return res.status(400).json({ success: false, message: "Choose at least one photo" });
    }
    const caption = (req.body.caption || "").trim();
    photos.forEach((p) => stage.photos.push({ ...p, caption }));
    await site.save();
    res.status(201).json({ success: true, site: present(site) });
  } catch (err) {
    await destroyImages(photos);
    next(err);
  }
};

// DELETE /api/sites/:id/stages/:stageId/photos/:photoId
const deleteStagePhoto = async (req, res, next) => {
  try {
    const site = await load(req, res);
    if (!site) return;
    const stage = site.stages.id(req.params.stageId);
    const photo = stage?.photos.id(req.params.photoId);
    if (!photo) return res.status(404).json({ success: false, message: "Photo not found" });
    await destroyImages([photo]);
    stage.photos.pull(photo._id);
    await site.save();
    res.json({ success: true, site: present(site) });
  } catch (err) {
    next(err);
  }
};

/* ---------- stage expenses (labour, transport, etc.) ---------- */

// POST /api/sites/:id/stages/:stageId/expenses
const addExpense = async (req, res, next) => {
  try {
    const site = await load(req, res);
    if (!site) return;
    const stage = site.stages.id(req.params.stageId);
    if (!stage) return res.status(404).json({ success: false, message: "Stage not found" });
    const amount = Number(req.body.amount);
    if (!req.body.title || !req.body.title.trim()) {
      return res.status(400).json({ success: false, message: "Expense title is required" });
    }
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Enter a valid amount" });
    }
    const e = pick(req.body, ["title", "note"]);
    e.amount = amount;
    if (req.body.date) e.date = req.body.date;
    stage.expenses.push(e);
    await site.save();
    res.status(201).json({ success: true, site: present(site) });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/sites/:id/stages/:stageId/expenses/:expId
const deleteExpense = async (req, res, next) => {
  try {
    const site = await load(req, res);
    if (!site) return;
    const stage = site.stages.id(req.params.stageId);
    const exp = stage?.expenses.id(req.params.expId);
    if (!exp) return res.status(404).json({ success: false, message: "Expense not found" });
    stage.expenses.pull(exp._id);
    await site.save();
    res.json({ success: true, site: present(site) });
  } catch (err) {
    next(err);
  }
};

/* ---------- materials (inside a stage) ---------- */

// POST /api/sites/:id/stages/:stageId/materials
const addMaterial = async (req, res, next) => {
  try {
    const site = await load(req, res);
    if (!site) return;
    const stage = site.stages.id(req.params.stageId);
    if (!stage) return res.status(404).json({ success: false, message: "Stage not found" });
    if (!req.body.name || !req.body.name.trim()) {
      return res.status(400).json({ success: false, message: "Material name is required" });
    }
    stage.materials.push(cleanMaterial(req.body));
    await site.save();
    res.status(201).json({ success: true, site: present(site) });
  } catch (err) {
    next(err);
  }
};

// PUT /api/sites/:id/stages/:stageId/materials/:matId
const updateMaterial = async (req, res, next) => {
  try {
    const site = await load(req, res);
    if (!site) return;
    const mat = site.stages.id(req.params.stageId)?.materials.id(req.params.matId);
    if (!mat) return res.status(404).json({ success: false, message: "Material not found" });
    mat.set(cleanMaterial(req.body));
    await site.save();
    res.json({ success: true, site: present(site) });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/sites/:id/stages/:stageId/materials/:matId
const deleteMaterial = async (req, res, next) => {
  try {
    const site = await load(req, res);
    if (!site) return;
    const stage = site.stages.id(req.params.stageId);
    const mat = stage?.materials.id(req.params.matId);
    if (!mat) return res.status(404).json({ success: false, message: "Material not found" });
    stage.materials.pull(mat._id);
    await site.save();
    res.json({ success: true, site: present(site) });
  } catch (err) {
    next(err);
  }
};

/* ---------- payments received from the client ---------- */

// POST /api/sites/:id/payments
const addPayment = async (req, res, next) => {
  try {
    const site = await load(req, res);
    if (!site) return;
    const amount = Number(req.body.amount);
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Enter a valid payment amount" });
    }
    const p = pick(req.body, ["mode", "reference", "note"]);
    p.amount = amount;
    if (req.body.date) p.date = req.body.date;
    site.payments.push(p);
    await site.save();
    res.status(201).json({ success: true, site: present(site) });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/sites/:id/payments/:payId
const deletePayment = async (req, res, next) => {
  try {
    const site = await load(req, res);
    if (!site) return;
    const pay = site.payments.id(req.params.payId);
    if (!pay) return res.status(404).json({ success: false, message: "Payment not found" });
    site.payments.pull(pay._id);
    await site.save();
    res.json({ success: true, site: present(site) });
  } catch (err) {
    next(err);
  }
};

/* ---------- general progress updates (text + photos) ---------- */

// POST /api/sites/:id/updates   (multipart: text, stageId, photos[])
const addUpdate = async (req, res, next) => {
  const photos = toImages(req.files);
  try {
    const site = await load(req, res);
    if (!site) return destroyImages(photos);
    if (!req.body.text?.trim() && photos.length === 0) {
      return res.status(400).json({ success: false, message: "Add some text or at least one photo" });
    }
    const upd = { text: req.body.text || "", photos };
    if (req.body.stageId && site.stages.id(req.body.stageId)) upd.stageId = req.body.stageId;
    if (req.body.date) upd.date = req.body.date;
    site.updates.unshift(upd); // newest first
    await site.save();
    res.status(201).json({ success: true, site: present(site) });
  } catch (err) {
    await destroyImages(photos);
    next(err);
  }
};

// DELETE /api/sites/:id/updates/:updateId
const deleteUpdate = async (req, res, next) => {
  try {
    const site = await load(req, res);
    if (!site) return;
    const upd = site.updates.id(req.params.updateId);
    if (!upd) return res.status(404).json({ success: false, message: "Update not found" });
    await destroyImages(upd.photos);
    site.updates.pull(upd._id);
    await site.save();
    res.json({ success: true, site: present(site) });
  } catch (err) {
    next(err);
  }
};

/* ---------- workers (labour) ---------- */

const cleanWorker = (b) => {
  const d = pick(b, ["name", "phone", "role", "wageType", "status"]);
  if (b.wageRate !== undefined) d.wageRate = Number(b.wageRate) || 0;
  if (b.workingHours !== undefined) d.workingHours = Number(b.workingHours) || 0;
  if (b.overtimeRate !== undefined) d.overtimeRate = Number(b.overtimeRate) || 0; // 0 = auto (dailyRate / workingHours)
  return d;
};

const findWorker = (site, workerId) => site.workers.id(workerId);

/* ---------- date-range payroll report (for a payslip, a week, 1-15, etc.) ---------- */

// GET /api/sites/:id/workers/:workerId/report?from=YYYY-MM-DD&to=YYYY-MM-DD
// Omit from/to for the worker's whole history. Figures are for THIS period only
// (not the running total) — paid is whatever was recorded as paid within the period.
const getWorkerReport = async (req, res, next) => {
  try {
    const site = await load(req, res);
    if (!site) return;
    const worker = findWorker(site, req.params.workerId);
    if (!worker) return res.status(404).json({ success: false, message: "Worker not found" });

    const from = (req.query.from || "").slice(0, 10) || null;
    const to = (req.query.to || "").slice(0, 10) || null;
    const inRange = (d) => (!from || d >= from) && (!to || d <= to);

    const entries = worker.attendance
      .filter((a) => inRange(a.date))
      .sort((a, b) => (a.date < b.date ? -1 : 1));

    const counts = { present: 0, half_day: 0, absent: 0, leave: 0 };
    let overtimeHours = 0;
    let earned = 0;
    let lunch = 0;
    entries.forEach((a) => {
      counts[a.status] = (counts[a.status] || 0) + 1;
      overtimeHours += a.overtimeHours || 0;
      earned += entryGross(a, worker);
      lunch += a.lunchAmount || 0;
    });
    earned = Math.round(earned);
    lunch = Math.round(lunch);

    const paid = Math.round(
      worker.payments
        .filter((p) => inRange(new Date(p.date).toISOString().slice(0, 10)))
        .reduce((sum, p) => sum + p.amount, 0)
    );

    res.json({
      success: true,
      site: { name: site.name, location: site.location },
      worker: { _id: worker._id, name: worker.name, role: worker.role, phone: worker.phone, wageType: worker.wageType, wageRate: worker.wageRate },
      report: {
        from, to,
        days: entries.length,
        counts,
        overtimeHours,
        earned,
        lunch,
        paid,
        balance: earned - lunch - paid,
        entries: entries.map(({ _id, date, status, checkIn, overtimeHours, lunchAmount, note }) => ({
          _id, date, status, checkIn, overtimeHours, lunchAmount, note,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/sites/:id/workers   { profileId? } — pick an existing worker profile to skip
// retyping their details, or omit it to create one automatically from the submitted fields
// (so the same person can be picked on another site next time without retyping).
const addWorker = async (req, res, next) => {
  try {
    const site = await load(req, res);
    if (!site) return;
    if (!req.body.name || !req.body.name.trim()) {
      return res.status(400).json({ success: false, message: "Worker name is required" });
    }
    const data = cleanWorker(req.body);

    if (req.body.profileId) {
      // picked an existing worker from the list — just make sure they aren't already on this site
      const alreadyOnSite = site.workers.some((w) => w.profileId && String(w.profileId) === String(req.body.profileId));
      if (alreadyOnSite) {
        return res.status(409).json({ success: false, message: "This worker is already added to this site" });
      }
      if (await Worker.exists({ _id: req.body.profileId })) {
        data.profileId = req.body.profileId;
      }
    } else {
      // typed a brand-new name — block an accidental duplicate on this same site...
      const nameClash = site.workers.find((w) => w.name.trim().toLowerCase() === data.name.trim().toLowerCase());
      if (nameClash) {
        return res.status(409).json({ success: false, message: `"${nameClash.name}" is already added to this site` });
      }
      // ...then reuse a matching profile elsewhere instead of creating a duplicate one
      const existingProfile = await Worker.findDuplicate(data.name, data.phone);
      data.profileId = existingProfile ? existingProfile._id : (
        await Worker.create({
          name: data.name,
          phone: data.phone || "",
          role: data.role || "",
          wageType: data.wageType || "daily",
          wageRate: data.wageRate || 0,
          workingHours: data.workingHours ?? 8,
          overtimeRate: data.overtimeRate || 0,
        })
      )._id;
    }

    site.workers.push(data);
    await site.save();
    res.status(201).json({ success: true, site: present(site) });
  } catch (err) {
    next(err);
  }
};

// PUT /api/sites/:id/workers/:workerId
const updateWorker = async (req, res, next) => {
  try {
    const site = await load(req, res);
    if (!site) return;
    const worker = findWorker(site, req.params.workerId);
    if (!worker) return res.status(404).json({ success: false, message: "Worker not found" });
    if (req.body.name && req.body.name.trim()) {
      const nameClash = site.workers.find(
        (w) => String(w._id) !== String(worker._id) && w.name.trim().toLowerCase() === req.body.name.trim().toLowerCase()
      );
      if (nameClash) {
        return res.status(409).json({ success: false, message: `"${nameClash.name}" is already added to this site` });
      }
    }
    worker.set(cleanWorker(req.body));
    await site.save();
    res.json({ success: true, site: present(site) });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/sites/:id/workers/:workerId
const deleteWorker = async (req, res, next) => {
  try {
    const site = await load(req, res);
    if (!site) return;
    const worker = findWorker(site, req.params.workerId);
    if (!worker) return res.status(404).json({ success: false, message: "Worker not found" });
    site.workers.pull(worker._id);
    await site.save();
    res.json({ success: true, site: present(site) });
  } catch (err) {
    next(err);
  }
};

// POST /api/sites/:id/workers/:workerId/attendance   (admin: add/correct an entry for any date)
// Throws a {status, message} error on bad input or a locked/settled date.
// `extra` can carry { photo, location } captured on the public link.
const upsertAttendanceByDate = (worker, body, markedBy, markedByName = "", extra = {}) => {
  const date = (body.date || "").slice(0, 10);
  if (!date) throw Object.assign(new Error("Date is required"), { status: 400 });
  if (worker.lockedThrough && date <= worker.lockedThrough) {
    throw Object.assign(new Error("This date has been settled and locked. Ask the admin to reopen it first."), { status: 409 });
  }

  const entry = pick(body, ["status", "checkIn", "note"]);
  entry.date = date;
  if (body.overtimeHours !== undefined) entry.overtimeHours = Math.max(0, Number(body.overtimeHours) || 0);
  if (body.lunchAmount !== undefined) entry.lunchAmount = Math.max(0, Number(body.lunchAmount) || 0);
  entry.markedBy = markedBy;
  if (markedByName) entry.markedByName = markedByName;
  if (extra.photo) entry.photo = extra.photo;
  if (extra.location) entry.location = extra.location;

  const existing = worker.attendance.find((a) => a.date === date);
  if (existing) {
    existing.set(entry); // keep the originally snapshotted rate — never re-price old days
  } else {
    Object.assign(entry, currentRates(worker)); // snapshot today's rate onto the new entry
    worker.attendance.push(entry);
  }
};

const addAttendance = async (req, res, next) => {
  try {
    const site = await load(req, res);
    if (!site) return;
    const worker = findWorker(site, req.params.workerId);
    if (!worker) return res.status(404).json({ success: false, message: "Worker not found" });
    upsertAttendanceByDate(worker, req.body, "admin", req.admin?.name);
    await site.save();
    res.status(201).json({ success: true, site: present(site) });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    next(err);
  }
};

// DELETE /api/sites/:id/workers/:workerId/attendance/:attId
const deleteAttendance = async (req, res, next) => {
  try {
    const site = await load(req, res);
    if (!site) return;
    const worker = findWorker(site, req.params.workerId);
    const att = worker?.attendance.id(req.params.attId);
    if (!att) return res.status(404).json({ success: false, message: "Attendance entry not found" });
    if (worker.lockedThrough && att.date <= worker.lockedThrough) {
      return res.status(409).json({ success: false, message: "This date has been settled and locked. Ask the admin to reopen it first." });
    }
    worker.attendance.pull(att._id);
    await site.save();
    res.json({ success: true, site: present(site) });
  } catch (err) {
    next(err);
  }
};

/* ---------- settlement (close the hisaab up to a date) ---------- */

// POST /api/sites/:id/workers/:workerId/settle   { toDate, note }
const settleWorker = async (req, res, next) => {
  try {
    const site = await load(req, res);
    if (!site) return;
    const worker = findWorker(site, req.params.workerId);
    if (!worker) return res.status(404).json({ success: false, message: "Worker not found" });

    const toDate = (req.body.toDate || "").slice(0, 10);
    if (!toDate) return res.status(400).json({ success: false, message: "Pick a date to settle up to" });
    if (worker.lockedThrough && toDate <= worker.lockedThrough) {
      return res.status(400).json({ success: false, message: `Already settled up to ${worker.lockedThrough}` });
    }

    // Only this NEW period — from just after the last settlement (if any) up to toDate —
    // so a second settlement doesn't re-count what an earlier one already covered.
    const days = worker.attendance.filter((a) => a.date <= toDate && (!worker.lockedThrough || a.date > worker.lockedThrough)).length;
    const earned = Math.round(workerGross(worker, toDate, worker.lockedThrough));
    const lunch = Math.round(lunchUpto(worker, toDate, worker.lockedThrough));
    const paid = Math.round(paidUpto(worker, toDate, worker.lockedThrough));
    const balance = earned - lunch - paid; // negative = paid in advance

    worker.settlements.push({ toDate, days, earned, lunch, paid, balance, note: req.body.note || "" });
    worker.attendance.forEach((a) => {
      if (a.date <= toDate) a.locked = true;
    });
    worker.lockedThrough = toDate;

    await site.save();
    res.status(201).json({ success: true, site: present(site) });
  } catch (err) {
    next(err);
  }
};

// PUT /api/sites/:id/workers/:workerId/unlock   — undo a settlement lock (keeps the settlement record)
const unlockWorker = async (req, res, next) => {
  try {
    const site = await load(req, res);
    if (!site) return;
    const worker = findWorker(site, req.params.workerId);
    if (!worker) return res.status(404).json({ success: false, message: "Worker not found" });
    worker.lockedThrough = null;
    worker.attendance.forEach((a) => {
      a.locked = false;
    });
    await site.save();
    res.json({ success: true, site: present(site) });
  } catch (err) {
    next(err);
  }
};

/* ---------- worker payments ---------- */

// POST /api/sites/:id/workers/:workerId/payments
const addWorkerPayment = async (req, res, next) => {
  try {
    const site = await load(req, res);
    if (!site) return;
    const worker = findWorker(site, req.params.workerId);
    if (!worker) return res.status(404).json({ success: false, message: "Worker not found" });
    const amount = Number(req.body.amount);
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Enter a valid payment amount" });
    }
    const p = pick(req.body, ["mode", "note"]);
    p.amount = amount;
    if (req.body.date) p.date = req.body.date;
    worker.payments.push(p);
    await site.save();
    res.status(201).json({ success: true, site: present(site) });
  } catch (err) {
    next(err);
  }
};

// PUT /api/sites/:id/workers/:workerId/payments/:payId
const updateWorkerPayment = async (req, res, next) => {
  try {
    const site = await load(req, res);
    if (!site) return;
    const worker = findWorker(site, req.params.workerId);
    const pay = worker?.payments.id(req.params.payId);
    if (!pay) return res.status(404).json({ success: false, message: "Payment not found" });
    if (req.body.amount !== undefined) {
      const amount = Number(req.body.amount);
      if (!amount || amount <= 0) return res.status(400).json({ success: false, message: "Enter a valid payment amount" });
      pay.amount = amount;
    }
    const d = pick(req.body, ["mode", "note"]);
    if (req.body.date) d.date = req.body.date;
    pay.set(d);
    await site.save();
    res.json({ success: true, site: present(site) });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/sites/:id/workers/:workerId/payments/:payId
const deleteWorkerPayment = async (req, res, next) => {
  try {
    const site = await load(req, res);
    if (!site) return;
    const worker = findWorker(site, req.params.workerId);
    const pay = worker?.payments.id(req.params.payId);
    if (!pay) return res.status(404).json({ success: false, message: "Payment not found" });
    worker.payments.pull(pay._id);
    await site.save();
    res.json({ success: true, site: present(site) });
  } catch (err) {
    next(err);
  }
};

/* ---------- the crew's shared attendance link (one per site, for the munshi/supervisor) ---------- */

// PUT /api/sites/:id/workers-share   { enabled, regenerate, pin }
const updateWorkersShare = async (req, res, next) => {
  try {
    const site = await load(req, res);
    if (!site) return;
    if (req.body.enabled !== undefined) site.workersShare.enabled = toBool(req.body.enabled);
    if (!site.workersShare.token || toBool(req.body.regenerate)) {
      site.workersShare.token = crypto.randomBytes(16).toString("hex");
    }
    if (req.body.pin !== undefined) {
      const pin = String(req.body.pin || "").trim();
      if (pin && !/^\d{4}$/.test(pin)) {
        return res.status(400).json({ success: false, message: "PIN must be exactly 4 digits" });
      }
      site.workersShare.pin = pin || null;
    }
    await site.save();
    res.json({ success: true, workersShare: site.workersShare });
  } catch (err) {
    next(err);
  }
};

const findSharedSite = (token) => Site.findOne({ "workersShare.token": token, "workersShare.enabled": true });
const pinOk = (share, provided) => !share.pin || share.pin === String(provided || "").trim();

// Last 7 calendar days, today first — the only dates the public link may touch.
const last7Dates = () => {
  const out = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
};

// GET /api/sites/attendance/:token?pin=1234   (public, no login)
// The whole active crew, last 7 days only. No wage/pay figures are ever sent here.
const viewSiteAttendance = async (req, res, next) => {
  try {
    const site = await findSharedSite(req.params.token);
    if (!site) return res.status(404).json({ success: false, message: "This link is invalid or has been turned off" });
    if (!pinOk(site.workersShare, req.query.pin)) {
      return res.status(401).json({ success: false, pinRequired: true, message: "Enter the 4-digit PIN" });
    }
    const window = last7Dates();
    const minDate = window[window.length - 1];
    const workers = site.workers
      .filter((w) => w.status === "active")
      .map((w) => ({
        _id: w._id,
        name: w.name,
        role: w.role,
        lockedThrough: w.lockedThrough,
        attendance: w.attendance
          .filter((a) => a.date >= minDate)
          .map((a) => ({
            _id: a._id, date: a.date, status: a.status, checkIn: a.checkIn,
            overtimeHours: a.overtimeHours, lunchAmount: a.lunchAmount, note: a.note, locked: a.locked,
          })),
      }));
    res.json({ success: true, site: { name: site.name, location: site.location }, window, workers, hasPin: !!site.workersShare.pin });
  } catch (err) {
    next(err);
  }
};

// POST /api/sites/attendance/:token/:workerId   (public, no login — multipart if a photo is attached)
const markSiteAttendance = async (req, res, next) => {
  const photoFile = req.file ? { url: req.file.path, publicId: req.file.filename } : null;
  try {
    const site = await findSharedSite(req.params.token);
    if (!site) {
      if (photoFile) await destroyImages([photoFile]);
      return res.status(404).json({ success: false, message: "This link is invalid or has been turned off" });
    }
    if (!pinOk(site.workersShare, req.body.pin)) {
      if (photoFile) await destroyImages([photoFile]);
      return res.status(401).json({ success: false, pinRequired: true, message: "Enter the 4-digit PIN" });
    }
    const worker = findWorker(site, req.params.workerId);
    if (!worker) {
      if (photoFile) await destroyImages([photoFile]);
      return res.status(404).json({ success: false, message: "Worker not found" });
    }

    const window = last7Dates();
    const date = (req.body.date || "").slice(0, 10);
    if (!window.includes(date)) {
      if (photoFile) await destroyImages([photoFile]);
      return res.status(400).json({ success: false, message: "You can only mark attendance for the last 7 days" });
    }

    const markedByName = (req.body.name || "").trim().slice(0, 60);
    const extra = {};
    if (photoFile) extra.photo = photoFile;
    if (req.body.lat && req.body.lng) extra.location = { lat: Number(req.body.lat), lng: Number(req.body.lng) };

    upsertAttendanceByDate(worker, req.body, "worker", markedByName, extra);
    await site.save();
    const updated = worker.attendance.find((a) => a.date === date);
    res.status(201).json({ success: true, attendance: updated });
  } catch (err) {
    if (photoFile) await destroyImages([photoFile]);
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    next(err);
  }
};

/* ---------- client share link ---------- */

// PUT /api/sites/:id/share   { enabled, showMaterials, regenerate }
const updateShare = async (req, res, next) => {
  try {
    const site = await load(req, res);
    if (!site) return;
    if (req.body.enabled !== undefined) site.share.enabled = toBool(req.body.enabled);
    if (req.body.showMaterials !== undefined) site.share.showMaterials = toBool(req.body.showMaterials);
    if (!site.share.token || toBool(req.body.regenerate)) {
      site.share.token = crypto.randomBytes(16).toString("hex");
    }
    await site.save();
    res.json({ success: true, share: site.share });
  } catch (err) {
    next(err);
  }
};

// GET /api/sites/view/:token   (public, no login)
const viewShared = async (req, res, next) => {
  try {
    const site = await Site.findOne({ "share.token": req.params.token, "share.enabled": true });
    if (!site) return res.status(404).json({ success: false, message: "This link is invalid or has been turned off" });
    res.json({ success: true, site: present(site, true) });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getSites, getSite, createSite, updateSite, deleteSite,
  addStage, updateStage, deleteStage,
  addStagePhotos, deleteStagePhoto,
  addExpense, deleteExpense,
  addMaterial, updateMaterial, deleteMaterial,
  addPayment, deletePayment,
  addUpdate, deleteUpdate,
  addWorker, updateWorker, deleteWorker,
  addAttendance, deleteAttendance,
  getWorkerReport,
  settleWorker, unlockWorker,
  addWorkerPayment, updateWorkerPayment, deleteWorkerPayment,
  updateWorkersShare, viewSiteAttendance, markSiteAttendance,
  updateShare, viewShared,
};