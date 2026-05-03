import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Coffee, CreditCard, MessageCircle, AlertCircle,
  RefreshCw, CheckCircle, History, ChevronDown, ChevronUp,
} from "lucide-react";
import { useParams, Navigate } from "react-router-dom";
import { useFreighter } from "../hooks/useFreighter";
import { createOrder, albedoPayOrder } from "../lib/posContract";
import io from "socket.io-client";

interface MenuItem {
  id: number;
  name: string;
  price: number;
  desc: string;
  img: string;
  image_url?: string | null;
  eta?: number;
  category?: string;
}

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

// ─── Countdown hook ──────────────────────────────────────────────────────────
function useCountdown(preparingStartedAt: string | null, etaMinutes: number) {
  const [remaining, setRemaining] = useState<number>(0);

  useEffect(() => {
    if (!preparingStartedAt) return;
    const tick = () => {
      const endTime = new Date(preparingStartedAt).getTime() + etaMinutes * 60 * 1000;
      const diff = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
      setRemaining(diff);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [preparingStartedAt, etaMinutes]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const display = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  const percent = preparingStartedAt
    ? Math.max(0, Math.min(100, (remaining / (etaMinutes * 60)) * 100))
    : 0;

  return { remaining, display, percent };
}

// ─── Status helpers ──────────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  awaiting_payment: "⏳ Ödeme Bekleniyor",
  preparing: "☕ Hazırlanıyor",
  ready: "✅ Hazır — Geliyor!",
  delivered: "📝 Teslim Edildi",
};
const STATUS_COLOR: Record<string, string> = {
  awaiting_payment: "var(--warning)",
  preparing: "var(--accent)",
  ready: "var(--success)",
  delivered: "var(--text-muted)",
};

const catEmojis: Record<string, string> = {
  "Sicak Icecekler": "☕",
  "Soguk Icecekler": "🧊",
  "Kahvalti": "🍳",
  "Ana Yemekler": "🍽️",
  "Tatlilar": "🍰",
  "Sicak \u0130\u00e7ecekler": "☕",
  "So\u011fuk \u0130\u00e7ecekler": "🧊",
  "Kahvalt\u0131": "🍳",
  "Tatl\u0131lar": "🍰",
  "T\u00fcm\u00fc": "🍴",
  "Di\u011fer": "✨",
};

// ─── Shared CartContent component ─────────────────────────────────────────
function CartContent({ cart, total, paying, isConnected, address, freighterError,
  removeFromCart, connect, disconnect, handlePayment, handleAlbedoPayment }: any) {
  return (
    <>
      <h2 className="serif text-gradient" style={{ fontSize: "1.5rem", marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px", fontWeight: 700 }}>
        🛒 Sepet
      </h2>
      {cart.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: "center", padding: "32px 0", color: "var(--text-muted)" }}>
          <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
            <Coffee size={36} style={{ opacity: 0.3, display: "block", margin: "0 auto 10px" }} />
          </motion.div>
          <p style={{ fontStyle: "italic", fontSize: "0.88rem", margin: 0 }}>Sepetin boş. Bir şeyler seç!</p>
        </motion.div>
      ) : (
        <motion.div style={{ marginBottom: "20px" }}>
          <div style={{ maxHeight: "240px", overflowY: "auto" }}>
            {cart.map((c: any, idx: number) => (
              <motion.div key={c.item.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }} layout
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: "#fff", fontSize: "0.9rem" }}>{c.item.name}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--accent)", marginTop: "2px" }}>{c.qty}× @ {c.item.price.toFixed(1)} XLM</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontWeight: 700, color: "var(--accent)", fontSize: "0.9rem", minWidth: "46px", textAlign: "right" }}>{(c.item.price * c.qty).toFixed(1)} XLM</span>
                  <motion.button whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.8 }} onClick={() => removeFromCart(c.item.id)}
                    style={{ background: "none", border: "none", color: "rgba(239,68,68,0.7)", cursor: "pointer", fontSize: "1.1rem", display: "flex", padding: "4px" }}>✕</motion.button>
                </div>
              </motion.div>
            ))}
          </div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            style={{ display: "flex", justifyContent: "space-between", marginTop: "14px", paddingTop: "14px", borderTop: "2px solid rgba(212,175,55,0.2)" }}>
            <span style={{ color: "var(--text-muted)", fontWeight: 600, fontSize: "1rem" }}>TOPLAM</span>
            <span className="serif" style={{ color: "var(--accent)", fontWeight: 800, fontSize: "1.3rem", background: "rgba(212,175,55,0.1)", padding: "3px 10px", borderRadius: "8px" }}>
              {total.toFixed(1)} XLM
            </span>
          </motion.div>
        </motion.div>
      )}

      {!isConnected ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="btn btn-primary"
            style={{ width: "100%", padding: "13px", fontWeight: 700, letterSpacing: "1px" }} onClick={connect}>
            <CreditCard size={16} /> Freighter Bağla
          </motion.button>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            style={{ width: "100%", padding: "13px", fontWeight: 700, letterSpacing: "1px", background: "linear-gradient(135deg, #1E3A8A 0%, #3B82F6 100%)", border: "none", borderRadius: "30px", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
            onClick={handleAlbedoPayment} disabled={cart.length === 0 || paying}>
            {paying ? <><RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} /> İşleniyor...</> : <>📱 Albedo ile Sipariş Ver</>}
          </motion.button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="btn btn-primary"
            disabled={cart.length === 0 || paying}
            style={{ width: "100%", padding: "13px", opacity: cart.length === 0 || paying ? 0.6 : 1, fontWeight: 700, letterSpacing: "1px" }}
            onClick={handlePayment}>
            {paying ? <><RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} /> İşleniyor...</> : <><CreditCard size={16} /> SİPARİŞ VER & ÖDE</>}
          </motion.button>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            style={{ width: "100%", padding: "9px", fontSize: "0.78rem", color: "var(--text-muted)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "30px", background: "transparent", cursor: "pointer" }}
            onClick={disconnect}>Cüzdanı Çıkart</motion.button>
        </div>
      )}
      {freighterError && <p style={{ color: "var(--error)", fontSize: "0.78rem", marginTop: "10px", textAlign: "center" }}>⚠️ {freighterError}</p>}
      {isConnected && address && (
        <p style={{ color: "var(--success)", fontSize: "0.75rem", marginTop: "10px", textAlign: "center", background: "rgba(52,211,153,0.1)", padding: "6px 8px", borderRadius: "8px", fontWeight: 600 }}>
          ✅ {address.slice(0, 8)}...{address.slice(-6)}
        </p>
      )}
    </>
  );
}

