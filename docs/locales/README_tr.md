# DevLens

<p align="center">
  <img src="../assets/lensy.svg" alt="Lensy" width="260" />
</p>

DevLens, iş akışına odaklanan bir geliştirici tarayıcısıdır.

Aynı URL’ü aynı anda mobil ve masaüstü çerçevelerinde gösterir; gerçek zamanlı konsol/ağ, HTTP interceptor ve repeater, canlı tasarım düzenleme, keşif raporları, yapay zekâ asistanı ve doğrudan editöre geçiş sunar.

## Özellikler

- Sekme çubuğu, navigasyon çubuğu ve kenar çubuğunda sürükleyici workspace temaları.
- Çift viewport önizleme ve kaydırma senkronizasyonu.
- Ad, renk, sürükle-bırak, sağ tık menüsü ve katlama destekli Tab Groups.
- Mevcut iki sekmeyi yeniden yüklemeden gösteren Split View.
- İçerik koruması ve tehdit katmanıyla WImH koruması.
- Entegre DevTools: Elements, Console, Network ve Application.
- Geçmiş, yer imleri, trafik ve tamamlama önerileriyle akıllı omnibox.
- Electron partition’ları ile workspace ve profil yalıtımı.

## Teknoloji Yığını

- Electron 44
- Vite 7
- React 19
- TypeScript (strict)
- Tailwind CSS 4

## Hızlı Başlangıç

Bu komutları `outputs/devlens` içinde çalıştırın:

| Komut | Açıklama |
| --- | --- |
| `npm install` | Bağımlılıkları yükle |
| `npm run dev` | Vite ve Electron’u HMR ile başlat |
| `npm run build` | Türleri denetle ve out/ üret |
| `npm run start` | Oluşturulan uygulamayı çalıştır |
| `npm run typecheck` | tsc --noEmit çalıştır |

## Klavye Kısayolları

| Eylem | Kısayol |
| --- | --- |
| Yeni sekme | `Ctrl+T` |
| Sekmeyi kapat | `Ctrl+W` |
| Sayfayı yenile | `Ctrl+R` |
| Sayfada bul | `Ctrl+F` |
| Ayarları aç | `Ctrl+,` |
| Yeni özel sekme | `Ctrl+Shift+P` |
| Shell DevTools | `F12` |
| Elements paneli | `Ctrl+Shift+I` |
| Console paneli | `Ctrl+Shift+J` |
| Network paneli | `Ctrl+Shift+E` |
| Kenar çubuğu | `Ctrl+Shift+B` |
| Ghost modu | `Ctrl+Shift+G` |
| WImH koruması | `Ctrl+Shift+H` |
| Son kullanılan sekme | `Ctrl+Tab` |

## Lisans

[MIT Lisansı](../../LICENSE) ile yayınlanır.

## Katkı

Issue ve pull request’ler memnuniyetle karşılanır. Değişiklik göndermeden önce `npm run typecheck` çalıştırın.

