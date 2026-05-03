import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart2, TrendingUp, Coffee, Users, ToggleLeft, ToggleRight, RefreshCw, ShoppingBag, Plus, Trash2, X, Pencil, Upload, Check, User, UserPlus, QrCode } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
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

interface MenuItem { id: number; name: string; desc: string; img: string; image_url: string | null; price: number; eta: number; in_stock: number; }
interface Analytics { totalOrders: number; totalRevenue: string; todayRevenue: string; dailyRevenue: Record<string, number>; tableOrders: Record<string, number>; itemCount: Record<string, number>; }

const STATUS_LABEL: Record<string, string> = { preparing: "☕ Hazırlanıyor", ready: "✅ Hazır", delivered: "📝 Teslim Edildi" };
const STATUS_COLOR: Record<string, string> = { preparing: "var(--accent)", ready: "var(--success)", delivered: "var(--text-muted)" };
const EMOJIS = ["☕","🧊","🍯","🥑","🍰","🧁","🥐","🍕","🍔","🌮","🥗","🍜","🍣","🥤","🍹","🍷","🫖","🥛","🍦","🎂","🍽️","🫒","🧀","🥪"];

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

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "11px 14px", boxSizing: "border-box",
  background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "10px", color: "#fff", fontFamily: "var(--sans)", fontSize: "0.88rem", outline: "none",
};

const EMPTY_FORM = { name: "", desc: "", img: "☕", image_url: null as string | null, price: "", eta: "10" };

