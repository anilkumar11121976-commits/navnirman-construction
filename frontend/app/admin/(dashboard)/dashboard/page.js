"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Box, Grid, Typography, Paper, Button, Stack } from "@mui/material";
import api from "@/lib/api";
import { tokens } from "@/lib/theme";

export default function AdminOverviewPage() {
  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await api.get("/categories")).data.categories,
  });
  const { data: works } = useQuery({
    queryKey: ["admin-works-count"],
    queryFn: async () => (await api.get("/works", { params: { limit: 1 } })).data.pagination,
  });
  const { data: messages } = useQuery({
    queryKey: ["messages"],
    queryFn: async () => (await api.get("/contact")).data.messages,
  });
  const { data: testimonials } = useQuery({
    queryKey: ["testimonials"],
    queryFn: async () => (await api.get("/testimonials")).data.testimonials,
  });

  const { data: tenderStats } = useQuery({
    queryKey: ["tender-stats"],
    queryFn: async () => (await api.get("/tenders/stats")).data,
  });

  const unread = messages?.filter((m) => !m.isRead).length ?? 0;

  const active = (tenderStats?.byStatus?.identified || 0) + (tenderStats?.byStatus?.preparing || 0);
  const cards = [
    { label: "Tenders in progress", value: tenderStats ? active : "–", href: "/admin/tenders", note: tenderStats?.dueSoon ? `${tenderStats.dueSoon} due within 7 days` : "" },
    { label: "Tenders won", value: tenderStats?.byStatus?.won ?? (tenderStats ? 0 : "–"), href: "/admin/tenders" },
    { label: "Projects", value: works?.total ?? "–", href: "/admin/works" },
    { label: "Unread enquiries", value: unread, href: "/admin/messages" },
    { label: "Services", value: categories?.length ?? "–", href: "/admin/categories" },
    { label: "Testimonials", value: testimonials?.length ?? "–", href: "/admin/testimonials" },
  ];

  return (
    <Box>
      <Typography variant="h4" sx={{ fontSize: "1.6rem", mb: 3 }}>
        Overview
      </Typography>
      <Grid container spacing={2.5}>
        {cards.map((c) => (
          <Grid item xs={12} sm={6} md={4} key={c.label}>
            <Paper
              component={Link}
              href={c.href}
              elevation={0}
              sx={{
                display: "block",
                p: 3,
                border: `1px solid ${tokens.line}`,
                "&:hover": { borderColor: tokens.rust },
              }}
            >
              <Typography sx={{ color: "#6b665c", fontWeight: 600, mb: 1 }}>{c.label}</Typography>
              <Typography sx={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "2rem", color: tokens.rust }}>
                {c.value}
              </Typography>
              {c.note && <Typography sx={{ color: tokens.rust, fontSize: "0.82rem", fontWeight: 600, mt: 0.5 }}>{c.note}</Typography>}
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Stack direction="row" flexWrap="wrap" spacing={1.5} sx={{ mt: 4, rowGap: 1.5 }}>
        <Button variant="contained" color="primary" component={Link} href="/admin/tenders">
          Add a Tender
        </Button>
        <Button variant="outlined" component={Link} href="/admin/works" sx={{ borderColor: tokens.ink, color: tokens.ink }}>
          Add a Project
        </Button>
        <Button variant="outlined" component="a" href="/company-profile" target="_blank" sx={{ borderColor: tokens.ink, color: tokens.ink }}>
          Company Profile / PDF
        </Button>
        <Button variant="outlined" component={Link} href="/" sx={{ borderColor: tokens.ink, color: tokens.ink }}>
          View Live Site
        </Button>
      </Stack>
    </Box>
  );
}
