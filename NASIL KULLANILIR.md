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

**Otomatik tur:** VR'a girince 3 sn sonra başlar. Sırasıyla kuzey sırası (batıdan doğuya), B holü, C holü,
güney sırası (doğudan batıya) gezilir, sonra başa sarar. Her makinede ön taraf, HMI ekranının önü ve iki
yan ya da köşe durağı vardır. Bir tur normal hızda ~12 dk, "Hızlı"da ~8 dk sürer (`js/vrtur.js` → `AYAR`).
Yürürken kenarlar hafifçe kararır (mide rahatlığı); büyük dönüşler kısa bir karartmayla tek seferde yapılır.

| Kumanda | İş |
|---|---|
| **Sol tetik** | Turu başlat / durdur |
| Sağ tetik → tur paneli | Panel düğmeleri: ⏮ önceki makine · ▶/⏸ · ⏭ sonraki · hız · makine listesi (seçilen makineye karartarak geçer, tur oradan sürer) · makine paneli · VR'dan çık |
| Sağ tetik → makine | Önünde kontrol paneli açılır (paneldeki düğmelere tetikle basılır; basılı tut düğmeleri tetik bırakılana dek etkin) |
| Yan tuş (grip) | Tur panelini gizle / göster (panel hep sol altta, yanında durur) |
| Tur dururken: sol çubuk | Yürü (duvar ve makinelerden geçilmez) |
| Tur dururken: sağ çubuk | 30° adımlı dönüş |
| Tur dururken: sağ tetik → zemin | Oraya ışınlan |

Görüntü: bütün fabrika görünür. Turun gezdiği makine canlıdır (hareketli, tam ayrıntı); diğerleri VR'a girerken
alınan tek parçalık birer kopyayla (vekil) çizilir, uzaktan hareketsiz görünür ve yaklaşınca canlanır
(`js/vrkalite.js`). Gözlük 72 Hz'de çalışır. Kare hızı düşerse önce kenar keskinliği (foveation), sonra ayrıntı
kendiliğinden azalır. VR'da gölgeler, makinelerdeki nokta ışıklar ve boyalı yüzeylerdeki ortam yansıması kapalıdır.
Masaüstünde yürürken VR'a girilirse aynı yerden başlanır; VR'dan çıkınca her şey masaüstü haline döner.

### Quest uygulaması (APK)
Gözlükte **Uygulamalar → Bilinmeyen kaynaklar → Sanal Fabrika**: ikona basınca doğrudan VR'da, girişte açılır.
Uygulama canlı siteyi (`/fabrika/?uygulama=1`) açan bir kabuktur (Meta Bubblewrap, TWA): Wi-Fi ister, site
güncellenince uygulama da güncellenir, yeniden kurmak gerekmez.
- `?uygulama=1` → `index.html` VR oturumunu açılışta ister (ikon dokunuşu kullanıcı etkileşimi sayılır),
  fabrika yüklenince `vr.bagla` bağlar; karşılama kartı gösterilmez. Reddedilirse üst şeritteki **VR'a gir** kalır.
- Uygulamayı siteye bağlayan doğrulama: `kaankirsan.github.io/.well-known/assetlinks.json` (paket
  `io.github.kaankirsan.fabrika` + imza parmak izi). Silinirse uygulama VR'da açılmaz.
- APK projesi ve imza anahtarı: `C:\Users\Kaan\Desktop\Projects\fabrika-quest\` (anahtar orada kalmalı; repoya girmez).

### Gözlükte test (geliştirme)
Gözlük USB'de ve geliştirici modundayken: yerel sunucu + `adb reverse tcp:8090 tcp:8090`, Quest tarayıcısında
`http://localhost:8090/` (localhost güvenli sayılır, sertifika gerekmez). Sayfa içi ölçüm:
`adb forward tcp:9222 localabstract:chrome_devtools_remote` → masaüstü Chrome'da `chrome://inspect`.
`__fabrika.vr._test` (tur, kalite, uyarlanır kalite durumu) buradan okunur.

## Notlar
- `tools/vr-sertifika/` yerel test sertifikasıdır; siteyi internete yayınlarken bu klasörü koymayın
  (GitHub Pages zaten HTTPS verir, sertifikaya gerek kalmaz).
- `?sabit=0` adres parametresi parça birleştirmeyi kapatır (karşılaştırma/hata ayıklama için).
- `?onderle=0` açılıştaki gölgelendirici ön derlemesini kapatır (karşılaştırma için; normalde açık kalsın).
- Link paylaşılınca önizlemede `og.jpg` görünür (WhatsApp, LinkedIn, e-posta).
