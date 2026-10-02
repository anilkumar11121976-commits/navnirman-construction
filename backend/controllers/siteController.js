const crypto = require("crypto");
const Site = require("../models/Site");
const { pick, dateFields, toBool } = require("../utils/helpers");
const { destroyImages } = require("../utils/images");
const { present } = require("../utils/sitePresenter");

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
const siteImages = (site) => [
  ...site.updates.flatMap((u) => u.photos),
  ...site.stages.flatMap((st) => st.photos),
];

const load = async (req, res) => {
  const site = await Site.findById(req.params.id);
  if (!site) res.status(404).json({ success: false, message: "Site not found" });
  return site;
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
  updateShare, viewShared,
};