import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import Database from "better-sqlite3";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { execSync } from "child_process";
import os from "os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const PORT = 4000;

const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

app.use(cors({ origin: "*" }));
app.use(express.json());

// ─── Uploads folder ──────────────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
app.use("/uploads", express.static(uploadsDir));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `item_${Date.now()}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// ─── SQLite Database ──────────────────────────────────────────────────────────
const db = new Database(path.join(__dirname, "cafe.db"));
db.pragma("journal_mode = WAL");

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS menu_items (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name      TEXT    NOT NULL,
    desc      TEXT    DEFAULT '',
    img       TEXT    DEFAULT '☕',
    image_url TEXT    DEFAULT NULL,
    price     REAL    NOT NULL,
    eta       INTEGER DEFAULT 10,
    in_stock  INTEGER DEFAULT 1,
    category  TEXT    DEFAULT 'Diğer'
  );

  CREATE TABLE IF NOT EXISTS orders (
    id                   TEXT PRIMARY KEY,
    table_id             TEXT NOT NULL,
    items                TEXT NOT NULL,
    total                REAL NOT NULL,
    status               TEXT DEFAULT 'preparing',
    tx_hash              TEXT,
    created_at           TEXT NOT NULL,
    preparing_started_at TEXT,
    delivered_at         TEXT,
    eta                  INTEGER DEFAULT 10
  );

  CREATE TABLE IF NOT EXISTS tables (
    id TEXT PRIMARY KEY,
    status TEXT DEFAULT 'idle'
  );

  CREATE TABLE IF NOT EXISTS waiters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    pin TEXT NOT NULL DEFAULT '1234',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Add category column if missing (migration)
try { db.exec("ALTER TABLE menu_items ADD COLUMN category TEXT DEFAULT 'Diğer'"); } catch(e){}

// Seed default menu if empty
const menuCount = db.prepare("SELECT COUNT(*) as c FROM menu_items").get();
if (menuCount.c === 0) {
  const insert = db.prepare(
    "INSERT INTO menu_items (name, desc, img, price, eta, category) VALUES (?, ?, ?, ?, ?, ?)"
  );
  // ☕ Sıcak İçecekler
  insert.run("Caffè Latte",        "Espresso & ipeksi süt köpüğü",                   "☕",  42.0,  8, "Sıcak İçecekler");
  insert.run("Cappuccino",         "Yoğun espresso ve kadifemsi süt köpüğü",         "☕",  40.0,  7, "Sıcak İçecekler");
  insert.run("Caramel Macchiato",  "Karamel şurubu, süt ve espresso katmanları",     "🍯",  48.0, 10, "Sıcak İçecekler");
  insert.run("Türk Kahvesi",       "Geleneksel köpüklü Türk kahvesi",                "🫖",  35.0, 12, "Sıcak İçecekler");
  insert.run("Filtre Kahve",       "Günlük taze çekilmiş filtre kahve",              "☕",  38.0,  5, "Sıcak İçecekler");
  insert.run("Salep",              "Geleneksel Osmanlı salepli sıcak içeceği",       "🌸",  45.0,  8, "Sıcak İçecekler");
  insert.run("Sıcak Çikolata",     "Kremalı sıcak Belçika çikolatası",               "🍫",  50.0,  8, "Sıcak İçecekler");
  // 🧊 Soğuk İçecekler
  insert.run("Iced Americano",     "Buzlu keskin espresso, serin serinlik",          "🧊",  40.0,  5, "Soğuk İçecekler");
  insert.run("Cold Brew",          "18 saatte demlenen soğuk kahve, düşük asidite", "🥤",  52.0, 10, "Soğuk İçecekler");
  insert.run("Mango Smoothie",     "Taze mango, yoğurt ve bal karışımı",             "🥭",  55.0,  8, "Soğuk İçecekler");
  insert.run("Limonata",           "Taze sıkılmış limon, nane ve şeker",             "🍋",  35.0,  5, "Soğuk İçecekler");
  insert.run("Matcha Latte",       "Japon matcha tozu, buharda ısıtılmış süt",       "🍵",  55.0,  8, "Soğuk İçecekler");
  insert.run("Strawberry Shake",   "Taze çilek, dondurma ve süt karışımı",           "🍓",  60.0,  8, "Soğuk İçecekler");
  // 🍳 Kahvaltı
  insert.run("Avocado Toast",      "Ekşi mayalı ekmekte avokado, kırmızı biber",    "🥑",  75.0, 15, "Kahvaltı");
  insert.run("Klasik Serpme",      "Peynir, zeytin, domates, salatalık çeşitleri",   "🧀",  95.0, 20, "Kahvaltı");
  insert.run("Simit & Peynir",     "Taze fırın simit, beyaz peynir ve zeytin",       "🥨",  45.0, 10, "Kahvaltı");
  insert.run("Menemen",            "Domates, biber ve yumurta kavurması",             "🍳",  65.0, 15, "Kahvaltı");
  // 🍽️ Ana Yemekler
  insert.run("Club Sandwich",      "Tavuk, marul, domates, mayonez, ekmek",          "🥪",  85.0, 20, "Ana Yemekler");
  insert.run("Caesar Salata",      "Romaine marul, parmesan, kruton, sos",           "🥗",  70.0, 12, "Ana Yemekler");
  insert.run("Margherita Pizza",   "San Marzano domates, mozzarella, fesleğen",     "🍕",  110.0, 25, "Ana Yemekler");
  insert.run("Tavuk Wrap",         "Izgara tavuk, roka, domates, sarımsaklı sos",    "🌯",  80.0, 18, "Ana Yemekler");
  // 🍰 Tatlılar
  insert.run("Cheesecake",         "New York usulü yoğun kremalı cheesecake",        "🍰",  65.0, 10, "Tatlılar");
  insert.run("Tiramisu",           "İtalyan usulü mascarpone ve espresso tatlısı",   "🎂",  70.0, 10, "Tatlılar");
  insert.run("Brownie & Dondurma", "Sıcak çikolatalı brownie ve vanilyalı dondurma","🍫",  75.0, 12, "Tatlılar");
}

try { db.exec("ALTER TABLE orders ADD COLUMN cleared_for_customer INTEGER DEFAULT 0"); } catch(e){}
try { db.exec("ALTER TABLE orders ADD COLUMN contract_order_id INTEGER DEFAULT NULL"); } catch(e){}

const tableCount = db.prepare("SELECT COUNT(*) as c FROM tables").get();
if (tableCount.c === 0) {
  for (let i = 1; i <= 5; i++) {
    db.prepare("INSERT INTO tables (id, status) VALUES (?, ?)").run(i.toString(), 'idle');
  }
}

// Seed a default waiter if none exist
const waiterCount = db.prepare("SELECT COUNT(*) as c FROM waiters").get();
if (waiterCount.c === 0) {
  db.prepare("INSERT INTO waiters (name, pin) VALUES (?, ?)").run("Garson 1", "1234");
}

// ─── Soroban contract config ─────────────────────────────────────────────────
const CONTRACT_ID = "CCDRWVJTAIOB7TADJEE6XYG2EZSH3CLE35AN5BWEVVAANRNGDXY53VXK";
const NATIVE_TOKEN = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
const CAFE_OWNER   = "GDSPUJG45447VF2YSW6SIEYHZVPBCVQVBXO2BS3ESA5MHPCXUJHBAFDA";

function fulfillOrderOnChain(contractOrderId) {
  const WAITER_KEY = "GDDCU4GYVJTV45NUFG3WYXUG4Q2BA54UUWPGRFVPOHGDNWN2U4E6K4B7"; // stellar CLI cafe_owner key
  try {
    const cmd = `stellar contract invoke --id ${CONTRACT_ID} --source cafe_owner --network testnet -- fulfill_order --waiter ${WAITER_KEY} --order_id ${contractOrderId} --token_address ${NATIVE_TOKEN} --cafe_owner ${CAFE_OWNER}`;
    console.log("📡 fulfill_order:", cmd);
    const result = execSync(cmd, { encoding: "utf-8", timeout: 60000 });
    console.log("✅ fulfill_order result:", result);
    return true;
  } catch (e) {
    console.error("❌ fulfill_order failed:", e.message);
    return false;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getTables() {
  return db.prepare("SELECT * FROM tables ORDER BY CAST(id AS INTEGER) ASC").all();
}

function getWaiters() {
  return db.prepare("SELECT id, name, pin, created_at FROM waiters ORDER BY id ASC").all();
}

function getMenuItems() {
  return db.prepare("SELECT * FROM menu_items ORDER BY id ASC").all();
}

function getStockMap() {
  const items = getMenuItems();
  const map = {};
  items.forEach((i) => { map[i.id] = i.in_stock === 1; });
  return map;
}

function getActiveOrders() {
  const rows = db.prepare("SELECT * FROM orders WHERE status != 'delivered' ORDER BY created_at DESC").all();
  return rows.map(deserializeOrder);
}

function deserializeOrder(row) {
  return {
    id: row.id,
    table: row.table_id,
    items: JSON.parse(row.items),
    total: row.total.toFixed(2),
    status: row.status,
    txHash: row.tx_hash,
    contractOrderId: row.contract_order_id ?? null,
    createdAt: row.created_at,
    preparingStartedAt: row.preparing_started_at,
    deliveredAt: row.delivered_at,
    eta: row.eta,
  };
}

// ─── REST endpoints ───────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.get("/api/menu", (_req, res) => res.json(getMenuItems()));

// Image upload
app.post("/api/menu/upload-image", upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file" });
  const url = `http://localhost:${PORT}/uploads/${req.file.filename}`;
  res.json({ url });
});

