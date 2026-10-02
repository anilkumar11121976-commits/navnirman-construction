"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Skeleton,
  Snackbar,
  Stack,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import GroupsIcon from "@mui/icons-material/GroupsOutlined";
import ArrowOutwardIcon from "@mui/icons-material/ArrowOutward";
import PaymentsIcon from "@mui/icons-material/PaymentsOutlined";
import ReceiptIcon from "@mui/icons-material/ReceiptLongOutlined";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import SearchIcon from "@mui/icons-material/Search";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonthOutlined";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import TrendingUpOutlinedIcon from "@mui/icons-material/TrendingUpOutlined";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";

import api from "@/lib/api";
import { tokens } from "@/lib/theme";
import PayWorkerDialog from "@/components/PayWorkerDialog";
import { PERIOD_PRESETS, inr, todayInput } from "@/lib/siteUtils";

const muted = "#6B7280";
const ink = tokens?.ink || "#172033";
const accent = tokens?.rust || "#C2412D";
const line = tokens?.line || "#E5E7EB";
const green = "#15803D";
const warning = "#B45309";
const blue = "#2563EB";

const cell = { fontSize: "0.82rem", py: 1.35, px: 1.5, whiteSpace: "nowrap" };
const card = {
  border: `1px solid ${line}`,
  borderRadius: 3,
  backgroundColor: "#FFFFFF",
  boxShadow: "0 8px 30px rgba(15, 23, 42, 0.045)",
};
const label = {
  fontSize: "0.72rem",
  fontWeight: 700,
  color: muted,
  textTransform: "uppercase",
  letterSpacing: "0.045em",
};
const primaryBtn = {
  borderRadius: 1.75,
  textTransform: "none",
  fontWeight: 800,
  background: accent,
  boxShadow: "none",
  "&:hover": { background: accent, boxShadow: "none" },
};
const textLink = {
  mt: 0.75,
  p: 0,
  minWidth: 0,
  textTransform: "none",
  fontWeight: 800,
  color: accent,
};

// "Today" always first; "All time" last. Any "Today" already in PERIOD_PRESETS is replaced.
const PRESETS = [
  { label: "Today", range: () => ({ from: todayInput(), to: todayInput() }) },
  ...(PERIOD_PRESETS || []).filter((p) => p.label.toLowerCase() !== "today"),
  { label: "All time", range: () => ({ from: "", to: "" }) },
];

/* ---------------- small building blocks ---------------- */

function StatCard({ icon, title, value, helper, color = accent }) {
  return (
    <Paper elevation={0} sx={{ ...card, p: 2, minWidth: 0, height: "100%" }}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box
          sx={{
            width: 42,
            height: 42,
            borderRadius: 2,
            display: "grid",
            placeItems: "center",
            background: `${color}12`,
            color,
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={label}>{title}</Typography>
          <Typography
            sx={{
              mt: 0.2,
              fontSize: "1.08rem",
              fontWeight: 800,
              color: ink,
              lineHeight: 1.2,
            }}
          >
            {value}
          </Typography>
          {helper && (
            <Typography sx={{ mt: 0.35, fontSize: "0.72rem", color: muted }}>
              {helper}
            </Typography>
          )}
        </Box>
      </Stack>
    </Paper>
  );
}

function StateCard({ icon, title, text, children }) {
  return (
    <Paper
      elevation={0}
      sx={{ ...card, p: { xs: 3, md: 5 }, textAlign: "center" }}
    >
      <Box
        sx={{
          width: 54,
          height: 54,
          borderRadius: "50%",
          background: `${accent}0D`,
          color: accent,
          display: "grid",
          placeItems: "center",
          mx: "auto",
          mb: 1.5,
        }}
      >
        {icon}
      </Box>
      <Typography sx={{ fontWeight: 800, color: ink }}>{title}</Typography>
      <Typography
        sx={{
          color: muted,
          fontSize: "0.82rem",
          maxWidth: 480,
          mx: "auto",
          mt: 0.5,
          mb: children ? 2 : 0,
        }}
      >
        {text}
      </Typography>
      {children}
    </Paper>
  );
}

function LoadingBlock({ rows = 4 }) {
  return (
    <Paper elevation={0} sx={{ ...card, p: 2 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} variant="rounded" height={46} sx={{ mb: 1 }} />
      ))}
    </Paper>
  );
}

