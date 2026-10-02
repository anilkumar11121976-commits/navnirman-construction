const cloudinary = require("../config/cloudinary");

const destroyImages = (imgs = []) =>
  Promise.all(imgs.map((i) => i.publicId && cloudinary.uploader.destroy(i.publicId).catch(() => {})));

module.exports = { destroyImages };
