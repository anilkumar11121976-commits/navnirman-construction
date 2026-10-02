"use client";
import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Typography, Button, Stack, Paper, IconButton, Alert, Chip, Dialog, DialogTitle, DialogContent,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/EditOutlined";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import VisibilityIcon from "@mui/icons-material/VisibilityOutlined";
import api from "@/lib/api";
import { tokens } from "@/lib/theme";
import FormDialog from "@/components/FormDialog";
import { WAGE_TYPES, WORKER_STATUS, inr, labelOf } from "@/lib/siteUtils";

const PROFILE_FIELDS = [
  { name: "name", label: "Worker name", required: true },
  { name: "phone", label: "Phone" },
  { name: "role", label: "Role (e.g. Mason, Helper, Electrician)" },
  { name: "wageType", label: "Default wage type", type: "select", options: WAGE_TYPES },
  { name: "wageRate", label: "Default wage rate (₹)", type: "number", helperText: "Used to pre-fill when you add them to a site — each site can still adjust it" },
  { name: "workingHours", label: "Default working hours / day", type: "number" },
  { name: "overtimeRate", label: "Default overtime rate (₹/hr)", type: "number", helperText: "Leave empty for auto" },
  { name: "status", label: "Status", type: "select", options: WORKER_STATUS },
];

function SitesDialog({ workerId, onClose }) {
  const { data, isLoading } = useQuery({
    queryKey: ["worker-sites", workerId],
    queryFn: async () => (await api.get(`/workers/${workerId}/sites`)).data,
    enabled: !!workerId,
  });

  return (
    <Dialog open={!!workerId} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{data?.worker?.name ? `Sites: ${data.worker.name}` : "Sites"}</DialogTitle>
      <DialogContent>
        {isLoading && <Typography sx={{ color: "#6b665c" }}>Loading…</Typography>}
        {data?.sites?.length === 0 && <Typography sx={{ color: "#6b665c" }}>Not assigned to any site yet.</Typography>}
        <Stack spacing={1.5} sx={{ mb: 2 }}>
          {data?.sites?.map((s) => (
            <Paper key={s.siteId} elevation={0} sx={{ p: 2, border: `1px solid ${tokens.line}` }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ flexWrap: "wrap", rowGap: 0.5 }}>
                <Box>
                  <Typography component={Link} href={`/admin/sites/${s.siteId}`} sx={{ fontWeight: 700, color: tokens.ink }}>{s.siteName}</Typography>
                  <Typography sx={{ fontSize: "0.8rem", color: "#6b665c" }}>{s.siteLocation}</Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                  {s.due > 0 && <Chip size="small" color="warning" label={`Due ${inr(s.due)}`} />}
                  {s.advance > 0 && <Chip size="small" color="info" label={`Advance ${inr(s.advance)}`} />}
                  {s.due === 0 && s.advance === 0 && <Chip size="small" label="Settled" />}
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminWorkersPage() {
  const qc = useQueryClient();
  const [dlg, setDlg] = useState(null); // { kind: "add"|"edit", worker? }
  const [sitesFor, setSitesFor] = useState(null);
  const [error, setError] = useState("");

  const { data: workers } = useQuery({
    queryKey: ["worker-profiles-full"],
    queryFn: async () => (await api.get("/workers")).data.workers,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["worker-profiles-full"] });

  const createMutation = useMutation({
    mutationFn: (payload) => api.post("/workers", payload),
    onSuccess: () => { invalidate(); setDlg(null); setError(""); },
    onError: (err) => setError(err?.response?.data?.message || "Could not add worker"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => api.put(`/workers/${id}`, payload),
    onSuccess: () => { invalidate(); setDlg(null); setError(""); },
    onError: (err) => setError(err?.response?.data?.message || "Could not update worker"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/workers/${id}`),
    onSuccess: invalidate,
  });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="h4" sx={{ fontSize: "1.6rem" }}>Workers</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDlg({ kind: "add" })}>Add worker</Button>
      </Stack>
      <Typography sx={{ color: "#6b665c", mb: 3 }}>
        Your reusable worker list. Add someone here once, then pick them by name on any site instead of retyping their details.
        Attendance and pay always stay separate per site.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}

      {workers?.length === 0 && (
        <Paper elevation={0} sx={{ p: 4, border: `1px solid ${tokens.line}`, textAlign: "center" }}>
          <Typography sx={{ color: "#6b665c" }}>No workers yet. Add one here, or add one directly from inside a site — either way it shows up here.</Typography>
        </Paper>
      )}

      <Stack spacing={1.5}>
        {workers?.map((w) => (
          <Paper key={w._id} elevation={0} sx={{ p: 2, border: `1px solid ${tokens.line}` }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ flexWrap: "wrap", rowGap: 1 }}>
              <Box>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap", rowGap: 0.5 }}>
                  <Typography sx={{ fontWeight: 700 }}>{w.name}</Typography>
                  {w.role && <Chip size="small" variant="outlined" label={w.role} />}
                  <Chip size="small" color={w.status === "active" ? "success" : "default"} label={labelOf(WORKER_STATUS, w.status)} />
                  <Chip size="small" variant="outlined" label={`${w.siteCount} site${w.siteCount === 1 ? "" : "s"}`} />
                  {w.due > 0 && <Chip size="small" color="warning" label={`Due ${inr(w.due)}`} />}
                  {w.advance > 0 && <Chip size="small" color="info" label={`Advance ${inr(w.advance)}`} />}
                </Stack>
                <Typography sx={{ fontSize: "0.82rem", color: "#6b665c", mt: 0.5 }}>
                  {w.phone} · {w.wageType === "monthly" ? `${inr(w.wageRate)}/month` : `${inr(w.wageRate)}/day`}
                </Typography>
              </Box>
              <Stack direction="row" spacing={0.5}>
                <IconButton size="small" aria-label="View sites" onClick={() => setSitesFor(w._id)}><VisibilityIcon fontSize="small" /></IconButton>
                <IconButton size="small" aria-label="Edit" onClick={() => setDlg({ kind: "edit", worker: w })}><EditIcon fontSize="small" /></IconButton>
                <IconButton
                  size="small"
                  aria-label="Delete"
                  onClick={() => window.confirm(`Remove "${w.name}" from the reusable list? Their existing attendance and pay on any site are kept.`) && deleteMutation.mutate(w._id)}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Stack>
            </Stack>
          </Paper>
        ))}
      </Stack>

      {dlg && (
        <FormDialog
          open
          title={dlg.kind === "add" ? "Add worker" : "Edit worker"}
          fields={PROFILE_FIELDS}
          initial={dlg.kind === "edit" ? dlg.worker : { wageType: "daily", workingHours: 8, status: "active" }}
          onClose={() => setDlg(null)}
          onSubmit={(v) => (dlg.kind === "add" ? createMutation.mutateAsync(v) : updateMutation.mutateAsync({ id: dlg.worker._id, payload: v }))}
        />
      )}

      {sitesFor && <SitesDialog workerId={sitesFor} onClose={() => setSitesFor(null)} />}
    </Box>
  );
}