function RowAction({ title, color, bg, hover, ...props }) {
  return (
    <Tooltip title={title}>
      <IconButton
        size="small"
        aria-label={title}
        {...props}
        sx={{
          color,
          background: bg,
          borderRadius: 1.5,
          "&:hover": { background: hover },
        }}
      />
    </Tooltip>
  );
}

function PresetButton({ active, children, ...props }) {
  return (
    <Button
      size="small"
      variant={active ? "contained" : "outlined"}
      aria-pressed={active}
      {...props}
      sx={{
        minHeight: 34,
        px: 1.5,
        borderRadius: 5,
        textTransform: "none",
        fontWeight: 700,
        boxShadow: "none",
        transition: "all .15s ease",
        ...(active
          ? {
              background: accent,
              color: "#fff",
              borderColor: accent,
              "&:hover": { background: accent, boxShadow: "none" },
            }
          : {
              borderColor: line,
              color: "#374151",
              background: "#fff",
              "&:hover": {
                borderColor: accent,
                color: accent,
                background: `${accent}08`,
              },
            }),
      }}
    >
      {children}
    </Button>
  );
}

/* ---------------- payroll ---------------- */

function PayrollTable() {
  const qc = useQueryClient();
  const [from, setFrom] = useState(todayInput());
  const [to, setTo] = useState(todayInput());
  const [siteId, setSiteId] = useState("");
  const [search, setSearch] = useState("");
  const [payRow, setPayRow] = useState(null);
  const [toast, setToast] = useState(null);

  const { data: sites } = useQuery({
    queryKey: ["sites-list-light"],
    queryFn: async () => (await api.get("/sites")).data.sites,
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["attendance-overview", from, to, siteId],
    queryFn: async () => {
      const q = new URLSearchParams();
      if (from) q.set("from", from);
      if (to) q.set("to", to);
      if (siteId) q.set("siteId", siteId);
      return (await api.get(`/sites/attendance-overview?${q.toString()}`)).data
        .rows;
    },
  });

  const refresh = () =>
    qc.invalidateQueries({ queryKey: ["attendance-overview"] });

  const payMutation = useMutation({
    mutationFn: ({ sId, workerId, payload }) =>
      api.post(`/sites/${sId}/workers/${workerId}/payments`, payload),
    onSuccess: () => {
      refresh();
      setToast({ type: "success", msg: "Payment saved" });
    },
    onError: () => setToast({ type: "error", msg: "Could not save payment" }),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ sId, workerId }) =>
      api.delete(`/sites/${sId}/workers/${workerId}`),
    onSuccess: () => {
      refresh();
      setToast({ type: "success", msg: "Worker removed" });
    },
    onError: () => setToast({ type: "error", msg: "Could not remove worker" }),
  });

  // A preset is "active" whenever the current dates match its range,
  // so manual date edits automatically un-highlight it.
  const isActive = (p) => {
    const r = p.range();
    return r.from === from && r.to === to;
  };

  const applyPreset = (p) => {
    const r = p.range();
    setFrom(r.from);
    setTo(r.to);
  };

  const rows = useMemo(() => {
    const list = data || [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.siteName.toLowerCase().includes(q),
    );
  }, [data, search]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (a, r) => ({
          workers: a.workers + 1,
          present: a.present + Number(r.counts?.present || 0),
          earned: a.earned + Number(r.earned || 0),
          paid: a.paid + Number(r.paid || 0),
          due: a.due + Number(r.due || 0),
        }),
        { workers: 0, present: 0, earned: 0, paid: 0, due: 0 },
      ),
    [rows],
  );

  const removeWorker = (r) => {
    const warn = r.due > 0 ? ` They still have ${inr(r.due)} due.` : "";
    if (
      window.confirm(
        `Remove "${r.name}" from ${r.siteName}? This deletes their attendance and payment history on this site.${warn}`,
      )
    ) {
      deleteMutation.mutate({ sId: r.siteId, workerId: r.workerId });
    }
  };

  const heads = [
    "Site",
    "Worker",
    "Present",
    "Half",
    "Absent",
    "Leave",
    "Overtime",
    "Earned",
    "Lunch (+)",
    "Paid",
    "Due / Advance",
    "Actions",
  ];

  return (
    <Box>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" },
          gap: 1.5,
          mb: 2,
        }}
      >
        <StatCard
          icon={<PeopleAltOutlinedIcon />}
          title="Workers"
          value={totals.workers}
          helper="Matching filters"
          color={blue}
        />
        <StatCard
          icon={<TrendingUpOutlinedIcon />}
          title="Present days"
          value={totals.present}
          helper="Across filtered workers"
          color={green}
        />
        <StatCard
          icon={<AccountBalanceWalletOutlinedIcon />}
          title="Earned"
          value={inr(totals.earned)}
          helper="Attendance + extras"
          color={accent}
        />
        <StatCard
          icon={<PaymentsIcon />}
          title="Due"
          value={inr(totals.due)}
          helper={`Paid ${inr(totals.paid)}`}
          color={warning}
        />
      </Box>

      {/* FILTERS */}
      <Paper elevation={0} sx={{ ...card, mb: 2.5 }}>
        <Box sx={{ p: { xs: 1.75, md: 2 } }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", md: "center" }}
            spacing={1.5}
            sx={{ mb: 1.75 }}
          >
            <Box>
              <Typography
                sx={{ fontSize: "0.98rem", fontWeight: 800, color: ink }}
              >
                Attendance & payroll
              </Typography>
              <Typography sx={{ fontSize: "0.76rem", color: muted, mt: 0.3 }}>
                Filter attendance records and manage worker payments.
              </Typography>
            </Box>
            <Chip
              size="small"
              icon={<CalendarMonthIcon />}
              label={
                from || to
                  ? from === to
                    ? from
                    : `${from || "Start"} → ${to || "End"}`
                  : "All dates"
              }
              sx={{
                borderRadius: 1.5,
                background: `${accent}0D`,
                color: accent,
                fontWeight: 700,
                "& .MuiChip-icon": { color: accent },
              }}
            />
          </Stack>

          <Stack
            direction="row"
            spacing={0.75}
            flexWrap="wrap"
            useFlexGap
            sx={{ mb: 1.75 }}
          >
            {PRESETS.map((p) => (
              <PresetButton
                key={p.label}
                active={isActive(p)}
                onClick={() => applyPreset(p)}
              >
                {p.label}
              </PresetButton>
            ))}
          </Stack>

          <Divider sx={{ mb: 1.75 }} />

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "1fr 1fr",
                lg: "1fr 1fr 1.2fr 1.5fr",
              },
              gap: 1.25,
            }}
          >
            <TextField
              size="small"
              label="From"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              inputProps={{ max: to || undefined }}
            />
            <TextField
              size="small"
              label="To"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={to}
              onChange={(e) => setTo(e.target.value)}
              inputProps={{ min: from || undefined }}
            />
            <TextField
              size="small"
              select
              label="Site"
              fullWidth
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
            >
              <MenuItem value="">All sites</MenuItem>
              {sites?.map((s) => (
                <MenuItem key={s._id} value={s._id}>
                  {s.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              label="Search worker or site"
              fullWidth
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 20, color: muted }} />
                  </InputAdornment>
                ),
              }}
            />
          </Box>
        </Box>
      </Paper>

      {isLoading && <LoadingBlock />}

      {isError && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              Retry
            </Button>
          }
        >
          Could not load attendance records.
        </Alert>
      )}

      {!isLoading && !isError && rows.length === 0 && (
        <StateCard
          icon={<SearchIcon />}
          title="No workers found"
          text="No workers match the selected period, site or search. Try a wider date range."
        />
      )}

      {rows.length > 0 && (
        <Paper elevation={0} sx={{ ...card, overflow: "hidden" }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{
              px: { xs: 1.5, md: 2 },
              py: 1.5,
              borderBottom: `1px solid ${line}`,
              background: "#FCFCFD",
            }}
          >
            <Box>
              <Typography
                sx={{ fontSize: "0.95rem", fontWeight: 800, color: ink }}
              >
                Worker payroll
              </Typography>
              <Typography sx={{ fontSize: "0.74rem", color: muted, mt: 0.2 }}>
                {rows.length} worker{rows.length === 1 ? "" : "s"} shown
              </Typography>
            </Box>
            <Chip
              size="small"
              label={`Due ${inr(totals.due)}`}
              sx={{
                borderRadius: 1.5,
                fontWeight: 800,
                background: totals.due > 0 ? "#FFF7ED" : "#F0FDF4",
                color: totals.due > 0 ? warning : green,
              }}
            />
          </Stack>

          <TableContainer sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 1180 }}>
              <TableHead>
                <TableRow>
                  {heads.map((h) => (
                    <TableCell
                      key={h}
                      sx={{
                        ...cell,
                        fontWeight: 800,
                        fontSize: "0.72rem",
                        color: "#4B5563",
                        textTransform: "uppercase",
                        letterSpacing: "0.035em",
                        borderBottom: `1px solid ${line}`,
                        background: "#F8FAFC",
                        ...(h === "Actions" && {
                          position: "sticky",
                          right: 0,
                          zIndex: 2,
                        }),
                      }}
                    >
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>

              <TableBody>
                {rows.map((r) => (
                  <TableRow
                    key={r.workerId}
                    hover
                    sx={{
                      "&:last-child td": { borderBottom: 0 },
                      "&:hover td:last-child": { background: "#FAFBFC" },
                    }}
                  >
                    <TableCell sx={cell}>
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        <LocationOnOutlinedIcon
                          sx={{ fontSize: 17, color: accent }}
                        />
                        <Typography
                          component={Link}
                          href={`/admin/sites/${r.siteId}`}
                          sx={{
                            fontSize: "0.79rem",
                            color: ink,
                            fontWeight: 700,
                            textDecoration: "none",
                            "&:hover": { color: accent },
                          }}
                        >
                          {r.siteName}
                        </Typography>
                      </Stack>
                    </TableCell>

                    <TableCell sx={cell}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box
                          sx={{
                            width: 34,
                            height: 34,
                            borderRadius: "50%",
                            background: `${blue}10`,
                            color: blue,
                            display: "grid",
                            placeItems: "center",
                            fontSize: "0.75rem",
                            fontWeight: 800,
                            flexShrink: 0,
                          }}
                        >
                          {r.name?.charAt(0)?.toUpperCase() || "W"}
                        </Box>
                        <Box>
                          <Typography
                            sx={{
                              fontWeight: 800,
                              fontSize: "0.82rem",
                              color: ink,
                            }}
                          >
                            {r.name}
                          </Typography>
                          {r.role && (
                            <Typography
                              sx={{ fontSize: "0.7rem", color: muted }}
                            >
                              {r.role}
                            </Typography>
                          )}
                        </Box>
                      </Stack>
                    </TableCell>

                    <TableCell sx={cell}>
                      <Chip
                        size="small"
                        label={r.counts.present}
                        sx={{
                          minWidth: 38,
                          height: 27,
                          fontWeight: 800,
                          background: "#F0FDF4",
                          color: green,
                        }}
                      />
                    </TableCell>
                    <TableCell sx={cell}>{r.counts.half_day}</TableCell>
                    <TableCell sx={cell}>{r.counts.absent}</TableCell>
                    <TableCell sx={cell}>{r.counts.leave}</TableCell>

                    <TableCell sx={cell}>
                      {r.overtimeHours ? (
                        <Stack
                          direction="row"
                          spacing={0.5}
                          alignItems="center"
                        >
                          <AccessTimeOutlinedIcon
                            sx={{ fontSize: 16, color: warning }}
                          />
                          <Box>
                            <Typography
                              sx={{ fontSize: "0.8rem", fontWeight: 800 }}
                            >
                              {r.overtimeHours}h
                            </Typography>
                            {r.overtimeRate > 0 && (
                              <Typography
                                sx={{ fontSize: "0.67rem", color: muted }}
                              >
                                {inr(r.overtimeRate)}/hr
                              </Typography>
                            )}
                          </Box>
                        </Stack>
                      ) : (
                        "–"
                      )}
                    </TableCell>

                    <TableCell sx={cell}>
                      <Typography sx={{ fontWeight: 800, color: ink }}>
                        +{inr(r.earned)}
                      </Typography>
                    </TableCell>
                    <TableCell sx={cell}>
                      <Typography sx={{ fontWeight: 700, color: "#4B5563" }}>
                        +{inr(r.lunch)}
                      </Typography>
                    </TableCell>
                    <TableCell sx={cell}>
                      <Typography sx={{ fontWeight: 800, color: green }}>
                        -{inr(r.paid)}
                      </Typography>
                    </TableCell>

                    <TableCell sx={cell}>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        {r.due > 0 && (
                          <Chip
                            size="small"
                            label={inr(r.due)}
                            sx={{
                              height: 27,
                              fontWeight: 800,
                              background: "#FFF7ED",
                              color: warning,
                            }}
                          />
                        )}
                        {r.advance > 0 && (
                          <Chip
                            size="small"
                            label={`Adv ${inr(r.advance)}`}
                            sx={{
                              height: 27,
                              fontWeight: 800,
                              background: "#EFF6FF",
                              color: blue,
                            }}
                          />
                        )}
                        {r.due === 0 && r.advance === 0 && (
                          <Typography sx={{ color: muted }}>–</Typography>
                        )}
                      </Stack>
                    </TableCell>

                    <TableCell
                      sx={{
                        ...cell,
                        position: "sticky",
                        right: 0,
                        background: "#FFFFFF",
                        zIndex: 1,
                        boxShadow: "-6px 0 8px -6px rgba(15,23,42,.08)",
                      }}
                    >
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <RowAction
                          title="Pay"
                          color={green}
                          bg="#F0FDF4"
                          hover="#DCFCE7"
                          onClick={() => setPayRow(r)}
                        >
                          <PaymentsIcon fontSize="small" />
                        </RowAction>
                        <RowAction
                          title="Payslip"
                          color={blue}
                          bg="#EFF6FF"
                          hover="#DBEAFE"
                          component={Link}
                          target="_blank"
                          href={`/admin/payslip/${r.siteId}/${r.workerId}?from=${from}&to=${to}`}
                        >
                          <ReceiptIcon fontSize="small" />
                        </RowAction>
                        <RowAction
                          title="Remove from site"
                          color="#DC2626"
                          bg="#FEF2F2"
                          hover="#FEE2E2"
                          onClick={() => removeWorker(r)}
                        >
                          <DeleteIcon fontSize="small" />
                        </RowAction>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {payRow && (
        <PayWorkerDialog
          open
          workerName={payRow.name}
          due={payRow.due}
          advance={payRow.advance}
          onClose={() => setPayRow(null)}
          onSubmit={(v) =>
            payMutation.mutateAsync({
              sId: payRow.siteId,
              workerId: payRow.workerId,
              payload: v,
            })
          }
        />
      )}

      <Snackbar
        open={!!toast}
        autoHideDuration={2500}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {toast ? (
          <Alert
            severity={toast.type}
            variant="filled"
            onClose={() => setToast(null)}
          >
            {toast.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}

/* ---------------- crew links ---------------- */

function SiteAttendanceRow({ site }) {
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const enabled = !!site.workersShare?.enabled;

  const shareUrl =
    site.workersShare?.token && typeof window !== "undefined"
      ? `${window.location.origin}/attendance/${site.workersShare.token}`
      : "";

  const toggle = useMutation({
    mutationFn: (on) =>
      api.put(`/sites/${site._id}/workers-share`, { enabled: on }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sites-attendance"] }),
  });

  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copy this link:", shareUrl);
    }
  };

  return (
    <Paper elevation={0} sx={{ ...card, overflow: "hidden" }}>
      <Box
        sx={{
          p: { xs: 1.75, md: 2.25 },
          background: "linear-gradient(180deg, #FFFFFF 0%, #FAFBFC 100%)",
        }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          spacing={1.5}
        >
          <Stack direction="row" spacing={1.25} alignItems="center">
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 2,
                background: `${accent}10`,
                color: accent,
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <GroupsIcon />
            </Box>
            <Box>
              <Stack
                direction="row"
                spacing={0.8}
                alignItems="center"
                flexWrap="wrap"
                useFlexGap
              >
                <Typography
                  sx={{ fontWeight: 800, fontSize: "0.98rem", color: ink }}
                >
                  {site.name}
                </Typography>
                <Chip
                  size="small"
                  icon={<GroupsIcon />}
                  label={`${site.workerCount} worker${site.workerCount === 1 ? "" : "s"}`}
                  sx={{
                    height: 25,
                    borderRadius: 1.5,
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    background: "#F3F4F6",
                  }}
                />
              </Stack>
              <Typography sx={{ color: muted, fontSize: "0.76rem", mt: 0.35 }}>
                {site.location || "Location not added"}
              </Typography>
            </Box>
          </Stack>

          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{
              px: 1.4,
              py: 0.65,
              borderRadius: 2,
              background: enabled ? "#F0FDF4" : "#F8FAFC",
              border: `1px solid ${enabled ? "#BBF7D0" : line}`,
            }}
          >
            <Box>
              <Typography
                sx={{
                  fontSize: "0.76rem",
                  fontWeight: 800,
                  color: enabled ? green : "#4B5563",
                }}
              >
                Crew link
              </Typography>
              <Typography sx={{ fontSize: "0.64rem", color: muted }}>
                {enabled ? "Active" : "Disabled"}
              </Typography>
            </Box>
            <Switch
              checked={enabled}
              disabled={toggle.isPending}
              onChange={(e) => toggle.mutate(e.target.checked)}
              size="small"
              color="success"
              inputProps={{ "aria-label": `Crew link for ${site.name}` }}
            />
          </Stack>
        </Stack>
      </Box>

      <Divider />

      <Box sx={{ p: { xs: 1.75, md: 2.25 } }}>
        {site.workerCount === 0 ? (
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              background: "#FFFBEB",
              border: "1px solid #FDE68A",
            }}
          >
            <Typography sx={{ fontSize: "0.82rem", color: "#92400E" }}>
              No workers have been added to this site yet.
            </Typography>
            <Button
              component={Link}
              href={`/admin/sites/${site._id}`}
              size="small"
              sx={textLink}
            >
              Add workers →
            </Button>
          </Box>
        ) : enabled && shareUrl ? (
          <Box>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1}
              alignItems={{ xs: "stretch", md: "center" }}
            >
              <TextField
                fullWidth
                size="small"
                value={shareUrl}
                InputProps={{
                  readOnly: true,
                  startAdornment: (
                    <InputAdornment position="start">
                      <LinkOutlinedIcon sx={{ fontSize: 19, color: accent }} />
                    </InputAdornment>
                  ),
                }}
              />
              <Button
                size="small"
                variant="contained"
                onClick={copyLink}
                startIcon={<ContentCopyOutlinedIcon />}
                sx={{ ...primaryBtn, minWidth: { md: 120 }, minHeight: 40 }}
              >
                {copied ? "Copied!" : "Copy link"}
              </Button>
            </Stack>

            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              sx={{ mt: 1.25 }}
            >
              <Button
                size="small"
                variant="outlined"
                component="a"
                target="_blank"
                rel="noreferrer"
                href={`https://wa.me/?text=${encodeURIComponent(`Mark today's attendance for ${site.name} here: ${shareUrl}`)}`}
                startIcon={<WhatsAppIcon />}
                sx={{
                  borderRadius: 1.75,
                  textTransform: "none",
                  fontWeight: 800,
                  color: green,
                  borderColor: "#BBF7D0",
                  "&:hover": { borderColor: "#86EFAC", background: "#F0FDF4" },
                }}
              >
                Send on WhatsApp
              </Button>
              <Button
                size="small"
                component={Link}
                href={`/admin/sites/${site._id}`}
                endIcon={<ArrowOutwardIcon fontSize="small" />}
                sx={{
                  borderRadius: 1.75,
                  textTransform: "none",
                  fontWeight: 800,
                  color: ink,
                  "&:hover": { background: "#F3F4F6" },
                }}
              >
                Manage workers / mark manually
              </Button>
            </Stack>
          </Box>
        ) : (
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              background: "#F8FAFC",
              border: `1px solid ${line}`,
            }}
          >
            <Typography
              sx={{ fontSize: "0.82rem", color: "#4B5563", lineHeight: 1.6 }}
            >
              Turn on the crew link above to create a shareable attendance link
              for your munshi/supervisor.
            </Typography>
            <Button
              component={Link}
              href={`/admin/sites/${site._id}`}
              size="small"
              sx={textLink}
            >
              Mark attendance yourself →
            </Button>
          </Box>
        )}
      </Box>
    </Paper>
  );
}

function CrewLinks() {
  const {
    data: sites,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["sites-attendance"],
    queryFn: async () => (await api.get("/sites")).data.sites,
  });

  if (isLoading) return <LoadingBlock rows={3} />;

  if (isError)
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={() => refetch()}>
            Retry
          </Button>
        }
      >
        Could not load sites.
      </Alert>
    );

  if (!sites?.length)
    return (
      <StateCard
        icon={<GroupsIcon />}
        title="No sites yet"
        text="Create a site first, then add workers to it to start tracking attendance."
      >
        <Button
          variant="contained"
          component={Link}
          href="/admin/sites"
          sx={primaryBtn}
        >
          Go to Site Progress →
        </Button>
      </StateCard>
    );

  return (
    <Stack spacing={1.75}>
      {sites.map((s) => (
        <SiteAttendanceRow key={s._id} site={s} />
      ))}
    </Stack>
  );
}

