"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  Alert, Avatar, Box, Button, ButtonBase, Chip, CircularProgress, Container, Dialog, DialogActions, DialogContent,
  DialogTitle, IconButton, LinearProgress, Paper, Snackbar, Stack, TextField, Typography,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircleOutline";
import CancelIcon from "@mui/icons-material/CancelOutlined";
import AccessTimeIcon from "@mui/icons-material/AccessTimeOutlined";
import MoreTimeIcon from "@mui/icons-material/MoreTimeOutlined";
import EventBusyIcon from "@mui/icons-material/EventBusyOutlined";
import RestaurantIcon from "@mui/icons-material/RestaurantOutlined";
import LockIcon from "@mui/icons-material/LockOutlined";
import PhotoCameraIcon from "@mui/icons-material/PhotoCameraOutlined";
import CheckIcon from "@mui/icons-material/Check";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import LocationOnIcon from "@mui/icons-material/LocationOnOutlined";
import LocationOffIcon from "@mui/icons-material/LocationOffOutlined";
import TranslateIcon from "@mui/icons-material/Translate";
import api from "@/lib/api";
import { tokens } from "@/lib/theme";
import { OT_QUICK_HOURS, LUNCH_QUICK_AMOUNTS } from "@/lib/siteUtils";

const muted = "#6b665c";
const nameKey = (token) => `vw_attn_name_${token}`;
const langKey = "vw_attn_lang";

const STATUS_COLOR = {
  present: "#2e7d32",
  half_day: "#B7791F",
  absent: tokens.rust,
  leave: "#6b665c",
};

// This page is used by the crew, so it keeps an English / Hindi toggle.
const STRINGS = {
  en: {
    title: "Crew Attendance",
    yourName: "Your name",
    nameHelp: "Saved on this phone for next time. Your name is shown against every entry you mark.",
    continueBtn: "Continue",
    enterPin: "Enter the 4-digit PIN",
    incorrectPin: "Incorrect PIN",
    present: "Present",
    halfDay: "Half day",
    absent: "Absent",
    leave: "Leave",
    overtime: "Overtime",
    lunch: "Lunch",
    hrsShort: "h",
    other: "Other",
    noWorkers: "No active workers on this site yet.",
    invalidLink: "This link is invalid or has been turned off. Please ask your contractor for a new link.",
    locked: "Settled",
    locationOff: "Share location",
    locationOn: "Location on",
    locationDenied: "Location permission was denied",
    lang: "हिंदी",
    savedError: "Could not save. Please try again.",
    saved: "Saved",
    markAllPresent: "Mark all present",
    marked: "marked",
    allMarked: "All marked",
    today: "Today",
    submit: "Submit",
    confirmTitle: "Submit attendance?",
    confirmSubmit: "Confirm & submit",
    back: "Back",
    summaryTitle: "Attendance",
    summaryNotMarked: "not marked yet",
    totalOvertime: "Total overtime",
    totalLunch: "Total lunch",
    summaryOk: "OK",
    thankYou: "Thank you!",
    thankYouMsg: "Attendance has been submitted.",
    editBtn: "Edit",
    viewBtn: "View",
    markingAs: "Marking as",
    change: "Change",
  },
  hi: {
    title: "हाज़िरी",
    yourName: "आपका नाम",
    nameHelp: "इस फ़ोन में अगली बार के लिए सेव हो जाएगा। हर एंट्री पर आपका नाम दिखेगा।",
    continueBtn: "आगे बढ़ें",
    enterPin: "4 अंकों का पिन डालें",
    incorrectPin: "गलत पिन",
    present: "हाज़िर",
    halfDay: "आधा दिन",
    absent: "गैरहाज़िर",
    leave: "छुट्टी",
    overtime: "ओवरटाइम",
    lunch: "खाना",
    hrsShort: "घं",
    other: "अन्य",
    noWorkers: "अभी कोई सक्रिय मज़दूर नहीं है।",
    invalidLink: "यह लिंक सही नहीं है या बंद कर दिया गया है। कॉन्ट्रैक्टर से नया लिंक मांगें।",
    locked: "सेटल",
    locationOff: "लोकेशन भेजें",
    locationOn: "लोकेशन चालू",
    locationDenied: "लोकेशन की अनुमति नहीं मिली",
    lang: "English",
    savedError: "सेव नहीं हो पाया। दोबारा कोशिश करें।",
    saved: "सेव हो गया",
    markAllPresent: "सभी को हाज़िर करें",
    marked: "भरे गए",
    allMarked: "सब भर दिया",
    today: "आज",
    submit: "जमा करें",
    confirmTitle: "हाज़िरी जमा करें?",
    confirmSubmit: "पक्का, जमा करें",
    back: "वापस",
    summaryTitle: "हाज़िरी",
    summaryNotMarked: "अभी तक भरा नहीं",
    totalOvertime: "कुल ओवरटाइम",
    totalLunch: "कुल खाना",
    summaryOk: "ठीक है",
    thankYou: "धन्यवाद!",
    thankYouMsg: "हाज़िरी जमा हो गई है।",
    editBtn: "बदलें",
    viewBtn: "देखें",
    markingAs: "आप भर रहे हैं:",
    change: "बदलें",
  },
};

