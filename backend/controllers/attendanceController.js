// Attendance & worker-payroll module: everything about labour on a site — the
// worker roster, daily attendance, overtime, lunch, payments, settlements, the
// crew's shared attendance link, and date-range payroll reports. Site CRUD,
// stages/materials/expenses and the client-facing share link live in
// siteController.js instead; both share utils/sitePresenter.js so a site looks
// the same shape everywhere.
const crypto = require("crypto");
const Site = require("../models/Site");
const Worker = require("../models/Worker");
const { pick, toBool } = require("../utils/helpers");
const { destroyImages } = require("../utils/images");
const { present } = require("../utils/sitePresenter");
const { currentRates, entryGross, workerGross, lunchUpto, paidUpto } = require("../utils/payroll");

const load = async (req, res) => {
  const site = await Site.findById(req.params.id);
  if (!site) res.status(404).json({ success: false, message: "Site not found" });
  return site;
};

const findWorker = (site, workerId) => site.workers.id(workerId);

const cleanWorker = (b) => {
  const d = pick(b, ["name", "phone", "role", "wageType", "status"]);
  if (b.wageRate !== undefined) d.wageRate = Number(b.wageRate) || 0;
  if (b.workingHours !== undefined) d.workingHours = Number(b.workingHours) || 0;
  if (b.overtimeRate !== undefined) d.overtimeRate = Number(b.overtimeRate) || 0; // 0 = auto (dailyRate / workingHours)
  return d;
};

/* ---------- payroll overview (the admin Attendance page table) ---------- */

// GET /api/sites/attendance-overview?from=&to=&siteId=
// Every worker across every site (or one site), with that period's attendance
// counts and pay. Lunch is a benefit — it's ADDED to what's owed, not subtracted.
const getAttendanceOverview = async (req, res, next) => {
  try {
    const from = (req.query.from || "").slice(0, 10) || null;
    const to = (req.query.to || "").slice(0, 10) || null;
    const inRange = (d) => (!from || d >= from) && (!to || d <= to);

    const query = req.query.siteId ? { _id: req.query.siteId } : {};
    const sites = await Site.find(query, { name: 1, location: 1, workers: 1 }).sort({ name: 1 });

    const rows = [];
    sites.forEach((site) => {
      site.workers.forEach((w) => {
        const entries = w.attendance.filter((a) => inRange(a.date));
        const counts = { present: 0, half_day: 0, absent: 0, leave: 0 };
        let overtimeHours = 0;
        let earned = 0;
        let lunch = 0;
        entries.forEach((a) => {
          counts[a.status] = (counts[a.status] || 0) + 1;
          overtimeHours += a.overtimeHours || 0;
          earned += entryGross(a, w);
          lunch += a.lunchAmount || 0;
        });
        earned = Math.round(earned);
        lunch = Math.round(lunch);
        const paid = Math.round(
          w.payments
            .filter((p) => inRange(new Date(p.date).toISOString().slice(0, 10)))
            .reduce((sum, p) => sum + p.amount, 0)
        );
        const diff = earned + lunch - paid; // lunch is added, not deducted
        const rates = currentRates(w);
        rows.push({
          siteId: site._id,
          siteName: site.name,
          siteLocation: site.location,
          workerId: w._id,
          name: w.name,
          role: w.role,
          phone: w.phone,
          status: w.status,
          lockedThrough: w.lockedThrough,
          days: entries.length,
          counts,
          overtimeHours,
          overtimeRate: Math.round(rates.overtimeRate * 100) / 100,
          earned,
          lunch,
          paid,
          due: Math.max(diff, 0),
          advance: Math.max(-diff, 0),
        });
      });
    });

    res.json({ success: true, from, to, rows });
  } catch (err) {
    next(err);
  }
};

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

    const rates = currentRates(worker);

    res.json({
      success: true,
      site: { name: site.name, location: site.location },
      worker: {
        _id: worker._id, name: worker.name, role: worker.role, phone: worker.phone,
        wageType: worker.wageType, wageRate: worker.wageRate, workingHours: worker.workingHours,
        overtimeRate: Math.round(rates.overtimeRate * 100) / 100,
      },
      report: {
        from, to,
        days: entries.length,
        counts,
        overtimeHours,
        earned,
        lunch, // added to pay, not deducted
        paid,
        balance: earned + lunch - paid,
        entries: entries.map(({ _id, date, status, checkIn, overtimeHours, lunchAmount, note }) => ({
          _id, date, status, checkIn, overtimeHours, lunchAmount, note,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
};

/* ---------- workers (labour) ---------- */

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

/* ---------- attendance ---------- */

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
    const balance = earned + lunch - paid; // negative = paid in advance

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

module.exports = {
  getAttendanceOverview,
  getWorkerReport,
  addWorker, updateWorker, deleteWorker,
  addAttendance, deleteAttendance,
  settleWorker, unlockWorker,
  addWorkerPayment, updateWorkerPayment, deleteWorkerPayment,
  updateWorkersShare, viewSiteAttendance, markSiteAttendance,
};
