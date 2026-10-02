"use client";
import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Button, Chip, Paper, Stack, Switch, TextField, Typography } from "@mui/material";
import GroupsIcon from "@mui/icons-material/GroupsOutlined";
import ArrowOutwardIcon from "@mui/icons-material/ArrowOutward";
import api from "@/lib/api";
import { tokens } from "@/lib/theme";

function SiteAttendanceRow({ site }) {
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const shareUrl = site.workersShare?.token && typeof window !== "undefined" ? `${window.location.origin}/attendance/${site.workersShare.token}` : "";

  const toggle = useMutation({
    mutationFn: (enabled) => api.put(`/sites/${site._id}/workers-share`, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sites-attendance"] }),
  });

  return (
    <Paper elevation={0} sx={{ p: 2.5, border: `1px solid ${tokens.line}` }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ flexWrap: "wrap", rowGap: 1 }}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography sx={{ fontWeight: 700 }}>{site.name}</Typography>
            <Chip size="small" variant="outlined" icon={<GroupsIcon />} label={`${site.workerCount} worker${site.workerCount === 1 ? "" : "s"}`} />
          </Stack>
          <Typography sx={{ color: "#6b665c", fontSize: "0.85rem" }}>{site.location}</Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography sx={{ fontSize: "0.85rem", color: "#6b665c" }}>Crew link</Typography>
          <Switch checked={!!site.workersShare?.enabled} onChange={(e) => toggle.mutate(e.target.checked)} />
        </Stack>
      </Stack>

      {site.workerCount === 0 ? (
        <Typography sx={{ mt: 1.5, fontSize: "0.88rem", color: "#6b665c" }}>
          No workers added to this site yet. <Link href={`/admin/sites/${site._id}`} style={{ color: tokens.rust, fontWeight: 600 }}>Add workers →</Link>
        </Typography>
      ) : site.workersShare?.enabled && shareUrl ? (
        <Box sx={{ mt: 1.5 }}>
          <TextField fullWidth size="small" value={shareUrl} InputProps={{ readOnly: true }} />
          <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap", rowGap: 1 }}>
            <Button
              size="small"
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
              size="small"
              component="a"
              target="_blank"
              rel="noreferrer"
              href={`https://wa.me/?text=${encodeURIComponent(`Mark today's attendance for ${site.name} here: ${shareUrl}`)}`}
            >
              Send on WhatsApp
            </Button>
            <Button size="small" component={Link} href={`/admin/sites/${site._id}`} endIcon={<ArrowOutwardIcon fontSize="small" />}>
              Manage workers / mark manually
            </Button>
          </Stack>
        </Box>
      ) : (
        <Typography sx={{ mt: 1.5, fontSize: "0.88rem", color: "#6b665c" }}>
          Turn the crew link on above to get a link for your munshi/supervisor, or{" "}
          <Link href={`/admin/sites/${site._id}`} style={{ color: tokens.rust, fontWeight: 600 }}>mark attendance yourself here →</Link>
        </Typography>
      )}
    </Paper>
  );
}

export default function AdminAttendancePage() {
  const { data: sites, isLoading } = useQuery({
    queryKey: ["sites-attendance"],
    queryFn: async () => (await api.get("/sites")).data.sites,
  });

  return (
    <Box>
      <Typography variant="h4" sx={{ fontSize: "1.6rem", mb: 1 }}>Attendance</Typography>
      <Typography sx={{ color: "#6b665c", mb: 3 }}>
        Turn on a site's crew link to let your munshi or supervisor mark everyone's attendance — present, half day, absent, overtime
        and lunch — no login needed. Or mark it yourself from inside a site.
      </Typography>

      {isLoading && <Typography>Loading…</Typography>}

      {!isLoading && sites?.length === 0 && (
        <Paper elevation={0} sx={{ p: 4, border: `1px solid ${tokens.line}`, textAlign: "center" }}>
          <Typography sx={{ fontWeight: 700, mb: 0.5 }}>No sites yet</Typography>
          <Typography sx={{ color: "#6b665c", mb: 2 }}>Create a site first, then add workers to it to start tracking attendance.</Typography>
          <Button variant="contained" component={Link} href="/admin/sites">Go to Site Progress →</Button>
        </Paper>
      )}

      <Stack spacing={2}>
        {sites?.map((s) => <SiteAttendanceRow key={s._id} site={s} />)}
      </Stack>
    </Box>
  );
}
