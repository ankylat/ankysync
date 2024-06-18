const express = require("express");
const router = express.Router();

const midjourneyOnAFrame = require("./midjourney-on-a-frame");
const ankyOnAFrame = require("./anky-on-a-frame");
const redirecter = require("./redirecter");
const generatedAnky = require("./generated-anky");
const blood = require("./blood");

router.use("/midjourney-on-a-frame", midjourneyOnAFrame);
router.use("/anky-on-a-frame", ankyOnAFrame);
router.use("/redirecter", redirecter);
router.use("/generated-anky", generatedAnky);
router.use("/blood", blood);

module.exports = router;
