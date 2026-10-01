"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Box, Stack, Typography, Button, CircularProgress, IconButton, Drawer, AppBar, Toolbar } from "@mui/material";
import DashboardIcon from "@mui/icons-material/DashboardOutlined";
import PhotoLibraryIcon from "@mui/icons-material/PhotoLibraryOutlined";
import CategoryIcon from "@mui/icons-material/CategoryOutlined";
import MailIcon from "@mui/icons-material/MailOutlineOutlined";
import StorefrontIcon from "@mui/icons-material/StorefrontOutlined";
import RateReviewIcon from "@mui/icons-material/RateReviewOutlined";
import GavelIcon from "@mui/icons-material/GavelOutlined";
import HomeWorkIcon from "@mui/icons-material/HomeWorkOutlined";
import DescriptionIcon from "@mui/icons-material/DescriptionOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import MenuIcon from "@mui/icons-material/Menu";
import LogoutIcon from "@mui/icons-material/LogoutOutlined";
import Logo from "@/components/Logo";
import useAdminAuth from "@/hooks/useAdminAuth";
import { tokens } from "@/lib/theme";

const nav = [
  { href: "/admin/dashboard", label: "Overview", icon: DashboardIcon },
  { href: "/admin/tenders", label: "Tenders", icon: GavelIcon },
  { href: "/admin/sites", label: "Site Progress", icon: HomeWorkIcon },
  { href: "/admin/works", label: "Projects", icon: PhotoLibraryIcon },
  { href: "/admin/profile", label: "Company Profile", icon: StorefrontIcon },
  { href: "/admin/categories", label: "Services", icon: CategoryIcon },
  { href: "/admin/testimonials", label: "Testimonials", icon: RateReviewIcon },
  { href: "/admin/messages", label: "Enquiries", icon: MailIcon },
];

function NavList({ pathname, onNavigate }) {
  return (
    <Stack spacing={0.5} sx={{ flexGrow: 1 }}>
      {nav.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
        return (
          <Stack
            key={item.href}
            component={Link}
            href={item.href}
            onClick={onNavigate}
            direction="row"
            spacing={1.5}
            alignItems="center"
            sx={{
              px: 1.5,
              py: 1.1,
              borderLeft: `3px solid ${active ? tokens.rust : "transparent"}`,
              color: active ? tokens.rust : tokens.ink,
              backgroundColor: active ? tokens.paperAlt : "transparent",
              "&:hover": { backgroundColor: tokens.paperAlt },
            }}
          >
            <Icon fontSize="small" />
            <Typography sx={{ fontWeight: 600, fontSize: "0.95rem" }}>{item.label}</Typography>
          </Stack>
        );
      })}
      <Stack
        component="a"
        href="/company-profile"
        target="_blank"
        direction="row"
        spacing={1.5}
        alignItems="center"
        sx={{ px: 1.5, py: 1.1, borderLeft: "3px solid transparent", color: tokens.steel, "&:hover": { backgroundColor: tokens.paperAlt } }}
      >
        <DescriptionIcon fontSize="small" />
        <Typography sx={{ fontWeight: 600, fontSize: "0.95rem", flexGrow: 1 }}>Send Profile / PDF</Typography>
        <OpenInNewIcon sx={{ fontSize: 14 }} />
      </Stack>
    </Stack>
  );
}

export default function AdminDashboardLayout({ children }) {
  const { admin, checked, logout, expiresAt } = useAdminAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (!checked) {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress size={22} sx={{ color: tokens.rust }} />
      </Box>
    );
  }

  const footer = (
    <Box sx={{ pt: 2, borderTop: `1px solid ${tokens.line}` }}>
      <Typography sx={{ fontSize: "0.85rem", color: "#6b665c" }}>{admin?.email}</Typography>
      {expiresAt && (
        <Typography sx={{ fontSize: "0.72rem", color: "#9a9587", mb: 1 }}>
          Session ends {new Date(expiresAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
        </Typography>
      )}
      <Button startIcon={<LogoutIcon />} onClick={logout} size="small" sx={{ color: tokens.ink, px: 0 }}>
        Log out
      </Button>
    </Box>
  );

  return (
    <Box sx={{ height: "100vh", display: "flex", backgroundColor: tokens.paper, overflow: "hidden" }}>
      {/* desktop sidebar — fixed in place, never scrolls with the page */}
      <Box
        component="nav"
        sx={{
          width: { md: 220, lg: 250 },
          flexShrink: 0,
          borderRight: `1px solid ${tokens.line}`,
          backgroundColor: tokens.white,
          p: 3,
          display: { xs: "none", md: "flex" },
          flexDirection: "column",
          height: "100vh",
          overflowY: "auto",
        }}
      >
        <Box sx={{ mb: 4 }}>
          <Logo href="/" size={40} />
        </Box>
        <NavList pathname={pathname} />
        {footer}
      </Box>

      {/* mobile top bar + drawer (the old layout had no navigation at all on phones) */}
      <AppBar position="fixed" elevation={0} sx={{ display: { xs: "block", md: "none" }, backgroundColor: tokens.white, color: tokens.ink, borderBottom: `1px solid ${tokens.line}` }}>
        <Toolbar sx={{ justifyContent: "space-between" }}>
          <Logo href="/" size={34} />
          <IconButton onClick={() => setOpen(true)} aria-label="Open menu">
            <MenuIcon />
          </IconButton>
        </Toolbar>
      </AppBar>
      <Drawer anchor="right" open={open} onClose={() => setOpen(false)} PaperProps={{ sx: { width: { xs: "82vw", sm: 300 }, maxWidth: 320 } }}>
        <Box sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column", overflowY: "auto", backgroundColor: tokens.white }}>
          <NavList pathname={pathname} onNavigate={() => setOpen(false)} />
          {footer}
        </Box>
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          maxWidth: "100%",
          height: "100vh",
          overflowY: "auto",
          overflowX: "hidden",
          p: { xs: 2, sm: 2.5, md: 4 },
          pt: { xs: 9, md: 4 },
        }}
      >
        {children}
      </Box>
    </Box>
  );
}