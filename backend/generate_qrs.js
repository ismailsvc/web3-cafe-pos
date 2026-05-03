import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import os from 'os';

const outDir = path.resolve('../Masa_QRCodes');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir);
}

const getLocalIP = () => {
  const interfaces = os.networkInterfaces();
  
  // Önce Wi-Fi bağdaştırıcısını bulmaya çalış
  if (interfaces['Wi-Fi']) {
    const wifiIpv4 = interfaces['Wi-Fi'].find(iface => iface.family === 'IPv4' && !iface.internal);
    if (wifiIpv4) return wifiIpv4.address;
  }

  // Bulunamazsa diğer aktif ipv4'lere bak (Sanal ağları hariç tutmaya çalışarak)
  for (const name of Object.keys(interfaces)) {
    if (name.toLowerCase().includes('vbox') || name.toLowerCase().includes('virtual') || name.toLowerCase().includes('ethernet 2')) continue;
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
};

const generate = async () => {
  const ip = getLocalIP();
  console.log(`📡 Ağ IP Adresi Bulundu: ${ip}`);
  
  for (let i = 1; i <= 5; i++) {
    const url = `http://${ip}:3000/menu/${i}`;
    const file = path.join(outDir, `Masa_${i}_QR.png`);
    await QRCode.toFile(file, url, { width: 300, margin: 2, color: { dark: '#000000', light: '#ffffff' } });
    console.log(`✅ Created: ${file} -> ${url}`);
  }
};

generate().catch(console.error);
