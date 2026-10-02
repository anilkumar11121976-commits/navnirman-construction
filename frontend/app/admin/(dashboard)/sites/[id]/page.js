"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Autocomplete, Avatar, Box, Button, Chip, Dialog,
  DialogActions, DialogContent, DialogTitle, Divider, FormControlLabel, Grid, IconButton, MenuItem, Paper,
  Slider, Stack, Switch, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AddIcon from "@mui/icons-material/Add";
import AddPhotoIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import PhotoIcon from "@mui/icons-material/PhotoCameraOutlined";
import VisibilityIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOffOutlined";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/EditOutlined";
import PaymentsIcon from "@mui/icons-material/PaymentsOutlined";
import LockIcon from "@mui/icons-material/LockOutlined";
import LockOpenIcon from "@mui/icons-material/LockOpenOutlined";
import ReceiptIcon from "@mui/icons-material/ReceiptLongOutlined";
import PrintIcon from "@mui/icons-material/PrintOutlined";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import DownloadIcon from "@mui/icons-material/DownloadOutlined";
import api from "@/lib/api";
import { tokens } from "@/lib/theme";
import FormDialog from "@/components/FormDialog";
import PayWorkerDialog from "@/components/PayWorkerDialog";
import { PhotoGrid, ProgressBar, StatCard } from "@/components/SiteBits";
import {
  ATTENDANCE_COLOR, ATTENDANCE_STATUS, MAT_COLOR, MATERIAL_STATUS, PAY_MODES, PERIOD_PRESETS, SITE_COLOR,
  SITE_STATUS, STAGE_COLOR, STAGE_STATUS, WAGE_TYPES, WORKER_STATUS,
  autoOvertimeRate, dateInput, downloadCsv, fdate, inr, labelOf, todayInput, withDates,
} from "@/lib/siteUtils";

/* ---------- form field definitions ---------- */

const SITE_FIELDS = [
  { name: "name", label: "Site / project name", required: true },
  { name: "clientName", label: "Client name" },
  { name: "clientPhone", label: "Client phone" },
  { name: "location", label: "Location" },
  { name: "contractValue", label: "Total contract value (₹)", type: "number" },
  { name: "startDate", label: "Start date", type: "date" },
  { name: "expectedEndDate", label: "Expected completion", type: "date" },
  { name: "status", label: "Status", type: "select", options: SITE_STATUS },
  { name: "notes", label: "Internal notes (never shown to the client)", type: "multiline" },
];

const STAGE_FIELDS = [
  { name: "name", label: "Stage name", required: true },
  { name: "description", label: "Description", type: "multiline" },
  { name: "weight", label: "Weight", type: "number", helperText: "Give bigger stages a higher weight. It affects overall progress. Default is 1." },
  { name: "plannedStart", label: "Planned start", type: "date" },
  { name: "plannedEnd", label: "Planned end", type: "date" },
  { name: "status", label: "Status", type: "select", options: STAGE_STATUS },
  { name: "notes", label: "Internal notes", type: "multiline" },
];

const MATERIAL_FIELDS = [
  { name: "name", label: "Material (e.g. Cement, Steel, Bricks)", required: true },
  { name: "quantity", label: "Quantity", type: "number" },
  { name: "unit", label: "Unit (bag, kg, ton, nos, sqft…)" },
  { name: "rate", label: "Rate per unit (₹)", type: "number", helperText: "Leave empty if the price is not known yet" },
  { name: "supplier", label: "Supplier" },
  { name: "location", label: "Where is it now?", helperText: "e.g. Site store, used in slab, supplier godown" },
  { name: "status", label: "Status", type: "select", options: MATERIAL_STATUS },
  { name: "expectedDate", label: "Expected date (arrival / use)", type: "date" },
  { name: "notes", label: "Notes", type: "multiline" },
];

const EXPENSE_FIELDS = [
  { name: "title", label: "What was it for? (e.g. Labour, Transport, Machine rent)", required: true },
  { name: "amount", label: "Amount (₹)", type: "number", required: true },
  { name: "date", label: "Date", type: "date" },
  { name: "note", label: "Note" },
];

const PAYMENT_FIELDS = [
  { name: "amount", label: "Amount received (₹)", type: "number", required: true },
  { name: "date", label: "Date", type: "date" },
  { name: "mode", label: "Mode", type: "select", options: PAY_MODES },
  { name: "reference", label: "Reference (cheque no. / UTR)" },
  { name: "note", label: "Note" },
];

const WORKER_PAYMENT_FIELDS = [
  { name: "amount", label: "Amount paid (₹)", type: "number", required: true },
  { name: "date", label: "Date", type: "date" },
  { name: "mode", label: "Mode", type: "select", options: PAY_MODES },
  { name: "note", label: "Note" },
];

const ATTENDANCE_FIELDS = [
  { name: "date", label: "Date", type: "date", required: true },
  { name: "status", label: "Status", type: "select", options: ATTENDANCE_STATUS },
  { name: "checkIn", label: "Check-in time (e.g. 09:15 AM)" },
  { name: "overtimeHours", label: "Overtime (hours)", type: "number" },
  { name: "lunchAmount", label: "Lunch given (₹)", type: "number", helperText: "Added to the worker's pay" },
  { name: "note", label: "Note" },
];

const cell = { fontSize: "0.82rem", py: 1 };
const statusColor = { pending: "#c9c4b8", in_progress: tokens.rust, completed: "#2e7d32" };

function SectionTitle({ children, action }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
      <Typography sx={{ fontWeight: 700, fontSize: "0.95rem" }}>{children}</Typography>
      {action}
    </Stack>
  );
}

/* ---------- add / edit worker, with a live pay preview ---------- */