/* ---------------- page ---------------- */

export default function AdminAttendancePage() {
  const [tab, setTab] = useState(0);

  return (
    <Box sx={{ width: "100%", maxWidth: 1600, mx: "auto" }}>
      <Paper
        elevation={0}
        sx={{ ...card, mb: 2.25, overflow: "hidden", position: "relative" }}
      >
        <Box sx={{ p: { xs: 2, md: 2.75 }, position: "relative" }}>
          <Box
            sx={{
              position: "absolute",
              top: -80,
              right: -50,
              width: 200,
              height: 200,
              borderRadius: "50%",
              background: `${accent}08`,
              pointerEvents: "none",
            }}
          />
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ mb: 0.7, position: "relative" }}
          >
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: 1.75,
                display: "grid",
                placeItems: "center",
                background: `${accent}12`,
                color: accent,
              }}
            >
              <GroupsIcon />
            </Box>
            <Typography
              component="h1"
              sx={{
                fontSize: { xs: "1.35rem", md: "1.6rem" },
                lineHeight: 1.15,
                fontWeight: 900,
                letterSpacing: "-0.025em",
                color: ink,
              }}
            >
              Attendance
            </Typography>
          </Stack>
          <Typography
            sx={{
              color: muted,
              fontSize: "0.82rem",
              maxWidth: 760,
              lineHeight: 1.65,
              position: "relative",
            }}
          >
            Track worker attendance, calculate earnings, manage payments and
            share a simple crew attendance link with your site supervisor.
          </Typography>
        </Box>

        <Box
          sx={{
            px: { xs: 1, md: 2 },
            borderTop: `1px solid ${line}`,
            background: "#FCFCFD",
          }}
        >
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant="scrollable"
            scrollButtons={false}
            sx={{
              minHeight: 48,
              "& .MuiTabs-indicator": {
                height: 3,
                borderRadius: "3px 3px 0 0",
                background: accent,
              },
              "& .MuiTab-root": {
                minHeight: 48,
                textTransform: "none",
                fontWeight: 800,
                fontSize: "0.8rem",
                color: muted,
                px: 1.75,
              },
              "& .Mui-selected": { color: `${accent} !important` },
            }}
          >
            <Tab label="Attendance & pay" />
            <Tab label="Crew links" />
          </Tabs>
        </Box>
      </Paper>

      {tab === 0 ? <PayrollTable /> : <CrewLinks />}
    </Box>
  );
}