/* ---------- helpers ---------- */

const locale = (lang) => (lang === "hi" ? "hi-IN" : "en-IN");
const fdateShort = (iso, lang) =>
  iso ? new Date(iso).toLocaleDateString(locale(lang), { day: "2-digit", month: "short", timeZone: "UTC" }) : "";
const weekday = (iso, lang) =>
  new Date(iso).toLocaleDateString(locale(lang), { weekday: "short", timeZone: "UTC" });
const todayISO = () => new Date().toLocaleDateString("en-CA"); // yyyy-mm-dd, local time

const entryFor = (worker, date) => worker.attendance.find((a) => a.date === date);
const isMarked = (worker, date) => !!entryFor(worker, date)?.status;

/* ---------- small components ---------- */

// One big tap target for a status. Colour fills in when selected.
function StatusButton({ active, disabled, color, Icon, label, onClick }) {
  return (
    <ButtonBase
      disabled={disabled}
      onClick={onClick}
      sx={{
        flexDirection: "column",
        gap: 0.25,
        minHeight: 60,
        borderRadius: 1.5,
        border: `1.5px solid ${active ? color : tokens.line}`,
        bgcolor: active ? color : "#fff",
        color: active ? "#fff" : color,
        opacity: disabled && !active ? 0.45 : 1,
        transition: "background-color .12s, transform .08s",
        "&:active": { transform: "scale(0.96)" },
      }}
    >
      <Icon sx={{ fontSize: 22 }} />
      <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, lineHeight: 1.1, color: "inherit" }}>{label}</Typography>
    </ButtonBase>
  );
}

// Quick-pick chips. Tap a selected chip again to clear it. "Other" opens a number box.
function QuickChips({ icon: Icon, label, value, options, format, otherLabel, disabled, onPick }) {
  const [custom, setCustom] = useState(false);
  const [draft, setDraft] = useState("");
  const v = Number(value) || 0;
  const isCustomValue = v > 0 && !options.includes(v);

  const commit = () => {
    const n = Number(draft);
    if (n > 0) onPick(n);
    setDraft("");
    setCustom(false);
  };

  return (
    <Box sx={{ mt: 1.5 }}>
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.75 }}>
        <Icon sx={{ fontSize: 17, color: muted }} />
        <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: muted }}>{label}</Typography>
      </Stack>
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ overflowX: "auto", pb: 0.5 }}>
        {options.map((o) => (
          <Chip
            key={o}
            label={format(o)}
            clickable
            disabled={disabled}
            color={v === o ? "primary" : "default"}
            variant={v === o ? "filled" : "outlined"}
            onClick={() => onPick(v === o ? 0 : o)}
            sx={{ flexShrink: 0, fontWeight: 600 }}
          />
        ))}
        {isCustomValue && (
          <Chip label={format(v)} color="primary" onDelete={() => onPick(0)} sx={{ flexShrink: 0, fontWeight: 600 }} />
        )}
        {custom ? (
          <Stack direction="row" alignItems="center" sx={{ flexShrink: 0 }}>
            <TextField
              size="small"
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value.replace(/[^\d.]/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && commit()}
              inputProps={{ inputMode: "decimal" }}
              sx={{ width: 76, "& .MuiInputBase-input": { py: 0.75, px: 1 } }}
            />
            <IconButton size="small" onClick={commit} sx={{ ml: 0.5, bgcolor: tokens.paperAlt }}>
              <CheckIcon fontSize="small" />
            </IconButton>
          </Stack>
        ) : (
          <Chip label={otherLabel} variant="outlined" clickable disabled={disabled} onClick={() => setCustom(true)} sx={{ flexShrink: 0 }} />
        )}
      </Stack>
    </Box>
  );
}