function WorkerFormDialog({ open, title, initial, onClose, onSubmit }) {
  const isAdd = !initial;
  const [v, setV] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const { data: profiles } = useQuery({
    queryKey: ["worker-profiles"],
    queryFn: async () => (await api.get("/workers")).data.workers,
    enabled: !!open && isAdd,
  });

  useEffect(() => {
    if (open) {
      setV(initial || { wageType: "daily", workingHours: 8, status: "active" });
      setError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (k, val) => setV((s) => ({ ...s, [k]: val }));

  const pickProfile = (profile) => {
    if (!profile) {
      setV((s) => ({ ...s, profileId: undefined }));
      return;
    }
    setV({
      profileId: profile._id,
      name: profile.name,
      phone: profile.phone,
      role: profile.role,
      wageType: profile.wageType,
      wageRate: profile.wageRate,
      workingHours: profile.workingHours,
      overtimeRate: profile.overtimeRate,
      status: "active",
    });
  };

  const dailyRate = v.wageType === "monthly" ? (Number(v.wageRate) || 0) / 30 : Number(v.wageRate) || 0;
  const otRate = Number(v.overtimeRate) || autoOvertimeRate(v.wageType, v.wageRate, v.workingHours);

  const submit = async () => {
    if (!v.name?.trim()) {
      setError("Worker name is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSubmit(v);
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {isAdd && profiles?.length > 0 && (
            <Autocomplete
              options={profiles}
              getOptionLabel={(p) => `${p.name}${p.role ? ` (${p.role})` : ""}`}
              value={profiles.find((p) => p._id === v.profileId) || null}
              onChange={(_, p) => pickProfile(p)}
              renderInput={(params) => (
                <TextField {...params} label="Pick an existing worker (optional)" helperText="Already added them on another site? Pick them here instead of retyping." />
              )}
            />
          )}
          <TextField
            label="Worker name"
            required
            fullWidth
            value={v.name || ""}
            onChange={(e) => setV((s) => ({ ...s, name: e.target.value, profileId: undefined }))}
          />
          <Stack direction="row" spacing={2}>
            <TextField label="Phone (optional)" fullWidth value={v.phone || ""} onChange={(e) => set("phone", e.target.value)} />
            <TextField label="Role (e.g. Mason, Helper)" fullWidth value={v.role || ""} onChange={(e) => set("role", e.target.value)} />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField select label="Wage type" fullWidth value={v.wageType || "daily"} onChange={(e) => set("wageType", e.target.value)}>
              {WAGE_TYPES.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
            </TextField>
            <TextField
              label={`Wage rate (₹ ${v.wageType === "monthly" ? "/ month" : "/ day"})`}
              type="number"
              fullWidth
              value={v.wageRate ?? ""}
              onChange={(e) => set("wageRate", e.target.value)}
            />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField label="Working hours / day" type="number" fullWidth value={v.workingHours ?? ""} onChange={(e) => set("workingHours", e.target.value)} />
            <TextField
              label="Overtime rate (₹/hr)"
              type="number"
              fullWidth
              value={v.overtimeRate ?? ""}
              onChange={(e) => set("overtimeRate", e.target.value)}
              placeholder={`Auto: ₹${autoOvertimeRate(v.wageType, v.wageRate, v.workingHours)}`}
              helperText="Leave empty to auto-calculate"
            />
          </Stack>
          <TextField select label="Status" fullWidth value={v.status || "active"} onChange={(e) => set("status", e.target.value)}>
            {WORKER_STATUS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
          </TextField>

          <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: tokens.paperAlt, fontSize: "0.85rem" }}>
            <b>Preview:</b> 1 day = {inr(dailyRate)} · Half day = {inr(dailyRate / 2)} · Overtime = {inr(otRate)}/hr
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
      </DialogActions>
    </Dialog>
  );
}

/* ---------- one stage ---------- */

function StageCard({ index, stage, h }) {
  const [p, setP] = useState(stage.progress);
  useEffect(() => setP(stage.progress), [stage.progress]);
  const c = stage.cost;

  return (
    <Accordion
      disableGutters
      elevation={0}
      sx={{ border: `1px solid ${tokens.line}`, mb: 1.5, borderRadius: 1, overflow: "hidden", "&:before": { display: "none" } }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ width: "100%", pr: 1 }}>
          <Avatar sx={{ width: 34, height: 34, fontSize: "0.9rem", fontWeight: 700, bgcolor: statusColor[stage.status] }}>
            {index + 1}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap", rowGap: 0.75, mb: 0.75 }}>
              <Typography sx={{ fontWeight: 700 }}>{stage.name}</Typography>
              <Chip size="small" label={labelOf(STAGE_STATUS, stage.status)} color={STAGE_COLOR[stage.status]} />
              {stage.photos.length > 0 && (
                <Chip size="small" variant="outlined" icon={<PhotoIcon />} label={stage.photos.length} />
              )}
              {c.total > 0 && <Chip size="small" variant="outlined" label={`Spent ${inr(c.total)}`} />}
              <Chip
                size="small"
                variant="outlined"
                color={stage.costVisible ? "success" : "default"}
                icon={stage.costVisible ? <VisibilityIcon /> : <VisibilityOffIcon />}
                label={stage.costVisible ? "Cost visible to client" : "Cost hidden"}
              />
            </Stack>
            <ProgressBar value={stage.progress} />
          </Box>
        </Stack>
      </AccordionSummary>

      <AccordionDetails sx={{ pt: 0 }}>
        <Divider sx={{ mb: 2 }} />
        {stage.description && <Typography sx={{ mb: 2, color: "#6b665c" }}>{stage.description}</Typography>}

        {/* progress */}
        <SectionTitle>Work completed</SectionTitle>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ px: 1 }}>
          <Slider value={p} onChange={(_, v) => setP(v)} step={5} marks min={0} max={100} valueLabelDisplay="auto" sx={{ color: tokens.rust }} />
          <Button size="small" variant="contained" disabled={p === stage.progress} onClick={() => h.saveProgress(stage, p)} sx={{ whiteSpace: "nowrap" }}>
            Save {p}%
          </Button>
        </Stack>
        <Stack direction="row" spacing={3} sx={{ mt: 1, flexWrap: "wrap" }}>
          <Typography sx={{ fontSize: "0.82rem", color: "#6b665c" }}>Planned: {fdate(stage.plannedStart)} → {fdate(stage.plannedEnd)}</Typography>
          <Typography sx={{ fontSize: "0.82rem", color: "#6b665c" }}>Actual: {fdate(stage.actualStart)} → {fdate(stage.actualEnd)}</Typography>
        </Stack>
        {stage.notes && <Typography sx={{ mt: 1, fontSize: "0.88rem" }}>Notes: {stage.notes}</Typography>}

        {/* photos */}
        <Divider sx={{ my: 2.5 }} />
        <SectionTitle
          action={<Button size="small" startIcon={<AddPhotoIcon />} onClick={() => h.addPhotos(stage)}>Upload photos</Button>}
        >
          Photos ({stage.photos.length}) <Typography component="span" sx={{ fontWeight: 400, color: "#6b665c", fontSize: "0.82rem" }}>· shown to the client</Typography>
        </SectionTitle>
        {stage.photos.length === 0 ? (
          <Typography sx={{ color: "#6b665c", fontSize: "0.88rem" }}>No photos for this stage yet.</Typography>
        ) : (
          <PhotoGrid photos={stage.photos} onDelete={(photo) => h.deletePhoto(stage, photo)} />
        )}

        {/* materials */}
        <Divider sx={{ my: 2.5 }} />
        <SectionTitle
          action={<Button size="small" startIcon={<AddIcon />} onClick={() => h.addMaterial(stage)}>Add material</Button>}
        >
          Materials ({stage.materials.length})
        </SectionTitle>
        {stage.materials.length === 0 ? (
          <Typography sx={{ color: "#6b665c", fontSize: "0.88rem" }}>No materials added yet.</Typography>
        ) : (
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {["Material", "Qty", "Rate", "Amount", "Status", "Location", "Expected", ""].map((t) => (
                    <TableCell key={t} sx={{ ...cell, fontWeight: 700 }}>{t}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {stage.materials.map((m) => (
                  <TableRow key={m._id}>
                    <TableCell sx={cell}>
                      {m.name}
                      {m.supplier && <Typography sx={{ fontSize: "0.72rem", color: "#6b665c" }}>{m.supplier}</Typography>}
                    </TableCell>
                    <TableCell sx={cell}>{m.quantity} {m.unit}</TableCell>
                    <TableCell sx={cell}>{m.rate == null ? <Chip size="small" label="Price pending" /> : inr(m.rate)}</TableCell>
                    <TableCell sx={cell}>{m.rate == null ? "–" : inr(m.amount)}</TableCell>
                    <TableCell sx={cell}><Chip size="small" label={labelOf(MATERIAL_STATUS, m.status)} color={MAT_COLOR[m.status]} /></TableCell>
                    <TableCell sx={cell}>{m.location || "–"}</TableCell>
                    <TableCell sx={cell}>{fdate(m.expectedDate)}</TableCell>
                    <TableCell sx={{ ...cell, whiteSpace: "nowrap" }}>
                      <IconButton size="small" aria-label="Edit material" onClick={() => h.editMaterial(stage, m)}><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" aria-label="Delete material" onClick={() => h.deleteMaterial(stage, m)}><DeleteIcon fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}

        {/* other expenses */}
        <Divider sx={{ my: 2.5 }} />
        <SectionTitle
          action={<Button size="small" startIcon={<AddIcon />} onClick={() => h.addExpense(stage)}>Add expense</Button>}
        >
          Other expenses ({stage.expenses.length}) <Typography component="span" sx={{ fontWeight: 400, color: "#6b665c", fontSize: "0.82rem" }}>· labour, transport, machinery…</Typography>
        </SectionTitle>
        {stage.expenses.length === 0 ? (
          <Typography sx={{ color: "#6b665c", fontSize: "0.88rem" }}>No other expenses added yet.</Typography>
        ) : (
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {["Date", "Item", "Amount", "Note", ""].map((t) => (
                    <TableCell key={t} sx={{ ...cell, fontWeight: 700 }}>{t}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {stage.expenses.map((e) => (
                  <TableRow key={e._id}>
                    <TableCell sx={cell}>{fdate(e.date)}</TableCell>
                    <TableCell sx={cell}>{e.title}</TableCell>
                    <TableCell sx={{ ...cell, fontWeight: 700 }}>{inr(e.amount)}</TableCell>
                    <TableCell sx={cell}>{e.note || "–"}</TableCell>
                    <TableCell sx={cell}>
                      <IconButton size="small" aria-label="Delete expense" onClick={() => h.deleteExpense(stage, e)}><DeleteIcon fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}

        {/* cost summary + client visibility */}
        <Box sx={{ mt: 2.5, p: 2, borderRadius: 1, bgcolor: tokens.paperAlt }}>
          <Stack direction="row" spacing={3} sx={{ flexWrap: "wrap", rowGap: 0.5 }}>
            <Typography sx={{ fontSize: "0.88rem" }}>Materials: <b>{inr(c.materials)}</b>{c.pricePending > 0 && ` (+${c.pricePending} without price)`}</Typography>
            <Typography sx={{ fontSize: "0.88rem" }}>Other expenses: <b>{inr(c.other)}</b></Typography>
            <Typography sx={{ fontSize: "0.88rem" }}>Total spent on this stage: <b>{inr(c.total)}</b></Typography>
          </Stack>
          <FormControlLabel
            sx={{ mt: 1 }}
            control={<Switch checked={!!stage.costVisible} onChange={(e) => h.toggleCost(stage, e.target.checked)} />}
            label="Show this stage's cost to the client"
          />
        </Box>

        <Stack direction="row" spacing={1} sx={{ mt: 2.5 }}>
          <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => h.edit(stage)}>Edit stage</Button>
          <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => h.remove(stage)}>Delete stage</Button>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

/* ---------- one worker ---------- */

function WorkerCard({ worker: w, h }) {
  const wageLabel = w.wageType === "monthly" ? `${inr(w.wageRate)}/month` : `${inr(w.wageRate)}/day`;
  const isLocked = (date) => w.lockedThrough && date <= w.lockedThrough;

  return (
    <Accordion
      disableGutters
      elevation={0}
      sx={{ border: `1px solid ${tokens.line}`, mb: 1.5, borderRadius: 1, overflow: "hidden", "&:before": { display: "none" } }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ width: "100%", pr: 1 }}>
          <Avatar sx={{ width: 34, height: 34, fontSize: "0.9rem", fontWeight: 700, bgcolor: w.status === "active" ? tokens.rust : "#c9c4b8" }}>
            {w.name.charAt(0).toUpperCase()}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap", rowGap: 0.75, mb: 0.5 }}>
              <Typography sx={{ fontWeight: 700 }}>{w.name}</Typography>
              {w.role && <Chip size="small" variant="outlined" label={w.role} />}
              <Chip size="small" color={w.status === "active" ? "success" : "default"} label={labelOf(WORKER_STATUS, w.status)} />
              <Chip size="small" variant="outlined" label={wageLabel} />
              {w.effectiveOvertimeRate > 0 && <Chip size="small" variant="outlined" label={`OT ${inr(w.effectiveOvertimeRate)}/hr`} />}
              {w.due > 0 && <Chip size="small" color="warning" label={`Due ${inr(w.due)}`} />}
              {w.advance > 0 && <Chip size="small" color="info" label={`Advance ${inr(w.advance)}`} />}
              {w.lockedThrough && <Chip size="small" icon={<LockIcon />} label={`Settled through ${fdate(w.lockedThrough)}`} />}
            </Stack>
            <Typography sx={{ fontSize: "0.78rem", color: "#6b665c" }}>
              {w.counts.present} present · {w.counts.half_day} half-day · {w.counts.absent} absent · {w.counts.leave} leave
              {w.overtimeHours > 0 ? ` · ${w.overtimeHours}h overtime` : ""}
            </Typography>
          </Box>
        </Stack>
      </AccordionSummary>

      <AccordionDetails sx={{ pt: 0 }}>
        <Divider sx={{ mb: 2 }} />

        {/* pay summary */}
        <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
          <Grid item xs={6} sm={3}><StatCard label="Earned (wage + OT)" value={`+${inr(w.earned)}`} color={tokens.ink} /></Grid>
          <Grid item xs={6} sm={3}><StatCard label="Lunch (added)" value={`+${inr(w.lunch)}`} color={tokens.ink} /></Grid>
          <Grid item xs={6} sm={3}><StatCard label="Paid" value={`-${inr(w.paid)}`} color="#2e7d32" /></Grid>
          <Grid item xs={6} sm={3}>
            {w.advance > 0 ? (
              <StatCard label="Advance (overpaid)" value={inr(w.advance)} color="#2e7d32" />
            ) : (
              <StatCard label="Balance due" value={inr(w.due)} />
            )}
          </Grid>
        </Grid>

        {/* attendance log */}
        <Divider sx={{ my: 2.5 }} />
        <SectionTitle
          action={<Button size="small" startIcon={<AddIcon />} onClick={() => h.addAttendance(w)}>Add / correct entry</Button>}
        >
          Attendance ({w.daysLogged})
        </SectionTitle>
        {w.attendance.length === 0 ? (
          <Typography sx={{ color: "#6b665c", fontSize: "0.88rem" }}>No attendance logged yet.</Typography>
        ) : (
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {["Date", "Status", "Check-in", "Overtime", "Lunch (+)", "Marked by", "Note", ""].map((t) => (
                    <TableCell key={t} sx={{ ...cell, fontWeight: 700 }}>{t}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {w.attendance.map((a) => (
                  <TableRow key={a._id}>
                    <TableCell sx={cell}>{fdate(a.date)}</TableCell>
                    <TableCell sx={cell}><Chip size="small" label={labelOf(ATTENDANCE_STATUS, a.status)} color={ATTENDANCE_COLOR[a.status]} /></TableCell>
                    <TableCell sx={cell}>{a.checkIn || "–"}</TableCell>
                    <TableCell sx={cell}>{a.overtimeHours ? `${a.overtimeHours}h` : "–"}</TableCell>
                    <TableCell sx={cell}>{a.lunchAmount ? `+${inr(a.lunchAmount)}` : "–"}</TableCell>
                    <TableCell sx={cell}>{a.markedByName || (a.markedBy === "admin" ? "Admin" : "Worker")}</TableCell>
                    <TableCell sx={cell}>{a.note || "–"}</TableCell>
                    <TableCell sx={cell}>
                      {isLocked(a.date) ? (
                        <LockIcon fontSize="small" sx={{ color: "#9a9587" }} titleAccess="Locked — settled" />
                      ) : (
                        <IconButton size="small" aria-label="Delete entry" onClick={() => h.deleteAttendance(w, a)}><DeleteIcon fontSize="small" /></IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}

        {/* worker payments */}
        <Divider sx={{ my: 2.5 }} />
        <SectionTitle
          action={<Button size="small" startIcon={<PaymentsIcon />} onClick={() => h.addWorkerPayment(w)}>Pay worker</Button>}
        >
          Payments made ({w.payments.length})
        </SectionTitle>
        {w.payments.length === 0 ? (
          <Typography sx={{ color: "#6b665c", fontSize: "0.88rem" }}>No payments made yet.</Typography>
        ) : (
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {["Date", "Amount", "Mode", "Note", ""].map((t) => (
                    <TableCell key={t} sx={{ ...cell, fontWeight: 700 }}>{t}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {[...w.payments].sort((a, b) => new Date(b.date) - new Date(a.date)).map((p) => (
                  <TableRow key={p._id}>
                    <TableCell sx={cell}>{fdate(p.date)}</TableCell>
                    <TableCell sx={{ ...cell, fontWeight: 700 }}>{inr(p.amount)}</TableCell>
                    <TableCell sx={cell}>{labelOf(PAY_MODES, p.mode)}</TableCell>
                    <TableCell sx={cell}>{p.note || "–"}</TableCell>
                    <TableCell sx={{ ...cell, whiteSpace: "nowrap" }}>
                      <IconButton size="small" aria-label="Edit payment" onClick={() => h.editWorkerPayment(w, p)}><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" aria-label="Delete payment" onClick={() => h.deleteWorkerPayment(w, p)}><DeleteIcon fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}

        {/* settlement */}
        <Divider sx={{ my: 2.5 }} />
        <SectionTitle
          action={
            w.lockedThrough ? (
              <Button size="small" startIcon={<LockOpenIcon />} onClick={() => h.unlockWorker(w)}>Unlock</Button>
            ) : (
              <Button size="small" startIcon={<LockIcon />} onClick={() => h.settleWorker(w)}>Close hisaab</Button>
            )
          }
        >
          Settlements ({w.settlements.length}) <Typography component="span" sx={{ fontWeight: 400, color: "#6b665c", fontSize: "0.82rem" }}>· locks attendance up to a date</Typography>
        </SectionTitle>
        {w.settlements.length === 0 ? (
          <Typography sx={{ color: "#6b665c", fontSize: "0.88rem" }}>No settlement made yet — all attendance is still editable.</Typography>
        ) : (
          <Stack spacing={1}>
            {w.settlements.map((s) => (
              <Paper key={s._id} elevation={0} sx={{ p: 1.5, border: `1px solid ${tokens.line}`, fontSize: "0.85rem" }}>
                Up to <b>{fdate(s.toDate)}</b> · {s.days} days · Earned +{inr(s.earned)} · Lunch +{inr(s.lunch)} · Paid -{inr(s.paid)} ·{" "}
                {s.balance < 0 ? `Advance ${inr(-s.balance)}` : `Balance ${inr(s.balance)}`}
                {s.note && <Typography sx={{ fontSize: "0.8rem", color: "#6b665c", mt: 0.25 }}>{s.note}</Typography>}
              </Paper>
            ))}
          </Stack>
        )}

        <Stack direction="row" spacing={1} sx={{ mt: 2.5, flexWrap: "wrap", rowGap: 1 }}>
          <Button size="small" variant="outlined" startIcon={<ReceiptIcon />} onClick={() => h.openReport(w)}>Payslip / Report</Button>
          <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => h.editWorker(w)}>Edit worker</Button>
          <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => h.removeWorker(w)}>Delete worker</Button>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

/* ---------- payslip / date-range report ---------- */

function ReportDialog({ open, siteId, worker, onClose }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(todayInput());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchReport = async (f, t) => {
    setLoading(true);
    setError("");
    try {
      const q = new URLSearchParams();
      if (f) q.set("from", f);
      if (t) q.set("to", t);
      const res = await api.get(`/sites/${siteId}/workers/${worker._id}/report?${q.toString()}`);
      setReport(res.data.report);
    } catch (err) {
      setError(err?.response?.data?.message || "Could not load report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && worker) {
      const preset = PERIOD_PRESETS[0].range();
      setFrom(preset.from);
      setTo(preset.to);
      fetchReport(preset.from, preset.to);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, worker?._id]);

  if (!worker) return null;

  const applyPreset = (preset) => {
    const r = preset.range();
    setFrom(r.from);
    setTo(r.to);
    fetchReport(r.from, r.to);
  };

  const printUrl = `/admin/payslip/${siteId}/${worker._id}?from=${from}&to=${to}`;

  const waText = report
    ? `${worker.name} — payslip ${from ? fdate(from) : "start"} to ${to ? fdate(to) : "today"}:\n` +
      `Present: ${report.counts.present}, Half day: ${report.counts.half_day}, Absent: ${report.counts.absent}, Leave: ${report.counts.leave}\n` +
      `Overtime: ${report.overtimeHours} hrs${worker.effectiveOvertimeRate ? ` @ ${inr(worker.effectiveOvertimeRate)}/hr` : ""}\n` +
      `Earned: +${inr(report.earned)}\nLunch: +${inr(report.lunch)}\nPaid: -${inr(report.paid)}\n` +
      `${report.balance < 0 ? "Advance" : "Balance due"}: ${inr(Math.abs(report.balance))}`
    : "";

  const exportCsv = () => {
    if (!report) return;
    const rows = report.entries.map((e) => ({
      Date: e.date, Status: e.status, "Check-in": e.checkIn, "Overtime (hrs)": e.overtimeHours, "Lunch added (Rs)": e.lunchAmount, Note: e.note,
    }));
    downloadCsv(`${worker.name}-attendance-${from || "start"}-to-${to || "today"}.csv`, rows);
  };

  return (
    <Dialog open={!!open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Payslip / Report: {worker.name}</DialogTitle>
      <DialogContent>
        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ rowGap: 1, mb: 2 }}>
          {PERIOD_PRESETS.map((p) => (
            <Button key={p.label} size="small" variant="outlined" onClick={() => applyPreset(p)}>{p.label}</Button>
          ))}
        </Stack>
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <TextField size="small" label="From" type="date" fullWidth InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} />
          <TextField size="small" label="To" type="date" fullWidth InputLabelProps={{ shrink: true }} value={to} onChange={(e) => setTo(e.target.value)} />
          <Button variant="contained" onClick={() => fetchReport(from, to)} sx={{ whiteSpace: "nowrap" }}>Go</Button>
        </Stack>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {loading && <Typography sx={{ color: "#6b665c" }}>Loading…</Typography>}

        {report && !loading && (
          <>
            <Grid container spacing={1.5} sx={{ mb: 2 }}>
              <Grid item xs={6} sm={3}><StatCard label="Earned" value={`+${inr(report.earned)}`} color={tokens.ink} /></Grid>
              <Grid item xs={6} sm={3}><StatCard label="Lunch (added)" value={`+${inr(report.lunch)}`} color={tokens.ink} /></Grid>
              <Grid item xs={6} sm={3}><StatCard label="Paid" value={`-${inr(report.paid)}`} color="#2e7d32" /></Grid>
              <Grid item xs={6} sm={3}>
                {report.balance < 0 ? (
                  <StatCard label="Advance" value={inr(-report.balance)} color="#2e7d32" />
                ) : (
                  <StatCard label="Balance due" value={inr(report.balance)} />
                )}
              </Grid>
            </Grid>
            <Typography sx={{ fontSize: "0.85rem", color: "#6b665c", mb: 2 }}>
              {report.counts.present} present · {report.counts.half_day} half-day · {report.counts.absent} absent · {report.counts.leave} leave · {report.overtimeHours}h overtime
              {worker.effectiveOvertimeRate > 0 ? ` (${inr(worker.effectiveOvertimeRate)}/hr)` : ""}
            </Typography>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, flexWrap: "wrap", rowGap: 1 }}>
        <Button onClick={onClose}>Close</Button>
        <Button startIcon={<DownloadIcon />} disabled={!report} onClick={exportCsv}>Export CSV</Button>
        <Button
          startIcon={<WhatsAppIcon />}
          disabled={!report}
          component="a"
          target="_blank"
          rel="noreferrer"
          href={`https://wa.me/${(worker.phone || "").replace(/\D/g, "")}?text=${encodeURIComponent(waText)}`}
        >
          Send on WhatsApp
        </Button>
        <Button variant="contained" startIcon={<PrintIcon />} component="a" target="_blank" rel="noreferrer" href={printUrl}>
          Print payslip
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ---------- page ---------- */

export default function SiteDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [dlg, setDlg] = useState(null); // { kind, stage?, material? }
  const [copied, setCopied] = useState(false);
  const [copiedWorkers, setCopiedWorkers] = useState(false);
  const [workersPin, setWorkersPin] = useState("");

  const { data: site, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["site", id],
    queryFn: async () => {
      const res = await api.get(`/sites/${id}`);
      if (!res.data?.site) throw new Error("The server did not return site data");
      return res.data.site;
    },
    enabled: !!id,
    retry: false,
  });

  useEffect(() => {
    if (site?.workersShare?.pin !== undefined) setWorkersPin(site.workersShare.pin || "");
  }, [site?.workersShare?.pin]);

  // after every change, put the fresh site from the server into the cache
  const save = async (request) => {
    const res = await request;
    qc.setQueryData(["site", id], res.data.site);
    qc.invalidateQueries({ queryKey: ["sites"] });
  };
  const showErr = (e) => alert(e?.response?.data?.message || e.message);
  const confirmDo = (msg, fn) => {
    if (window.confirm(msg)) fn().catch(showErr);
  };

  if (isLoading) return <Typography>Loading…</Typography>;
  if (isError || !site) {
    const status = error?.response?.status;
    const reason = error?.response?.data?.message || error?.message || "Unknown error";
    return (
      <Box>
        <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Could not load this site</Typography>
        <Typography sx={{ color: "#6b665c", mb: 2 }}>{status ? `Server error ${status}: ${reason}` : reason}</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={() => refetch()}>Retry</Button>
          <Button component={Link} href="/admin/sites">← All sites</Button>
        </Stack>
      </Box>
    );
  }

  const base = `/sites/${id}`;
  const shareUrl = site.share?.token && typeof window !== "undefined" ? `${window.location.origin}/site/${site.share.token}` : "";
  const workersShareUrl = site.workersShare?.token && typeof window !== "undefined" ? `${window.location.origin}/attendance/${site.workersShare.token}` : "";

  const updateShare = async (body) => {
    const res = await api.put(`${base}/share`, body);
    qc.setQueryData(["site", id], (s) => ({ ...s, share: res.data.share }));
  };

  const updateWorkersShare = async (body) => {
    const res = await api.put(`${base}/workers-share`, body);
    qc.setQueryData(["site", id], (s) => ({ ...s, workersShare: res.data.workersShare }));
  };

  // handlers used by every stage card
  const h = {
    edit: (stage) => setDlg({ kind: "stage-edit", stage }),
    remove: (stage) => confirmDo(`Delete the stage "${stage.name}" along with its photos?`, () => save(api.delete(`${base}/stages/${stage._id}`))),
    saveProgress: (stage, progress) => save(api.put(`${base}/stages/${stage._id}`, { progress })).catch(showErr),
    toggleCost: (stage, value) => save(api.put(`${base}/stages/${stage._id}`, { costVisible: value })).catch(showErr),
    addPhotos: (stage) => setDlg({ kind: "stage-photos", stage }),
    deletePhoto: (stage, photo) => confirmDo("Delete this photo?", () => save(api.delete(`${base}/stages/${stage._id}/photos/${photo._id}`))),
    addMaterial: (stage) => setDlg({ kind: "mat-add", stage }),
    editMaterial: (stage, material) => setDlg({ kind: "mat-edit", stage, material }),
    deleteMaterial: (stage, m) => confirmDo(`Delete "${m.name}"?`, () => save(api.delete(`${base}/stages/${stage._id}/materials/${m._id}`))),
    addExpense: (stage) => setDlg({ kind: "expense", stage }),
    deleteExpense: (stage, e) => confirmDo(`Delete the expense "${e.title}"?`, () => save(api.delete(`${base}/stages/${stage._id}/expenses/${e._id}`))),
    // workers
    editWorker: (worker) => setDlg({ kind: "worker-edit", worker }),
    removeWorker: (worker) => confirmDo(`Delete worker "${worker.name}" along with their attendance and payment history?`, () => save(api.delete(`${base}/workers/${worker._id}`))),
    addAttendance: (worker) => setDlg({ kind: "attendance-add", worker }),
    deleteAttendance: (worker, att) => confirmDo(`Delete the attendance entry for ${fdate(att.date)}?`, () => save(api.delete(`${base}/workers/${worker._id}/attendance/${att._id}`))),
    addWorkerPayment: (worker) => setDlg({ kind: "worker-payment", worker }),
    editWorkerPayment: (worker, payment) => setDlg({ kind: "worker-payment-edit", worker, payment }),
    deleteWorkerPayment: (worker, p) => confirmDo("Delete this payment entry?", () => save(api.delete(`${base}/workers/${worker._id}/payments/${p._id}`))),
    settleWorker: (worker) => setDlg({ kind: "worker-settle", worker }),
    unlockWorker: (worker) => confirmDo(`Unlock attendance up to ${fdate(worker.lockedThrough)}? It can be edited again.`, () => save(api.put(`${base}/workers/${worker._id}/unlock`))),
    openReport: (worker) => setDlg({ kind: "worker-report", worker }),
  };

  /* dialog config */
  const stageOptions = [{ value: "", label: "General (not tied to a stage)" }, ...site.stages.map((s) => ({ value: s._id, label: s.name }))];
  const today = dateInput(new Date());

  const dialogs = {
    site: {
      title: "Edit site",
      fields: SITE_FIELDS,
      initial: withDates(site, ["startDate", "expectedEndDate"]),
      onSubmit: (v) => save(api.put(base, v)),
    },
    "stage-add": {
      title: "Add stage",
      fields: STAGE_FIELDS,
      initial: { weight: 1, status: "pending" },
      onSubmit: (v) => save(api.post(`${base}/stages`, v)),
    },
    "stage-edit": {
      title: "Edit stage",
      fields: STAGE_FIELDS,
      initial: dlg?.stage && withDates(dlg.stage, ["plannedStart", "plannedEnd"]),
      onSubmit: (v) => save(api.put(`${base}/stages/${dlg.stage._id}`, v)),
    },
    "stage-photos": {
      title: `Upload photos: ${dlg?.stage?.name}`,
      fields: [
        { name: "photos", label: "Choose photos", type: "files" },
        { name: "caption", label: "Caption (optional)", helperText: "Applied to all photos in this upload" },
      ],
      initial: {},
      submitLabel: "Upload",
      onSubmit: (v) => {
        if (!v.photos?.length) throw new Error("Please choose at least one photo");
        const fd = new FormData();
        fd.append("caption", v.caption || "");
        v.photos.forEach((f) => fd.append("photos", f));
        return save(api.post(`${base}/stages/${dlg.stage._id}/photos`, fd));
      },
    },
    "mat-add": {
      title: `Add material: ${dlg?.stage?.name}`,
      fields: MATERIAL_FIELDS,
      initial: { status: "planned" },
      onSubmit: (v) => save(api.post(`${base}/stages/${dlg.stage._id}/materials`, v)),
    },
    "mat-edit": {
      title: `Edit material: ${dlg?.stage?.name}`,
      fields: MATERIAL_FIELDS,
      initial: dlg?.material && withDates({ ...dlg.material, rate: dlg.material.rate ?? "" }, ["expectedDate"]),
      onSubmit: (v) => save(api.put(`${base}/stages/${dlg.stage._id}/materials/${dlg.material._id}`, v)),
    },
    expense: {
      title: `Add expense: ${dlg?.stage?.name}`,
      fields: EXPENSE_FIELDS,
      initial: { date: today },
      onSubmit: (v) => save(api.post(`${base}/stages/${dlg.stage._id}/expenses`, v)),
    },
    payment: {
      title: "Add payment received",
      fields: PAYMENT_FIELDS,
      initial: { date: today, mode: "cash" },
      onSubmit: (v) => save(api.post(`${base}/payments`, v)),
    },
    update: {
      title: "Add progress update",
      fields: [
        { name: "text", label: "What was done?", type: "multiline" },
        { name: "stageId", label: "Stage", type: "select", options: stageOptions },
        { name: "photos", label: "Choose photos", type: "files" },
      ],
      initial: { stageId: "" },
      onSubmit: (v) => {
        const fd = new FormData();
        fd.append("text", v.text || "");
        if (v.stageId) fd.append("stageId", v.stageId);
        (v.photos || []).forEach((f) => fd.append("photos", f));
        return save(api.post(`${base}/updates`, fd));
      },
    },
    "attendance-add": {
      title: `Add / correct attendance: ${dlg?.worker?.name}`,
      fields: ATTENDANCE_FIELDS,
      initial: { date: today, status: "present" },
      submitLabel: "Save entry",
      onSubmit: (v) => save(api.post(`${base}/workers/${dlg.worker._id}/attendance`, v)),
    },
    "worker-payment-edit": {
      title: `Edit payment: ${dlg?.worker?.name}`,
      fields: WORKER_PAYMENT_FIELDS,
      initial: dlg?.payment && withDates(dlg.payment, ["date"]),
      onSubmit: (v) => save(api.put(`${base}/workers/${dlg.worker._id}/payments/${dlg.payment._id}`, v)),
    },
    "worker-settle": {
      title: `Close hisaab: ${dlg?.worker?.name}`,
      fields: [
        { name: "toDate", label: "Settle up to date", type: "date", required: true, helperText: "All attendance on or before this date gets locked" },
        { name: "note", label: "Note (optional)" },
      ],
      initial: { toDate: today },
      submitLabel: "Close & lock",
      onSubmit: (v) => save(api.post(`${base}/workers/${dlg.worker._id}/settle`, v)),
    },
  };
  const cfg = dlg ? dialogs[dlg.kind] : null;
  const paidPct = site.contractValue ? Math.round((site.paid / site.contractValue) * 100) : 0;

  return (
    <Box>
      <Button component={Link} href="/admin/sites" size="small" sx={{ mb: 1 }}>← All sites</Button>

      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={1.5} sx={{ mb: 3 }}>
        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexWrap: "wrap", rowGap: 0.5 }}>
            <Typography variant="h4" sx={{ fontSize: "1.6rem" }}>{site.name}</Typography>
            <Chip size="small" label={labelOf(SITE_STATUS, site.status)} color={SITE_COLOR[site.status]} />
          </Stack>
          <Typography sx={{ color: "#6b665c" }}>
            {[site.clientName, site.clientPhone, site.location].filter(Boolean).join(" · ")}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<EditIcon />} onClick={() => setDlg({ kind: "site" })}>Edit</Button>
          <Button
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() =>
              confirmDo("This permanently deletes the site, its photos and payments. Continue?", async () => {
                await api.delete(base);
                qc.invalidateQueries({ queryKey: ["sites"] });
                router.push("/admin/sites");
              })
            }
          >
            Delete
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} md={3}><StatCard label="Overall progress" value={`${site.overallProgress}%`} note={`Expected end: ${fdate(site.expectedEndDate)}`} /></Grid>
        <Grid item xs={6} md={3}><StatCard label="Contract value" value={inr(site.contractValue)} color={tokens.ink} /></Grid>
        <Grid item xs={6} md={3}><StatCard label="Received" value={inr(site.paid)} color="#2e7d32" note={`${paidPct}% of contract`} /></Grid>
        <Grid item xs={6} md={3}><StatCard label="Balance (unpaid)" value={inr(site.unpaid)} /></Grid>
        <Grid item xs={12} md={6}>
          <StatCard
            label="Total spent so far"
            value={inr(site.cost.total)}
            color={tokens.ink}
            note={`Materials ${inr(site.cost.materials)} · Other ${inr(site.cost.other)}${site.cost.pricePending ? ` · ${site.cost.pricePending} material(s) without price` : ""}`}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper elevation={0} sx={{ p: 2.5, border: `1px solid ${tokens.line}`, height: "100%" }}>
            <Typography sx={{ color: "#6b665c", fontWeight: 600, fontSize: "0.82rem", mb: 1.5 }}>Payment received</Typography>
            <ProgressBar value={paidPct} height={10} />
          </Paper>
        </Grid>
      </Grid>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" sx={{ mb: 2, borderBottom: `1px solid ${tokens.line}` }}>
        <Tab label={`Stages (${site.stages.length})`} />
        <Tab label={`Workers (${site.workers.length})`} />
        <Tab label={`Payments (${site.payments.length})`} />
        <Tab label={`Updates (${site.updates.length})`} />
        <Tab label="Client link" />
      </Tabs>

      {/* ---- Stages ---- */}
      {tab === 0 && (
        <Box>
          <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1.5 }}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDlg({ kind: "stage-add" })}>Add stage</Button>
          </Stack>
          {site.stages.map((st, i) => (
            <StageCard key={st._id} index={i} stage={st} h={h} />
          ))}
        </Box>
      )}

      {/* ---- Workers ---- */}
      {tab === 1 && (
        <Box>
          <Paper elevation={0} sx={{ p: 2.5, border: `1px solid ${tokens.line}`, mb: 3 }}>
            <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Crew attendance link</Typography>
            <Typography sx={{ color: "#6b665c", mb: 2, fontSize: "0.9rem" }}>
              One link for the whole crew — send it to your munshi or supervisor, no login needed. They mark Present / Half day /
              Absent, overtime and lunch for every active worker. It only shows the last 7 days and never shows any wage or pay figures.
            </Typography>
            <FormControlLabel
              control={<Switch checked={!!site.workersShare?.enabled} onChange={(e) => updateWorkersShare({ enabled: e.target.checked }).catch(showErr)} />}
              label="Crew attendance link is on"
            />
            <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mt: 1, mb: 1.5 }}>
              <TextField
                size="small"
                label="4-digit PIN (optional)"
                value={workersPin}
                onChange={(e) => setWorkersPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                sx={{ width: 170 }}
                helperText={site.workersShare?.pin ? "PIN is set" : "No PIN — anyone with the link can mark"}
              />
              <Button size="small" variant="outlined" sx={{ mt: 0.5 }} disabled={workersPin === (site.workersShare?.pin || "")} onClick={() => updateWorkersShare({ pin: workersPin }).catch(showErr)}>
                {site.workersShare?.pin ? "Update" : "Set PIN"}
              </Button>
              {site.workersShare?.pin && (
                <Button size="small" sx={{ mt: 0.5 }} onClick={() => { setWorkersPin(""); updateWorkersShare({ pin: "" }).catch(showErr); }}>Remove</Button>
              )}
            </Stack>
            {site.workersShare?.enabled && workersShareUrl && (
              <Box>
                <TextField fullWidth size="small" value={workersShareUrl} InputProps={{ readOnly: true }} />
                <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap", rowGap: 1 }}>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => {
                      navigator.clipboard.writeText(workersShareUrl);
                      setCopiedWorkers(true);
                      setTimeout(() => setCopiedWorkers(false), 1500);
                    }}
                  >
                    {copiedWorkers ? "Copied!" : "Copy link"}
                  </Button>
                  <Button
                    size="small"
                    component="a"
                    target="_blank"
                    rel="noreferrer"
                    href={`https://wa.me/?text=${encodeURIComponent(`Mark today's attendance for ${site.name} here: ${workersShareUrl}`)}`}
                  >
                    Send on WhatsApp
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    onClick={() => confirmDo("The current link will stop working and a new one will be created. Continue?", () => updateWorkersShare({ regenerate: true }))}
                  >
                    Generate new link
                  </Button>
                </Stack>
              </Box>
            )}
          </Paper>

          <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1.5 }}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDlg({ kind: "worker-add" })}>Add worker</Button>
          </Stack>
          {site.workers.length === 0 ? (
            <Typography sx={{ color: "#6b665c" }}>No workers added yet. Add one to start tracking attendance and pay.</Typography>
          ) : (
            site.workers.map((w) => <WorkerCard key={w._id} worker={w} h={h} />)
          )}
        </Box>
      )}

      {/* ---- Payments ---- */}
      {tab === 2 && (
        <Paper elevation={0} sx={{ p: 2.5, border: `1px solid ${tokens.line}` }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2, flexWrap: "wrap", rowGap: 1 }}>
            <Typography sx={{ fontWeight: 700 }}>
              Received {inr(site.paid)} of {inr(site.contractValue)} · Balance {inr(site.unpaid)}
            </Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDlg({ kind: "payment" })}>Add payment</Button>
          </Stack>
          {site.payments.length === 0 ? (
            <Typography sx={{ color: "#6b665c" }}>No payments recorded yet.</Typography>
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {["Date", "Amount", "Mode", "Reference", "Note", ""].map((t) => (
                      <TableCell key={t} sx={{ ...cell, fontWeight: 700 }}>{t}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[...site.payments].sort((a, b) => new Date(b.date) - new Date(a.date)).map((pay) => (
                    <TableRow key={pay._id}>
                      <TableCell sx={cell}>{fdate(pay.date)}</TableCell>
                      <TableCell sx={{ ...cell, fontWeight: 700 }}>{inr(pay.amount)}</TableCell>
                      <TableCell sx={cell}>{labelOf(PAY_MODES, pay.mode)}</TableCell>
                      <TableCell sx={cell}>{pay.reference || "–"}</TableCell>
                      <TableCell sx={cell}>{pay.note || "–"}</TableCell>
                      <TableCell sx={cell}>
                        <IconButton size="small" aria-label="Delete payment" onClick={() => confirmDo("Delete this payment entry?", () => save(api.delete(`${base}/payments/${pay._id}`)))}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </Paper>
      )}

      {/* ---- General updates ---- */}
      {tab === 3 && (
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
            <Typography sx={{ color: "#6b665c", fontSize: "0.88rem" }}>
              General site updates. Stage-specific photos go inside each stage.
            </Typography>
            <Button variant="contained" startIcon={<AddPhotoIcon />} onClick={() => setDlg({ kind: "update" })}>Add update</Button>
          </Stack>
          {site.updates.length === 0 && <Typography sx={{ color: "#6b665c" }}>No updates yet.</Typography>}
          <Stack spacing={1.5}>
            {site.updates.map((u) => {
              const stageName = site.stages.find((s) => s._id === u.stageId)?.name;
              return (
                <Paper key={u._id} elevation={0} sx={{ p: 2.5, border: `1px solid ${tokens.line}` }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography sx={{ fontSize: "0.82rem", color: "#6b665c" }}>
                      {fdate(u.date)}{stageName ? ` · ${stageName}` : ""}
                    </Typography>
                    <IconButton size="small" aria-label="Delete update" onClick={() => confirmDo("Delete this update and its photos?", () => save(api.delete(`${base}/updates/${u._id}`)))}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                  {u.text && <Typography sx={{ mt: 0.5, whiteSpace: "pre-wrap" }}>{u.text}</Typography>}
                  <PhotoGrid photos={u.photos} />
                </Paper>
              );
            })}
          </Stack>
        </Box>
      )}

      {/* ---- Client link ---- */}
      {tab === 4 && (
        <Paper elevation={0} sx={{ p: 3, border: `1px solid ${tokens.line}`, maxWidth: 660 }}>
          <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Share progress with your client</Typography>
          <Typography sx={{ color: "#6b665c", mb: 2, fontSize: "0.9rem" }}>
            Turn the link on and send it to the client. No login is needed. They can see overall progress, stage progress with photos,
            and the paid / unpaid amounts. Internal notes, material rates and suppliers are never shown. A stage&apos;s cost is shown
            only if you switch on &quot;Show this stage&apos;s cost to the client&quot; inside that stage.
          </Typography>
          <Stack>
            <FormControlLabel
              control={<Switch checked={!!site.share?.enabled} onChange={(e) => updateShare({ enabled: e.target.checked })} />}
              label="Client link is on"
            />
            <FormControlLabel
              control={<Switch checked={!!site.share?.showMaterials} onChange={(e) => updateShare({ showMaterials: e.target.checked })} />}
              label="Also show the materials list (without rates)"
            />
          </Stack>
          {site.share?.enabled && shareUrl && (
            <Box sx={{ mt: 2 }}>
              <TextField fullWidth size="small" value={shareUrl} InputProps={{ readOnly: true }} />
              <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap", rowGap: 1 }}>
                <Button
                  variant="contained"
                  onClick={() => {
                    navigator.clipboard.writeText(shareUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? "Copied!" : "Copy link"}
                </Button>
                <Button
                  component="a"
                  target="_blank"
                  rel="noreferrer"
                  href={`https://wa.me/${(site.clientPhone || "").replace(/\D/g, "")}?text=${encodeURIComponent(`You can follow the progress of ${site.name} here: ${shareUrl}`)}`}
                >
                  Send on WhatsApp
                </Button>
                <Button color="error" onClick={() => confirmDo("The current link will stop working and a new one will be created. Continue?", () => updateShare({ regenerate: true }))}>
                  Generate new link
                </Button>
              </Stack>
            </Box>
          )}
        </Paper>
      )}

      {(dlg?.kind === "worker-add" || dlg?.kind === "worker-edit") && (
        <WorkerFormDialog
          open
          title={dlg.kind === "worker-add" ? "Add worker" : "Edit worker"}
          initial={dlg.kind === "worker-edit" ? dlg.worker : null}
          onClose={() => setDlg(null)}
          onSubmit={(v) => (dlg.kind === "worker-add" ? save(api.post(`${base}/workers`, v)) : save(api.put(`${base}/workers/${dlg.worker._id}`, v)))}
        />
      )}

      {dlg?.kind === "worker-report" && (
        <ReportDialog open siteId={id} worker={dlg.worker} onClose={() => setDlg(null)} />
      )}

      {dlg?.kind === "worker-payment" && (
        <PayWorkerDialog
          open
          workerName={dlg.worker.name}
          due={dlg.worker.due}
          advance={dlg.worker.advance}
          onClose={() => setDlg(null)}
          onSubmit={(v) => save(api.post(`${base}/workers/${dlg.worker._id}/payments`, v))}
        />
      )}

      {cfg && (
        <FormDialog
          open
          title={cfg.title}
          fields={cfg.fields}
          initial={cfg.initial}
          submitLabel={cfg.submitLabel}
          onClose={() => setDlg(null)}
          onSubmit={cfg.onSubmit}
        />
      )}
    </Box>
  );
}