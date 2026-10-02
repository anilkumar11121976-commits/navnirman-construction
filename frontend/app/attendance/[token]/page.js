"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  Alert, Avatar, Box, Button, Chip, CircularProgress, Container, Dialog, DialogActions, DialogContent,
  DialogTitle, IconButton, Paper, Stack, TextField, Typography,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircleOutline";
import CancelIcon from "@mui/icons-material/CancelOutlined";
import AccessTimeIcon from "@mui/icons-material/AccessTimeOutlined";
import EventBusyIcon from "@mui/icons-material/EventBusyOutlined";
import RestaurantIcon from "@mui/icons-material/RestaurantOutlined";
import LockIcon from "@mui/icons-material/LockOutlined";
import PhotoCameraIcon from "@mui/icons-material/PhotoCameraOutlined";
import CheckIcon from "@mui/icons-material/Check";
import LocationOnIcon from "@mui/icons-material/LocationOnOutlined";
import TranslateIcon from "@mui/icons-material/Translate";
import api from "@/lib/api";
import { tokens } from "@/lib/theme";
import { OT_QUICK_HOURS, LUNCH_QUICK_AMOUNTS } from "@/lib/siteUtils";

const muted = "#6b665c";
const nameKey = (token) => `vw_attn_name_${token}`;
const langKey = "vw_attn_lang";

const STRINGS = {
  en: {
    title: "Crew Attendance",
    subtitle: "Mark today's attendance for the crew",
    yourName: "Your name",
    nameHelp: "Saved on this phone for next time — shown against every entry you mark.",
    continueBtn: "Continue",
    enterPin: "Enter the 4-digit PIN",
    present: "Present",
    halfDay: "Half day",
    absent: "Absent",
    leave: "Leave",
    overtime: "Overtime",
    hrs: "hrs",
    lunch: "Lunch",
    noWorkers: "No active workers on this site yet.",
    invalidLink: "This link is invalid or has been turned off. Please ask your contractor for a new link.",
    locked: "Settled — locked",
    shareLocation: "Share my location",
    locationOn: "Location shared",
    lang: "हिंदी",
    savedError: "Could not save. Please try again.",
  },
  hi: {
    title: "हाज़िरी",
    subtitle: "आज की हाज़िरी भरें",
    yourName: "आपका नाम",
    nameHelp: "इस फ़ोन में अगली बार के लिए सेव हो जाएगा — हर एंट्री पर आपका नाम दिखेगा।",
    continueBtn: "आगे बढ़ें",
    enterPin: "4 अंकों का पिन डालें",
    present: "हाज़िर",
    halfDay: "आधा दिन",
    absent: "गैरहाज़िर",
    leave: "छुट्टी",
    overtime: "ओवरटाइम",
    hrs: "घंटे",
    lunch: "खाना",
    noWorkers: "अभी कोई सक्रिय मज़दूर नहीं है।",
    invalidLink: "यह लिंक सही नहीं है या बंद कर दिया गया है। कॉन्ट्रैक्टर से नया लिंक मांगें।",
    locked: "सेटल — लॉक है",
    shareLocation: "मेरी लोकेशन भेजें",
    locationOn: "लोकेशन भेज दी गई",
    lang: "English",
    savedError: "सेव नहीं हो पाया। दोबारा कोशिश करें।",
  },
};

function fdateShort(iso, lang) {
  const d = new Date(iso);
  return d.toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { day: "2-digit", month: "short" });
}
function weekday(iso, lang) {
  const d = new Date(iso);
  return d.toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { weekday: "short" });
}

function QuickChips({ icon: Icon, label, value, options, suffix, onPick }) {
  const [custom, setCustom] = useState("");
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" sx={{ rowGap: 0.75, mt: 1 }}>
      <Icon fontSize="small" sx={{ color: muted }} />
      <Typography sx={{ fontSize: "0.78rem", color: muted, mr: 0.5 }}>{label}</Typography>
      {options.map((o) => (
        <Chip
          key={o}
          size="small"
          label={`${o}${suffix}`}
          clickable
          color={Number(value) === o ? "primary" : "default"}
          variant={Number(value) === o ? "filled" : "outlined"}
          onClick={() => onPick(o)}
        />
      ))}
      <TextField
        size="small"
        placeholder="…"
        value={custom}
        onChange={(e) => setCustom(e.target.value.replace(/[^\d.]/g, ""))}
        sx={{ width: 60, "& .MuiInputBase-input": { py: 0.5, px: 1 } }}
      />
      {custom !== "" && (
        <IconButton size="small" onClick={() => { onPick(Number(custom)); setCustom(""); }} sx={{ bgcolor: tokens.paperAlt }}>
          <CheckIcon fontSize="small" />
        </IconButton>
      )}
      {Number(value) > 0 && <Chip size="small" label={`${value}${suffix}`} sx={{ bgcolor: tokens.rust, color: "#fff", fontWeight: 700 }} />}
    </Stack>
  );
}

