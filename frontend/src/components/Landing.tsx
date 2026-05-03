import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Coffee, Lock, QrCode, Shield } from "lucide-react";
import { motion } from "framer-motion";

const API_BASE = "";

export function Landing() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [waiters, setWaiters] = useState<any[]>([]);

  useEffect(() => {
    fetch(`${API_BASE}/api/waiters`)
      .then(res => res.json())
      .then(data => setWaiters(data))
      .catch(err => console.error("Garson listesi alınamadı:", err));
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.toLowerCase() === "admin" && pin === "1111") {
      localStorage.setItem("adminAuth", "true");
      localStorage.removeItem("waiterAuth");
      navigate("/admin");
    } else {
      const waiter = waiters.find(
        (w) => w.name.toLowerCase() === username.toLowerCase() && w.pin === pin
      );
      if (waiter) {
        localStorage.setItem("waiterAuth", "true");
        localStorage.removeItem("adminAuth");
        navigate("/waiter");
      } else {
        setError("Kullanıcı adı veya şifre hatalı!");
        setPin("");
      }
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "clamp(12px, 4vw, 40px) clamp(12px, 3vw, 20px)" }}>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{ maxWidth: "920px", width: "100%" }}
      >
        <motion.div
          className="glass-panel"
          style={{ padding: "clamp(24px, 5vw, 60px) clamp(16px, 4vw, 40px)", border: "1px solid rgba(212,175,55,0.3)", background: "linear-gradient(180deg, rgba(30,30,30,0.9) 0%, rgba(15,15,15,0.95) 100%)" }}
          whileHover={{ boxShadow: "0 20px 60px rgba(212,175,55,0.15)" }}
          transition={{ duration: 0.4 }}
        >
          {/* Header */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            style={{ textAlign: "center", marginBottom: "clamp(24px, 5vw, 56px)" }}
          >
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
              <Coffee size={48} color="var(--accent)" style={{ margin: "0 auto 16px", display: "block" }} />
            </motion.div>
            <h1 className="serif" style={{
              fontSize: "clamp(2rem, 7vw, 3.5rem)",
              marginBottom: "10px",
              background: "linear-gradient(135deg, var(--accent) 0%, #f0d469 100%)",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              letterSpacing: "clamp(1px, 1vw, 4px)",
              fontWeight: 800
            }}>
              Web3 Café
            </h1>
            <p style={{ color: "var(--text-muted)", marginBottom: "0", fontSize: "clamp(0.75rem, 2vw, 0.95rem)", letterSpacing: "0.5px", textTransform: "uppercase", fontWeight: 500 }}>
              ☕ Blockchain ile Güçlendirilmiş Sipariş Sistemi
            </p>
          </motion.div>

          {/* Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "clamp(16px, 3vw, 28px)", textAlign: "left" }}>

            {/* Customer card */}
            <motion.div
              className="glass"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              whileHover={{ y: -8, boxShadow: "0 20px 40px rgba(212,175,55,0.12)" }}
              style={{
                padding: "40px 32px",
                display: "flex",
                flexDirection: "column",
                gap: "18px",
                background: "linear-gradient(135deg, rgba(212,175,55,0.05) 0%, rgba(212,175,55,0.02) 100%)",
                borderLeft: "4px solid var(--accent)"
              }}
            >
              <h2 className="serif" style={{
                fontSize: "1.7rem",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                color: "#fff",
                margin: 0
              }}>
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 4 }}>
                  <QrCode color="var(--accent)" size={24} />
                </motion.div>
                Müşteri
              </h2>
              <p style={{ color: "var(--text-muted)", lineHeight: "1.8", fontWeight: 400, fontSize: "0.95rem", margin: 0 }}>
                Masanızdaki QR kodu okutarak menüye erişin ve Freighter cüzdanı ile ödeme yapın.
              </p>
              <motion.div
                whileHover={{ scale: 1.05 }}
                style={{
                  marginTop: "auto",
                  padding: "14px 16px",
                  background: "linear-gradient(135deg, rgba(212,175,55,0.1) 0%, rgba(212,175,55,0.05) 100%)",
                  borderRadius: "10px",
                  border: "1px solid rgba(212,175,55,0.2)",
                  fontSize: "0.85rem",
                  color: "var(--text-muted)",
                  fontWeight: 500
                }}
              >
                📱 Freighter ile Güvenli Ödeme
              </motion.div>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => window.location.href = "/menu/1"}
                className="btn btn-primary"
                style={{ marginTop: "20px", padding: "14px 18px", borderRadius: "28px", width: "100%", fontWeight: 700, letterSpacing: "1px" }}
              >
                Menüye Git (Masa 1)
              </motion.button>
            </motion.div>

            {/* Staff / Admin login */}
            <motion.div
              className="glass"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              whileHover={{ y: -8, boxShadow: "0 20px 40px rgba(212,175,55,0.12)" }}
              style={{
                padding: "40px 32px",
                display: "flex",
                flexDirection: "column",
                gap: "18px",
                background: "linear-gradient(135deg, rgba(52,211,153,0.05) 0%, rgba(52,211,153,0.02) 100%)",
                borderLeft: "4px solid var(--success)"
              }}
            >
              <h2 className="serif" style={{
                fontSize: "1.7rem",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                color: "#fff",
                margin: 0
              }}>
                <Lock color="var(--success)" size={24} /> Personel
              </h2>
              <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <motion.input
                  whileFocus={{ scale: 1.02 }}
                  type="text"
                  placeholder="Kullanıcı Adı"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setError(""); }}
                  autoComplete="username"
                  style={{
                    background: "rgba(0,0,0,0.4)",
                    border: "1px solid rgba(52,211,153,0.3)",
                    borderRadius: "15px",
                    color: "#fff",
                    padding: "13px 22px",
                    fontFamily: "var(--sans)",
                    fontSize: "1.1rem",
                    outline: "none",
                    textAlign: "center",
                    width: "100%",
                    boxSizing: "border-box",
                    transition: "all 0.3s ease",
                    fontWeight: 600
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = "rgba(52,211,153,0.6)"}
                  onBlur={(e) => e.currentTarget.style.borderColor = "rgba(52,211,153,0.3)"}
                />
                <motion.input
                  whileFocus={{ scale: 1.02 }}
                  type="password"
                  placeholder="Şifre / PIN"
                  value={pin}
                  onChange={(e) => { setPin(e.target.value); setError(""); }}
                  autoComplete="current-password"
                  style={{
                    background: "rgba(0,0,0,0.4)",
                    border: "1px solid rgba(52,211,153,0.3)",
                    borderRadius: "15px",
                    color: "#fff",
                    padding: "13px 22px",
                    fontFamily: "var(--sans)",
                    fontSize: "1.1rem",
                    outline: "none",
                    textAlign: "center",
                    letterSpacing: "4px",
                    width: "100%",
                    boxSizing: "border-box",
                    transition: "all 0.3s ease",
                    fontWeight: 600
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = "rgba(52,211,153,0.6)"}
                  onBlur={(e) => e.currentTarget.style.borderColor = "rgba(52,211,153,0.3)"}
                />
                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className="btn btn-primary"
                  style={{ width: "100%", padding: "14px", fontWeight: 700, letterSpacing: "1px" }}
                >
                  Giriş Yap
                </motion.button>
                {error && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{
                      color: "#FF6B6B",
                      textAlign: "center",
                      fontSize: "0.9rem",
                      fontWeight: 600,
                      margin: 0
                    }}
                  >
                    ⚠️ {error}
                  </motion.p>
                )}
              </form>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.82rem", color: "var(--text-muted)", padding: "8px 12px", background: "rgba(212,175,55,0.05)", borderRadius: "8px", fontWeight: 500 }}>
                  <Lock size={14} /> <span>Garson: <strong style={{ color: "var(--accent)" }}>Garson 1 / 1234</strong></span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.82rem", color: "var(--text-muted)", padding: "8px 12px", background: "rgba(239,68,68,0.05)", borderRadius: "8px", fontWeight: 500 }}>
                  <Shield size={14} /> <span>Admin: <strong style={{ color: "#FF6B6B" }}>admin / 1111</strong></span>
                </div>
              </motion.div>
            </motion.div>

          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
