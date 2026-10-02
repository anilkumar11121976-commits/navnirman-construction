const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

// route uploaded photos into their own Cloudinary folder depending on
// which field they came in on (work-item photos vs. business profile photos)
const folderForField = (fieldname) => {
  if (fieldname === "logo" || fieldname === "cover" || fieldname === "gallery") {
    return "vendorworks/profile";
  }
  if (fieldname === "photo") {
    return "vendorworks/attendance";
  }
  return "vendorworks/works";
};

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: folderForField(file.fieldname),
    allowed_formats: ["jpg", "jpeg", "png", "webp", "avif"],
    transformation: [{ width: 1600, height: 1600, crop: "limit", quality: "auto" }],
  }),
});

const fileFilter = (req, file, cb) => {
  const allowed = /image\/(jpeg|jpg|png|webp|avif)/;
  if (allowed.test(file.mimetype)) return cb(null, true);
  cb(new Error("Only image files (jpg, png, webp, avif) are allowed"));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
});

module.exports = upload;