function WorkerRow({ worker, date, t, name, pin, onPatch }) {
  const entry = worker.attendance.find((a) => a.date === date);
  const status = entry?.status;
  const locked = entry?.locked;
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const statusBtn = (value, label, Icon, color) => (
    <Button
      fullWidth
      disabled={locked}
      variant={status === value ? "contained" : "outlined"}
      startIcon={<Icon />}
      onClick={() => onPatch(worker, date, { status: value })}
      sx={
        status === value
          ? { bgcolor: color, "&:hover": { bgcolor: color } }
          : { borderColor: tokens.line, color, "& .MuiButton-startIcon": { color } }
      }
    >
      {label}
    </Button>
  );

  const handlePhoto = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("date", date);
      fd.append("name", name);
      if (pin) fd.append("pin", pin);
      fd.append("photo", file);
      const res = await api.post(`/sites/attendance/${worker.__token}/${worker._id}`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      onPatch(worker, date, res.data.attendance, true);
    } catch {
      // ignore — photo is optional, silently skip on failure
    } finally {
      setUploading(false);
    }
  };

  return (
    <Paper elevation={0} sx={{ p: 2, border: `1px solid ${tokens.line}`, mb: 1.5 }}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.5 }}>
        <Avatar sx={{ width: 36, height: 36, fontSize: "0.95rem", fontWeight: 700, bgcolor: tokens.rust }}>
          {worker.name.charAt(0).toUpperCase()}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700 }}>{worker.name}</Typography>
          {worker.role && <Typography sx={{ fontSize: "0.78rem", color: muted }}>{worker.role}</Typography>}
        </Box>
        {locked && <Chip size="small" icon={<LockIcon />} label={t.locked} />}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => handlePhoto(e.target.files?.[0])} />
        <IconButton size="small" disabled={locked || uploading} onClick={() => fileRef.current?.click()} sx={{ bgcolor: entry?.photo ? "#e8f5e9" : tokens.paperAlt }}>
          {uploading ? <CircularProgress size={16} /> : <PhotoCameraIcon fontSize="small" sx={{ color: entry?.photo ? "#2e7d32" : muted }} />}
        </IconButton>
      </Stack>

      <Stack direction="row" spacing={1}>
        {statusBtn("present", t.present, CheckCircleIcon, "#2e7d32")}
        {statusBtn("half_day", t.halfDay, AccessTimeIcon, "#B7791F")}
        {statusBtn("absent", t.absent, CancelIcon, tokens.rust)}
      </Stack>
      <Button
        size="small"
        disabled={locked}
        onClick={() => onPatch(worker, date, { status: "leave" })}
        startIcon={<EventBusyIcon fontSize="small" />}
        sx={{ mt: 0.5, color: status === "leave" ? tokens.ink : muted, fontWeight: status === "leave" ? 700 : 400 }}
      >
        {t.leave}
      </Button>

      <QuickChips
        icon={AccessTimeIcon}
        label={t.overtime}
        value={entry?.overtimeHours || 0}
        options={OT_QUICK_HOURS}
        suffix={t.hrs === "hrs" ? "h" : " घं"}
        onPick={(v) => onPatch(worker, date, { overtimeHours: v })}
      />
      <QuickChips
        icon={RestaurantIcon}
        label={t.lunch}
        value={entry?.lunchAmount || 0}
        options={LUNCH_QUICK_AMOUNTS}
        suffix="₹"
        onPick={(v) => onPatch(worker, date, { lunchAmount: v })}
      />
    </Paper>
  );
}

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

  const t = STRINGS[lang];

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
          if (pinValue) setPinError("Incorrect PIN");
        } else {
          setNotFound(true);
        }
      });
  };

  useEffect(() => {
    load();
    const savedName = typeof window !== "undefined" ? localStorage.getItem(nameKey(token)) : "";
    if (savedName) setName(savedName);
    const savedLang = typeof window !== "undefined" ? localStorage.getItem(langKey) : "";
    if (savedLang) setLang(savedLang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const toggleLang = () => {
    const next = lang === "en" ? "hi" : "en";
    setLang(next);
    if (typeof window !== "undefined") localStorage.setItem(langKey, next);
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
    if (typeof window !== "undefined") localStorage.setItem(nameKey(token), n);
  };

  const shareLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {}
    );
  };

  // optimistic patch: update local state immediately, save in the background, roll back on failure
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

    if (isServerEntry) return; // already saved (used for photo uploads)

    const fd = new FormData();
    fd.append("date", date);
    fd.append("name", name);
    if (pin) fd.append("pin", pin);
    if (location) {
      fd.append("lat", location.lat);
      fd.append("lng", location.lng);
    }
    Object.entries(fields).forEach(([k, v]) => fd.append(k, v));

    api.post(`/sites/attendance/${token}/${worker._id}`, fd, { headers: { "Content-Type": "multipart/form-data" } }).catch(() => {
      setToast(t.savedError);
      setTimeout(() => setToast(""), 2500);
      load(pin); // reload from server to undo the optimistic change
    });
  };

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
          <LockIcon sx={{ fontSize: 32, color: tokens.rust, mb: 1 }} />
          <Typography sx={{ fontWeight: 700, mb: 2 }}>{t.enterPin}</Typography>
          {pinError && <Alert severity="error" sx={{ mb: 2 }}>{pinError}</Alert>}
          <TextField
            fullWidth
            autoFocus
            value={pinDraft}
            onChange={(e) => setPinDraft(e.target.value.replace(/\D/g, "").slice(0, 4))}
            onKeyDown={(e) => e.key === "Enter" && submitPin()}
            inputProps={{ inputMode: "numeric", style: { textAlign: "center", fontSize: "1.5rem", letterSpacing: "0.5em" } }}
          />
          <Button fullWidth variant="contained" sx={{ mt: 2 }} disabled={pinDraft.length !== 4} onClick={submitPin}>
            Continue
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

  const { site, window: dateWindow, workers } = data;
  // give each worker a reference back to the token, for the photo-upload handler
  const workersWithToken = workers.map((w) => ({ ...w, __token: token }));

  return (
    <Box sx={{ bgcolor: tokens.paper, minHeight: "100vh", pb: 6 }}>
      <Dialog open={!name} disableEscapeKeyDown maxWidth="xs" fullWidth>
        <DialogTitle>{t.yourName}</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: muted, fontSize: "0.88rem", mb: 2 }}>{t.nameHelp}</Typography>
          <TextField fullWidth autoFocus label={t.yourName} value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitName()} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="contained" fullWidth disabled={!nameDraft.trim()} onClick={submitName}>{t.continueBtn}</Button>
        </DialogActions>
      </Dialog>

      <Box sx={{ bgcolor: tokens.ink, color: "#fff", pt: { xs: 3, md: 4 }, pb: { xs: 3, md: 4 } }}>
        <Container maxWidth="sm">
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Typography variant="h4" sx={{ color: "#fff", fontSize: { xs: "1.4rem", md: "1.6rem" } }}>{t.title}</Typography>
              <Typography sx={{ color: "#fff", opacity: 0.8, mt: 0.5, fontSize: "0.9rem" }}>{site.name}{site.location ? ` · ${site.location}` : ""}</Typography>
            </Box>
            <Button size="small" startIcon={<TranslateIcon />} onClick={toggleLang} sx={{ color: "#fff", borderColor: "rgba(255,255,255,0.4)", flexShrink: 0 }} variant="outlined">
              {t.lang}
            </Button>
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="sm" sx={{ mt: 2.5 }}>
        {toast && <Alert severity="error" sx={{ mb: 2 }}>{toast}</Alert>}

        {/* date picker — last 7 days */}
        <Stack direction="row" spacing={1} sx={{ mb: 2, overflowX: "auto", pb: 0.5 }}>
          {dateWindow.map((d) => (
            <Button
              key={d}
              size="small"
              variant={d === selectedDate ? "contained" : "outlined"}
              onClick={() => setSelectedDate(d)}
              sx={{ flexDirection: "column", minWidth: 56, lineHeight: 1.2, py: 0.5, borderColor: tokens.line, color: d === selectedDate ? "#fff" : tokens.ink }}
            >
              <span style={{ fontSize: "0.68rem", opacity: 0.85 }}>{weekday(d, lang)}</span>
              <span style={{ fontWeight: 700 }}>{fdateShort(d, lang)}</span>
            </Button>
          ))}
        </Stack>

        {!location && (
          <Button size="small" startIcon={<LocationOnIcon />} onClick={shareLocation} sx={{ mb: 2, color: muted }}>
            {t.shareLocation}
          </Button>
        )}
        {location && (
          <Chip size="small" icon={<LocationOnIcon />} label={t.locationOn} color="success" sx={{ mb: 2 }} />
        )}

        {workersWithToken.length === 0 ? (
          <Typography sx={{ color: muted, textAlign: "center", mt: 4 }}>{t.noWorkers}</Typography>
        ) : (
          workersWithToken.map((w) => (
            <WorkerRow key={w._id} worker={w} date={selectedDate} t={t} name={name} pin={pin} onPatch={patch} />
          ))
        )}
      </Container>
    </Box>
  );
}
