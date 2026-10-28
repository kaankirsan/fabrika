# Sanal Fabrika — kullanım

## İnternette
**https://kaankirsan.github.io/fabrika/**: kurulum gerekmez; bilgisayar, telefon ya da Quest tarayıcısında açılır
(Quest'te doğrudan **VR'a gir**, sertifika uyarısı çıkmaz).

Güncellemek için bu klasörde: `git add -A && git commit -m "..." && git push` (1–2 dk içinde yayına çıkar).

## Bilgisayarda
`FABRIKAYI AC.bat` → tarayıcıda `http://localhost:8090/` açılır.

Fabrika **girişte, göz hizasında** (birinci şahıs) açılır. Karşılama kartındaki **Gezmeye başla** fareyi
kilitler (oyun gibi); **Esc** imleci geri verir (liste, panel, düğmeler için), sahnede boş bir yere
tıklamak tekrar kilitler. Üst şeritteki **Kuş bakışı** (ya da **M**) eski yörünge kamerasına geçer.

| Girdi | Yürüyüş (birinci şahıs) | Kuş bakışı |
|---|---|---|
| Fare | Kilitliyken: etrafa bak · imleç serbestken: sürükle → bak | Sol tık sürükle döndür · sağ tık kaydır · teker yakınlaş |
| W A S D / oklar (+Shift) | Yürü (Shift koş) · ← → döner | Kaydır |
| Teker | İleri / geri adım | Yakınlaş |
| Makineye tıkla / soldaki liste / 1–9 / Q E | Koridorlardan **yürüyerek** gider, varınca panel açılır | Yakın plan + panel |
| Boşluk / "Atla" | Otomatik yürüyüşü bitir (hedefe geç) | — |
| Zemine tıkla | (imleç serbestken) fare kilidine dön | Oraya in, yürüyüşe geç |
| Esc | Kilidi aç → yürüyüşü kes → paneli kapat | Genel bakış |
| P / panelde ⟩ | Paneli gizle-göster | Paneli gizle-göster |
| M / "Kuş bakışı" ↔ "Yürü" | Kuş bakışına geç | Baktığın yere (ya da seçili makinenin önüne) in |
| "B Holü" / "C Holü" | Geçitten içeri yürür | Holün üstüne uçar |
| "Efektler" | Gölgelendirme (AO) + parlama; kare hızı düşerse kendiliğinden kapanır, `?efekt=0` kapatır | |

Duvarlardan, makinelerden ve raflardan geçilmez (yürünebilir alan haritası: `js/gezgin.js`).
Alttaki kontrol kartı o anki moda göre değişir; × ile küçülür ("⌨ Kontroller" ile geri gelir), basılan tuş kartta yanar.
Telefonda: sol altta başparmakla sanal kumanda (yürü, sonuna kadar it: koş), sağda sürükle → bak, makineye
dokun → oraya yürü, zemine dokun → oraya yürü. Kuş bakışında tek parmak döndürür, iki parmak yakınlaştırır/kaydırır.

URL: `?m=<id>` makineye yürüyerek götürür (portföydeki "Sanal fabrikada gez" düğmeleri), `?mod=kus` kuş bakışıyla
açar, `?ui=0` arayüzü gizler (ekran görüntüsü için; kuş bakışıyla açılır).

## Quest (VR)
1. `FABRIKA VR AC.bat` çalıştır (ilk seferde Windows güvenlik duvarı sorarsa **Özel ağ**'a izin ver).
2. Quest aynı Wi-Fi'de olsun; Quest tarayıcısında pencerede yazan adresi aç
   (ör. `https://192.168.1.128:8443/`).
3. "Bağlantınız gizli değil" uyarısı → **Gelişmiş → Yine de devam et** (yerel, kendinden imzalı sertifika).
4. Üst şeritteki **VR'a gir**.

| Kumanda | İş |
|---|---|
| Sol çubuk | Yürü (baktığın yöne göre; duvar ve makinelerden geçilmez, duvar boyunca kayar) |
| Sağ çubuk sağa/sola | 30° adımlı dönüş |
| Tetik → zemin | Oraya ışınlan (yürünebilir en yakın noktaya) |
| Tetik → makine | Önünde kontrol paneli açılır |
| Tetik → panel düğmesi | Bas (basılı tut düğmeleri tetik bırakılana dek etkin) |
| Yan tuş (grip) | Makine listesi menüsü (seçilen makinenin önüne ışınlar) · salon ortası · B holü · C holü · VR'dan çık |

Masaüstünde yürürken VR'a girilirse aynı yerde, aynı yöne bakarak başlanır; VR'dan çıkınca yürüyüş kalınan yerden sürer.
VR'da performans için gölgeler kapalı ve uzak makineler sisin arkasında çizilmez;
kare hızı düşerse görüş mesafesi kendiliğinden kısalır.

## Notlar
- `tools/vr-sertifika/` yerel test sertifikasıdır; siteyi internete yayınlarken bu klasörü koymayın
  (GitHub Pages zaten HTTPS verir, sertifikaya gerek kalmaz).
- `?sabit=0` adres parametresi parça birleştirmeyi kapatır (karşılaştırma/hata ayıklama için).
- `?onderle=0` açılıştaki gölgelendirici ön derlemesini kapatır (karşılaştırma için; normalde açık kalsın).
- Link paylaşılınca önizlemede `og.jpg` görünür (WhatsApp, LinkedIn, e-posta).
