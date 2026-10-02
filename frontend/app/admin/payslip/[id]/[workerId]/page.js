"use client";
import { useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Box, Button, Container, Stack, Typography } from "@mui/material";
import PrintIcon from "@mui/icons-material/PrintOutlined";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Link from "next/link";
import api from "@/lib/api";
import { tokens } from "@/lib/theme";
import useProfile from "@/hooks/useProfile";
import { ATTENDANCE_STATUS, fdate, inr, labelOf } from "@/lib/siteUtils";

const muted = "#6b665c";

// Admin-only printable payslip for one worker over a date range. The report API itself
// is behind the admin auth middleware, so this page needs no separate login guard —
// an unauthenticated request just gets redirected to /admin/login by the axios interceptor.
export default function PayslipPage() {
  const { id, workerId } = useParams();
  const params = useSearchParams();
  const { profile } = useProfile();
  const from = params.get("from") || "";
  const to = params.get("to") || "";

  const { data, isLoading, isError } = useQuery({
    queryKey: ["worker-report", id, workerId, from, to],
    queryFn: async () => {
      const q = new URLSearchParams();
      if (from) q.set("from", from);
      if (to) q.set("to", to);
      const res = await api.get(`/sites/${id}/workers/${workerId}/report?${q.toString()}`);
      return res.data;
    },
  });

  if (isLoading) return <Box sx={{ p: 4 }}>Loading…</Box>;
  if (isError || !data) return <Box sx={{ p: 4 }}>Could not load this payslip.</Box>;

  const { site, worker, report: r } = data;

  return (
    <Box sx={{ bgcolor: "#f3f1ea", minHeight: "100vh", py: 4 }}>
      <Container maxWidth="sm">
        <Stack direction="row" justifyContent="space-between" className="no-print" sx={{ mb: 2 }}>
          <Button component={Link} href={`/admin/sites/${id}`} startIcon={<ArrowBackIcon />} size="small">Back</Button>
          <Button variant="contained" startIcon={<PrintIcon />} size="small" onClick={() => window.print()}>Print / Save PDF</Button>
        </Stack>

        <Box className="print-sheet" sx={{ bgcolor: "#fff", border: `1px solid ${tokens.line}`, p: { xs: 3, md: 4 } }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 3, pb: 2, borderBottom: `2px solid ${tokens.ink}` }}>
            <Box>
              <Typography sx={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.3rem" }}>{profile.businessName}</Typography>
              <Typography sx={{ fontSize: "0.82rem", color: muted }}>{[profile.address, profile.phone].filter(Boolean).join(" · ")}</Typography>
            </Box>
            <Box sx={{ textAlign: "right" }}>
              <Typography sx={{ fontWeight: 800, letterSpacing: "0.05em" }}>PAYSLIP</Typography>
              <Typography sx={{ fontSize: "0.8rem", color: muted }}>
                {from || to ? `${from ? fdate(from) : "Start"} – ${to ? fdate(to) : "Today"}` : "All time"}
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" justifyContent="space-between" sx={{ mb: 3, flexWrap: "wrap", rowGap: 1 }}>
            <Box>
              <Typography sx={{ fontSize: "0.75rem", color: muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Worker</Typography>
              <Typography sx={{ fontWeight: 700 }}>{worker.name}</Typography>
              <Typography sx={{ fontSize: "0.85rem", color: muted }}>{[worker.role, worker.phone].filter(Boolean).join(" · ")}</Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: "0.75rem", color: muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Site</Typography>
              <Typography sx={{ fontWeight: 700 }}>{site.name}</Typography>
              <Typography sx={{ fontSize: "0.85rem", color: muted }}>{site.location}</Typography>
            </Box>
          </Stack>

          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1.5, mb: 3, textAlign: "center" }}>
            {[
              ["Present", r.counts.present],
              ["Half day", r.counts.half_day],
              ["Absent", r.counts.absent],
              ["Leave", r.counts.leave],
            ].map(([label, val]) => (
              <Box key={label} sx={{ p: 1, border: `1px solid ${tokens.line}` }}>
                <Typography sx={{ fontSize: "1.3rem", fontWeight: 800 }}>{val}</Typography>
                <Typography sx={{ fontSize: "0.72rem", color: muted }}>{label}</Typography>
              </Box>
            ))}
          </Box>

          <Box sx={{ mb: 3 }}>
            {[
              ["Overtime", `${r.overtimeHours} hrs`],
              ["Earned (wage + overtime)", inr(r.earned)],
              ["Lunch deducted", `– ${inr(r.lunch)}`],
              ["Paid in this period", `– ${inr(r.paid)}`],
            ].map(([label, val]) => (
              <Stack key={label} direction="row" justifyContent="space-between" sx={{ py: 0.5, borderBottom: `1px solid ${tokens.line}` }}>
                <Typography sx={{ fontSize: "0.9rem" }}>{label}</Typography>
                <Typography sx={{ fontSize: "0.9rem", fontWeight: 600 }}>{val}</Typography>
              </Stack>
            ))}
            <Stack direction="row" justifyContent="space-between" sx={{ pt: 1.5, mt: 0.5 }}>
              <Typography sx={{ fontWeight: 800 }}>{r.balance < 0 ? "Advance (overpaid)" : "Balance due"}</Typography>
              <Typography sx={{ fontWeight: 800, fontSize: "1.1rem" }}>{inr(Math.abs(r.balance))}</Typography>
            </Stack>
          </Box>

          {r.entries.length > 0 && (
            <Box className="avoid-break">
              <Typography sx={{ fontWeight: 700, mb: 1, fontSize: "0.9rem" }}>Daily record</Typography>
              <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                <Box component="thead">
                  <Box component="tr">
                    {["Date", "Status", "OT", "Lunch", "Note"].map((h) => (
                      <Box component="th" key={h} sx={{ textAlign: "left", borderBottom: `1px solid ${tokens.ink}`, py: 0.5 }}>{h}</Box>
                    ))}
                  </Box>
                </Box>
                <Box component="tbody">
                  {r.entries.map((e) => (
                    <Box component="tr" key={e._id}>
                      <Box component="td" sx={{ py: 0.4, borderBottom: `1px solid ${tokens.line}` }}>{fdate(e.date)}</Box>
                      <Box component="td" sx={{ py: 0.4, borderBottom: `1px solid ${tokens.line}` }}>{labelOf(ATTENDANCE_STATUS, e.status)}</Box>
                      <Box component="td" sx={{ py: 0.4, borderBottom: `1px solid ${tokens.line}` }}>{e.overtimeHours ? `${e.overtimeHours}h` : "–"}</Box>
                      <Box component="td" sx={{ py: 0.4, borderBottom: `1px solid ${tokens.line}` }}>{e.lunchAmount ? inr(e.lunchAmount) : "–"}</Box>
                      <Box component="td" sx={{ py: 0.4, borderBottom: `1px solid ${tokens.line}` }}>{e.note || "–"}</Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>
          )}
        </Box>
      </Container>
    </Box>
  );
}
