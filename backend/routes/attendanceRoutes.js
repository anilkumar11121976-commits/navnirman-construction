// Attendance & worker-payroll routes — the crew roster, daily attendance, overtime,
// lunch, payments, settlements, the shared crew link and payroll reports. Mounted at
// the same "/api/sites" prefix as siteRoutes.js (as its own router, ahead of it) so
// none of these URLs changed when this module was split out of siteController.js.
const express = require("express");
const c = require("../controllers/attendanceController");
const { protect } = require("../middleware/auth");
const rateLimit = require("../middleware/rateLimit");
const upload = require("../middleware/upload");

const router = express.Router();

// public: the crew's shared attendance link, for the munshi/supervisor (no login).
// Rate-limited per IP since these need no password — just slows down PIN guessing / spam.
const attendanceLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 120, message: "Too many attempts. Please try again in a few minutes." });
router.get("/attendance/:token", attendanceLimit, c.viewSiteAttendance);
router.post("/attendance/:token/:workerId", attendanceLimit, upload.single("photo"), c.markSiteAttendance);

// everything below is admin only
router.use(protect);

router.get("/attendance-overview", c.getAttendanceOverview);

router.post("/:id/workers", c.addWorker);
router.route("/:id/workers/:workerId").put(c.updateWorker).delete(c.deleteWorker);

router.post("/:id/workers/:workerId/attendance", c.addAttendance);
router.delete("/:id/workers/:workerId/attendance/:attId", c.deleteAttendance);

router.get("/:id/workers/:workerId/report", c.getWorkerReport);

router.post("/:id/workers/:workerId/settle", c.settleWorker);
router.put("/:id/workers/:workerId/unlock", c.unlockWorker);

router.post("/:id/workers/:workerId/payments", c.addWorkerPayment);
router.route("/:id/workers/:workerId/payments/:payId").put(c.updateWorkerPayment).delete(c.deleteWorkerPayment);

router.put("/:id/workers-share", c.updateWorkersShare);

module.exports = router;
