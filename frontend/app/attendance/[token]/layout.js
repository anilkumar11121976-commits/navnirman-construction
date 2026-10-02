// Worker ka private link Google par index nahi hona chahiye
export const metadata = {
  title: "My Attendance",
  robots: { index: false, follow: false },
};

export default function WorkerAttendanceLayout({ children }) {
  return children;
}
