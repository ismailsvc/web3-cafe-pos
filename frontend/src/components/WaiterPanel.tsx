import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Check, Clock, AlertCircle, Coffee, CheckCircle, ToggleLeft, ToggleRight, Package, LogOut, User, RefreshCw } from "lucide-react";
import io from "socket.io-client";

const API_BASE = "";
const socket = io(API_BASE);

const getImgUrl = (url: string | null) => {
  if (!url) return null;
  if (url.includes(":4000/uploads")) {
    return url.replace(/http:\/\/[^:]+:4000/, "");
  }
  if (url.startsWith("/")) return `${API_BASE}${url}`;
  return url;
};

interface Order {
  id: string;
  contractOrderId?: number;
  table: string;
  items: { name: string; qty: number }[];
  total: string;
  status: "awaiting_payment" | "preparing" | "ready" | "delivered";
  createdAt: string;
  eta?: number;
}

interface Complaint {
  id: string;
  table: string;
  text: string;
  time: Date;
}

const playNotificationSound = () => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880.0, audioCtx.currentTime); 
    oscillator.frequency.exponentialRampToValueAtTime(440.0, audioCtx.currentTime + 0.1);

    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 1);
  } catch (e) {
    console.error("Audio play failed", e);
  }
};

export function WaiterPanel() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [stock, setStock] = useState<Record<number, boolean>>({});
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [tables, setTables] = useState<{id: string, status: string}[]>([]);
  const [waiters, setWaiters] = useState<{id: number, name: string, pin: string}[]>([]);
  const [loggedInWaiter, setLoggedInWaiter] = useState<{id: number | string, name: string} | null>(null);
  const [loginName, setLoginName] = useState("");
  const [loginPin, setLoginPin] = useState("");
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    const handleSync = (syncedOrders: Order[]) => {
      const active = syncedOrders
        .filter((o) => o.status !== "delivered")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOrders(active);
    };

    const handleComplaint = (data: any) => {
      setComplaints((prev) => [
        { ...data, id: data.id || Math.random().toString(), time: new Date() },
        ...prev,
      ]);
    };

    const handleStock = (s: Record<number, boolean>) => setStock(s);
    const handleMenu  = (m: any[]) => setMenuItems(m);
    const handleTables = (t: any[]) => setTables(t);

    socket.on("sync_orders", handleSync);
    socket.on("new_order_alert", playNotificationSound);
    socket.on("new_complaint", (data: any) => {
      playNotificationSound();
      handleComplaint(data);
    });
    socket.on("sync_stock", handleStock);
    socket.on("sync_menu", handleMenu);
    socket.on("sync_tables", handleTables);
    socket.on("sync_waiters", (w: any[]) => setWaiters(w));

    // Also fetch waiters via REST in case socket event was missed
    fetch(`${API_BASE}/api/waiters`).then(r => r.ok ? r.json() : []).then(w => { if (w.length) setWaiters(w); }).catch(() => {});

    return () => {
      socket.off("sync_orders", handleSync);
      socket.off("new_order_alert", playNotificationSound);
      socket.off("new_complaint");
      socket.off("sync_stock", handleStock);
      socket.off("sync_menu", handleMenu);
      socket.off("sync_tables", handleTables);
      socket.off("sync_waiters");
    };
  }, []);

  const toggleStock = (itemId: number) => {
    const newVal = stock[itemId] === false ? true : !stock[itemId];
    socket.emit("set_stock", { itemId, inStock: newVal });
    setStock((prev) => ({ ...prev, [itemId]: newVal }));
  };

  const updateStatus = (orderId: string, newStatus: string) => {
    // Backend handles escrow release via stellar CLI
    socket.emit("update_order_status", { orderId, status: newStatus });
  };

  const updateTableStatus = (tableId: string, status: string) => {
    socket.emit("update_table_status", { tableId, status });
  };

  const fetchData = async () => {
    try {
      const [ordersRes, tablesRes, stockRes, menuRes] = await Promise.all([
        fetch(`${API_BASE}/api/orders/active`),
        fetch(`${API_BASE}/api/tables`),
        fetch(`${API_BASE}/api/stock`),
        fetch(`${API_BASE}/api/menu`),
      ]);
      const [ordersData, tablesData, stockData, menuData] = await Promise.all([
        ordersRes.json(), tablesRes.json(), stockRes.json(), menuRes.json(),
      ]);
      const active = (ordersData as Order[])
        .filter(o => o.status !== "delivered")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOrders(active);
      setTables(tablesData);
      setStock(stockData);
      setMenuItems(menuData);
    } catch (e) {
      console.error("Yenileme hatası:", e);
    }
  };

  const dismissComplaint = (id: string) => {
    setComplaints((prev) => prev.filter((c) => c.id !== id));
  };

  const statusLabel = (s: string) => {
    if (s === "awaiting_payment") return "Ödeme Bekliyor";
    if (s === "preparing") return "Hazırlanıyor";
    if (s === "ready") return "Hazır — Teslim Bekliyor";
    return s;
  };

  const statusColor = (s: string) => {
    if (s === "awaiting_payment") return "var(--warning)";
    if (s === "preparing") return "var(--accent)";
    return "var(--success)";
  };

  const navigate = useNavigate();

  const handleLogin = () => {
    const name = loginName.trim();
    const pin = loginPin.trim();
    if (!name || !pin) { setLoginError("İsim ve şifre zorunludur."); return; }
    // Admin check → redirect to admin panel
    if (name.toLowerCase() === "admin" && pin === "1234") {
      navigate("/admin");
      return;
    }
    // Waiter check (case-insensitive name match)
    const found = waiters.find(w => w.name.toLowerCase() === name.toLowerCase() && w.pin === pin);
    if (found) {
      setLoggedInWaiter({ id: found.id, name: found.name });
      setLoginError("");
    } else {
      setLoginError("İsim veya şifre hatalı!");
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "14px 16px", fontSize: "1rem",
    background: "rgba(0,0,0,0.5)", border: "1px solid rgba(212,175,55,0.25)",
    borderRadius: "12px", color: "#fff", outline: "none", boxSizing: "border-box",
    fontFamily: "var(--sans)",
  };

  // ── Login screen ──
  if (!loggedInWaiter) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", background: "var(--bg)" }}>
        <motion.div
          className="glass-panel"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ padding: "48px 40px", maxWidth: "420px", width: "100%", textAlign: "center" }}
        >
          <div style={{ width: "72px", height: "72px", borderRadius: "50%", background: "rgba(212,175,55,0.08)", border: "1px solid rgba(212,175,55,0.25)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <User size={32} color="var(--accent)" />
          </div>
          <h1 className="serif" style={{ fontSize: "2rem", color: "var(--accent)", marginBottom: "6px" }}>Personel Girişi</h1>
          <p style={{ color: "var(--text-muted)", marginBottom: "32px", fontSize: "0.88rem" }}>İsim ve şifrenizle giriş yapın</p>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px", textAlign: "left" }}>
            <div>
              <label style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "6px", display: "block", letterSpacing: "0.5px", textTransform: "uppercase" }}>Kullanıcı Adı</label>
              <input
                style={inputStyle}
                placeholder="Garson adı veya admin"
                value={loginName}
                onChange={e => { setLoginName(e.target.value); setLoginError(""); }}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                autoComplete="username"
              />
            </div>
            <div>
              <label style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "6px", display: "block", letterSpacing: "0.5px", textTransform: "uppercase" }}>Şifre (PIN)</label>
              <input
                type="password"
                style={inputStyle}
                placeholder="••••"
                value={loginPin}
                onChange={e => { setLoginPin(e.target.value); setLoginError(""); }}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                autoComplete="current-password"
              />
            </div>

            {loginError && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ color: "var(--error)", fontSize: "0.85rem", textAlign: "center", margin: 0 }}>
                ⚠️ {loginError}
              </motion.p>
            )}

            <button
              className="btn btn-primary"
              style={{ width: "100%", padding: "16px", fontSize: "1rem", marginTop: "4px", borderRadius: "12px" }}
              onClick={handleLogin}
            >
              Giriş Yap
            </button>
          </div>

          <p style={{ color: "var(--text-muted)", marginTop: "24px", fontSize: "0.75rem", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "16px" }}>
            Admin girişi: kullanıcı <strong style={{color:"#ccc"}}>admin</strong> / şifre <strong style={{color:"#ccc"}}>1234</strong>
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "30px 20px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "48px", paddingBottom: "20px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div>
          <h1 className="serif" style={{ fontSize: "2.5rem", color: "var(--accent)", marginBottom: "4px" }}>
            Personel Paneli
          </h1>
          <p style={{ color: "var(--text-muted)", fontWeight: 300, letterSpacing: "1px", fontSize: "0.9rem" }}>
            Hoşgeldin, <strong style={{ color: "#fff" }}>{loggedInWaiter.name}</strong>
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div className="status-badge" style={{ background: "rgba(52,211,153,0.1)", color: "var(--success)", border: "1px solid rgba(52,211,153,0.3)" }}>
            <Bell size={13} /> Canlı Sistem
          </div>
          <button
            className="btn btn-glass"
            style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.78rem", padding: "6px 14px" }}
            onClick={fetchData}
          >
            <RefreshCw size={13} /> Yenile
          </button>
          <button
            className="btn btn-glass"
            style={{ padding: "6px 14px", fontSize: "0.78rem", color: "var(--error)", borderColor: "rgba(239,68,68,0.3)" }}
            onClick={() => setLoggedInWaiter(null)}
          >
            <LogOut size={13} /> Çıkış
          </button>
        </div>
      </div>

      {/* Content Grid: orders | right sidebar */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "40px" }}>

        {/* Orders Column */}
        <div>
          <h2 className="serif" style={{ fontSize: "1.4rem", marginBottom: "20px", color: "#fff", display: "flex", alignItems: "center", gap: "10px" }}>
            <Coffee color="var(--accent)" size={20} /> Aktif Siparişler
            {orders.length > 0 && (
              <span style={{ background: "rgba(212,175,55,0.15)", color: "var(--accent)", borderRadius: "20px", padding: "2px 10px", fontSize: "0.85rem", fontFamily: "var(--sans)", fontWeight: 600 }}>
                {orders.length}
              </span>
            )}
          </h2>

          <div style={{ display: "grid", gap: "20px" }}>
            <AnimatePresence>
              {orders.length === 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass" style={{ padding: "80px 20px", textAlign: "center", borderStyle: "dashed", borderColor: "rgba(255,255,255,0.08)" }}>
                  <Clock size={40} style={{ margin: "0 auto 16px", opacity: 0.25, color: "var(--accent)", display: "block" }} />
                  <p className="serif" style={{ fontSize: "1.3rem", color: "var(--text-muted)" }}>Bekleyen sipariş yok</p>
                </motion.div>
              )}
              {orders.map((order) => (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="glass-panel"
                  style={{
                    padding: "24px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                    borderLeft: `3px solid ${statusColor(order.status)}`,
                  }}
                >
                  {/* Order header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
                      <div style={{
                        width: "46px", height: "46px", borderRadius: "50%",
                        background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.2)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.2rem", fontFamily: "var(--serif)", color: "var(--accent)",
                      }}>
                        {order.table}
                      </div>
                      <h3 className="serif" style={{ fontSize: "1.3rem", color: "#fff" }}>Masa {order.table}</h3>
                    </div>
                    <span style={{
                      fontSize: "0.78rem", fontWeight: 600, letterSpacing: "0.5px",
                      padding: "4px 12px", borderRadius: "20px",
                      background: `${statusColor(order.status)}18`,
                      color: statusColor(order.status),
                      border: `1px solid ${statusColor(order.status)}40`,
                    }}>
                      {statusLabel(order.status)}
                    </span>
                  </div>

                  {/* Order items */}
                  <div style={{ background: "rgba(0,0,0,0.3)", padding: "14px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.04)" }}>
                    {order.items.map((item, idx) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)", fontSize: "0.9rem", padding: "3px 0" }}>
                        <span>{item.qty}× {item.name}</span>
                      </div>
                    ))}
                    <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", color: "var(--accent)", fontWeight: 600 }}>
                      <span>Toplam</span>
                      <span>{order.total} XLM</span>
                    </div>
                  </div>

                  {/* ETA badge */}
                  {order.status === "preparing" && order.eta && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--accent)", fontSize: "0.85rem" }}>
                      <Clock size={14} /> Tahmini süre: <strong>~{order.eta} dakika</strong>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                    {order.status === "awaiting_payment" && (
                      <span style={{ color: "var(--text-muted)", fontSize: "0.82rem", alignSelf: "center", fontStyle: "italic" }}>
                        Blockchain ödemesi bekleniyor...
                      </span>
                    )}
                    {order.status === "preparing" && (
                      <button
                        className="btn btn-primary"
                        onClick={() => updateStatus(order.id, "ready")}
                        style={{ padding: "8px 20px", fontSize: "0.85rem" }}
                      >
                        <Check size={15} /> Sipariş Hazır
                      </button>
                    )}
                    {order.status === "ready" && (
                      <button
                        className="btn btn-glass"
                        onClick={() => updateStatus(order.id, "delivered")}
                        style={{ borderColor: "var(--success)", color: "var(--success)", padding: "8px 20px", fontSize: "0.85rem" }}
                      >
                        <CheckCircle size={15} /> Teslim Edildi
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
        {/* Complaints Column */}
        <div>
          <h2 className="serif" style={{ fontSize: "1.4rem", marginBottom: "20px", color: "#fff", display: "flex", alignItems: "center", gap: "10px" }}>
            <AlertCircle color="var(--error)" size={20} /> Bildirimler
            {complaints.length > 0 && (
              <span style={{ background: "rgba(239,68,68,0.15)", color: "var(--error)", borderRadius: "20px", padding: "2px 10px", fontSize: "0.85rem", fontFamily: "var(--sans)", fontWeight: 600 }}>
                {complaints.length}
              </span>
            )}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <AnimatePresence>
              {complaints.length === 0 && (
                <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.88rem", fontStyle: "italic" }}>
                  Müşterilerden gelen mesaj yok.
                </div>
              )}
              {complaints.map((c) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="glass"
                  style={{ padding: "18px", borderLeft: "3px solid var(--error)", background: "rgba(239,68,68,0.04)" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <strong style={{ color: "var(--error)", fontFamily: "var(--serif)", fontSize: "1rem" }}>
                      Masa {c.table}
                    </strong>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      {c.time instanceof Date ? c.time.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : ""}
                    </span>
                  </div>
                  <p style={{ color: "#ddd", fontSize: "0.88rem", lineHeight: "1.5", marginBottom: "12px" }}>{c.text}</p>
                  <button
                    onClick={() => dismissComplaint(c.id)}
                    className="btn btn-glass"
                    style={{ width: "100%", padding: "6px", fontSize: "0.78rem", color: "var(--text-muted)", borderColor: "rgba(255,255,255,0.08)" }}
                  >
                    ✓ Okundu
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Stock Management ── */}
        <div style={{ marginTop: "32px", gridColumn: "1 / -1" }}>
          <h2 className="serif" style={{ fontSize: "1.3rem", marginBottom: "16px", color: "#fff", display: "flex", alignItems: "center", gap: "10px" }}>
            <Package color="var(--accent)" size={18} /> Stok Durumu
            <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontFamily: "var(--sans)", fontWeight: 400, marginLeft: "4px" }}>
              — Tükenenleri anlık kapatın
            </span>
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "14px" }}>
            {menuItems.map((item) => {
              const inStock = stock[item.id] !== false;
              return (
                <div
                  key={item.id}
                  className="glass"
                  style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: "14px", opacity: inStock ? 1 : 0.55, transition: "opacity 0.3s" }}
                >
                  {item.image_url
                    ? <img src={getImgUrl(item.image_url)!} alt={item.name} style={{ width: "44px", height: "44px", objectFit: "cover", borderRadius: "8px", flexShrink: 0 }} />
                    : <span style={{ fontSize: "1.8rem", flexShrink: 0 }}>{item.img}</span>
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, color: "#fff", fontSize: "0.85rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</div>
                    <div style={{ fontSize: "0.78rem", color: "var(--accent)", marginTop: "1px" }}>{item.price?.toFixed(1)} XLM</div>
                    <div style={{ fontSize: "0.70rem", color: inStock ? "var(--success)" : "var(--error)", marginTop: "3px", fontWeight: 700 }}>
                      {inStock ? "● Stokta" : "● Tükendi"}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleStock(item.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: inStock ? "var(--success)" : "var(--error)", flexShrink: 0, transition: "color 0.2s" }}
                    title={inStock ? "Tükendi işaretle" : "Stoka geri ekle"}
                  >
                    {inStock ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Table Management ── */}
        <div style={{ marginTop: "32px", gridColumn: "1 / -1" }}>
          <h2 className="serif" style={{ fontSize: "1.3rem", marginBottom: "16px", color: "#fff", display: "flex", alignItems: "center", gap: "10px" }}>
            <Coffee color="var(--accent)" size={18} /> Masa Yönetimi
            <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontFamily: "var(--sans)", fontWeight: 400, marginLeft: "4px" }}>
              — Masaların temizlik ve doluluk durumu
            </span>
          </h2>
          <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
            {tables.map(t => {
              let bgColor = "rgba(255,255,255,0.05)";
              let borderColor = "rgba(255,255,255,0.1)";
              let icon = <CheckCircle size={18} />;
              let label = "Boş & Temiz";

              if (t.status === "occupied") {
                bgColor = "rgba(59,130,246,0.1)";
                borderColor = "rgba(59,130,246,0.3)";
                icon = <Coffee size={18} />;
                label = "Dolu";
              } else if (t.status === "dirty") {
                bgColor = "rgba(239,68,68,0.1)";
                borderColor = "rgba(239,68,68,0.3)";
                icon = <AlertCircle size={18} />;
                label = "Kirli (Temizlenecek)";
              }

              return (
                <div key={t.id} className="glass" style={{ width: "200px", padding: "16px", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", background: bgColor, borderColor: borderColor }}>
                  <div style={{ fontSize: "1.5rem", fontFamily: "var(--serif)", color: "#fff", fontWeight: "bold" }}>
                    Masa {t.id}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem", color: "#ddd" }}>
                    {icon} {label}
                  </div>
                  <div style={{ display: "flex", gap: "8px", marginTop: "10px", width: "100%" }}>
                    {t.status === "occupied" && (
                      <button className="btn btn-glass" style={{ flex: 1, padding: "6px", fontSize: "0.75rem", borderColor: "rgba(239,68,68,0.4)", color: "#EF4444" }} onClick={() => updateTableStatus(t.id, "dirty")}>
                        Masa Boşaldı
                      </button>
                    )}
                    {t.status === "dirty" && (
                      <button className="btn btn-glass" style={{ flex: 1, padding: "6px", fontSize: "0.75rem", borderColor: "rgba(52,211,153,0.4)", color: "#34D399" }} onClick={() => updateTableStatus(t.id, "idle")}>
                        Temizlendi
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}



