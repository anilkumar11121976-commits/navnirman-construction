const express = require("express");
const c = require("../controllers/workerController");
const { protect } = require("../middleware/auth");

const router = express.Router();

// the reusable worker master list is an internal admin tool — no public view
router.use(protect);

router.route("/").get(c.getWorkers).post(c.createWorker);
router.route("/:id").put(c.updateWorker).delete(c.deleteWorker);
router.get("/:id/sites", c.getWorkerSites);

module.exports = router;
