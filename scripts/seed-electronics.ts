/**
 * One-time electronics product seed script.
 * Run: tsx --env-file=.env.local scripts/seed-electronics.ts
 */

import mongoose from "mongoose";
import { Product } from "../src/models/Product";
import { Supplier } from "../src/models/Supplier";
import { Category } from "../src/models/Category";

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) throw new Error("MONGODB_URI is required");

// ─── Supplier map ─────────────────────────────────────────────────────────────

const SUPPLIER_MAP: Record<string, string> = {
  Peripherals:          "CompuWorld Distributors",
  Accessories:          "CompuWorld Distributors",
  Displays:             "DisplayTech Nepal",
  Audio:                "AudioHub Traders",
  Storage:              "DataLink Suppliers",
  "Networking & Cables": "DataLink Suppliers",
};

// ─── Products ─────────────────────────────────────────────────────────────────

interface ProductSeed {
  name: string;
  category: string;
  description: string;
  price: number;
  quantity: number;
  lowStockThreshold?: number;
}

const PRODUCTS: ProductSeed[] = [
  // Peripherals (12 products)
  { name: "Logitech MX Master 3 Mouse",         category: "Peripherals",          description: "Advanced wireless mouse with MagSpeed scroll, 7 buttons, ergonomic design for productivity", price: 6500,  quantity: 30 },
  { name: "Logitech MX Keys Keyboard",           category: "Peripherals",          description: "Wireless illuminated keyboard with smart backlighting and multi-device support",               price: 9500,  quantity: 20 },
  { name: "Logitech G402 Gaming Mouse",          category: "Peripherals",          description: "High-speed gaming mouse with 8 programmable buttons and 4000 DPI sensor",                     price: 3500,  quantity: 40 },
  { name: "HP KM10 Keyboard & Mouse Combo",      category: "Peripherals",          description: "Wired USB combo set suitable for office and home use",                                         price: 1200,  quantity: 80 },
  { name: "Logitech K120 USB Keyboard",          category: "Peripherals",          description: "Spill-resistant full-size wired keyboard with quiet keys",                                     price: 800,   quantity: 100 },
  { name: "Rapoo M10 Wireless Mouse",            category: "Peripherals",          description: "Compact wireless mouse with 2.4GHz connection and 1000 DPI",                                  price: 600,   quantity: 120 },
  { name: "Logitech C920 HD Webcam",             category: "Peripherals",          description: "Full HD 1080p webcam with auto-focus and stereo microphone",                                   price: 7200,  quantity: 25 },
  { name: "Havit HV-KB395L Keyboard",            category: "Peripherals",          description: "Mechanical gaming keyboard with RGB backlight and blue switches",                              price: 2800,  quantity: 35 },
  { name: "Dell MS116 USB Mouse",                category: "Peripherals",          description: "Optical wired mouse with smooth gliding and plug-and-play setup",                             price: 450,   quantity: 150 },
  { name: "Artisan Hien Gaming Mouse Pad",       category: "Peripherals",          description: "Large high-speed gaming mouse pad 450x400mm with anti-slip base",                             price: 1800,  quantity: 60 },
  { name: "Logitech G Pro X Gaming Headset",     category: "Peripherals",          description: "Tournament-grade wired gaming headset with detachable Blue VO!CE microphone",                 price: 12000, quantity: 15, lowStockThreshold: 5 },
  { name: "Trust Taro Compact Keyboard",         category: "Peripherals",          description: "Compact USB keyboard with 12 multimedia shortcuts",                                            price: 700,   quantity: 90 },

  // Accessories (10 products)
  { name: "USB-C to USB-A Hub 4-Port",           category: "Accessories",          description: "Slim 4-port USB 3.0 hub for expanding connectivity on laptops and desktops",                  price: 1400,  quantity: 70 },
  { name: "Laptop Stand Adjustable Aluminum",    category: "Accessories",          description: "Ergonomic aluminum stand with 6 height levels, foldable and portable",                        price: 2200,  quantity: 45 },
  { name: "HDMI Cable 1.5m V2.0",               category: "Accessories",          description: "High-speed HDMI 2.0 cable supporting 4K@60Hz and HDR",                                        price: 350,   quantity: 200 },
  { name: "USB-C Charging Cable 1m",             category: "Accessories",          description: "Braided USB-C to USB-C fast-charging cable rated at 60W",                                     price: 400,   quantity: 180 },
  { name: "Cable Organizer Velcro Straps x10",   category: "Accessories",          description: "Reusable velcro cable ties for desk and home organization",                                    price: 150,   quantity: 300 },
  { name: "Laptop Bag 15.6 inch Waterproof",     category: "Accessories",          description: "Business laptop backpack with USB charging port and anti-theft design",                        price: 2800,  quantity: 40 },
  { name: "Screen Cleaning Kit",                 category: "Accessories",          description: "Microfiber cloth and spray solution for safe screen cleaning",                                 price: 250,   quantity: 250 },
  { name: "Monitor Stand with Drawer",           category: "Accessories",          description: "Wooden monitor riser with storage drawer for keyboard and stationery",                         price: 1600,  quantity: 35 },
  { name: "Anti-Static Wrist Strap",             category: "Accessories",          description: "ESD wrist band for safe PC assembly and repair",                                               price: 200,   quantity: 100 },
  { name: "Desk Cable Management Tray",          category: "Accessories",          description: "Under-desk cable raceway tray for hiding power strips and cables",                             price: 900,   quantity: 55 },

  // Displays (8 products)
  { name: "LG 24MP60G 24-inch FHD Monitor",     category: "Displays",             description: "Full HD IPS monitor 1920x1080, 75Hz, 1ms response, AMD FreeSync",                             price: 22000, quantity: 12, lowStockThreshold: 3 },
  { name: "Samsung 27-inch Curved Monitor",      category: "Displays",             description: "27-inch 1800R curved VA panel, 1080p, 60Hz, HDMI and VGA ports",                             price: 28000, quantity: 10, lowStockThreshold: 3 },
  { name: "Dell E2422H 24-inch Monitor",         category: "Displays",             description: "24-inch Full HD IPS monitor with tilt stand and DisplayPort",                                  price: 24000, quantity: 8,  lowStockThreshold: 3 },
  { name: "AOC 22B2H 21.5-inch Monitor",        category: "Displays",             description: "Frameless FHD IPS monitor with HDMI, VGA and low blue light mode",                            price: 18500, quantity: 15, lowStockThreshold: 5 },
  { name: "Asus VA24DQ 24-inch Monitor",         category: "Displays",             description: "IPS 75Hz monitor with Eye Care technology and ultra-slim bezel",                               price: 23000, quantity: 10, lowStockThreshold: 3 },
  { name: "Philips 242E2F 24-inch FHD Monitor",  category: "Displays",             description: "24-inch IPS monitor with VESA mount, HDMI, and flicker-free display",                         price: 21500, quantity: 12, lowStockThreshold: 4 },
  { name: "HDMI DisplayPort Adapter",            category: "Displays",             description: "Passive HDMI to DisplayPort adapter supporting up to 4K resolution",                          price: 550,   quantity: 80 },
  { name: "Monitor Privacy Filter 24-inch",      category: "Displays",             description: "Anti-glare privacy screen filter for 16:9 24-inch monitors",                                  price: 1800,  quantity: 30 },

  // Audio (8 products)
  { name: "JBL Tune 500BT Headphones",          category: "Audio",                description: "Wireless on-ear headphones with 16-hour battery and hands-free calls",                        price: 3500,  quantity: 30 },
  { name: "Sony WH-1000XM4 Headphones",          category: "Audio",                description: "Industry-leading noise cancelling wireless headphones with 30-hour battery",                  price: 28000, quantity: 8,  lowStockThreshold: 3 },
  { name: "Xiaomi Mi True Wireless Earbuds",     category: "Audio",                description: "TWS earbuds with 14.2mm drivers, touch controls and 20-hour total playtime",                  price: 2800,  quantity: 50 },
  { name: "Logitech Z213 Multimedia Speakers",   category: "Audio",                description: "2.1 stereo speaker system with subwoofer, 7W RMS, 3.5mm input",                               price: 2200,  quantity: 40 },
  { name: "Boat Bassheads 100 Wired Earphones",  category: "Audio",                description: "In-ear wired earphones with 10mm drivers and 3.5mm jack",                                    price: 450,   quantity: 120 },
  { name: "USB Desktop Microphone",              category: "Audio",                description: "Plug-and-play USB condenser microphone for streaming and video calls",                         price: 3200,  quantity: 25 },
  { name: "Edifier R1280T Bookshelf Speakers",   category: "Audio",                description: "Powered 2.0 studio monitor speakers with dual RCA input, 42W total",                          price: 9800,  quantity: 15, lowStockThreshold: 5 },
  { name: "3.5mm Audio Splitter Y Adapter",      category: "Audio",                description: "Headphone and microphone Y splitter for combining headset on single port",                    price: 180,   quantity: 200 },

  // Storage (7 products)
  { name: "WD Blue 1TB 2.5-inch HDD",            category: "Storage",              description: "7200RPM SATA laptop hard drive with 64MB cache and 3-year warranty",                         price: 5800,  quantity: 30 },
  { name: "Seagate Barracuda 2TB HDD",            category: "Storage",              description: "Desktop 3.5-inch HDD with 256MB cache, SATA 6Gb/s interface",                                price: 7500,  quantity: 25 },
  { name: "Kingston A400 480GB SSD",              category: "Storage",              description: "2.5-inch SATA SSD with 500MB/s read, 10x faster than HDD",                                   price: 5200,  quantity: 35 },
  { name: "Samsung 970 EVO Plus 500GB NVMe",      category: "Storage",              description: "M.2 NVMe SSD with 3500MB/s sequential read for fast system boot",                             price: 9500,  quantity: 20, lowStockThreshold: 5 },
  { name: "SanDisk Ultra 64GB USB 3.1 Drive",    category: "Storage",              description: "Compact USB flash drive with 130MB/s read speed and 5-year warranty",                        price: 1200,  quantity: 100 },
  { name: "Transcend 32GB microSDHC Card",        category: "Storage",              description: "Class 10 microSD card with adapter, suitable for dash cams and phones",                       price: 700,   quantity: 150 },
  { name: "Ugreen USB 3.0 Hard Drive Enclosure",  category: "Storage",              description: "2.5-inch SATA to USB 3.0 enclosure with tool-free assembly and UASP",                         price: 1400,  quantity: 45 },

  // Networking & Cables (8 products)
  { name: "TP-Link Archer C6 AC1200 Router",      category: "Networking & Cables",  description: "Dual-band Wi-Fi router with MU-MIMO, 4 antennas and parental controls",                    price: 5200,  quantity: 20, lowStockThreshold: 5 },
  { name: "TP-Link TL-SF1008D 8-Port Switch",     category: "Networking & Cables",  description: "Unmanaged 8-port 10/100Mbps desktop Ethernet switch",                                        price: 1800,  quantity: 35 },
  { name: "CAT6 Ethernet Patch Cable 2m",          category: "Networking & Cables",  description: "RJ45 Cat6 LAN cable supporting speeds up to 1Gbps",                                         price: 200,   quantity: 300 },
  { name: "CAT6 Ethernet Cable 10m",               category: "Networking & Cables",  description: "10-meter Cat6 UTP network cable with moulded boots",                                        price: 550,   quantity: 150 },
  { name: "RJ45 Crimping Tool Kit",                category: "Networking & Cables",  description: "Network cable crimper with 10 RJ45 connectors and cable stripper",                          price: 800,   quantity: 60 },
  { name: "TP-Link RE305 Wi-Fi Range Extender",    category: "Networking & Cables",  description: "AC1200 dual-band range extender with Ethernet port and AP mode",                            price: 3200,  quantity: 25 },
  { name: "USB 3.0 Gigabit Ethernet Adapter",      category: "Networking & Cables",  description: "USB to RJ45 LAN adapter for laptops without Ethernet port",                                 price: 1200,  quantity: 55 },
  { name: "D-Link DWA-131 USB Wi-Fi Adapter",      category: "Networking & Cables",  description: "Wireless N 300Mbps USB nano adapter for desktop and laptop",                                price: 900,   quantity: 70 },
];

