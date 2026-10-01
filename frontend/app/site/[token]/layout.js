// Client ka private link Google par index nahi hona chahiye
export const metadata = {
  title: "Site Progress",
  robots: { index: false, follow: false },
};

export default function ClientSiteLayout({ children }) {
  return children;
}