# Sanal Fabrika — kullanım

## İnternette
**https://kaankirsan.github.io/fabrika/**: kurulum gerekmez; bilgisayar, telefon ya da Quest tarayıcısında açılır
(Quest'te doğrudan **VR'a gir**, sertifika uyarısı çıkmaz).

Güncellemek için bu klasörde: `git add -A && git commit -m "..." && git push` (1–2 dk içinde yayına çıkar).

## Bilgisayarda
`FABRIKAYI AC.bat` → tarayıcıda `http://localhost:8090/` açılır.

| Girdi | İş |
|---|---|
| Sol tık sürükle | Döndür |
| Sağ tık sürükle | Kaydır |
| Teker | Yakınlaş |
| W A S D (+Shift) | Yürü |
| Makineye tıkla / soldaki liste | Makineyi seç, sağda kontrol paneli |
| 1–9 | İlk dokuz makineye git |
| Q / E | Önceki / sonraki makine |
| Esc / panelde × | Genel bakış |
| P / panelde ⟩ | Paneli gizle-göster (kamera makinede kalır) |
| "B Holü" | Konteyner · FK-1000 · Big bag (A holünün doğusu, geniş geçitten yürünür) |
| C Holü (B'nin doğusu, koridor ekseninde geçit) | Ar-Ge & BT: sunucu odası, e-bisiklet, İHA, elektrikli araç |
| "Efektler" | Gölgelendirme (AO) + parlama; kare hızı düşerse kendiliğinden kapanır, `?efekt=0` kapatır |

Alttaki kontrol kartı × ile küçülür ("⌨ Kontroller" ile geri gelir); basılan tuş kartta yanar.
Telefonda tek parmak döndürür, iki parmak yakınlaştırır/kaydırır.

## Quest (VR)
1. `FABRIKA VR AC.bat` çalıştır (ilk seferde Windows güvenlik duvarı sorarsa **Özel ağ**'a izin ver).
2. Quest aynı Wi-Fi'de olsun; Quest tarayıcısında pencerede yazan adresi aç
   (ör. `https://192.168.1.128:8443/`).
3. "Bağlantınız gizli değil" uyarısı → **Gelişmiş → Yine de devam et** (yerel, kendinden imzalı sertifika).
4. Üst şeritteki **VR'a gir**.

| Kumanda | İş |
|---|---|
| Sol çubuk | Yürü (baktığın yöne göre) |
| Sağ çubuk sağa/sola | 30° adımlı dönüş |
| Tetik → zemin | Oraya ışınlan |
| Tetik → makine | Önünde kontrol paneli açılır |
| Tetik → panel düğmesi | Bas (basılı tut düğmeleri tetik bırakılana dek etkin) |
| Yan tuş (grip) | Makine listesi menüsü (seçilen makinenin önüne ışınlar) · salon ortası · B holü · C holü · VR'dan çık |

VR'da performans için gölgeler kapalı ve uzak makineler sisin arkasında çizilmez;
kare hızı düşerse görüş mesafesi kendiliğinden kısalır.

## Notlar
- `tools/vr-sertifika/` yerel test sertifikasıdır; siteyi internete yayınlarken bu klasörü koymayın
  (GitHub Pages zaten HTTPS verir, sertifikaya gerek kalmaz).
- `?sabit=0` adres parametresi parça birleştirmeyi kapatır (karşılaştırma/hata ayıklama için).
- `?onderle=0` açılıştaki gölgelendirici ön derlemesini kapatır (karşılaştırma için; normalde açık kalsın).
- Link paylaşılınca önizlemede `og.jpg` görünür (WhatsApp, LinkedIn, e-posta).