// ─── Image URL helper ─────────────────────────────────────────────────────────

function placeholderImage(name: string): string {
  const encoded = encodeURIComponent(name);
  return `https://placehold.co/600x400/e4e4e7/3f3f46?text=${encoded}`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Connecting to MongoDB…");
  await mongoose.connect(MONGODB_URI!);

  let created = 0;
  let skipped = 0;
  const failures: string[] = [];

  // ── 1. Ensure all categories exist ────────────────────────────────────────

  const categoryNames = [...new Set(PRODUCTS.map((p) => p.category))];
  console.log(`\nEnsuring ${categoryNames.length} categories…`);
  for (const name of categoryNames) {
    await Category.findOneAndUpdate(
      { name },
      { $setOnInsert: { name } },
      { upsert: true }
    );
    console.log(`  ✓ Category: ${name}`);
  }

  // ── 2. Ensure all suppliers exist ─────────────────────────────────────────

  const supplierNames = [...new Set(Object.values(SUPPLIER_MAP))];
  console.log(`\nEnsuring ${supplierNames.length} suppliers…`);
  const supplierIdMap = new Map<string, string>();

  for (const name of supplierNames) {
    const doc = await Supplier.findOneAndUpdate(
      { name },
      { $setOnInsert: { name } },
      { upsert: true, new: true }
    );
    if (doc) {
      supplierIdMap.set(name, String(doc._id));
      console.log(`  ✓ Supplier: ${name} (${doc._id})`);
    }
  }

  // ── 3. Create products ────────────────────────────────────────────────────

  console.log(`\nCreating ${PRODUCTS.length} products…\n`);

  for (const p of PRODUCTS) {
    try {
      // Skip if already exists by name (idempotent)
      const existing = await Product.findOne({ name: p.name }).lean();
      if (existing) {
        console.log(`  SKIP (exists): ${p.name}`);
        skipped++;
        continue;
      }

      const supplierName = SUPPLIER_MAP[p.category];
      const supplierId = supplierIdMap.get(supplierName);
      if (!supplierId) {
        failures.push(`${p.name}: could not resolve supplier for category "${p.category}"`);
        continue;
      }

      // Generate SKU the same way the API does
      const count = await Product.countDocuments();
      const seq = String(count + 1).padStart(6, "0");
      const skuCandidate = `PROD-${seq}`;
      const skuExists = await Product.findOne({ sku: skuCandidate }).lean();
      const sku = skuExists
        ? `PROD-${seq}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
        : skuCandidate;

      const imageUrl = placeholderImage(p.name);

      await Product.create({
        name:              p.name,
        category:          p.category,
        supplierId,
        description:       p.description,
        price:             p.price,
        quantity:          p.quantity,
        lowStockThreshold: p.lowStockThreshold ?? 10,
        imageUrl,
        sku,
      });

      console.log(`  ✓ ${p.name} (${sku}) — placeholder image`);
      created++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failures.push(`${p.name}: ${msg}`);
      console.error(`  ✗ ${p.name}: ${msg}`);
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  console.log("\n════════════════════════════════");
  console.log(`SUMMARY`);
  console.log(`════════════════════════════════`);
  console.log(`✓ Created:  ${created}`);
  console.log(`○ Skipped:  ${skipped} (already existed)`);
  console.log(`✗ Failures: ${failures.length}`);
  if (failures.length > 0) {
    failures.forEach((f) => console.log(`  - ${f}`));
  }
  console.log(`\nImages: all ${created} used placeholder URLs`);
  console.log(`(No image search capability — real images can be uploaded from the Products page)`);

  await mongoose.disconnect();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