export function AdminPanel() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [stock, setStock]         = useState<Record<number, boolean>>({});
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [tables, setTables]       = useState<any[]>([]);
  const [waiters, setWaiters]     = useState<any[]>([]);
  const [networkIps, setNetworkIps] = useState<string[]>([]);
  const [selectedIp, setSelectedIp] = useState<string>(window.location.hostname);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState<"analytics"|"menu"|"stock"|"orders"|"waiters"|"qr">("analytics");
  const [newWaiterName, setNewWaiterName] = useState("");
  const [newWaiterPin, setNewWaiterPin]   = useState("1234");

  // Form state
  const [showAddForm, setShowAddForm]   = useState(false);
  const [editItemId, setEditItemId]     = useState<number | null>(null);
  const [form, setForm]                 = useState({ ...EMPTY_FORM });
  const [uploading, setUploading]       = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [a, o, m, s, w, t, net] = await Promise.all([
        fetch(`${API_BASE}/api/analytics`).then(r => r.json()),
        fetch(`${API_BASE}/api/orders`).then(r => r.json()),
        fetch(`${API_BASE}/api/menu`).then(r => r.json()),
        fetch(`${API_BASE}/api/stock`).then(r => r.json()),
        fetch(`${API_BASE}/api/waiters`).then(r => r.json()),
        fetch(`${API_BASE}/api/tables`).then(r => r.json()),
        fetch(`${API_BASE}/api/network-ip`).then(r => r.json()).catch(() => ({ ips: [window.location.hostname] })),
      ]);
      setAnalytics(a);
      setAllOrders(o);
      setMenuItems(m);
      setStock(s);
      setWaiters(w);
      setTables(t);
      if (net.ips && net.ips.length > 0) {
        setNetworkIps(net.ips);
        // Try to prefer a 192.168.x.x or 10.x.x.x IP over WSL (172.x.x.x)
        const preferred = net.ips.find((ip: string) => ip.startsWith("192.168.") || ip.startsWith("10.")) || net.ips[0];
        setSelectedIp(preferred);
      } else {
        setNetworkIps([window.location.hostname]);
        setSelectedIp(window.location.hostname);
      }
    } catch (e) {
      console.error("Admin veri yükleme hatası:", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    // Socket listeners for real-time updates
    socket.on("sync_stock",   (s) => setStock(s));
    socket.on("sync_menu",    (m) => setMenuItems(m));
    socket.on("sync_tables",  (t) => setTables(t));
    socket.on("sync_waiters", (w) => setWaiters(w));
    socket.on("new_order_alert", playNotificationSound);
    socket.on("new_complaint", playNotificationSound);
    socket.on("sync_orders",  () => {
      // Re-fetch orders when they change
      fetch(`${API_BASE}/api/orders`).then(r => r.json()).then(setAllOrders).catch(() => {});
    });
    return () => {
      socket.off("sync_stock");
      socket.off("sync_menu");
      socket.off("sync_tables");
      socket.off("sync_waiters");
      socket.off("new_order_alert");
      socket.off("new_complaint");
      socket.off("sync_orders");
    };
  }, []);

  const toggleStock = (itemId: number) => {
    const v = !stock[itemId];
    socket.emit("set_stock", { itemId, inStock: v });
    setStock(p => ({ ...p, [itemId]: v }));
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    const fd = new FormData();
    fd.append("image", file);
    try {
      const res = await fetch(`${API_BASE}/api/menu/upload-image`, { method: "POST", body: fd });
      const { url } = await res.json();
      setForm(p => ({ ...p, image_url: url }));
    } catch { alert("Görsel yüklenemedi."); }
    setUploading(false);
  };

  const openAdd = () => { setForm({ ...EMPTY_FORM }); setEditItemId(null); setShowAddForm(true); };
  const openEdit = (item: MenuItem) => {
    setForm({ name: item.name, desc: item.desc, img: item.img, image_url: item.image_url, price: String(item.price), eta: String(item.eta) });
    setEditItemId(item.id); setShowAddForm(true);
  };

  const saveItem = () => {
    if (!form.name.trim() || !form.price) return;
    const payload = { ...form, price: parseFloat(form.price), eta: parseInt(form.eta) };
    if (editItemId !== null) {
      socket.emit("update_menu_item", { id: editItemId, ...payload });
    } else {
      socket.emit("add_menu_item", payload);
    }
    setShowAddForm(false); setEditItemId(null); setForm({ ...EMPTY_FORM });
  };

  const removeItem = (id: number) => {
    if (!confirm("Bu ürünü silmek istediğinize emin misiniz?")) return;
    socket.emit("remove_menu_item", { itemId: id });
  };

  const maxRev   = analytics ? Math.max(...Object.values(analytics.dailyRevenue), 1) : 1;
  const maxTable = analytics ? Math.max(...Object.values(analytics.tableOrders), 1) : 1;

  return (
    <div style={{ maxWidth: "1300px", margin: "0 auto", padding: "30px 20px" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "36px", paddingBottom: "18px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div>
          <h1 className="serif" style={{ fontSize: "2.2rem", color: "var(--accent)", marginBottom: "4px" }}>Admin Paneli</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Menü · Stok · Analitik · Siparişler</p>
        </div>
        <button onClick={fetchData} className="btn btn-glass" style={{ display:"flex", alignItems:"center", gap:"8px", fontSize:"0.82rem" }}>
          <RefreshCw size={14} /> Yenile
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "28px", flexWrap: "wrap" }}>
        {([["analytics","📊 Analitik"],["menu","🍽️ Menü"],["stock","📦 Stok"],["orders","📋 Siparişler"],["waiters","👤 Garsonlar"],["qr","📱 QR Kodlar"]] as const).map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className="btn" style={{ padding:"8px 20px", fontSize:"0.85rem", borderRadius:"30px", cursor:"pointer", background: activeTab===tab ? "var(--accent)" : "rgba(255,255,255,0.04)", color: activeTab===tab ? "#000" : "var(--text-muted)", border: activeTab===tab ? "none" : "1px solid rgba(255,255,255,0.1)", fontWeight: activeTab===tab ? 700 : 400 }}>
            {label}
          </button>
        ))}
      </div>

      {loading && <div style={{ textAlign:"center", padding:"60px", color:"var(--text-muted)" }}><RefreshCw size={30} style={{ animation:"spin 1s linear infinite", display:"block", margin:"0 auto 12px" }} /> Yükleniyor...</div>}

      {/* ═══ ANALYTICS ═══ */}
      {!loading && activeTab === "analytics" && analytics && (
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))", gap:"18px", marginBottom:"30px" }}>
            {[
              { label:"Toplam Sipariş", value:analytics.totalOrders, icon:<ShoppingBag size={20} color="var(--accent)" />, suffix:"adet" },
              { label:"Toplam Kazanç",  value:analytics.totalRevenue, icon:<TrendingUp size={20} color="var(--success)" />, suffix:"XLM" },
              { label:"Bugün",          value:analytics.todayRevenue, icon:<Coffee size={20} color="var(--warning)" />, suffix:"XLM" },
              { label:"Aktif Masa",     value:Object.values(analytics.tableOrders).filter(v=>v>0).length, icon:<Users size={20} color="var(--accent)" />, suffix:"masa" },
            ].map(k => (
              <div key={k.label} className="glass-panel" style={{ padding:"22px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"12px" }}>
                  <span style={{ fontSize:"0.75rem", color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"1px" }}>{k.label}</span>
                  {k.icon}
                </div>
                <div className="serif" style={{ fontSize:"1.9rem", fontWeight:700, color:"#fff" }}>
                  {k.value}<span style={{ fontSize:"0.85rem", color:"var(--text-muted)", marginLeft:"5px", fontFamily:"var(--sans)", fontWeight:400 }}>{k.suffix}</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"24px" }}>
            <div className="glass-panel" style={{ padding:"24px" }}>
              <h3 className="serif" style={{ fontSize:"1.1rem", marginBottom:"20px", display:"flex", alignItems:"center", gap:"8px", color:"#fff" }}><BarChart2 size={16} color="var(--accent)" /> Son 7 Gün (XLM)</h3>
              <div style={{ display:"flex", alignItems:"flex-end", gap:"8px", height:"140px" }}>
                {Object.entries(analytics.dailyRevenue).map(([day, val]) => (
                  <div key={day} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:"4px", height:"100%" }}>
                    <div style={{ fontSize:"0.65rem", color:"var(--accent)", fontWeight:600 }}>{val>0 ? val.toFixed(0) : ""}</div>
                    <div style={{ flex:1, width:"100%", display:"flex", alignItems:"flex-end" }}>
                      <motion.div initial={{ height:0 }} animate={{ height:`${(val/maxRev)*100}%` }} transition={{ duration:0.6 }}
                        style={{ width:"100%", minHeight:"3px", background: val>0 ? "linear-gradient(to top,var(--accent),rgba(212,175,55,0.35))" : "rgba(255,255,255,0.05)", borderRadius:"4px 4px 0 0" }} />
                    </div>
                    <div style={{ fontSize:"0.64rem", color:"var(--text-muted)" }}>{day}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel" style={{ padding:"24px" }}>
              <h3 className="serif" style={{ fontSize:"1.1rem", marginBottom:"20px", display:"flex", alignItems:"center", gap:"8px", color:"#fff" }}><Users size={16} color="var(--accent)" /> Masa Siparişleri</h3>
              <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
                {Object.entries(analytics.tableOrders).map(([t, c]) => (
                  <div key={t} style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                    <span style={{ minWidth:"50px", fontSize:"0.8rem", color:"var(--text-muted)" }}>Masa {t}</span>
                    <div style={{ flex:1, height:"22px", background:"rgba(255,255,255,0.04)", borderRadius:"6px", overflow:"hidden" }}>
                      <motion.div initial={{ width:0 }} animate={{ width:`${(c/maxTable)*100}%` }} transition={{ duration:0.6 }}
                        style={{ height:"100%", background:"linear-gradient(to right,var(--accent),rgba(212,175,55,0.4))", borderRadius:"6px", minWidth: c>0?"3px":0 }} />
                    </div>
                    <span style={{ minWidth:"24px", textAlign:"right", fontSize:"0.82rem", fontWeight:600, color: c>0?"var(--accent)":"var(--text-muted)" }}>{c}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel" style={{ padding:"24px", gridColumn:"1 / -1" }}>
              <h3 className="serif" style={{ fontSize:"1.1rem", marginBottom:"20px", display:"flex", alignItems:"center", gap:"8px", color:"#fff" }}>
                <Coffee size={16} color="var(--accent)" /> Anlık Masa Durumu
              </h3>
              <div style={{ display:"flex", gap:"14px", flexWrap:"wrap" }}>
                {tables.map(t => {
                  let bgColor = "rgba(255,255,255,0.05)";
                  let borderColor = "rgba(255,255,255,0.1)";
                  let label = "Boş & Temiz";
                  if (t.status === "occupied") {
                    bgColor = "rgba(59,130,246,0.1)"; borderColor = "rgba(59,130,246,0.3)"; label = "Dolu";
                  } else if (t.status === "dirty") {
                    bgColor = "rgba(239,68,68,0.1)"; borderColor = "rgba(239,68,68,0.3)"; label = "Kirli";
                  }
                  return (
                    <div key={t.id} style={{ background: bgColor, border: `1px solid ${borderColor}`, padding:"12px 20px", borderRadius:"12px", display:"flex", flexDirection:"column", alignItems:"center", gap:"6px", minWidth:"140px" }}>
                      <span style={{ fontSize:"1.2rem", fontFamily:"var(--serif)", fontWeight:"bold", color:"#fff" }}>Masa {t.id}</span>
                      <span style={{ fontSize:"0.8rem", color:"#ddd" }}>{label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {Object.keys(analytics.itemCount).length > 0 && (
              <div className="glass-panel" style={{ padding:"24px", gridColumn:"1 / -1" }}>
                <h3 className="serif" style={{ fontSize:"1.1rem", marginBottom:"16px", display:"flex", alignItems:"center", gap:"8px", color:"#fff" }}><Coffee size={16} color="var(--accent)" /> En Çok Satılanlar</h3>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:"12px" }}>
                  {Object.entries(analytics.itemCount).sort((a,b)=>b[1]-a[1]).map(([n,q])=>(
                    <div key={n} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 16px", background:"rgba(0,0,0,0.3)", borderRadius:"10px", border:"1px solid rgba(255,255,255,0.04)" }}>
                      <span style={{ color:"#ccc", fontSize:"0.85rem" }}>{n}</span>
                      <span style={{ fontWeight:700, color:"var(--accent)", fontFamily:"var(--serif)", fontSize:"1.05rem" }}>{q}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ═══ MENU MANAGEMENT ═══ */}
      {!loading && activeTab === "menu" && (
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px" }}>
            <p style={{ color:"var(--text-muted)", fontSize:"0.85rem" }}>Ürünleri düzenleyin, ekleyin veya silin. Tüm değişiklikler anlık olarak yansır.</p>
            <button onClick={openAdd} className="btn btn-primary" style={{ display:"flex", alignItems:"center", gap:"8px", flexShrink:0 }}>
              <Plus size={15} /> Yeni Ürün
            </button>
          </div>

          {/* Form */}
          <AnimatePresence>
            {showAddForm && (
              <motion.div initial={{ opacity:0, y:-16 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-16 }}
                className="glass-panel" style={{ padding:"28px", marginBottom:"24px", border:"1px solid rgba(212,175,55,0.25)" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px" }}>
                  <h3 className="serif" style={{ fontSize:"1.3rem", color:"var(--accent)" }}>
                    {editItemId !== null ? "Ürünü Düzenle" : "Yeni Ürün Ekle"}
                  </h3>
                  <button onClick={() => { setShowAddForm(false); setEditItemId(null); }} style={{ background:"none", border:"none", color:"var(--text-muted)", cursor:"pointer" }}>
                    <X size={18} />
                  </button>
                </div>

                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px" }}>
                  <div>
                    <label style={{ fontSize:"0.74rem", color:"var(--text-muted)", display:"block", marginBottom:"5px", textTransform:"uppercase", letterSpacing:"1px" }}>Ürün Adı *</label>
                    <input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="örn. Türk Kahvesi" style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize:"0.74rem", color:"var(--text-muted)", display:"block", marginBottom:"5px", textTransform:"uppercase", letterSpacing:"1px" }}>Fiyat (XLM) *</label>
                    <input type="number" step="0.1" min="0" value={form.price} onChange={e=>setForm(p=>({...p,price:e.target.value}))} placeholder="12.5" style={inputStyle} />
                  </div>
                  <div style={{ gridColumn:"1 / -1" }}>
                    <label style={{ fontSize:"0.74rem", color:"var(--text-muted)", display:"block", marginBottom:"5px", textTransform:"uppercase", letterSpacing:"1px" }}>Açıklama</label>
                    <input value={form.desc} onChange={e=>setForm(p=>({...p,desc:e.target.value}))} placeholder="Kısa bir açıklama..." style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize:"0.74rem", color:"var(--text-muted)", display:"block", marginBottom:"5px", textTransform:"uppercase", letterSpacing:"1px" }}>Tahmini Süre (dk)</label>
                    <input type="number" min="1" max="120" value={form.eta} onChange={e=>setForm(p=>({...p,eta:e.target.value}))} placeholder="10" style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize:"0.74rem", color:"var(--text-muted)", display:"block", marginBottom:"5px", textTransform:"uppercase", letterSpacing:"1px" }}>Görsel (Dosya)</label>
                    <input type="file" accept="image/*" ref={fileRef} style={{ display:"none" }} onChange={e => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); }} />
                    <button onClick={() => fileRef.current?.click()} className="btn btn-glass" style={{ width:"100%", padding:"10px", fontSize:"0.82rem", display:"flex", alignItems:"center", justifyContent:"center", gap:"8px" }}>
                      {uploading ? <RefreshCw size={14} style={{ animation:"spin 1s linear infinite" }} /> : <Upload size={14} />}
                      {form.image_url ? "Görsel seçildi ✓" : "Dosyadan Yükle"}
                    </button>
                    {form.image_url && <img src={form.image_url} alt="preview" style={{ marginTop:"8px", width:"64px", height:"64px", objectFit:"cover", borderRadius:"8px", border:"1px solid rgba(255,255,255,0.1)" }} />}
                  </div>
                  <div style={{ gridColumn:"1 / -1" }}>
                    <label style={{ fontSize:"0.74rem", color:"var(--text-muted)", display:"block", marginBottom:"8px", textTransform:"uppercase", letterSpacing:"1px" }}>Emoji (görsel yoksa)</label>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:"5px" }}>
                      {EMOJIS.map(e => (
                        <button key={e} onClick={()=>setForm(p=>({...p,img:e}))} style={{ fontSize:"1.4rem", padding:"5px 7px", border:"none", cursor:"pointer", borderRadius:"7px", background: form.img===e ? "rgba(212,175,55,0.25)" : "rgba(255,255,255,0.04)", outline: form.img===e ? "2px solid var(--accent)" : "none" }}>{e}</button>
                      ))}
                    </div>
                  </div>
                </div>

                <button onClick={saveItem} className="btn btn-primary" disabled={!form.name.trim() || !form.price} style={{ marginTop:"20px", width:"100%", padding:"13px", fontSize:"0.95rem", opacity: (!form.name.trim()||!form.price)?0.5:1 }}>
                  <Check size={16} /> {editItemId !== null ? "Değişiklikleri Kaydet" : "Menüye Ekle"}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Items grid */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:"18px" }}>
            {menuItems.map(item => {
              const inStock = item.in_stock === 1;
              return (
                <div key={item.id} className="glass-panel" style={{ padding:"22px", opacity: inStock ? 1 : 0.65 }}>
                  <div style={{ display:"flex", gap:"14px", alignItems:"flex-start", marginBottom:"14px" }}>
                    {item.image_url
                      ? <img src={getImgUrl(item.image_url)!} alt={item.name} style={{ width:"56px", height:"56px", objectFit:"cover", borderRadius:"10px", border:"1px solid rgba(255,255,255,0.08)", flexShrink:0 }} />
                      : <div style={{ fontSize:"2.4rem", flexShrink:0 }}>{item.img}</div>
                    }
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:600, color:"#fff", fontSize:"0.95rem" }}>{item.name}</div>
                      <div style={{ color:"var(--text-muted)", fontSize:"0.78rem", marginTop:"3px", lineHeight:1.4 }}>{item.desc || "—"}</div>
                      <div style={{ display:"flex", gap:"12px", marginTop:"6px", fontSize:"0.8rem" }}>
                        <span style={{ color:"var(--accent)", fontWeight:700, fontFamily:"var(--serif)" }}>{item.price.toFixed(1)} XLM</span>
                        <span style={{ color:"var(--text-muted)" }}>⏱ {item.eta} dk</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:"7px", borderTop:"1px solid rgba(255,255,255,0.05)", paddingTop:"12px" }}>
                    <button onClick={()=>toggleStock(item.id)} className="btn btn-glass" style={{ flex:1, padding:"7px", fontSize:"0.76rem", display:"flex", alignItems:"center", justifyContent:"center", gap:"5px", color: inStock?"var(--success)":"var(--error)", borderColor: inStock?"rgba(52,211,153,0.3)":"rgba(239,68,68,0.3)" }}>
                      {inStock ? <><ToggleRight size={14} /> Stokta</> : <><ToggleLeft size={14} /> Tükendi</>}
                    </button>
                    <button onClick={()=>openEdit(item)} className="btn btn-glass" style={{ padding:"7px 12px", color:"var(--accent)", borderColor:"rgba(212,175,55,0.2)" }} title="Düzenle"><Pencil size={14} /></button>
                    <button onClick={()=>removeItem(item.id)} className="btn btn-glass" style={{ padding:"7px 12px", color:"var(--error)", borderColor:"rgba(239,68,68,0.2)" }} title="Sil"><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ═══ STOCK ═══ */}
      {!loading && activeTab === "stock" && (
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}>
          <p style={{ color:"var(--text-muted)", fontSize:"0.85rem", marginBottom:"18px" }}>Bir ürünü <strong style={{ color:"var(--error)" }}>Tükendi</strong> olarak işaretlediğinizde müşteri menüsünde anlık olarak pasif hale gelir.</p>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(250px,1fr))", gap:"18px" }}>
            {menuItems.map(item => {
              const inStock = item.in_stock === 1;
              return (
                <div key={item.id} className="glass-panel" style={{ padding:"22px", display:"flex", alignItems:"center", gap:"16px", opacity: inStock?1:0.6 }}>
                  {item.image_url
                    ? <img src={getImgUrl(item.image_url)!} alt={item.name} style={{ width:"48px", height:"48px", objectFit:"cover", borderRadius:"8px", flexShrink:0 }} />
                    : <div style={{ fontSize:"2.2rem", flexShrink:0 }}>{item.img}</div>
                  }
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600, color:"#fff", fontSize:"0.9rem" }}>{item.name}</div>
                    <div style={{ fontSize:"0.78rem", color:"var(--accent)", marginTop:"2px" }}>{item.price.toFixed(1)} XLM</div>
                    <div style={{ fontSize:"0.72rem", marginTop:"3px", color: inStock?"var(--success)":"var(--error)", fontWeight:600 }}>
                      {inStock ? "● Stokta var" : "● Tükendi"}
                    </div>
                  </div>
                  <button onClick={()=>toggleStock(item.id)} style={{ background:"none", border:"none", cursor:"pointer", color: inStock?"var(--success)":"var(--error)" }}>
                    {inStock ? <ToggleRight size={34} /> : <ToggleLeft size={34} />}
                  </button>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ═══ ORDERS ═══ */}
      {!loading && activeTab === "orders" && (
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}>
          {allOrders.length === 0
            ? <div style={{ textAlign:"center", padding:"60px", color:"var(--text-muted)", fontStyle:"italic" }}>Henüz sipariş yok.</div>
            : <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
                {allOrders.map(o => (
                  <div key={o.id} className="glass" style={{ padding:"16px 22px", display:"flex", gap:"18px", alignItems:"center", borderLeft:`3px solid ${STATUS_COLOR[o.status]??"var(--border)"}` }}>
                    <div style={{ minWidth:"56px", textAlign:"center" }}>
                      <div style={{ fontFamily:"var(--serif)", fontSize:"1.3rem", color:"var(--accent)" }}>{o.table}</div>
                      <div style={{ fontSize:"0.68rem", color:"var(--text-muted)" }}>Masa</div>
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:"0.85rem", color:"#ccc" }}>{o.items?.map((it:any) => `${it.qty}× ${it.name}`).join(" · ")}</div>
                      <div style={{ fontSize:"0.72rem", color:"var(--text-muted)", marginTop:"3px" }}>{new Date(o.createdAt).toLocaleString("tr-TR")}</div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontWeight:700, color:"var(--accent)", fontFamily:"var(--serif)" }}>{o.total} XLM</div>
                      <div style={{ fontSize:"0.72rem", color:STATUS_COLOR[o.status], marginTop:"3px", fontWeight:600 }}>{STATUS_LABEL[o.status]??o.status}</div>
                    </div>
                    {o.txHash && <a href={`https://stellar.expert/explorer/testnet/tx/${o.txHash}`} target="_blank" rel="noreferrer" style={{ fontSize:"0.7rem", color:"var(--text-muted)", textDecoration:"underline", flexShrink:0 }}>TX →</a>}
                  </div>
                ))}
              </div>
          }
        </motion.div>
      )}

      {/* ── WAITERS TAB ── */}
      {activeTab === "waiters" && (
        <motion.div key="waiters" initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}>
          <div className="glass-panel" style={{ padding:"28px", marginBottom:"24px" }}>
            <h3 className="serif" style={{ fontSize:"1.2rem", marginBottom:"20px", display:"flex", alignItems:"center", gap:"8px", color:"#fff" }}>
              <UserPlus size={18} color="var(--accent)" /> Yeni Garson Ekle
            </h3>
            <div style={{ display:"flex", gap:"12px", alignItems:"flex-end", flexWrap:"wrap" }}>
              <div style={{ flex:1, minWidth:"160px" }}>
                <label style={{ fontSize:"0.75rem", color:"var(--text-muted)", marginBottom:"4px", display:"block" }}>İsim</label>
                <input style={inputStyle} placeholder="Garson adı" value={newWaiterName} onChange={e => setNewWaiterName(e.target.value)} />
              </div>
              <div style={{ width:"120px" }}>
                <label style={{ fontSize:"0.75rem", color:"var(--text-muted)", marginBottom:"4px", display:"block" }}>PIN</label>
                <input style={inputStyle} placeholder="1234" value={newWaiterPin} onChange={e => setNewWaiterPin(e.target.value)} />
              </div>
              <button className="btn btn-primary" style={{ padding:"10px 24px", fontSize:"0.85rem" }}
                onClick={() => {
                  if (!newWaiterName.trim()) return;
                  socket.emit("add_waiter", { name: newWaiterName.trim(), pin: newWaiterPin || "1234" });
                  setNewWaiterName(""); setNewWaiterPin("1234");
                }}
              >
                <Plus size={15} /> Ekle
              </button>
            </div>
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
            {waiters.length === 0
              ? <div style={{ textAlign:"center", padding:"60px", color:"var(--text-muted)", fontStyle:"italic" }}>Henüz garson eklenmedi.</div>
              : waiters.map(w => (
                <div key={w.id} className="glass" style={{ padding:"18px 22px", display:"flex", alignItems:"center", gap:"16px" }}>
                  <div style={{ width:"44px", height:"44px", borderRadius:"50%", background:"rgba(212,175,55,0.08)", border:"1px solid rgba(212,175,55,0.2)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <User size={20} color="var(--accent)" />
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600, color:"#fff", fontSize:"1rem" }}>{w.name}</div>
                    <div style={{ fontSize:"0.78rem", color:"var(--text-muted)", marginTop:"2px" }}>PIN: {w.pin}</div>
                  </div>
                  <button className="btn btn-glass" style={{ padding:"6px 16px", fontSize:"0.78rem", color:"var(--error)", borderColor:"rgba(239,68,68,0.3)" }}
                    onClick={() => {
                      if (window.confirm(`"${w.name}" silinsin mi?`)) {
                        socket.emit("remove_waiter", { waiterId: w.id });
                      }
                    }}
                  >
                    <Trash2 size={13} /> Sil
                  </button>
                </div>
              ))
            }
          </div>
        </motion.div>
      )}

      {/* ── QR CODES TAB ── */}
      {activeTab === "qr" && (
        <motion.div key="qr" initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px" }}>
            <p style={{ color:"var(--text-muted)", fontSize:"0.85rem", margin:0 }}>Müşterilerin sipariş verebilmesi için bu QR kodları telefonlarıyla taramaları gerekir.</p>
            {networkIps.length > 1 && (
              <select 
                value={selectedIp} 
                onChange={e => setSelectedIp(e.target.value)}
                style={{ ...inputStyle, width: "auto", padding: "8px 12px", border: "1px solid var(--accent)", color: "var(--accent)", background: "rgba(212,175,55,0.1)" }}
              >
                {networkIps.map(ip => <option key={ip} value={ip}>{ip}</option>)}
              </select>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "24px" }}>
            {tables.map(t => {
              const url = `http://${selectedIp}:3001/menu/${t.id}`;
              return (
                <div key={t.id} className="glass-panel" style={{ padding: "24px", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", textAlign: "center" }}>
                  <h3 className="serif" style={{ fontSize: "1.5rem", color: "#fff", margin: 0 }}>Masa {t.id}</h3>
                  <div style={{ padding: "16px", background: "#fff", borderRadius: "12px" }}>
                    <QRCodeCanvas value={url} size={150} level={"H"} />
                  </div>
                  <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: "0.8rem", color: "var(--accent)", textDecoration: "none", wordBreak: "break-all" }}>
                    {url}
                  </a>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}
