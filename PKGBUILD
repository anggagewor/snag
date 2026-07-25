# Maintainer: Angga <anggagewor@gmail.com>
pkgname=snag
pkgver=0.1.0
pkgrel=1
pkgdesc="Fast and lightweight API client desktop app built with Tauri"
arch=('x86_64')
url="https://github.com/angga/snag"
license=('MIT')
depends=('webkit2gtk-4.1' 'gtk3' 'openssl')
makedepends=('rust' 'cargo' 'nodejs' 'npm' 'pkg-config')
source=()

build() {
  cd "$startdir"
  npm ci
  npm run tauri build
}

package() {
  cd "$startdir"

  # Binary
  install -Dm755 "src-tauri/target/release/snag" "$pkgdir/usr/bin/snag"

  # Desktop entry
  install -Dm644 "pkg/snag.desktop" "$pkgdir/usr/share/applications/snag.desktop"

  # Icon
  install -Dm644 "src-tauri/icons/128x128.png" "$pkgdir/usr/share/icons/hicolor/128x128/apps/snag.png"
  install -Dm644 "src-tauri/icons/32x32.png" "$pkgdir/usr/share/icons/hicolor/32x32/apps/snag.png"

  # License
  install -Dm644 "LICENSE" "$pkgdir/usr/share/licenses/$pkgname/LICENSE"
}
