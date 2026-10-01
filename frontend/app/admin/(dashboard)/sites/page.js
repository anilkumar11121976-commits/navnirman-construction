"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Box, Button, Chip, Grid, Paper, Stack, Typography } from "@mui/material";
import api from "@/lib/api";
import { tokens } from "@/lib/theme";
import FormDialog from "@/components/FormDialog";
import { ProgressBar } from "@/components/SiteBits";
import { SITE_COLOR, SITE_STATUS, fdate, inr, labelOf } from "@/lib/siteUtils";

const FIELDS = [
  { name: "name", label: "Site / project name (e.g. Sharma Residence)", required: true },
  { name: "clientName", label: "Client name" },
  { name: "clientPhone", label: "Client phone" },
  { name: "location", label: "Location" },
  { name: "contractValue", label: "Total contract value (₹)", type: "number" },
  { name: "startDate", label: "Start date", type: "date" },
  { name: "expectedEndDate", label: "Expected completion", type: "date" },
  { name: "status", label: "Status", type: "select", options: SITE_STATUS },
];

export default function SitesPage() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const { data: sites, isLoading } = useQuery({
    queryKey: ["sites"],
    queryFn: async () => (await api.get("/sites")).data.sites,
  });

  const create = async (values) => {
    const res = await api.post("/sites", values);
    router.push(`/admin/sites/${res.data.site._id}`);
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontSize: "1.6rem" }}>
          Site Progress
        </Typography>
        <Button variant="contained" onClick={() => setOpen(true)}>
          Add Site
        </Button>
      </Stack>

      {isLoading && <Typography>Loading…</Typography>}
      {sites?.length === 0 && (
        <Paper elevation={0} sx={{ p: 4, border: `1px solid ${tokens.line}`, textAlign: "center" }}>
          <Typography sx={{ color: "#6b665c" }}>
            No sites yet. Click “Add Site” to start your first project.
          </Typography>
        </Paper>
      )}

      <Grid container spacing={2.5}>
        {sites?.map((s) => (
          <Grid item xs={12} md={6} key={s._id}>
            <Paper
              component={Link}
              href={`/admin/sites/${s._id}`}
              elevation={0}
              sx={{ display: "block", p: 3, border: `1px solid ${tokens.line}`, "&:hover": { borderColor: tokens.rust } }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
                <Box>
                  <Typography sx={{ fontWeight: 700, fontSize: "1.1rem" }}>{s.name}</Typography>
                  <Typography sx={{ color: "#6b665c", fontSize: "0.88rem" }}>
                    {[s.clientName, s.location].filter(Boolean).join(" · ") || "—"}
                  </Typography>
                </Box>
                <Chip size="small" label={labelOf(SITE_STATUS, s.status)} color={SITE_COLOR[s.status]} />
              </Stack>

              <ProgressBar value={s.overallProgress} />

              <Stack direction="row" spacing={3} sx={{ mt: 2 }}>
                <Box>
                  <Typography sx={{ color: "#6b665c", fontSize: "0.75rem" }}>Paid</Typography>
                  <Typography sx={{ fontWeight: 700, color: "#2e7d32" }}>{inr(s.paid)}</Typography>
                </Box>
                <Box>
                  <Typography sx={{ color: "#6b665c", fontSize: "0.75rem" }}>Unpaid</Typography>
                  <Typography sx={{ fontWeight: 700, color: tokens.rust }}>{inr(s.unpaid)}</Typography>
                </Box>
                <Box>
                  <Typography sx={{ color: "#6b665c", fontSize: "0.75rem" }}>Expected end</Typography>
                  <Typography sx={{ fontWeight: 600 }}>{fdate(s.expectedEndDate)}</Typography>
                </Box>
              </Stack>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <FormDialog
        open={open}
        title="Add Site"
        fields={FIELDS}
        initial={{ status: "ongoing" }}
        submitLabel="Create"
        onClose={() => setOpen(false)}
        onSubmit={create}
      />
    </Box>
  );
}