"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Alert, Avatar, Box, Chip, CircularProgress, Container, Paper, Stack, Typography } from "@mui/material";
import api from "@/lib/api";
import { tokens } from "@/lib/theme";
import { PhotoGrid, ProgressBar, StatCard } from "@/components/SiteBits";
import {
  MATERIAL_STATUS, PAY_MODES, SITE_COLOR, SITE_STATUS, STAGE_COLOR, STAGE_STATUS, fdate, inr, labelOf,
} from "@/lib/siteUtils";

const statusColor = { pending: "#c9c4b8", in_progress: tokens.rust, completed: "#2e7d32" };

// Public page: no login needed. The server only sends client-safe data
// (no material rates, suppliers or internal notes; stage cost only when the admin enabled it).
export default function ClientSitePage() {
  const { token } = useParams();
  const [site, setSite] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .get(`/sites/view/${token}`)
      .then((res) => alive && setSite(res.data.site))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [token]);

  if (error) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Alert severity="warning">This link is invalid or has been turned off. Please ask your contractor for a new link.</Alert>
      </Container>
    );
  }

  if (!site) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
        <CircularProgress sx={{ color: tokens.rust }} />
      </Box>
    );
  }

  const paidPct = site.contractValue ? Math.round((site.paid / site.contractValue) * 100) : 0;

  return (
    <Box sx={{ bgcolor: "#faf8f3", minHeight: "100vh", pb: 6 }}>
      {/* header band */}
      <Box sx={{ bgcolor: tokens.ink, color: "#fff", pt: { xs: 4, md: 6 }, pb: { xs: 8, md: 10 } }}>
        <Container maxWidth="md">
          <Typography sx={{ color: "#fff", opacity: 0.65, fontSize: "0.75rem", letterSpacing: 1.4, textTransform: "uppercase", mb: 1 }}>
            Project progress
          </Typography>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexWrap: "wrap", rowGap: 1 }}>
            <Typography variant="h4" sx={{ color: "#fff", fontSize: { xs: "1.6rem", md: "2rem" } }}>{site.name}</Typography>
            <Chip size="small" label={labelOf(SITE_STATUS, site.status)} color={SITE_COLOR[site.status]} />
          </Stack>
          <Typography sx={{ color: "#fff", opacity: 0.8, mt: 0.5 }}>
            {[site.clientName && `For ${site.clientName}`, site.location].filter(Boolean).join(" · ")}
          </Typography>
        </Container>
      </Box>

      <Container maxWidth="md" sx={{ mt: -5 }}>
        {/* overall progress */}
        <Paper elevation={0} sx={{ p: 3, border: `1px solid ${tokens.line}`, mb: 2.5 }}>
          <Typography sx={{ fontWeight: 700, mb: 1.5 }}>Overall progress</Typography>
          <ProgressBar value={site.overallProgress} height={12} />
          <Stack direction="row" spacing={4} sx={{ mt: 2, flexWrap: "wrap", rowGap: 0.5 }}>
            <Typography sx={{ fontSize: "0.88rem" }}>Started: <b>{fdate(site.startDate)}</b></Typography>
            <Typography sx={{ fontSize: "0.88rem" }}>Expected completion: <b>{fdate(site.expectedEndDate)}</b></Typography>
          </Stack>
        </Paper>

        {/* payments summary */}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(3, 1fr)" }, gap: 2, mb: 2.5 }}>
          <StatCard label="Total amount" value={inr(site.contractValue)} color={tokens.ink} />
          <StatCard label="Paid" value={inr(site.paid)} color="#2e7d32" note={`${paidPct}% of total`} />
          <Box sx={{ gridColumn: { xs: "1 / -1", md: "auto" } }}>
            <StatCard label="Balance (unpaid)" value={inr(site.unpaid)} />
          </Box>
        </Box>

        {site.payments.length > 0 && (
          <Paper elevation={0} sx={{ p: 3, border: `1px solid ${tokens.line}`, mb: 2.5 }}>
            <Typography sx={{ fontWeight: 700, mb: 1.5 }}>Payments received</Typography>
            <Stack spacing={1}>
              {[...site.payments].sort((a, b) => new Date(b.date) - new Date(a.date)).map((p, i) => (
                <Stack key={i} direction="row" justifyContent="space-between">
                  <Typography sx={{ fontSize: "0.9rem" }}>{fdate(p.date)} · {labelOf(PAY_MODES, p.mode)}</Typography>
                  <Typography sx={{ fontSize: "0.9rem", fontWeight: 700 }}>{inr(p.amount)}</Typography>
                </Stack>
              ))}
            </Stack>
          </Paper>
        )}

        {/* stages */}
        <Typography sx={{ fontWeight: 700, fontSize: "1.1rem", mt: 4, mb: 1.5 }}>Work stages</Typography>
        <Stack spacing={2}>
          {site.stages.map((st, i) => (
            <Paper key={st._id} elevation={0} sx={{ p: { xs: 2, md: 3 }, border: `1px solid ${tokens.line}` }}>
              <Stack direction="row" spacing={2} alignItems="flex-start">
                <Avatar sx={{ width: 34, height: 34, fontSize: "0.9rem", fontWeight: 700, bgcolor: statusColor[st.status] }}>{i + 1}</Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap", rowGap: 0.5, mb: 1 }}>
                    <Typography sx={{ fontWeight: 700 }}>{st.name}</Typography>
                    <Chip size="small" label={labelOf(STAGE_STATUS, st.status)} color={STAGE_COLOR[st.status]} />
                    {st.status === "completed" && st.actualEnd && (
                      <Typography sx={{ fontSize: "0.78rem", color: "#6b665c" }}>Completed {fdate(st.actualEnd)}</Typography>
                    )}
                    {st.status !== "completed" && st.plannedEnd && (
                      <Typography sx={{ fontSize: "0.78rem", color: "#6b665c" }}>Target {fdate(st.plannedEnd)}</Typography>
                    )}
                  </Stack>

                  <ProgressBar value={st.progress} />

                  {st.cost && (
                    <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 1, bgcolor: tokens.paperAlt }}>
                      <Typography sx={{ fontSize: "0.88rem" }}>
                        Spent on this stage: <b>{inr(st.cost.total)}</b>
                        <Typography component="span" sx={{ fontSize: "0.8rem", color: "#6b665c" }}>
                          {" "}(Materials {inr(st.cost.materials)} · Labour &amp; other {inr(st.cost.other)})
                        </Typography>
                      </Typography>
                    </Box>
                  )}

                  <PhotoGrid photos={st.photos} />

                  {st.materials?.length > 0 && (
                    <Box sx={{ mt: 1.5, pl: 1.5, borderLeft: `2px solid ${tokens.line}` }}>
                      {st.materials.map((m, k) => (
                        <Typography key={k} sx={{ fontSize: "0.8rem", color: "#6b665c" }}>
                          {m.name}: {m.quantity} {m.unit} · {labelOf(MATERIAL_STATUS, m.status)}
                          {m.location ? ` · ${m.location}` : ""}
                          {m.status !== "used" && m.expectedDate ? ` · by ${fdate(m.expectedDate)}` : ""}
                        </Typography>
                      ))}
                    </Box>
                  )}
                </Box>
              </Stack>
            </Paper>
          ))}
        </Stack>

        {/* general updates */}
        {site.updates.length > 0 && (
          <Box sx={{ mt: 4 }}>
            <Typography sx={{ fontWeight: 700, fontSize: "1.1rem", mb: 1.5 }}>Latest updates</Typography>
            <Stack spacing={1.5}>
              {site.updates.map((u) => {
                const stageName = site.stages.find((s) => s._id === u.stageId)?.name;
                return (
                  <Paper key={u._id} elevation={0} sx={{ p: 2.5, border: `1px solid ${tokens.line}` }}>
                    <Typography sx={{ fontSize: "0.8rem", color: "#6b665c" }}>
                      {fdate(u.date)}{stageName ? ` · ${stageName}` : ""}
                    </Typography>
                    {u.text && <Typography sx={{ mt: 0.5, whiteSpace: "pre-wrap" }}>{u.text}</Typography>}
                    <PhotoGrid photos={u.photos} />
                  </Paper>
                );
              })}
            </Stack>
          </Box>
        )}
      </Container>
    </Box>
  );
}