// Tiny request-body helpers shared across controllers.

const pick = (body, fields) =>
  Object.fromEntries(fields.filter((f) => body[f] !== undefined).map((f) => [f, body[f]]));

const dateFields = (body, fields, out) =>
  fields.forEach((f) => {
    if (body[f] !== undefined) out[f] = body[f] || null; // "" becomes null
  });

const toBool = (v) => v === true || v === "true";

module.exports = { pick, dateFields, toBool };