function WorkerCard({ worker, token, date, t, name, pin, onPatch, justSaved }) {
  const entry = entryFor(worker, date);
  const status = entry?.status;
  const locked = entry?.locked;
  const showExtras = status === "present" || status === "half_day";
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handlePhoto = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("date", date);
      fd.append("name", name);
      if (pin) fd.append("pin", pin);
      fd.append("photo", file);
      const res = await api.post(`/sites/attendance/${token}/${worker._id}`, fd);
      onPatch(worker, date, res.data.attendance, true);
    } catch {
      // the photo is optional, so a failed upload is skipped silently
    } finally {
      setUploading(false);
    }
  };

  const set = (value) => onPatch(worker, date, { status: value });

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        mb: 1.5,
        border: `1px solid ${tokens.line}`,
        borderLeft: `5px solid ${STATUS_COLOR[status] || "#d8d3c6"}`,
        bgcolor: "#fff",
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.5 }}>
        <Avatar sx={{ width: 40, height: 40, fontSize: "1rem", fontWeight: 700, bgcolor: tokens.ink }}>
          {worker.name.charAt(0).toUpperCase()}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, lineHeight: 1.25 }} noWrap>{worker.name}</Typography>
          {worker.role && <Typography sx={{ fontSize: "0.78rem", color: muted }} noWrap>{worker.role}</Typography>}
        </Box>
        {locked && <Chip size="small" icon={<LockIcon />} label={t.locked} />}
        {!locked && justSaved && <Chip size="small" icon={<CheckIcon />} label={t.saved} color="success" />}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => handlePhoto(e.target.files?.[0])} />
        <IconButton
          disabled={locked || uploading}
          onClick={() => fileRef.current?.click()}
          aria-label="Take photo"
          sx={{ bgcolor: entry?.photo ? "#e8f5e9" : tokens.paperAlt }}
        >
          {uploading ? <CircularProgress size={18} /> : <PhotoCameraIcon fontSize="small" sx={{ color: entry?.photo ? "#2e7d32" : muted }} />}
        </IconButton>
      </Stack>

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1 }}>
        <StatusButton active={status === "present"} disabled={locked} color={STATUS_COLOR.present} Icon={CheckCircleIcon} label={t.present} onClick={() => set("present")} />
        <StatusButton active={status === "half_day"} disabled={locked} color={STATUS_COLOR.half_day} Icon={AccessTimeIcon} label={t.halfDay} onClick={() => set("half_day")} />
        <StatusButton active={status === "absent"} disabled={locked} color={STATUS_COLOR.absent} Icon={CancelIcon} label={t.absent} onClick={() => set("absent")} />
        <StatusButton active={status === "leave"} disabled={locked} color={STATUS_COLOR.leave} Icon={EventBusyIcon} label={t.leave} onClick={() => set("leave")} />
      </Box>

      {/* overtime and lunch only matter when the worker came to site */}
      {showExtras && (
        <Box sx={{ mt: 0.5, pt: 0.5, borderTop: `1px dashed ${tokens.line}` }}>
          <QuickChips
            icon={MoreTimeIcon}
            label={t.overtime}
            value={entry?.overtimeHours || 0}
            options={OT_QUICK_HOURS}
            format={(o) => `${o}${t.hrsShort}`}
            otherLabel={t.other}
            disabled={locked}
            onPick={(v) => onPatch(worker, date, { overtimeHours: v })}
          />
          <QuickChips
            icon={RestaurantIcon}
            label={t.lunch}
            value={entry?.lunchAmount || 0}
            options={LUNCH_QUICK_AMOUNTS}
            format={(o) => `₹${o}`}
            otherLabel={t.other}
            disabled={locked}
            onPick={(v) => onPatch(worker, date, { lunchAmount: v })}
          />
        </Box>
      )}
    </Paper>
  );
}

