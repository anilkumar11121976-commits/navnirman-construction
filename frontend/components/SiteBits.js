"use client";
import { useState } from "react";
import { Box, Dialog, IconButton, LinearProgress, Paper, Typography } from "@mui/material";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import { tokens } from "@/lib/theme";
import { imgUrl } from "@/lib/api";

export function ProgressBar({ value = 0, height = 8 }) {
  const v = Math.min(100, Math.max(0, value || 0));
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
      <LinearProgress
        variant="determinate"
        value={v}
        sx={{
          flex: 1,
          height,
          borderRadius: height,
          bgcolor: "#ece8df",
          "& .MuiLinearProgress-bar": { bgcolor: tokens.rust, borderRadius: height },
        }}
      />
      <Typography sx={{ fontWeight: 700, fontSize: "0.85rem", minWidth: 40, textAlign: "right" }}>{v}%</Typography>
    </Box>
  );
}

export function StatCard({ label, value, note, color }) {
  return (
    <Paper elevation={0} sx={{ p: 2.5, border: `1px solid ${tokens.line}`, height: "100%" }}>
      <Typography sx={{ color: "#6b665c", fontWeight: 600, fontSize: "0.82rem", mb: 0.5 }}>{label}</Typography>
      <Typography
        sx={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.5rem", color: color || tokens.rust }}
      >
        {value}
      </Typography>
      {note && <Typography sx={{ color: "#6b665c", fontSize: "0.78rem", mt: 0.25 }}>{note}</Typography>}
    </Paper>
  );
}

/**
 * Thumbnail grid with a click-to-enlarge viewer.
 * Pass onDelete(photo) in the admin area to show a delete button on each thumbnail.
 */
export function PhotoGrid({ photos = [], onDelete, size = 110 }) {
  const [view, setView] = useState(null);
  if (!photos.length) return null;

  return (
    <>
      <Box sx={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${size}px, 1fr))`, gap: 1, mt: 1.5 }}>
        {photos.map((p, i) => (
          <Box
            key={p._id || p.publicId || i}
            onClick={() => setView(p)}
            sx={{
              position: "relative",
              aspectRatio: "1 / 1",
              overflow: "hidden",
              borderRadius: 1,
              border: `1px solid ${tokens.line}`,
              cursor: "zoom-in",
            }}
          >
            <img
              src={imgUrl(p)}
              alt={p.caption || "Site photo"}
              loading="lazy"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
            {onDelete && (
              <IconButton
                size="small"
                aria-label="Delete photo"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(p);
                }}
                sx={{ position: "absolute", top: 4, right: 4, bgcolor: "rgba(255,255,255,0.92)", "&:hover": { bgcolor: "#fff" } }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
        ))}
      </Box>

      <Dialog open={!!view} onClose={() => setView(null)} maxWidth="lg">
        {view && (
          <Box>
            <img
              src={imgUrl(view)}
              alt={view.caption || "Site photo"}
              style={{ display: "block", maxWidth: "100%", maxHeight: "80vh", margin: "0 auto" }}
            />
            {view.caption && <Typography sx={{ p: 1.5, textAlign: "center" }}>{view.caption}</Typography>}
          </Box>
        )}
      </Dialog>
    </>
  );
}