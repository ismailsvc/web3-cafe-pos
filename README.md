# ☕ Web3 Café POS

> **A real-time, QR-based restaurant ordering system powered by the Stellar blockchain.**

Customers scan a QR code at their table to access the menu and pay with XLM via **Freighter** or **Albedo** wallet. Payments are locked in escrow by a **Soroban smart contract** and automatically released to the café owner when the waiter marks the order as delivered.

---

## 📋 Table of Contents

- [Features](#-features)
- [Architecture](#-architecture)
- [Directory Structure](#-directory-structure)
- [Installation](#-installation)
- [Running the App](#-running-the-app)
- [Transaction Flow](#-transaction-flow)
- [Smart Contract (Soroban POS)](#-smart-contract-soroban-pos)
- [API Reference](#-api-reference)
- [Roles & Authentication](#-roles--authentication)
- [QR Code Generation](#-qr-code-generation)
- [Network & Environment](#-network--environment)
- [Tech Stack](#-tech-stack)

---

## ✨ Features

### Customer
- Access the menu at `/menu/:tableId` by scanning the table QR code
- Category-filtered, animated menu (Hot Drinks, Cold Drinks, Breakfast, Main Dishes, Desserts)
- Pay with XLM via Freighter (desktop) or Albedo (mobile)
- Real-time order tracking (preparing / ready / delivered)
- Order history with blockchain transaction link
- Waiter call / complaint submission
- Table leave notification

### Waiter Panel (`/waiter`)
- PIN-based login; each waiter has their own credentials
- View and update active order statuses (preparing → ready → delivered)
- Table status management (idle / occupied / needs cleaning)
- Real-time stock management (toggle items in/out of stock instantly)
- Complaint and call notifications
- Live updates via WebSocket

### Admin Panel (`/admin`)
- Full menu management (add, edit, delete items)
- Product image uploads
- Waiter management (add, remove, change PIN)
- Analytics dashboard (daily revenue, orders per table, best-selling items)
- View all orders

### Blockchain (Soroban Testnet)
- `create_order`: Locks the customer's XLM in the smart contract as escrow
- `fulfill_order`: When the waiter marks delivery, the backend calls the contract to release funds to the café owner
- All transactions can be tracked at [stellar.expert](https://stellar.expert/explorer/testnet)

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CUSTOMER DEVICE                          │
│   QR Scan → /menu/:tableId  →  Menu  →  Payment (Freighter /   │
│                                          Albedo)                │
└────────────────────────┬────────────────────────────────────────┘
                         │ WebSocket + REST
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                  BACKEND  (Node.js / Express)                   │
│  • SQLite database (orders, menu, tables, waiters)             │
│  • Real-time broadcast via Socket.IO                           │
│  • Image uploads via Multer                                     │
│  • Soroban fulfill_order call (stellar CLI)                    │
└──────────┬──────────────────────────────────────────────────────┘
           │ stellar CLI / Soroban RPC
           ▼
┌─────────────────────────────────────────────────────────────────┐
│              SOROBAN SMART CONTRACT  (Testnet)                  │
│  CafePos: create_order  ↔  fulfill_order                       │
│  Contract ID: CCDRWVJTAIOB7TADJEE6XYG2EZSH3CLE35AN5BWEVVAA… │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 Directory Structure

```
Web3_Menu/
├── backend/                        # Node.js server
│   ├── server.js                   # Express + Socket.IO + SQLite
│   ├── generate_qrs.js             # Generates table QR code PNGs
│   ├── seed_menu.mjs               # Initial menu seed data
│   ├── cafe.db                     # SQLite database (not in git)
│   ├── uploads/                    # Uploaded product images
│   └── package.json
│
├── frontend/                       # React + Vite + TypeScript
│   ├── src/
│   │   ├── App.tsx                 # Router layout and Header
│   │   ├── components/
│   │   │   ├── Landing.tsx         # Home page (customer entry + staff login)
│   │   │   ├── Menu.tsx            # Customer menu + cart + payment
│   │   │   ├── WaiterPanel.tsx     # Waiter order management
│   │   │   ├── AdminPanel.tsx      # Admin menu/waiter/analytics management
│   │   │   ├── ConnectButton.tsx   # Freighter connect button
│   │   │   └── WalletInfo.tsx      # Connected wallet info display
│   │   ├── hooks/
│   │   │   └── useFreighter.ts     # Freighter wallet React hook
│   │   ├── lib/
│   │   │   ├── posContract.ts      # Soroban create_order / Albedo pay
│   │   │   └── stellar.ts          # RPC URL and network passphrase config
│   │   └── index.css               # Global design system (dark mode)
│   ├── vite.config.ts              # Vite proxy (/api + WebSocket → :4000)
│   └── package.json
│
├── contracts/
│   └── pos/                        # Soroban smart contract (Rust)
│       ├── src/lib.rs              # CafePos contract source
│       └── Cargo.toml
│
├── Masa_QRCodes/                   # Generated QR PNG files (5 tables)
└── README.md
```

---

## 🚀 Installation

### Prerequisites
- **Node.js** ≥ 18
- **Rust + Soroban CLI** (only needed for contract re-deployment)
- **Freighter** Chrome extension (for customer payments on desktop)

### 1. Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Soroban CLI Setup (optional — contract is already deployed)

```bash
cargo install --locked stellar-cli --features opt
stellar network add testnet \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015"
```

---

## ▶️ Running the App

### Backend (Port 4000)

```bash
cd backend
npm run dev        # node --watch server.js  (hot reload)
# or
npm start          # node server.js
```

Expected output:
```
✅ Backend Local:   http://localhost:4000
🌐 Backend Network: http://10.0.8.36:4000
📦 Database: cafe.db
🖼️  Uploads: http://10.0.8.36:4000/uploads
```

### Frontend (Port 3001)

```bash
cd frontend
npm run dev        # vite --host 0.0.0.0 --port 3001
```

Expected output:
```
  VITE v5.4.x  ready

  ➜  Local:   http://localhost:3001/
  ➜  Network: http://10.0.8.36:3001/
```

> Vite automatically proxies `/api`, `/uploads`, and `/socket.io` requests to `:4000`.

### Regenerate QR Codes

```bash
cd backend
node generate_qrs.js
```

Creates 5 PNG files in `../Masa_QRCodes/`, each pointing to `http://<local-ip>:3001/menu/<n>`.

---

## 💳 Transaction Flow

### Freighter Payment (Desktop / Escrow)

```
Customer confirms cart
       │
       ▼
useFreighter.connect()
  → Freighter popup: account selection
       │
       ▼
posContract.createOrder(address, totalXLM, tableId)
  1. Fetches account sequence from Horizon
  2. Builds transaction with create_order operation
     - customer:      customer Stellar address
     - token_address: XLM Native Token (CDLZFC...)
     - amount:        total × 10_000_000 stroops (i128)
     - items:         ["Masa<N>"] symbol vector
  3. simulateTransaction() via Soroban RPC
  4. assembleTransaction() → auth entries attached
  5. Freighter.signTransaction(preparedTx.toXDR())
  6. sendTransaction() → broadcast to RPC
  7. getTransaction() polling (up to 45 s)
       │
       ├── SUCCESS → txHash returned
       │       │
       │       ▼
       │  socket.emit("create_order", { tableId, items, total, txHash })
       │       │
       │       ▼
       │  GET /api/get-order-id/:txHash
       │    → parses contract orderId from diagnosticEventsXdr
       │       │
       │       ▼
       │  POST /api/update-order-contract-id { txHash, contractOrderId }
       │    → updates orders.contract_order_id in DB
       │
       └── FAILURE → alert shown to customer
```

**On-chain effect:**
- `amount` XLM is transferred from the customer's wallet to the `CafePos` contract address (locked in escrow).
- `order_seq` instance storage counter increments by 1.
- New `Order` struct is written to persistent storage under `order_id`.

---

### Albedo Payment (Mobile / Direct)

```
Customer taps "Order with Albedo"
       │
       ▼
albedo.pay({
  amount:      totalXLM,
  destination: CAFE_OWNER,   // GDSPUJG4...
  network:     "testnet",
  memo:        "Masa<N>",
  submit:      true
})
  → Albedo mobile/web UI opens
  → Customer approves
       │
       ▼
txHash returned
  → socket.emit("create_order", { tableId, items, total, txHash })
```

> With Albedo, funds go **directly** to `CAFE_OWNER`; the escrow mechanism is **not used**. This method is recommended for mobile users who don't have the Freighter extension.

---

### Waiter Delivery → Escrow Release

```
Waiter clicks "Delivered"
       │
       ▼
socket.emit("update_order_status", { orderId, status: "delivered" })
       │
       ▼
Backend: sets order status = "delivered" in DB
       │
       ▼
fulfillOrderOnChain(contractOrderId):
  stellar contract invoke \
    --id    <CONTRACT_ID>  \
    --source cafe_owner    \
    --network testnet      \
    -- fulfill_order       \
    --waiter      <WAITER_KEY>      \
    --order_id    <contractOrderId> \
    --token_address <NATIVE_TOKEN>  \
    --cafe_owner  <CAFE_OWNER>
       │
       ▼
Contract:
  1. Verifies order.status === "pending"
  2. Sets order.status = "fulfilled"
  3. Transfers amount XLM: contract_address → cafe_owner
```

---

### Order Status Reference

**On-chain (Soroban contract):**

| Status | Meaning |
|--------|---------|
| `pending` | Funds locked in escrow, order being prepared |
| `fulfilled` | Order delivered, funds released to café owner |

**Frontend display:**

| Status | Label |
|--------|-------|
| `preparing` | ☕ Preparing |
| `ready` | ✅ Ready — On its way! |
| `delivered` | 📝 Delivered |

---

## 📜 Smart Contract (Soroban POS)

**Language:** Rust (`no_std`)
**SDK:** soroban-sdk 25.0.1
**Network:** Stellar Testnet

### Deployment Info

| Field | Value |
|-------|-------|
| **Contract ID** | `CCDRWVJTAIOB7TADJEE6XYG2EZSH3CLE35AN5BWEVVAANRNGDXY53VXK` |
| **Deployment Transaction Hash** | `eeef6734244d986be2f363039d16b7ee1133c607c5f4832637a128882d425fee` |
| **Deployment Date** | May 2, 2026 — 19:41:36 UTC |
| **Ledger** | #2348744 |
| **Deployer Address** | `GDDCU4GYVJTV45NUFG3WYXUG4Q2BA54UUWPGRFVPOHGDNWN2U4E6K4B7` |
| **Native Token** | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |
| **Café Owner** | `GDSPUJG45447VF2YSW6SIEYHZVPBCVQVBXO2BS3ESA5MHPCXUJHBAFDA` |
| **Deploy Fee** | 0.0019601 XLM |

🔗 **Deployment Transaction:** https://stellar.expert/explorer/testnet/tx/eeef6734244d986be2f363039d16b7ee1133c607c5f4832637a128882d425fee

🔗 **Contract on Explorer:** https://stellar.expert/explorer/testnet/contract/CCDRWVJTAIOB7TADJEE6XYG2EZSH3CLE35AN5BWEVVAANRNGDXY53VXK

---

### Data Structure

```rust
pub struct Order {
    pub customer: Address,   // Customer's Stellar address
    pub amount: i128,        // Locked amount (stroops)
    pub status: Symbol,      // "pending" | "fulfilled"
    pub items: Vec<Symbol>,  // e.g. ["Masa1"] table identifier
}
```

### Contract Functions

#### `create_order(env, customer, token_address, amount, items) → u32`

| Parameter | Type | Description |
|-----------|------|-------------|
| `customer` | `Address` | Customer's Stellar address |
| `token_address` | `Address` | XLM Native Token address |
| `amount` | `i128` | Payment amount in stroops |
| `items` | `Vec<Symbol>` | Order contents symbol |

- `customer.require_auth()` verifies the customer's signature
- `token::transfer(customer → contract, amount)` locks funds in escrow
- `order_seq` in instance storage is incremented
- New `Order` is written to persistent storage under `order_id`
- Returns: `u32` sequence number (contract order ID)

#### `fulfill_order(env, waiter, order_id, token_address, cafe_owner)`

| Parameter | Type | Description |
|-----------|------|-------------|
| `waiter` | `Address` | Authorized waiter's address |
| `order_id` | `u32` | Contract order ID |
| `token_address` | `Address` | XLM Native Token address |
| `cafe_owner` | `Address` | Café owner's Stellar address |

- `waiter.require_auth()` verifies waiter authorization
- Panics if `order.status != "pending"`
- Updates status to `"fulfilled"`
- `token::transfer(contract → cafe_owner, amount)` releases escrow

#### `get_order(env, order_id) → Order`

Returns the `Order` struct for the given `order_id`.

### Build & Deploy

```bash
cd contracts/pos

# Build optimized WASM
cargo build --target wasm32-unknown-unknown --release

# Deploy to Testnet
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/pos.wasm \
  --source cafe_owner \
  --network testnet
```

### Verify Contract

```bash
stellar contract invoke \
  --id CCDRWVJTAIOB7TADJEE6XYG2EZSH3CLE35AN5BWEVVAANRNGDXY53VXK \
  --source cafe_owner \
  --network testnet \
  -- get_order \
  --order_id 1
```

---

## 🔌 API Reference

### REST Endpoints (Backend :4000)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Server health check |
| `GET` | `/api/menu` | All menu items |
| `POST` | `/api/menu/upload-image` | Upload product image (`multipart/form-data`) |
| `GET` | `/api/orders` | All orders |
| `GET` | `/api/orders/active` | Active (non-delivered) orders |
| `GET` | `/api/orders/table/:tableId` | Orders for a specific table (customer view) |
| `GET` | `/api/stock` | Stock status map `{ itemId: boolean }` |
| `GET` | `/api/tables` | Table statuses |
| `GET` | `/api/waiters` | Waiter list |
| `GET` | `/api/analytics` | Revenue, order count, and item statistics |
| `GET` | `/api/network-ip` | Server's local IP addresses |
| `GET` | `/api/get-order-id/:txHash` | Parses contract order_id from tx hash |
| `POST` | `/api/update-order-contract-id` | Updates contract_order_id in DB |

### Socket.IO Events

#### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `create_order` | `{ tableId, items, total, contractOrderId }` | Create a new order |
| `update_order_status` | `{ orderId, status }` | Update order status |
| `update_table_status` | `{ tableId, status }` | Update table status |
| `set_stock` | `{ itemId, inStock }` | Toggle item stock status |
| `add_menu_item` | `{ name, desc, img, price, eta, image_url }` | Add a new menu item |
| `update_menu_item` | `{ id, name, desc, img, price, eta, image_url }` | Update a menu item |
| `remove_menu_item` | `{ itemId }` | Remove a menu item |
| `add_waiter` | `{ name, pin }` | Add a new waiter |
| `update_waiter` | `{ waiterId, name, pin }` | Update waiter info |
| `remove_waiter` | `{ waiterId }` | Remove a waiter |
| `submit_complaint` | `{ table, text }` | Submit a complaint or waiter call |

#### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `sync_orders` | `Order[]` | Active order list |
| `sync_stock` | `{ [itemId]: boolean }` | Current stock status |
| `sync_menu` | `MenuItem[]` | Current menu |
| `sync_tables` | `Table[]` | Table statuses |
| `sync_waiters` | `Waiter[]` | Waiter list |
| `new_order_alert` | — | New order notification |
| `new_complaint` | `{ id, table, text }` | New complaint or call |

---

## 👥 Roles & Authentication

| Role | Entry Point | Credentials | Access |
|------|-------------|-------------|--------|
| **Customer** | QR code → `/menu/:tableId` | None required | Menu, cart, payment |
| **Waiter** | Landing page form | Username + PIN | Order management, stock, table status |
| **Admin** | Landing page form | `admin` / `1111` | All waiter access + menu management + analytics |

Authentication state is stored in `localStorage`:
- `adminAuth: "true"` → Admin access
- `waiterAuth: "true"` → Waiter access

> **Default waiter:** Username `Garson 1`, PIN `1234`
> **Admin:** Username `admin`, PIN `1111`

---

## 📱 QR Code Generation

```bash
cd backend
node generate_qrs.js
```

The script auto-detects the local IP from the Wi-Fi adapter and generates one QR PNG per table:

```
../Masa_QRCodes/
  Masa_1_QR.png  →  http://10.0.8.36:3001/menu/1
  Masa_2_QR.png  →  http://10.0.8.36:3001/menu/2
  Masa_3_QR.png  →  http://10.0.8.36:3001/menu/3
  Masa_4_QR.png  →  http://10.0.8.36:3001/menu/4
  Masa_5_QR.png  →  http://10.0.8.36:3001/menu/5
```

> ⚠️ QR codes contain the machine's local IP address. Regenerate them if the IP changes.

---

## 🌐 Network & Environment

| Service | Local | Network |
|---------|-------|---------|
| Frontend | http://localhost:3001 | http://10.0.8.36:3001 |
| Backend | http://localhost:4000 | http://10.0.8.36:4000 |
| Soroban RPC | https://soroban-testnet.stellar.org | — |
| Stellar Horizon | https://horizon-testnet.stellar.org | — |
| Block Explorer | https://stellar.expert/explorer/testnet | — |

---

## 🛠 Tech Stack

### Frontend

| Package | Version | Usage |
|---------|---------|-------|
| React | 18.3 | UI framework |
| Vite | 5.4 | Build tool / dev server |
| TypeScript | 5.5 | Type safety |
| react-router-dom | 7 | Client-side routing |
| framer-motion | 12 | Animations & transitions |
| socket.io-client | 4.8 | Real-time communication |
| @stellar/stellar-sdk | 14.6 | Transaction building & signing |
| @stellar/freighter-api | 4.0 | Freighter wallet integration |
| @albedo-link/intent | 0.13 | Albedo mobile payment |
| lucide-react | 1.14 | Icons |
| qrcode.react | 4.2 | QR code rendering |

### Backend

| Package | Version | Usage |
|---------|---------|-------|
| express | 4.19 | HTTP server |
| socket.io | 4.8 | WebSocket server |
| better-sqlite3 | 12.9 | SQLite database |
| multer | 2.1 | File uploads |
| cors | 2.8 | CORS policy |
| qrcode | 1.5 | QR PNG generation |

### Smart Contract

| Tool | Version | Usage |
|------|---------|-------|
| Rust | stable | Contract development |
| soroban-sdk | 25.0.1 | Soroban runtime |
| stellar-cli | latest | Deploy & invoke |

---

## 🔒 Security Notes

- This project runs on **Stellar Testnet** — no real XLM is used.
- Admin and waiter PINs should be hashed and strengthened for production use.
- The `cafe_owner` private key should be stored in a secure environment variable in production.
- The `waiter.require_auth()` call in the Soroban contract enforces real signature verification in production.

---

## 📄 License

MIT © 2026 Web3 Café POS
