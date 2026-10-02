const express = require("express");
const c = require("../controllers/siteController");
const { protect } = require("../middleware/auth");
const rateLimit = require("../middleware/rateLimit");
// the same multer + Cloudinary upload middleware used by the profile route
const upload = require("../middleware/upload");

const router = express.Router();

// public: the client's private link (no login). Must stay above "/:id".
router.get("/view/:token", c.viewShared);

// public: the crew's shared attendance link, for the munshi/supervisor (no login). Must stay above "/:id".
// Rate-limited per IP since these need no password — just slows down PIN guessing / spam.
const attendanceLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 120, message: "Too many attempts. Please try again in a few minutes." });
router.get("/attendance/:token", attendanceLimit, c.viewSiteAttendance);
router.post("/attendance/:token/:workerId", attendanceLimit, upload.single("photo"), c.markSiteAttendance);

// everything below is admin only
router.use(protect);

router.route("/").get(c.getSites).post(c.createSite);
router.route("/:id").get(c.getSite).put(c.updateSite).delete(c.deleteSite);

router.post("/:id/stages", c.addStage);
router.route("/:id/stages/:stageId").put(c.updateStage).delete(c.deleteStage);

router.post("/:id/stages/:stageId/photos", upload.array("photos", 10), c.addStagePhotos);
router.delete("/:id/stages/:stageId/photos/:photoId", c.deleteStagePhoto);

router.post("/:id/stages/:stageId/expenses", c.addExpense);
router.delete("/:id/stages/:stageId/expenses/:expId", c.deleteExpense);

router.post("/:id/stages/:stageId/materials", c.addMaterial);
router.route("/:id/stages/:stageId/materials/:matId").put(c.updateMaterial).delete(c.deleteMaterial);

router.post("/:id/payments", c.addPayment);
router.delete("/:id/payments/:payId", c.deletePayment);

router.post("/:id/workers", c.addWorker);
router.route("/:id/workers/:workerId").put(c.updateWorker).delete(c.deleteWorker);

router.post("/:id/workers/:workerId/attendance", c.addAttendance);
router.delete("/:id/workers/:workerId/attendance/:attId", c.deleteAttendance);

router.get("/:id/workers/:workerId/report", c.getWorkerReport);

router.post("/:id/workers/:workerId/settle", c.settleWorker);
router.put("/:id/workers/:workerId/unlock", c.unlockWorker);

router.post("/:id/workers/:workerId/payments", c.addWorkerPayment);
router.route("/:id/workers/:workerId/payments/:payId").put(c.updateWorkerPayment).delete(c.deleteWorkerPayment);

router.post("/:id/updates", upload.array("photos", 10), c.addUpdate);
router.delete("/:id/updates/:updateId", c.deleteUpdate);

router.put("/:id/share", c.updateShare);
router.put("/:id/workers-share", c.updateWorkersShare);

module.exports = router;