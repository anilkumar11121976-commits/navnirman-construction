const express = require("express");
const c = require("../controllers/siteController");
const { protect } = require("../middleware/auth");
// the same multer + Cloudinary upload middleware used by the profile route
const upload = require("../middleware/upload");

const router = express.Router();

// public: the client's private link (no login). Must stay above "/:id".
router.get("/view/:token", c.viewShared);

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

router.post("/:id/updates", upload.array("photos", 10), c.addUpdate);
router.delete("/:id/updates/:updateId", c.deleteUpdate);

router.put("/:id/share", c.updateShare);

module.exports = router;