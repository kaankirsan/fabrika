# tools/https_sunucu.py — Sanal fabrikayı yerel ağda HTTPS ile yayınlar (Quest WebXR için).
#
# WebXR yalnız güvenli bağlantıda (HTTPS) çalışır. Bu sunucu tools/vr-sertifika içindeki
# kendinden imzalı sertifikayı kullanır; Quest tarayıcısı ilk açılışta uyarı verir:
# "Gelişmiş → Yine de devam et" deyin, sonra "VR'a gir" düğmesi görünür.
# Yalnız yerel ağda (Wi-Fi) çalışır; internete açmaz. Durdurmak için pencerede Ctrl+C.
import http.server
import socket
import ssl
import sys
from pathlib import Path

KOK = Path(__file__).resolve().parent.parent
SERT = Path(__file__).resolve().parent / "vr-sertifika"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8443


class Isleyici(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(KOK), **k)

    def end_headers(self):
        # geliştirme: Quest eski dosyayı önbellekten getirmesin
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass


def yerel_ipler():
    ipler = set()
    try:
        for bilgi in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ipler.add(bilgi[4][0])
    except OSError:
        pass
    return sorted(ip for ip in ipler if not ip.startswith("127."))


if __name__ == "__main__":
    sunucu = http.server.ThreadingHTTPServer(("0.0.0.0", PORT), Isleyici)
    bag = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    bag.load_cert_chain(SERT / "sertifika.pem", SERT / "anahtar.pem")
    sunucu.socket = bag.wrap_socket(sunucu.socket, server_side=True)
    print()
    print("  Sanal Fabrika - VR (HTTPS) sunucusu calisiyor.")
    print("  Quest tarayicisinda su adreslerden birini acin (ayni Wi-Fi):")
    for ip in yerel_ipler():
        print(f"     https://{ip}:{PORT}/")
    print("  Ilk acilista guvenlik uyarisi cikar: Gelismis -> Yine de devam et.")
    print("  Durdurmak icin Ctrl+C.")
    print()
    try:
        sunucu.serve_forever()
    except KeyboardInterrupt:
        pass
