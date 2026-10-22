# DevLens

<p align="center">
  <img src="../assets/lensy.svg" alt="Lensy" width="260" />
</p>

DevLens เป็นเบราว์เซอร์สำหรับนักพัฒนาที่ออกแบบตาม workflow

แสดง URL เดียวกันในเฟรมโทรศัพท์และเดสก์ท็อปพร้อมกัน พร้อม console/network แบบเรียลไทม์, HTTP interceptor และ repeater, การแก้ไขดีไซน์สด, รายงาน reconnaissance, AI assistant และการเปิดโค้ดใน editor ได้ทันที

## คุณสมบัติหลัก

- ธีม workspace แบบ immersive ในแถบแท็บ แถบนำทาง และ sidebar
- ดูตัวอย่างสอง viewport พร้อมซิงก์การเลื่อนหน้าจอ
- Tab Groups จัดการแท็บตามชื่อและสี รองรับลากวาง เมนูคลิกขวา และการย่อ
- Split View แสดงสองแท็บเดิมโดยไม่ต้องโหลดใหม่
- การป้องกัน WImH มี content protection และ overlay แจ้งเตือนภัย
- DevTools ในตัว: Elements, Console, Network และ Application
- Omnibox อัจฉริยะ รวมประวัติ บุ๊กมาร์ก ทราฟฟิก และการเติมข้อความ
- แยก workspace และ profile ด้วย Electron partition อิสระ

## Tech Stack

- Electron 44
- Vite 7
- React 19
- TypeScript (strict)
- Tailwind CSS 4

## เริ่มต้นใช้งาน

รันคำสั่งเหล่านี้ใน `outputs/devlens`:

| สคริปต์ | คำอธิบาย |
| --- | --- |
| `npm install` | ติดตั้ง dependencies |
| `npm run dev` | เริ่ม Vite และ Electron พร้อม HMR |
| `npm run build` | ตรวจ type แล้ว build out/ |
| `npm run start` | รันแอปที่ build แล้ว |
| `npm run typecheck` | รัน tsc --noEmit |

## คีย์ลัด

| การทำงาน | คีย์ลัด |
| --- | --- |
| แท็บใหม่ | `Ctrl+T` |
| ปิดแท็บ | `Ctrl+W` |
| โหลดหน้าซ้ำ | `Ctrl+R` |
| ค้นหาในหน้า | `Ctrl+F` |
| เปิด Settings | `Ctrl+,` |
| แท็บส่วนตัวใหม่ | `Ctrl+Shift+P` |
| Shell DevTools | `F12` |
| แผง Elements | `Ctrl+Shift+I` |
| แผง Console | `Ctrl+Shift+J` |
| แผง Network | `Ctrl+Shift+E` |
| Sidebar | `Ctrl+Shift+B` |
| โหมด Ghost | `Ctrl+Shift+G` |
| การป้องกัน WImH | `Ctrl+Shift+H` |
| แท็บล่าสุด | `Ctrl+Tab` |

## สัญญาอนุญาต

เผยแพร่ภายใต้ [MIT License](../../LICENSE) 

## การมีส่วนร่วม

ยินดีรับ issue และ pull request ก่อนส่งการแก้ไข กรุณารัน `npm run typecheck`

