import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from "react-router-dom";
import { Menu } from "./components/Menu";
import { Landing } from "./components/Landing";
import { WaiterPanel } from "./components/WaiterPanel";
import { AdminPanel } from "./components/AdminPanel";
import styles from "./App.module.css";

function Header() {
  const location = useLocation();
  const isAdmin = localStorage.getItem("adminAuth") === "true";
  const isWaiter = localStorage.getItem("waiterAuth") === "true";

  // Hide header on customer menu pages
  if (location.pathname.startsWith("/menu/")) return null;

  const logout = () => {
    localStorage.removeItem("waiterAuth");
    localStorage.removeItem("adminAuth");
    window.location.href = "/waiter";
  };

  return (
    <header className={styles.header} style={{
      borderBottom: "1px solid var(--border)",
      background: "rgba(10,10,10,0.85)",
      backdropFilter: "blur(20px)",
      padding: "16px 40px",
    }}>
      <div className={styles.logo}>
        <Link to="/" style={{ textDecoration: "none" }}>
          <span style={{ fontFamily: "var(--serif)", fontSize: "24px", color: "var(--accent)", letterSpacing: "2px" }}>
            Web3 Café
          </span>
        </Link>
      </div>

      <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
        <Link to="/" style={{ color: "var(--text-muted)", textDecoration: "none", fontSize: "0.82rem", letterSpacing: "1px", textTransform: "uppercase" }}>
          Ana Sayfa
        </Link>

        {/* Admin sees both Admin + Garson links */}
        {isAdmin && (
          <>
            <Link to="/admin" style={{ color: "var(--accent)", textDecoration: "none", fontSize: "0.82rem", letterSpacing: "1px", textTransform: "uppercase", fontWeight: 600 }}>
              Admin Panel
            </Link>
            <Link to="/waiter" style={{ color: "var(--text-muted)", textDecoration: "none", fontSize: "0.82rem", letterSpacing: "1px", textTransform: "uppercase" }}>
              Garson Paneli
            </Link>
          </>
        )}

        {/* Waiter (non-admin) sees only their panel link — NO admin access */}
        {isWaiter && !isAdmin && (
          <Link to="/waiter" style={{ color: "var(--text-muted)", textDecoration: "none", fontSize: "0.82rem", letterSpacing: "1px", textTransform: "uppercase" }}>
            Panel
          </Link>
        )}

        {(isWaiter || isAdmin) && (
          <button onClick={logout} className="btn btn-glass" style={{ fontSize: "0.82rem", padding: "6px 14px", color: "var(--error)", borderColor: "var(--error)" }}>
            Çıkış
          </button>
        )}
      </div>
    </header>
  );
}

export default function App() {
  return (
    <Router>
      <div className={styles.root}>
        <Header />
        <main className={styles.main} style={{ paddingTop: "40px", alignItems: "stretch" }}>
          <div style={{ width: "100%" }}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/menu/:tableId" element={<Menu />} />
              <Route path="/waiter" element={<WaiterPanel />} />
              <Route path="/admin" element={<AdminPanel />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </Router>
  );
}
