// Shared worker pay calculation — used by both the site controller (per-site worker
// records) and the worker-profile controller (summarising the same worker across sites).

const DAY_MULTIPLIER = { present: 1, half_day: 0.5, absent: 0, leave: 0 };

// The wage/overtime rate that should apply to a NEW attendance entry right now, from the
// worker's current settings. Snapshotted onto the entry so a later wage edit never rewrites
// what earlier days were worth. Overtime rate auto-computes (dailyRate / workingHours) when
// the admin leaves it blank.
const currentRates = (w) => {
  const dailyRate = w.wageType === "monthly" ? w.wageRate / 30 : w.wageRate;
  const overtimeRate = w.overtimeRate > 0 ? w.overtimeRate : w.workingHours > 0 ? dailyRate / w.workingHours : 0;
  return { dailyRate, overtimeRate };
};

// Gross wage + overtime for one entry (no lunch), using its own snapshotted rate — falling
// back to the worker's current rate only for entries saved before dailyRate existed.
const entryGross = (a, w) => {
  const dailyRate = a.dailyRate ?? currentRates(w).dailyRate;
  const overtimeRate = a.overtimeRate ?? currentRates(w).overtimeRate;
  return (DAY_MULTIPLIER[a.status] ?? 0) * dailyRate + (a.overtimeHours || 0) * overtimeRate;
};

// Pass `uptoDate` ("YYYY-MM-DD") to total only entries on or before that date, and/or
// `fromDate` to exclude entries on or before it (both used by settlements, so a second
// settlement only totals the NEW period instead of re-counting what was already settled).
const workerGross = (w, uptoDate = null, fromDate = null) =>
  w.attendance.reduce((sum, a) => {
    if (uptoDate && a.date > uptoDate) return sum;
    if (fromDate && a.date <= fromDate) return sum;
    return sum + entryGross(a, w);
  }, 0);

const lunchUpto = (w, uptoDate = null, fromDate = null) =>
  w.attendance.reduce((sum, a) => {
    if (uptoDate && a.date > uptoDate) return sum;
    if (fromDate && a.date <= fromDate) return sum;
    return sum + (a.lunchAmount || 0);
  }, 0);

const paidUpto = (w, uptoDate = null, fromDate = null) =>
  w.payments.reduce((sum, p) => {
    const d = new Date(p.date).toISOString().slice(0, 10);
    if (uptoDate && d > uptoDate) return sum;
    if (fromDate && d <= fromDate) return sum;
    return sum + p.amount;
  }, 0);

const presentWorker = (w) => {
  const wk = w.toObject ? w.toObject() : w;
  const earned = Math.round(workerGross(wk)); // gross: wage + overtime
  const lunch = Math.round(lunchUpto(wk)); // total lunch cost deducted
  const paid = Math.round(paidUpto(wk));
  const diff = earned - lunch - paid; // positive = still owed, negative = paid in advance
  const counts = { present: 0, absent: 0, half_day: 0, leave: 0 };
  let overtimeHours = 0;
  wk.attendance.forEach((a) => {
    counts[a.status] = (counts[a.status] || 0) + 1;
    overtimeHours += a.overtimeHours || 0;
  });
  wk.earned = earned;
  wk.lunch = lunch;
  wk.paid = paid;
  wk.due = Math.max(diff, 0);
  wk.advance = Math.max(-diff, 0);
  wk.daysLogged = wk.attendance.length;
  wk.counts = counts;
  wk.overtimeHours = overtimeHours;
  wk.attendance = [...wk.attendance].sort((a, b) => (a.date < b.date ? 1 : -1));
  wk.settlements = [...wk.settlements].sort((a, b) => (a.toDate < b.toDate ? 1 : -1));
  return wk;
};

module.exports = { DAY_MULTIPLIER, currentRates, entryGross, workerGross, lunchUpto, paidUpto, presentWorker };