/* ---------- page ---------- */

export default function CrewAttendancePage() {
  const { token } = useParams();
  const [lang, setLang] = useState("en");
  const [data, setData] = useState(null); // { site, window, workers }
  const [notFound, setNotFound] = useState(false);
  const [needsPin, setNeedsPin] = useState(false);
  const [pin, setPin] = useState("");
  const [pinDraft, setPinDraft] = useState("");
  const [pinError, setPinError] = useState("");
  const [name, setName] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [selectedDate, setSelectedDate] = useState(null);
  const [location, setLocation] = useState(null);
  const [toast, setToast] = useState("");
  const [savedFlash, setSavedFlash] = useState({}); // workerId -> true briefly after a save
  const [dialog, setDialog] = useState(null); // null | "confirm" | "view"
  const [submitted, setSubmitted] = useState(false);

  const t = STRINGS[lang];

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const load = (pinValue) => {
    const qs = pinValue ? `?pin=${encodeURIComponent(pinValue)}` : "";
    api
      .get(`/sites/attendance/${token}${qs}`)
      .then((res) => {
        setData(res.data);
        setSelectedDate((d) => d || res.data.window[0]);
        setNeedsPin(false);
        setPinError("");
      })
      .catch((err) => {
        if (err?.response?.data?.pinRequired) {
          setNeedsPin(true);
          if (pinValue) setPinError(t.incorrectPin);
        } else {
          setNotFound(true);
        }
      });
  };

  useEffect(() => {
    load();
    const savedName = localStorage.getItem(nameKey(token));
    if (savedName) setName(savedName);
    const savedLang = localStorage.getItem(langKey);
    if (savedLang && STRINGS[savedLang]) setLang(savedLang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const toggleLang = () => {
    const next = lang === "en" ? "hi" : "en";
    setLang(next);
    localStorage.setItem(langKey, next);
  };

  const submitPin = () => {
    if (pinDraft.length !== 4) return;
    setPin(pinDraft);
    load(pinDraft);
  };

  const submitName = () => {
    const n = nameDraft.trim();
    if (!n) return;
    setName(n);
    localStorage.setItem(nameKey(token), n);
  };

  const toggleLocation = () => {
    if (location) {
      setLocation(null);
      return;
    }
    if (!navigator.geolocation) return showToast(t.locationDenied);
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => showToast(t.locationDenied)
    );
  };

  // Optimistic update: change the screen immediately, save in the background, undo if the save fails.
  const patch = (worker, date, fields, isServerEntry = false) => {
    setData((d) => {
      const workers = d.workers.map((w) => {
        if (w._id !== worker._id) return w;
        const attendance = [...w.attendance];
        const idx = attendance.findIndex((a) => a.date === date);
        if (isServerEntry) {
          if (idx >= 0) attendance[idx] = fields;
          else attendance.push(fields);
        } else if (idx >= 0) {
          attendance[idx] = { ...attendance[idx], ...fields };
        } else {
          attendance.push({ date, status: "present", overtimeHours: 0, lunchAmount: 0, ...fields });
        }
        return { ...w, attendance };
      });
      return { ...d, workers };
    });

    if (isServerEntry) return; // already saved (photo uploads)

    const fd = new FormData();
    fd.append("date", date);
    fd.append("name", name);
    if (pin) fd.append("pin", pin);
    if (location) {
      fd.append("lat", location.lat);
      fd.append("lng", location.lng);
    }
    Object.entries(fields).forEach(([k, v]) => fd.append(k, v));

    api
      .post(`/sites/attendance/${token}/${worker._id}`, fd)
      .then(() => {
        setSavedFlash((s) => ({ ...s, [worker._id]: true }));
        setTimeout(() => setSavedFlash((s) => ({ ...s, [worker._id]: false })), 1800);
      })
      .catch(() => {
        showToast(t.savedError);
        load(pin); // reload from the server to undo the optimistic change
      });
  };

  /* ----- early screens ----- */

  if (notFound) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Alert severity="warning">{t.invalidLink}</Alert>
      </Container>
    );
  }

  if (needsPin) {
    return (
      <Container maxWidth="xs" sx={{ py: 10 }}>
        <Paper elevation={0} sx={{ p: 3, border: `1px solid ${tokens.line}`, textAlign: "center" }}>
          <LockIcon sx={{ fontSize: 34, color: tokens.rust, mb: 1 }} />
          <Typography sx={{ fontWeight: 700, mb: 2 }}>{t.enterPin}</Typography>
          {pinError && <Alert severity="error" sx={{ mb: 2 }}>{pinError}</Alert>}
          <TextField
            fullWidth
            autoFocus
            value={pinDraft}
            onChange={(e) => setPinDraft(e.target.value.replace(/\D/g, "").slice(0, 4))}
            onKeyDown={(e) => e.key === "Enter" && submitPin()}
            inputProps={{ inputMode: "numeric", style: { textAlign: "center", fontSize: "1.6rem", letterSpacing: "0.5em" } }}
          />
          <Button fullWidth size="large" variant="contained" sx={{ mt: 2 }} disabled={pinDraft.length !== 4} onClick={submitPin}>
            {t.continueBtn}
          </Button>
        </Paper>
      </Container>
    );
  }

  if (!data) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
        <CircularProgress sx={{ color: tokens.rust }} />
      </Box>
    );
  }

  /* ----- main screen ----- */

  const { site, window: dateWindow, workers } = data;
  const total = workers.length;
  const marked = workers.filter((w) => isMarked(w, selectedDate)).length;
  const unmarked = total - marked;
  const pct = total ? Math.round((marked / total) * 100) : 0;
  const dayDone = (d) => total > 0 && workers.every((w) => isMarked(w, d));

  const stats = { counts: { present: 0, half_day: 0, absent: 0, leave: 0 }, ot: 0, lunch: 0 };
  workers.forEach((w) => {
    const e = entryFor(w, selectedDate);
    if (!e?.status) return;
    stats.counts[e.status] += 1;
    stats.ot += Number(e.overtimeHours) || 0;
    stats.lunch += Number(e.lunchAmount) || 0;
  });

  const markAllPresent = () => {
    workers.forEach((w) => {
      const e = entryFor(w, selectedDate);
      if (!e?.status && !e?.locked) patch(w, selectedDate, { status: "present" });
    });
  };

  const summaryRows = [
    [t.present, stats.counts.present, STATUS_COLOR.present],
    [t.halfDay, stats.counts.half_day, STATUS_COLOR.half_day],
    [t.absent, stats.counts.absent, STATUS_COLOR.absent],
    [t.leave, stats.counts.leave, STATUS_COLOR.leave],
  ];

  return (
    <Box sx={{ bgcolor: tokens.paper, minHeight: "100vh", pb: submitted ? 4 : 14 }}>
      {/* name prompt */}
      <Dialog open={!name} disableEscapeKeyDown maxWidth="xs" fullWidth>
        <DialogTitle>{t.yourName}</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: muted, fontSize: "0.88rem", mb: 2 }}>{t.nameHelp}</Typography>
          <TextField
            fullWidth
            autoFocus
            label={t.yourName}
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitName()}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="contained" size="large" fullWidth disabled={!nameDraft.trim()} onClick={submitName}>
            {t.continueBtn}
          </Button>
        </DialogActions>
      </Dialog>

      {/* header */}
      <Box sx={{ bgcolor: tokens.ink, color: "#fff", pt: 3, pb: 2.5 }}>
        <Container maxWidth="sm">
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h4" sx={{ color: "#fff", fontSize: "1.45rem" }}>{t.title}</Typography>
              <Typography sx={{ color: "#fff", opacity: 0.8, mt: 0.25, fontSize: "0.9rem" }}>
                {site.name}{site.location ? ` · ${site.location}` : ""}
              </Typography>
              {name && (
                <Typography sx={{ color: "#fff", opacity: 0.65, mt: 0.75, fontSize: "0.78rem" }}>
                  {t.markingAs} <b>{name}</b>{" · "}
                  <Box
                    component="span"
                    role="button"
                    onClick={() => { setNameDraft(name); setName(""); }}
                    sx={{ textDecoration: "underline", cursor: "pointer" }}
                  >
                    {t.change}
                  </Box>
                </Typography>
              )}
            </Box>
            <Button
              size="small"
              variant="outlined"
              startIcon={<TranslateIcon />}
              onClick={toggleLang}
              sx={{ color: "#fff", borderColor: "rgba(255,255,255,0.45)", flexShrink: 0 }}
            >
              {t.lang}
            </Button>
          </Stack>
        </Container>
      </Box>

      {/* sticky date strip */}
      <Box sx={{ position: "sticky", top: 0, zIndex: 10, bgcolor: tokens.paper, borderBottom: `1px solid ${tokens.line}`, py: 1.25 }}>
        <Container maxWidth="sm">
          <Stack direction="row" spacing={1} sx={{ overflowX: "auto", pb: 0.25 }}>
            {dateWindow.map((d) => {
              const selected = d === selectedDate;
              const isToday = d.slice(0, 10) === todayISO();
              return (
                <ButtonBase
                  key={d}
                  onClick={() => { setSelectedDate(d); setSubmitted(false); }}
                  sx={{
                    flexShrink: 0,
                    flexDirection: "column",
                    minWidth: 62,
                    py: 0.75,
                    px: 1,
                    borderRadius: 1.5,
                    border: `1.5px solid ${selected ? tokens.ink : tokens.line}`,
                    bgcolor: selected ? tokens.ink : "#fff",
                    color: selected ? "#fff" : tokens.ink,
                    position: "relative",
                  }}
                >
                  <Typography sx={{ fontSize: "0.68rem", opacity: 0.85, color: "inherit", lineHeight: 1.2 }}>
                    {isToday ? t.today : weekday(d, lang)}
                  </Typography>
                  <Typography sx={{ fontWeight: 700, fontSize: "0.9rem", color: "inherit", lineHeight: 1.3 }}>
                    {fdateShort(d, lang)}
                  </Typography>
                  {dayDone(d) && (
                    <CheckCircleIcon sx={{ position: "absolute", top: -7, right: -7, fontSize: 17, color: "#2e7d32", bgcolor: "#fff", borderRadius: "50%" }} />
                  )}
                </ButtonBase>
              );
            })}
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="sm" sx={{ mt: 2 }}>
        {submitted ? (
          <Paper elevation={0} sx={{ p: 4, border: `1px solid ${tokens.line}`, textAlign: "center" }}>
            <CheckCircleIcon sx={{ fontSize: 52, color: "#2e7d32", mb: 1 }} />
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>{t.thankYou}</Typography>
            <Typography sx={{ color: muted, mb: 3 }}>{t.thankYouMsg}</Typography>
            <Stack direction="row" spacing={1.5} justifyContent="center">
              <Button variant="outlined" size="large" onClick={() => setSubmitted(false)}>{t.editBtn}</Button>
              <Button variant="contained" size="large" onClick={() => setDialog("view")}>{t.viewBtn}</Button>
            </Stack>
          </Paper>
        ) : total === 0 ? (
          <Typography sx={{ color: muted, textAlign: "center", mt: 6 }}>{t.noWorkers}</Typography>
        ) : (
          <>
            {/* quick actions */}
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<DoneAllIcon />}
                disabled={unmarked === 0}
                onClick={markAllPresent}
                sx={{ borderColor: STATUS_COLOR.present, color: STATUS_COLOR.present, fontWeight: 700, bgcolor: "#fff" }}
              >
                {t.markAllPresent}
              </Button>
              <Button
                variant={location ? "contained" : "outlined"}
                color={location ? "success" : "inherit"}
                onClick={toggleLocation}
                aria-label={location ? t.locationOn : t.locationOff}
                sx={{ flexShrink: 0, minWidth: 0, px: 1.75, borderColor: tokens.line, bgcolor: location ? undefined : "#fff" }}
              >
                {location ? <LocationOnIcon /> : <LocationOffIcon sx={{ color: muted }} />}
              </Button>
            </Stack>

            {workers.map((w) => (
              <WorkerCard
                key={w._id}
                worker={w}
                token={token}
                date={selectedDate}
                t={t}
                name={name}
                pin={pin}
                onPatch={patch}
                justSaved={!!savedFlash[w._id]}
              />
            ))}
          </>
        )}
      </Container>

      {/* sticky bottom bar: progress + submit */}
      {!submitted && total > 0 && (
        <Box
          sx={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 20,
            bgcolor: "#fff",
            borderTop: `1px solid ${tokens.line}`,
            pb: "env(safe-area-inset-bottom, 0px)",
            boxShadow: "0 -4px 14px rgba(0,0,0,0.06)",
          }}
        >
          <Container maxWidth="sm" sx={{ py: 1.25 }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, fontSize: "0.9rem", mb: 0.5, color: unmarked === 0 ? "#2e7d32" : tokens.ink }}>
                  {unmarked === 0 ? t.allMarked : `${marked} / ${total} ${t.marked}`}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={pct}
                  sx={{
                    height: 6,
                    borderRadius: 3,
                    bgcolor: "#ece8df",
                    "& .MuiLinearProgress-bar": { bgcolor: unmarked === 0 ? "#2e7d32" : tokens.rust, borderRadius: 3 },
                  }}
                />
              </Box>
              <Button variant="contained" size="large" onClick={() => setDialog("confirm")} sx={{ px: 3, flexShrink: 0 }}>
                {t.submit}
              </Button>
            </Stack>
          </Container>
        </Box>
      )}

      {/* summary / confirm dialog */}
      <Dialog open={!!dialog} onClose={() => setDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          {dialog === "confirm" ? t.confirmTitle : t.summaryTitle} · {fdateShort(selectedDate, lang)}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={1}>
            {summaryRows.map(([label, n, color]) => (
              <Stack key={label} direction="row" justifyContent="space-between">
                <Typography sx={{ color }}>{label}</Typography>
                <Typography sx={{ fontWeight: 700, color }}>{n}</Typography>
              </Stack>
            ))}
            {(stats.ot > 0 || stats.lunch > 0) && (
              <Box sx={{ pt: 1, mt: 0.5, borderTop: `1px solid ${tokens.line}` }}>
                {stats.ot > 0 && (
                  <Stack direction="row" justifyContent="space-between">
                    <Typography sx={{ color: muted }}>{t.totalOvertime}</Typography>
                    <Typography sx={{ fontWeight: 700 }}>{stats.ot}{t.hrsShort}</Typography>
                  </Stack>
                )}
                {stats.lunch > 0 && (
                  <Stack direction="row" justifyContent="space-between">
                    <Typography sx={{ color: muted }}>{t.totalLunch}</Typography>
                    <Typography sx={{ fontWeight: 700 }}>₹{stats.lunch}</Typography>
                  </Stack>
                )}
              </Box>
            )}
            {unmarked > 0 && <Alert severity="warning" sx={{ mt: 1 }}>{unmarked} {t.summaryNotMarked}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          {dialog === "confirm" ? (
            <>
              <Button variant="outlined" size="large" onClick={() => setDialog(null)} sx={{ flex: 1 }}>{t.back}</Button>
              <Button
                variant="contained"
                size="large"
                onClick={() => { setDialog(null); setSubmitted(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                sx={{ flex: 2 }}
              >
                {t.confirmSubmit}
              </Button>
            </>
          ) : (
            <Button variant="contained" size="large" fullWidth onClick={() => setDialog(null)}>{t.summaryOk}</Button>
          )}
        </DialogActions>
      </Dialog>

      <Snackbar open={!!toast} message={toast} anchorOrigin={{ vertical: "top", horizontal: "center" }} />
    </Box>
  );
}