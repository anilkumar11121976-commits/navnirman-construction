"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Accordion, AccordionDetails, AccordionSummary, Avatar, Box, Button, Chip, Divider, FormControlLabel, Grid,
  IconButton, Paper, Slider, Stack, Switch, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs,
  TextField, Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AddIcon from "@mui/icons-material/Add";
import AddPhotoIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import PhotoIcon from "@mui/icons-material/PhotoCameraOutlined";
import VisibilityIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOffOutlined";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/EditOutlined";
import api from "@/lib/api";
import { tokens } from "@/lib/theme";
import FormDialog from "@/components/FormDialog";
import { PhotoGrid, ProgressBar, StatCard } from "@/components/SiteBits";
import {
  MAT_COLOR, MATERIAL_STATUS, PAY_MODES, SITE_COLOR, SITE_STATUS, STAGE_COLOR, STAGE_STATUS,
  dateInput, fdate, inr, labelOf, withDates,
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

/* ---------- page ---------- */

export default function SiteDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [dlg, setDlg] = useState(null); // { kind, stage?, material? }
  const [copied, setCopied] = useState(false);

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

  const updateShare = async (body) => {
    const res = await api.put(`${base}/share`, body);
    qc.setQueryData(["site", id], (s) => ({ ...s, share: res.data.share }));
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

      {/* ---- Payments ---- */}
      {tab === 1 && (
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
      {tab === 2 && (
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
      {tab === 3 && (
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