export function Menu() {
  const { tableId } = useParams<{ tableId: string }>();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<{ item: MenuItem; qty: number }[]>([]);
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [tableHistory, setTableHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [complaintText, setComplaintText] = useState("");
  const [showComplaint, setShowComplaint] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatText, setChatText] = useState("");
  const [paying, setPaying] = useState(false);
  const [stock, setStock] = useState<Record<number, boolean>>({});
  const [tableStatus, setTableStatus] = useState<string>("occupied");
  const [activeCategory, setActiveCategory] = useState<string>("Tümü");
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  const { address, status, connect, disconnect, error: freighterError } = useFreighter();
  const isConnected = status === "connected";

  const tableNum = Number(tableId);
  if (!tableId || isNaN(tableNum) || tableNum < 1 || tableNum > 5) {
    return <Navigate to="/" replace />;
  }

  // ── Socket sync ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleSync = (orders: any[]) => {
      const forThisTable = orders.filter((o) => o.table === tableId);
      const active = forThisTable
        .filter((o) => o.status !== "delivered")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      setActiveOrder(active || null);
      if (!active) setShowMenu(false);
    };
    const handleStock = (s: Record<number, boolean>) => setStock(s);
    const handleMenu = (m: MenuItem[]) => setMenuItems(m);
    const handleTables = (t: any[]) => {
      const myTable = t.find(table => table.id === tableId);
      if (myTable) setTableStatus(myTable.status);
    };

    socket.on("sync_orders", handleSync);
    socket.on("sync_stock", handleStock);
    socket.on("sync_menu", handleMenu);
    socket.on("sync_tables", handleTables);

    return () => {
      socket.off("sync_orders", handleSync);
      socket.off("sync_stock", handleStock);
      socket.off("sync_menu", handleMenu);
      socket.off("sync_tables", handleTables);
    };
  }, [tableId]);

  // ── Fetch table order history ────────────────────────────────────────────────
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/orders/table/${tableId}`);
        if (res.ok) setTableHistory(await res.json());
      } catch { /* silent */ }
    };
    fetchHistory();
  }, [tableId, activeOrder?.status]);

  const total = cart.reduce((sum, c) => sum + c.item.price * c.qty, 0);

  const categories = ["Tümü", ...Array.from(new Set(menuItems.map(m => m.category || "Diğer")))];
  const filteredItems = activeCategory === "Tümü"
    ? menuItems
    : menuItems.filter(m => (m.category || "Diğer") === activeCategory);

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((p) => p.item.id === item.id);
      if (existing) return prev.map((p) => p.item.id === item.id ? { ...p, qty: p.qty + 1 } : p);
      return [...prev, { item, qty: 1 }];
    });
  };

  const removeFromCart = (itemId: number) => setCart((prev) => prev.filter((p) => p.item.id !== itemId));

  const handlePayment = async () => {
    if (!isConnected || !address) { alert("Lütfen Freighter cüzdanınızı bağlayın!"); return; }
    if (total === 0) return;
    setPaying(true);
    try {
      const txHash = await createOrder(address, total.toFixed(7), tableId!);
      socket.emit("create_order", {
        tableId,
        items: cart.map((c) => ({ name: c.item.name, qty: c.qty })),
        total: total.toFixed(2),
        contractOrderId: txHash,
      });
      setCart([]);
      setTimeout(async () => {
        try {
          const r = await fetch(`${API_BASE}/api/get-order-id/${txHash}`);
          const d = await r.json();
          if (d.orderId !== null) {
            await fetch(`${API_BASE}/api/update-order-contract-id`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ txHash, contractOrderId: d.orderId }),
            });
          }
        } catch { /* silent */ }
      }, 3000);
    } catch (err: any) {
      alert("Ödeme başarısız: " + (err?.message || "Bilinmeyen hata"));
    } finally {
      setPaying(false);
    }
  };

  const handleAlbedoPayment = async () => {
    if (total === 0) return;
    setPaying(true);
    try {
      const txHash = await albedoPayOrder(total.toFixed(7), tableId!);
      socket.emit("create_order", {
        tableId,
        items: cart.map((c) => ({ name: c.item.name, qty: c.qty })),
        total: total.toFixed(2),
        contractOrderId: txHash,
      });
      setCart([]);
    } catch (err: any) {
      alert("Albedo ödemesi iptal edildi veya başarısız.");
    } finally {
      setPaying(false);
    }
  };

  const sendComplaint = () => {
    if (!complaintText.trim()) return;
    socket.emit("submit_complaint", { table: tableId, text: complaintText });
    setComplaintText("");
    setShowComplaint(false);
    alert("Bildiriminiz yönetime iletildi.");
  };

  const sendChat = () => {
    if (!chatText.trim()) return;
    socket.emit("submit_complaint", { table: tableId, text: chatText });
    setChatText("");
    setShowChat(false);
    alert("Mesajınız garsonumuza iletildi! 👋");
  };

  // ─── Active order tracking screen ─────────────────────────────────────────
  if (activeOrder && !showMenu) {
    return (
      <div style={{ maxWidth: "640px", margin: "0 auto", padding: "30px 20px" }}>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowMenu(true)}
          className="btn btn-glass"
          style={{ marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", color: "var(--text-muted)" }}
        >
          ← Menüye Dön
        </motion.button>
        <ActiveOrderView
          order={activeOrder}
          tableId={tableId!}
          tableHistory={tableHistory}
          showHistory={showHistory}
          setShowHistory={setShowHistory}
          complaintText={complaintText}
          setComplaintText={setComplaintText}
          showComplaint={showComplaint}
          setShowComplaint={setShowComplaint}
          sendComplaint={sendComplaint}
        />
      </div>
    );
  }

  // ─── Menu screen ──────────────────────────────────────────────────────────

  if (tableStatus !== "occupied") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px", textAlign: "center" }}>
        <Coffee size={60} color="var(--accent)" style={{ marginBottom: "20px" }} />
        <h1 className="serif" style={{ fontSize: "2.5rem", color: "#fff", marginBottom: "10px" }}>Masa {tableId}</h1>
        {tableStatus === "dirty" && (
          <p style={{ color: "var(--error)", marginBottom: "20px", background: "rgba(239,68,68,0.1)", padding: "10px 20px", borderRadius: "8px" }}>
            Bu masa şu an temizlik bekliyor olabilir. Yine de oturabilirsiniz.
          </p>
        )}
        <p style={{ color: "var(--text-muted)", marginBottom: "30px", fontSize: "1.1rem" }}>
          Sipariş vermek için lütfen masaya oturduğunuzu onaylayın.
        </p>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="btn btn-primary"
          style={{ padding: "16px 32px", fontSize: "1.2rem", borderRadius: "40px", fontWeight: 700 }}
          onClick={() => socket.emit("update_table_status", { tableId, status: "occupied" })}
        >
          Masaya Otur
        </motion.button>
      </div>
    );
  }

  return (
    <>
      <div className="menu-layout">
        {/* Left: items */}
        <div>
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            style={{ marginBottom: "40px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "20px" }}
          >
            <div>
              <h1 className="serif text-gradient" style={{
                fontSize: "clamp(1.8rem, 5vw, 3.2rem)",
                marginBottom: "6px",
                fontWeight: 700,
                lineHeight: 1.1,
              }}>
                ☕ Masa {tableId}
              </h1>
              <p style={{
                color: "var(--text-muted)",
                letterSpacing: "1px",
                textTransform: "uppercase",
                fontSize: "0.72rem",
                fontWeight: 500,
                marginBottom: 0,
              }}>
                Hazırlanmaya hazır mısınız?
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="btn btn-glass"
              onClick={() => {
                if (window.confirm("Masadan kalktığınızı bildirmek istiyor musunuz?")) {
                  socket.emit("update_table_status", { tableId, status: "dirty" });
                  setTableHistory([]);
                  alert("Teşekkür ederiz!");
                }
              }}
              style={{
                padding: "8px 14px",
                fontSize: "0.75rem",
                borderColor: "rgba(239,68,68,0.5)",
                color: "#FF6B6B",
                background: "rgba(239,68,68,0.08)",
                flexShrink: 0,
                fontWeight: 600,
                borderRadius: "20px",
              }}
            >
              🚪 Ayrıl
            </motion.button>
          </motion.div>

          {/* Active order banner */}
          {activeOrder && showMenu && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              whileHover={{ y: -4, boxShadow: "0 20px 40px rgba(212,175,55,0.15)" }}
              transition={{ duration: 0.4 }}
              style={{
                marginBottom: "32px", padding: "18px 24px",
                background: "linear-gradient(135deg, rgba(212,175,55,0.12) 0%, rgba(212,175,55,0.04) 100%)",
                border: "1px solid rgba(212,175,55,0.4)",
                borderRadius: "16px",
                display: "flex", justifyContent: "space-between", alignItems: "center"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 3 }}>
                  <Coffee size={24} color="var(--accent)" />
                </motion.div>
                <div>
                  <div style={{ color: "var(--accent)", fontWeight: 700, fontSize: "0.95rem", letterSpacing: "0.5px" }}>
                    {activeOrder.status === "preparing" && "⚡ SİPARİŞ HAZIRLANIYÖR"}
                    {activeOrder.status === "ready" && "✨ HAZIR - GELİYOR!"}
                  </div>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: "4px" }}>
                    {activeOrder.items?.map((i: any) => `${i.qty}× ${i.name}`).join(" • ")}
                  </div>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowMenu(false)}
                className="btn btn-primary"
                style={{ padding: "10px 18px", fontSize: "0.82rem", flexShrink: 0, fontWeight: 700 }}
              >
                Görüntüle →
              </motion.button>
            </motion.div>
          )}

          {/* Order history */}
          {tableHistory.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ marginBottom: "32px" }}
            >
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowHistory((h) => !h)}
                className="btn btn-glass"
                style={{
                  width: "100%",
                  justifyContent: "space-between",
                  display: "flex",
                  alignItems: "center",
                  padding: "14px 20px",
                  background: "linear-gradient(135deg, rgba(212,175,55,0.08) 0%, rgba(212,175,55,0.03) 100%)",
                  fontWeight: 600,
                  letterSpacing: "0.5px"
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <History size={18} /> Geçmiş ({tableHistory.length})
                </span>
                <motion.div animate={{ rotate: showHistory ? 180 : 0 }} transition={{ duration: 0.3 }}>
                  {showHistory ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </motion.div>
              </motion.button>
              <AnimatePresence>
                {showHistory && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    style={{ overflow: "hidden" }}
                  >
                    <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "12px" }}>
                      {tableHistory.map((o, idx) => (
                        <motion.div
                          key={o.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="glass"
                          style={{
                            padding: "16px 20px",
                            borderLeft: `4px solid ${STATUS_COLOR[o.status] ?? "var(--border)"}`,
                            background: "rgba(0,0,0,0.3)"
                          }}
                          whileHover={{ x: 4 }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>
                              {new Date(o.createdAt).toLocaleString("tr-TR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </span>
                            <span style={{
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              color: STATUS_COLOR[o.status] ?? "var(--text-muted)",
                              background: `${STATUS_COLOR[o.status]}20`,
                              padding: "4px 12px",
                              borderRadius: "20px"
                            }}>
                              {STATUS_LABEL[o.status] ?? o.status}
                            </span>
                          </div>
                          <div style={{ fontSize: "0.88rem", color: "var(--text-muted)", marginBottom: "6px" }}>
                            {o.items.map((it: any) => `${it.qty}× ${it.name}`).join(" · ")}
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ fontSize: "0.9rem", color: "var(--accent)", fontWeight: 700 }}>
                              {o.total} XLM
                            </div>
                            {o.txHash && (
                              <a
                                href={`https://stellar.expert/explorer/testnet/tx/${o.txHash}`}
                                target="_blank" rel="noreferrer"
                                style={{ fontSize: "0.7rem", color: "var(--text-muted)", textDecoration: "none", opacity: 0.7 }}
                                onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                                onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.7")}
                              >
                                🔗 Blockchain
                              </a>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* Category filter bar */}
          <div
            className="category-bar"
            style={{
              marginBottom: "16px",
              display: "flex",
              gap: "8px",
              overflowX: "auto",
              paddingBottom: "6px",
              WebkitOverflowScrolling: "touch" as any,
            }}
          >
            {categories.map(cat => (
              <motion.button
                key={cat}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveCategory(cat)}
              style={{
                padding: "7px 14px",
                borderRadius: "40px",
                border: activeCategory === cat
                  ? "1.5px solid var(--accent)"
                  : "1.5px solid rgba(255,255,255,0.1)",
                background: activeCategory === cat
                  ? "linear-gradient(135deg, rgba(212,175,55,0.25) 0%, rgba(212,175,55,0.1) 100%)"
                  : "rgba(255,255,255,0.04)",
                color: activeCategory === cat ? "var(--accent)" : "var(--text-muted)",
                fontFamily: "var(--sans)",
                fontSize: "0.75rem",
                fontWeight: activeCategory === cat ? 700 : 500,
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
                letterSpacing: "0.3px",
                transition: "all 0.25s ease",
                boxShadow: activeCategory === cat ? "0 0 15px rgba(212,175,55,0.2)" : "none",
              }}
              >
                {catEmojis[cat] ?? "🍴"} {cat}
              </motion.button>
            ))}
          </div>

          {/* Menu grid */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCategory}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="menu-grid"
            >
              {filteredItems.map((item, i) => {
                const inStock = stock[item.id] !== false;
                return (


                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 30, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: i * 0.06, duration: 0.4, type: "spring" }}
                  className="glass"
                  style={{
                    padding: "0",
                    display: "flex",
                    flexDirection: "column",
                    cursor: inStock ? "pointer" : "not-allowed",
                    opacity: inStock ? 1 : 0.5,
                    position: "relative",
                    overflow: "hidden",
                    background: "linear-gradient(180deg, rgba(30,30,30,0.8) 0%, rgba(10,10,10,0.9) 100%)",
                    height: "100%"
                  }}
                  onClick={() => inStock && addToCart(item)}
                  whileHover={inStock ? { y: -8, boxShadow: "0 24px 48px rgba(212,175,55,0.2)" } : {}}
                  whileTap={inStock ? { scale: 0.97 } : {}}
                >
                  {/* Image */}
                  <div style={{ position: "relative", width: "100%", height: "clamp(110px, 20vw, 200px)", overflow: "hidden", background: "rgba(0,0,0,0.4)" }}>
                    {item.image_url ? (
                      <motion.img
                        src={getImgUrl(item.image_url)!}
                        alt={item.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        whileHover={inStock ? { scale: 1.1 } : {}}
                        transition={{ duration: 0.4 }}
                      />
                    ) : (
                      <div style={{ fontSize: "clamp(2rem, 6vw, 4rem)", display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                        {item.img}
                      </div>
                    )}

                    {!inStock && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        style={{
                          position: "absolute",
                          top: "12px", right: "12px",
                          background: "linear-gradient(135deg, #FF6B6B 0%, #EF4444 100%)",
                          color: "#fff",
                          fontSize: "0.7rem",
                          fontWeight: 800,
                          padding: "6px 12px",
                          borderRadius: "20px",
                          letterSpacing: "1.5px",
                          textTransform: "uppercase",
                          boxShadow: "0 4px 15px rgba(239,68,68,0.4)"
                        }}
                      >
                        TÜKETME
                      </motion.div>
                    )}

                    {inStock && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        whileHover={{ opacity: 1 }}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: "100%",
                          background: "linear-gradient(180deg, rgba(212,175,55,0.0) 0%, rgba(0,0,0,0.6) 100%)",
                          display: "flex",
                          alignItems: "flex-end",
                          justifyContent: "center",
                          padding: "16px",
                          pointerEvents: "none"
                        }}
                      >
                        <span style={{ color: "#fff", fontWeight: 700, fontSize: "0.9rem", opacity: 0.9 }}>Eklemek için tıkla</span>
                      </motion.div>
                    )}
                  </div>

                  {/* Content */}
                  <div style={{ padding: "clamp(10px, 3vw, 18px)", display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
                    <h3 className="serif" style={{ fontSize: "clamp(0.95rem, 3vw, 1.35rem)", color: "#fff", margin: 0, lineHeight: 1.2 }}>
                      {item.name}
                    </h3>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", flex: 1, lineHeight: "1.4", margin: 0 }}>
                      {item.desc}
                    </p>

                    {/* Footer */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.08)", marginTop: "auto" }}>
                      <motion.span
                        whileHover={{ scale: 1.1 }}
                        style={{ fontWeight: 700, color: inStock ? "var(--accent)" : "var(--text-muted)", fontSize: "clamp(0.9rem, 2.5vw, 1.2rem)", background: inStock ? "rgba(212,175,55,0.1)" : "transparent", padding: "3px 8px", borderRadius: "8px" }}
                      >
                        {item.price.toFixed(1)} XLM
                      </motion.span>
                      {inStock ? (
                        <motion.button
                          whileHover={{ scale: 1.1, y: -2 }}
                          whileTap={{ scale: 0.9 }}
                          className="btn btn-primary"
                          style={{ padding: "6px 10px", fontSize: "0.7rem", borderRadius: "16px", fontWeight: 700 }}
                          onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                        >
                          + EKLE
                        </motion.button>
                      ) : (
                        <span style={{ fontSize: "0.75rem", color: "var(--error)", fontWeight: 700 }}>Stok Yok</span>
                      )}
                    </div>
                  </div>
                </motion.div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── DESKTOP CART (hidden on mobile) ── */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="glass-panel desktop-cart"
          style={{
            padding: "28px",
            height: "fit-content",
            position: "sticky",
            top: "90px",
            background: "linear-gradient(180deg, rgba(30,30,30,0.9) 0%, rgba(15,15,15,0.95) 100%)"
          }}
        >
          <CartContent
            cart={cart}
            total={total}
            paying={paying}
            isConnected={isConnected}
            address={address}
            freighterError={freighterError}
            removeFromCart={removeFromCart}
            connect={connect}
            disconnect={disconnect}
            handlePayment={handlePayment}
            handleAlbedoPayment={handleAlbedoPayment}
          />
        </motion.div>
      </div>

      {/* ── MOBILE CART BAR (hidden on desktop) ── */}
      <div className="mobile-cart-bar" onClick={() => setMobileCartOpen(true)} style={{
        display: "none", /* shown via CSS on mobile */
        position: "fixed", bottom: 0, left: 0, width: "100%", zIndex: 200,
        background: "linear-gradient(135deg, rgba(212,175,55,0.95) 0%, rgba(170,130,34,0.98) 100%)",
        padding: "14px 20px",
        alignItems: "center",
        justifyContent: "space-between",
        cursor: "pointer",
        boxShadow: "0 -8px 30px rgba(0,0,0,0.6)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "1.4rem" }}>🛒</span>
          <div>
            <div style={{ color: "#000", fontWeight: 800, fontSize: "0.9rem", lineHeight: 1 }}>
              {cart.length === 0 ? "Sepet Boş" : `${cart.reduce((s, c) => s + c.qty, 0)} Ürün`}
            </div>
            {cart.length > 0 && (
              <div style={{ color: "rgba(0,0,0,0.7)", fontSize: "0.75rem", marginTop: "2px" }}>
                Tıkla, sipariş ver →
              </div>
            )}
          </div>
        </div>
        {cart.length > 0 && (
          <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: "12px", padding: "6px 14px" }}>
            <span style={{ color: "#000", fontWeight: 800, fontSize: "1rem" }}>
              {total.toFixed(1)} XLM
            </span>
          </div>
        )}
      </div>

      {/* ── MOBILE CART DRAWER ── */}
      <AnimatePresence>
        {mobileCartOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileCartOpen(false)}
              style={{
                position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
                zIndex: 300, display: "none"
              }}
              className="mobile-overlay"
            />
            {/* Drawer */}
            <motion.div
              key="drawer"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="mobile-drawer"
              style={{
                position: "fixed", bottom: 0, left: 0, width: "100%",
                zIndex: 400,
                background: "linear-gradient(180deg, rgba(25,25,25,0.99) 0%, rgba(10,10,10,1) 100%)",
                borderRadius: "24px 24px 0 0",
                border: "1px solid rgba(212,175,55,0.3)",
                borderBottom: "none",
                maxHeight: "85vh",
                overflowY: "auto",
                display: "none",
              }}
            >
              <div style={{ padding: "20px 20px 100px" }}>
                {/* Handle bar */}
                <div style={{ width: "40px", height: "4px", background: "rgba(255,255,255,0.2)", borderRadius: "2px", margin: "0 auto 20px" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                  <h2 className="serif text-gradient" style={{ fontSize: "1.5rem", margin: 0, fontWeight: 700 }}>🛒 Sepet</h2>
                  <button onClick={() => setMobileCartOpen(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "1.5rem", cursor: "pointer", padding: "4px" }}>✕</button>
                </div>
                <CartContent
                  cart={cart}
                  total={total}
                  paying={paying}
                  isConnected={isConnected}
                  address={address}
                  freighterError={freighterError}
                  removeFromCart={removeFromCart}
                  connect={connect}
                  disconnect={disconnect}
                  handlePayment={handlePayment}
                  handleAlbedoPayment={handleAlbedoPayment}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Floating chat button */}
      <motion.button
        className="chat-fab"
        whileHover={{ scale: 1.15, y: -5 }}
        whileTap={{ scale: 0.9 }}
        animate={{ y: [0, -10, 0] }}
        transition={{ y: { repeat: Infinity, duration: 3, ease: "easeInOut" } }}
        onClick={() => setShowChat((v) => !v)}
        style={{
          position: "fixed", bottom: "32px", right: "32px", zIndex: 1000,
          width: "64px", height: "64px", borderRadius: "50%",
          background: "linear-gradient(135deg, #D4AF37 0%, #f0d469 100%)",
          border: "none", cursor: "pointer",
          boxShadow: "0 8px 32px rgba(212,175,55,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "1.8rem"
        }}
        title="Garson Çağır"
      >
        {showChat ? "✕" : "💬"}
      </motion.button>

      {/* Chat panel */}
      <AnimatePresence>
        {showChat && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 30 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            style={{
              position: "fixed", bottom: "110px", right: "32px", zIndex: 999,
              width: "320px",
              background: "linear-gradient(180deg, rgba(30,30,30,0.95) 0%, rgba(15,15,15,0.98) 100%)",
              border: "1px solid rgba(212,175,55,0.3)",
              borderRadius: "20px",
              padding: "24px",
              boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
              backdropFilter: "blur(16px)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                style={{ width: "10px", height: "10px", borderRadius: "50%", background: "var(--success)" }}
              />
              <h3 style={{ color: "var(--accent)", fontFamily: "var(--serif)", fontSize: "1.1rem", margin: 0, fontWeight: 700 }}>
                Garson
              </h3>
              <span style={{ marginLeft: "auto", fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600 }}>
                Masa {tableId}
              </span>
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginBottom: "14px", lineHeight: 1.6 }}>
              💧 Su, 💰 hesap, ☣️ alérji veya herhangi bir istek için garsonumuza mesaj gönder!
            </p>
            <textarea
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              placeholder="Mesajını yazınız..."
              rows={3}
              style={{
                width: "100%", padding: "12px",
                background: "rgba(0,0,0,0.4)",
                border: "1px solid rgba(212,175,55,0.2)",
                borderRadius: "12px", color: "#fff",
                fontFamily: "var(--sans)", fontSize: "0.88rem",
                outline: "none", resize: "none", boxSizing: "border-box",
                transition: "all 0.3s ease"
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = "rgba(212,175,55,0.5)"}
              onBlur={(e) => e.currentTarget.style.borderColor = "rgba(212,175,55,0.2)"}
            />
            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={sendChat}
              className="btn btn-primary"
              style={{ width: "100%", marginTop: "12px", padding: "12px", fontWeight: 700, letterSpacing: "1px" }}
            >
              <MessageCircle size={16} /> Gönder
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Active Order View (with countdown) ───────────────────────────────────────
function ActiveOrderView({
  order, tableId, tableHistory, showHistory, setShowHistory,
  complaintText, setComplaintText, showComplaint, setShowComplaint, sendComplaint,
}: any) {
  const { display, percent } = useCountdown(
    order.preparingStartedAt ?? order.createdAt,
    order.eta ?? 15
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="glass-panel"
      style={{
        padding: "42px",
        textAlign: "center",
        background: "linear-gradient(180deg, rgba(30,30,30,0.9) 0%, rgba(15,15,15,0.95) 100%)"
      }}
    >
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
        <h1 className="serif text-gradient" style={{
          fontSize: "2.2rem",
          marginBottom: "8px",
          fontWeight: 700,
          margin: 0
        }}>
          🍽️ Siparişiniz İzleniyor
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "32px", fontWeight: 500, margin: 0, marginTop: "8px" }}>
          Masa {tableId}
        </p>
      </motion.div>

      {order.status === "preparing" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={{ marginBottom: "36px" }}
        >
          <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
            <Coffee size={52} style={{ margin: "0 auto 18px", color: "var(--accent)", display: "block" }} />
          </motion.div>
          <h3 style={{ color: "#fff", fontSize: "1.5rem", marginBottom: "10px", fontWeight: 700, margin: 0 }}>
            ⚡ Hazırlanıyor...
          </h3>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", margin: 0 }}>
            Ustalarımız lezzetli bir hazırlık yapıyor! ☕
          </p>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            style={{ margin: "32px auto", maxWidth: "320px" }}
          >
            <div style={{ fontSize: "0.75rem", color: "var(--accent)", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "14px", fontWeight: 700 }}>
              ⏱️ Tahmini Kalan Süre
            </div>
            <div className="serif" style={{ fontSize: "4.2rem", fontWeight: 800, color: "var(--accent)", lineHeight: 1, marginBottom: "16px", textShadow: "0 0 20px rgba(212,175,55,0.3)" }}>
              {display}
            </div>
            <div style={{ height: "6px", background: "rgba(255,255,255,0.08)", borderRadius: "6px", overflow: "hidden", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.3)" }}>
              <motion.div
                style={{ height: "100%", background: "linear-gradient(90deg, var(--accent) 0%, #f0d469 100%)", borderRadius: "6px", boxShadow: "0 0 20px rgba(212,175,55,0.5)" }}
                animate={{ width: `${percent}%` }}
                transition={{ duration: 1, ease: "linear" }}
              />
            </div>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "10px", fontWeight: 500 }}>
              ~{order.eta} dakika tahmin edildi
            </p>
          </motion.div>
        </motion.div>
      )}

      {order.status === "ready" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, type: "spring" }}
          style={{ marginBottom: "36px" }}
        >
          <motion.div animate={{ scale: [1, 1.15, 1], rotate: [0, 5, -5, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
            <CheckCircle size={64} style={{ margin: "0 auto 18px", color: "var(--success)", display: "block" }} />
          </motion.div>
          <h3 style={{ color: "var(--success)", fontSize: "1.8rem", marginBottom: "10px", fontWeight: 700, margin: 0 }}>
            ✨ Siparişiniz Hazır!
          </h3>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", margin: 0 }}>
            Garsonumuz hemen masanıza getiriyor! 🏃
          </p>
        </motion.div>
      )}

      {/* Order summary */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        style={{ background: "linear-gradient(135deg, rgba(212,175,55,0.08) 0%, rgba(212,175,55,0.03) 100%)", borderRadius: "14px", padding: "18px 22px", marginBottom: "26px", textAlign: "left", border: "1px solid rgba(212,175,55,0.2)", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}
      >
        <div style={{ marginBottom: "12px" }}>
          {order.items?.map((item: any, i: number) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + i * 0.05 }}
              style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)", fontSize: "0.9rem", padding: "6px 0", borderBottom: i < (order.items?.length - 1) ? "1px solid rgba(255,255,255,0.04)" : "none" }}
            >
              <span style={{ fontWeight: 500 }}>
                <span style={{ color: "var(--accent)", fontWeight: 700 }}>{item.qty}×</span> {item.name}
              </span>
            </motion.div>
          ))}
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", marginTop: "12px", paddingTop: "12px", display: "flex", justifyContent: "space-between", color: "var(--accent)", fontWeight: 700, fontSize: "1.05rem" }}>
          <span>TOPLAM</span>
          <span>{order.total} XLM</span>
        </div>
      </motion.div>

      {/* History */}
      {tableHistory.length > 1 && (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowHistory((h: boolean) => !h)}
          className="btn btn-glass"
          style={{ width: "100%", marginBottom: "14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", fontSize: "0.85rem", fontWeight: 600 }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <History size={16} /> Geçmiş ({tableHistory.length})
          </span>
          <motion.div animate={{ rotate: showHistory ? 180 : 0 }} transition={{ duration: 0.3 }}>
            {showHistory ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </motion.div>
        </motion.button>
      )}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            style={{ overflow: "hidden", marginBottom: "14px" }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {tableHistory.filter((o: any) => o.id !== order.id).map((o: any, idx: number) => (
                <motion.div
                  key={o.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="glass"
                  style={{ padding: "12px 16px", textAlign: "left", borderLeft: `3px solid ${STATUS_COLOR[o.status] ?? "var(--border)"}`, background: "rgba(0,0,0,0.3)", borderRadius: "10px" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>
                      {new Date(o.createdAt).toLocaleString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: STATUS_COLOR[o.status] }}>
                      {STATUS_LABEL[o.status] ?? o.status}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "#ccc" }}>
                    {o.items.map((it: any) => `${it.qty}× ${it.name}`).join(" · ")}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Complaint */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setShowComplaint(!showComplaint)}
        className="btn btn-glass"
        style={{ width: "100%", borderColor: "rgba(239,68,68,0.4)", color: "#FF6B6B", background: "rgba(239,68,68,0.08)", fontWeight: 600, letterSpacing: "0.5px", marginBottom: "14px" }}
      >
        <AlertCircle size={18} /> Sorun veya İstek
      </motion.button>
      <AnimatePresence>
        {showComplaint && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            style={{ marginBottom: "14px", overflow: "hidden" }}
          >
            <textarea
              value={complaintText}
              onChange={(e) => setComplaintText(e.target.value)}
              placeholder="Bize iletmek istediğiniz bir sorun veya istek var mı?"
              style={{ width: "100%", height: "100px", padding: "12px", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "12px", color: "#fff", fontFamily: "var(--sans)", outline: "none", resize: "none", boxSizing: "border-box", transition: "all 0.3s ease" }}
              onFocus={(e) => e.currentTarget.style.borderColor = "rgba(239,68,68,0.4)"}
              onBlur={(e) => e.currentTarget.style.borderColor = "rgba(239,68,68,0.2)"}
            />
            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={sendComplaint}
              className="btn btn-primary"
              style={{ width: "100%", marginTop: "10px", fontWeight: 700, letterSpacing: "1px" }}
            >
              <MessageCircle size={16} /> Gönder
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