app.get("/api/orders", (_req, res) => {
  const rows = db.prepare("SELECT * FROM orders ORDER BY created_at DESC").all();
  res.json(rows.map(deserializeOrder));
});

app.get("/api/orders/table/:tableId", (req, res) => {
  const rows = db.prepare(
    "SELECT * FROM orders WHERE table_id = ? AND cleared_for_customer = 0 ORDER BY created_at DESC"
  ).all(req.params.tableId);
  res.json(rows.map(deserializeOrder));
});

app.get("/api/stock", (_req, res) => res.json(getStockMap()));

app.get("/api/waiters", (_req, res) => res.json(getWaiters()));

app.get("/api/tables", (_req, res) => res.json(getTables()));

app.get("/api/orders/active", (_req, res) => res.json(getActiveOrders()));

// Soroban tx order_id extractor
app.get("/api/get-order-id/:txHash", async (req, res) => {
  const { txHash } = req.params;
  try {
    const rpcRes = await fetch("https://soroban-testnet.stellar.org", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getTransaction", params: { hash: txHash } }),
    });
    const data = await rpcRes.json();
    const result = data.result;
    if (!result || result.status !== "SUCCESS") {
      return res.json({ orderId: null, status: result?.status ?? "NOT_FOUND" });
    }
    // Parse the last fn_return event to extract the u32 order_id
    // The return value for create_order is a u32
    let orderId = null;
    try {
      // events XDR contains fn_return:create_order with the u32
      const events = result.diagnosticEventsXdr || [];
      for (const evXdr of events) {
        const buf = Buffer.from(evXdr, "base64");
        const str = buf.toString("binary");
        if (str.includes("create_order") && str.includes("fn_return")) {
          // Last 4 bytes of fn_return:create_order event encode the u32
          // Parse: look for \x03 (ScVal type u32=3) followed by 4 bytes
          const hex = buf.toString("hex");
          // Find 00000003 (u32 type tag) near end
          const u32Pattern = /00000003([0-9a-f]{8})$/;
          const match = hex.match(u32Pattern);
          if (match) {
            orderId = parseInt(match[1], 16);
            break;
          }
        }
      }
    } catch (parseErr) {
      console.error("orderId parse error:", parseErr);
    }
    res.json({ orderId, status: "SUCCESS" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/update-order-contract-id", (req, res) => {
  const { txHash, contractOrderId } = req.body;
  if (!txHash || contractOrderId === undefined) return res.status(400).json({ error: "Missing params" });
  db.prepare("UPDATE orders SET contract_order_id = ? WHERE tx_hash = ?").run(contractOrderId, txHash);
  res.json({ ok: true });
});

app.get("/api/analytics", (_req, res) => {
  const now = new Date();
  const dailyRevenue = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dailyRevenue[d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" })] = 0;
  }

  const allOrders = db.prepare("SELECT * FROM orders").all().map(deserializeOrder);

  allOrders.forEach((o) => {
    const key = new Date(o.createdAt).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" });
    if (dailyRevenue[key] !== undefined) dailyRevenue[key] += parseFloat(o.total);
  });

  const tableOrders = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  const itemCount = {};
  allOrders.forEach((o) => {
    if (tableOrders[o.table] !== undefined) tableOrders[o.table]++;
    o.items?.forEach((it) => { itemCount[it.name] = (itemCount[it.name] || 0) + it.qty; });
  });

  const totalRevenue = allOrders.reduce((s, o) => s + parseFloat(o.total), 0);
  const todayKey = now.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" });

  res.json({
    totalOrders: allOrders.length,
    totalRevenue: totalRevenue.toFixed(2),
    todayRevenue: (dailyRevenue[todayKey] || 0).toFixed(2),
    dailyRevenue, tableOrders, itemCount,
  });
});

app.get("/api/network-ip", (_req, res) => {
  const ips = [];
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  res.json({ ips });
});

// ─── Socket.IO ────────────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  socket.emit("sync_orders", getActiveOrders());
  socket.emit("sync_stock",  getStockMap());
  socket.emit("sync_menu",   getMenuItems());
  socket.emit("sync_tables", getTables());
  socket.emit("sync_waiters", getWaiters());

  // ── Orders ──
  socket.on("create_order", (data) => {
    const items = data.items || [];
    const menu = getMenuItems();
    const maxEta = items.reduce((max, oi) => {
      const m = menu.find((m) => m.name === oi.name);
      return m && m.eta > max ? m.eta : max;
    }, 10);

    // contractOrderId format: "<tx_hash>|orderId:<n>"  or  just a tx_hash
    const rawId = data.contractOrderId ?? null;
    let txHash = rawId;
    let contractOrderId = null;
    if (rawId && rawId.includes('|orderId:')) {
      const parts = rawId.split('|orderId:');
      txHash = parts[0];
      contractOrderId = parseInt(parts[1], 10) || null;
    }

    const order = {
      id: "ord_" + Math.random().toString(36).substr(2, 9),
      table_id: String(data.tableId),
      items: JSON.stringify(items),
      total: parseFloat(data.total),
      status: "preparing",
      tx_hash: txHash,
      contract_order_id: contractOrderId,
      created_at: new Date().toISOString(),
      preparing_started_at: new Date().toISOString(),
      eta: maxEta,
    };

    db.prepare(`
      INSERT INTO orders (id, table_id, items, total, status, tx_hash, contract_order_id, created_at, preparing_started_at, eta)
      VALUES (@id, @table_id, @items, @total, @status, @tx_hash, @contract_order_id, @created_at, @preparing_started_at, @eta)
    `).run(order);

    db.prepare("UPDATE tables SET status = 'occupied' WHERE id = ?").run(String(data.tableId));

    io.emit("sync_orders", getActiveOrders());
    io.emit("new_order_alert");
    io.emit("sync_tables", getTables());
  });

  socket.on("update_order_status", ({ orderId, status }) => {
    const deliveredAt = status === "delivered" ? new Date().toISOString() : null;
    db.prepare(
      "UPDATE orders SET status = ?, delivered_at = ? WHERE id = ?"
    ).run(status, deliveredAt, orderId);

    // If delivered → release escrow on-chain
    if (status === "delivered") {
      const order = db.prepare("SELECT contract_order_id FROM orders WHERE id = ?").get(orderId);
      if (order && order.contract_order_id) {
        fulfillOrderOnChain(order.contract_order_id);
      }
    }

    io.emit("sync_orders", getActiveOrders());
  });

  // ── Tables ──
  socket.on("update_table_status", ({ tableId, status }) => {
    db.prepare("UPDATE tables SET status = ? WHERE id = ?").run(status, String(tableId));
    if (status === "dirty" || status === "idle") {
      // Hide old orders from customer when table becomes dirty or idle
      db.prepare("UPDATE orders SET cleared_for_customer = 1 WHERE table_id = ?").run(String(tableId));
    }
    io.emit("sync_tables", getTables());
    io.emit("sync_orders", getActiveOrders());
  });

  // ── Stock ──
  socket.on("set_stock", ({ itemId, inStock }) => {
    db.prepare("UPDATE menu_items SET in_stock = ? WHERE id = ?").run(inStock ? 1 : 0, itemId);
    io.emit("sync_stock", getStockMap());
    io.emit("sync_menu",  getMenuItems());
  });

  // ── Menu management ──
  socket.on("add_menu_item", (item) => {
    db.prepare(
      "INSERT INTO menu_items (name, desc, img, image_url, price, eta) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(
      item.name || "Yeni Ürün",
      item.desc || "",
      item.img || "🍽️",
      item.image_url || null,
      parseFloat(item.price) || 0,
      parseInt(item.eta) || 10
    );
    io.emit("sync_menu", getMenuItems());
    io.emit("sync_stock", getStockMap());
  });

  socket.on("update_menu_item", (item) => {
    db.prepare(
      "UPDATE menu_items SET name = ?, desc = ?, img = ?, image_url = ?, price = ?, eta = ? WHERE id = ?"
    ).run(
      item.name, item.desc, item.img,
      item.image_url ?? null,
      parseFloat(item.price),
      parseInt(item.eta),
      item.id
    );
    io.emit("sync_menu", getMenuItems());
  });

  socket.on("remove_menu_item", ({ itemId }) => {
    db.prepare("DELETE FROM menu_items WHERE id = ?").run(itemId);
    io.emit("sync_menu",  getMenuItems());
    io.emit("sync_stock", getStockMap());
  });

  // ── Complaints ──
  socket.on("submit_complaint", (data) => {
    io.emit("new_complaint", { ...data, id: "c_" + Date.now() });
  });

  // ── Waiters ──
  socket.emit("sync_waiters", getWaiters());

  socket.on("add_waiter", ({ name, pin }) => {
    db.prepare("INSERT INTO waiters (name, pin) VALUES (?, ?)").run(name, pin || "1234");
    io.emit("sync_waiters", getWaiters());
  });

  socket.on("remove_waiter", ({ waiterId }) => {
    db.prepare("DELETE FROM waiters WHERE id = ?").run(waiterId);
    io.emit("sync_waiters", getWaiters());
  });

  socket.on("update_waiter", ({ waiterId, name, pin }) => {
    db.prepare("UPDATE waiters SET name = ?, pin = ? WHERE id = ?").run(name, pin, waiterId);
    io.emit("sync_waiters", getWaiters());
  });
});

httpServer.listen(PORT, "0.0.0.0", () => {
  const nets = os.networkInterfaces();
  let localIp = 'localhost';
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        localIp = net.address;
      }
    }
  }

  console.log(`✅ Backend Local: http://localhost:${PORT}`);
  console.log(`🌐 Backend Network: http://${localIp}:${PORT}`);
  console.log(`📦 Database: cafe.db`);
  console.log(`🖼️  Uploads: http://${localIp}:${PORT}/uploads`);
});
