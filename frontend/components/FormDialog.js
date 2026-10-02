"use client";
import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem,
  Stack, TextField, Typography,
} from "@mui/material";

/**
 * Generic add/edit dialog.
 * fields: [{ name, label, type: text|number|date|select|multiline|files|boolean, options, required, helperText }]
 * onSubmit(values) -> Promise. Error aaye toh dialog khula rehta hai aur message dikhata hai.
 */
export default function FormDialog({ open, title, fields, initial, submitLabel = "Save", onClose, onSubmit }) {
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setValues(initial || {});
      setError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (name, v) => setValues((s) => ({ ...s, [name]: v }));

  const submit = async () => {
    if (fields.some((f) => f.required && !String(values[f.name] ?? "").trim())) {
      setError("Please fill the required fields");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSubmit(values);
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
          {fields.map((f) =>
            f.type === "boolean" ? (
              <FormControlLabel
                key={f.name}
                control={<Checkbox checked={!!values[f.name]} onChange={(e) => set(f.name, e.target.checked)} />}
                label={f.label}
              />
            ) : f.type === "files" ? (
              <Box key={f.name}>
                <Button component="label" variant="outlined">
                  {f.label}
                  <input
                    hidden
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => set(f.name, Array.from(e.target.files || []))}
                  />
                </Button>
                <Typography variant="body2" sx={{ mt: 0.75, color: "#6b665c" }}>
                  {values[f.name]?.length ? `${values[f.name].length} photo(s) selected` : "No photos selected"}
                </Typography>
              </Box>
            ) : (
              <TextField
                key={f.name}
                label={f.label}
                required={f.required}
                helperText={f.helperText}
                value={values[f.name] ?? ""}
                onChange={(e) => set(f.name, e.target.value)}
                select={f.type === "select"}
                multiline={f.type === "multiline"}
                minRows={f.type === "multiline" ? 3 : undefined}
                type={["number", "date"].includes(f.type) ? f.type : "text"}
                InputLabelProps={f.type === "date" ? { shrink: true } : undefined}
                fullWidth
              >
                {f.type === "select" &&
                  f.options.map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                      {o.label}
                    </MenuItem>
                  ))}
              </TextField>
            )
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={submit} disabled={saving}>
          {saving ? "Saving…" : submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}