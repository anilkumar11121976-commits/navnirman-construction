const { presentWorker } = require("./payroll");

// Build the API shape: totals, per-stage cost, worker pay and (optionally) the
// client-safe view. Shared by siteController (site CRUD) and attendanceController
// (worker/attendance mutations) so both return the same site shape after a change.
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

module.exports = { present };
