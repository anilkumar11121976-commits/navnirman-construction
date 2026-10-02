"use client";
import { useEffect, useState } from "react";
import {
  Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography,
} from "@mui/material";
import { PAY_MODES, inr, todayInput } from "@/lib/siteUtils";

/**
 * Shared "pay a worker" dialog — shows what's due / already in advance, and previews
 * the resulting balance as the admin types an amount, so it's clear whether this
 * payment will clear the balance, leave some due, or push them into advance.
 */
export default function PayWorkerDialog({ open, workerName, due = 0, advance = 0, onClose, onSubmit }) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayInput());
  const [mode, setMode] = useState("cash");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setAmount(due > 0 ? String(due) : "");
      setDate(todayInput());
      setMode("cash");
      setNote("");
      setError("");
    }
  }, [open, due]);

  const amt = Number(amount) || 0;
  const startingBalance = due - advance; // positive = due, negative = already in advance
  const afterBalance = startingBalance - amt;

  const submit = async () => {
    if (!amt || amt <= 0) {
      setError("Enter a valid amount");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSubmit({ amount: amt, date, mode, note });
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Could not save payment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!open} onClose={saving ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>Pay {workerName}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <Typography sx={{ fontSize: "0.88rem", color: "#6b665c" }}>
            {due > 0
              ? `Currently due: ${inr(due)}`
              : advance > 0
              ? `Already paid in advance: ${inr(advance)}`
              : "Settled — nothing due right now"}
          </Typography>
          <TextField label="Amount (₹)" type="number" fullWidth autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} />
          <TextField label="Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={date} onChange={(e) => setDate(e.target.value)} />
          <TextField select label="Mode" fullWidth value={mode} onChange={(e) => setMode(e.target.value)}>
            {PAY_MODES.map((o) => (
              <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
            ))}
          </TextField>
          <TextField label="Note (optional)" fullWidth value={note} onChange={(e) => setNote(e.target.value)} />
          {amt > 0 && (
            <Alert severity={afterBalance > 0 ? "warning" : "success"} sx={{ py: 0.5 }}>
              {afterBalance > 0
                ? `Still due after this payment: ${inr(afterBalance)}`
                : afterBalance < 0
                ? `This pays more than owed — leaves an advance of ${inr(-afterBalance)}`
                : "This fully settles the balance"}
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={saving}>{saving ? "Saving…" : "Pay"}</Button>
      </DialogActions>
    </Dialog>
  );
}
