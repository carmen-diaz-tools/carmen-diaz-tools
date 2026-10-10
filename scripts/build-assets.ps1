# Genera, a partir del logo original de la tienda:
#  - tools/etiquetas/logo.js  -> logo "Lencería Carmen Díaz" en blanco y negro puro para la etiqueta
#  - assets/icons/*.png       -> iconos de la app (pantalla de inicio)
#
# Uso (Windows PowerShell):
#   powershell -ExecutionPolicy Bypass -File scripts/build-assets.ps1 -Logo "C:\ruta\Logo Tienda.png"
#
# El logo original no se sube al repo; solo lo que genera este script.

param(
  [Parameter(Mandatory = $true)][string]$Logo,
  [int]$LabelLogoHeight = 62
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$src = [System.Drawing.Bitmap]::FromFile((Resolve-Path $Logo))

function Lum($c) { 0.299 * $c.R + 0.587 * $c.G + 0.114 * $c.B }

function Save-Png($bmp, $path) {
  New-Item -ItemType Directory -Force (Split-Path -Parent $path) | Out-Null
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
}

function Resize($bmp, $w, $h) {
  $out = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($out)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::White)
  $g.DrawImage($bmp, 0, 0, $w, $h)
  $g.Dispose()
  $out
}

# ---------- Logo para la etiqueta ----------
# El texto del logo es gris; las líneas y el corazón son dorados. En térmica
# las líneas finas doradas desaparecen, así que solo se conserva el gris.
function Is-Text($c) { (Lum $c) -lt 170 -and [math]::Abs([int]$c.R - [int]$c.B) -lt 30 }

$minX = $src.Width; $minY = $src.Height; $maxX = 0; $maxY = 0
$half = [int]($src.Width * 0.35)
for ($y = 0; $y -lt $src.Height; $y++) {
  for ($x = $half; $x -lt $src.Width; $x++) {
    if (Is-Text $src.GetPixel($x, $y)) {
      if ($x -lt $minX) { $minX = $x }; if ($x -gt $maxX) { $maxX = $x }
      if ($y -lt $minY) { $minY = $y }; if ($y -gt $maxY) { $maxY = $y }
    }
  }
}
$cw = $maxX - $minX + 1; $ch = $maxY - $minY + 1
$mask = New-Object System.Drawing.Bitmap $cw, $ch
for ($y = 0; $y -lt $ch; $y++) {
  for ($x = 0; $x -lt $cw; $x++) {
    $isText = Is-Text $src.GetPixel($x + $minX, $y + $minY)
    $mask.SetPixel($x, $y, $(if ($isText) { [System.Drawing.Color]::Black } else { [System.Drawing.Color]::White }))
  }
}

$lh = $LabelLogoHeight
$lw = [int][math]::Round($cw * $lh / $ch)
$small = Resize $mask $lw $lh
# Umbral generoso para que los trazos finos de la letra no se pierdan.
for ($y = 0; $y -lt $lh; $y++) {
  for ($x = 0; $x -lt $lw; $x++) {
    $v = if ((Lum $small.GetPixel($x, $y)) -lt 215) { [System.Drawing.Color]::Black } else { [System.Drawing.Color]::White }
    $small.SetPixel($x, $y, $v)
  }
}
$tmp = Join-Path $env:TEMP 'cd-logo-label.png'
Save-Png $small $tmp
$b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($tmp))
$js = @"
// Generado por scripts/build-assets.ps1. No editar a mano.
// Logo en blanco y negro puro, al tamaño exacto de la etiqueta (300 dpi).
export const LOGO_WIDTH = $lw;
export const LOGO_HEIGHT = $lh;
export const LOGO_SRC = 'data:image/png;base64,$b64';
"@
[IO.File]::WriteAllText((Join-Path $root 'tools/etiquetas/logo.js'), $js.Replace("`r`n", "`n"), (New-Object System.Text.UTF8Encoding $false))
Write-Host "logo.js: ${lw}x${lh}px"

# ---------- Iconos ----------
# Ilustración (percha + conjunto) del lado izquierdo, sobre el fondo de la marca.
$cx = [int]($src.Width * 0.24); $cy = [int]($src.Height * 0.5); $side = [int]($src.Height * 0.58)
$left = $cx - [int]($side / 2)
$crop = New-Object System.Drawing.Bitmap $side, $side
$g = [System.Drawing.Graphics]::FromImage($crop)
$g.DrawImage($src, (New-Object System.Drawing.Rectangle 0, 0, $side, $side), (New-Object System.Drawing.Rectangle $left, ($cy - $side / 2), $side, $side), [System.Drawing.GraphicsUnit]::Pixel)
# Tapa el texto que empieza a la derecha de la ilustración (la "C" de Carmen).
$textStart = $minX - 8 - $left
if ($textStart -lt $side) { $g.FillRectangle([System.Drawing.Brushes]::White, $textStart, 0, $side - $textStart, $side) }
$g.Dispose()

$bg = [System.Drawing.ColorTranslator]::FromHtml('#F5F0E8')
function Icon($size, $padRatio, $path) {
  $out = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($out)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.Clear($bg)
  $inner = [int]($size * (1 - 2 * $padRatio)); $off = [int](($size - $inner) / 2)
  # El blanco del logo se sustituye por el fondo de la marca.
  $attr = New-Object System.Drawing.Imaging.ImageAttributes
  $attr.SetColorKey([System.Drawing.Color]::FromArgb(235, 235, 235), [System.Drawing.Color]::White)
  $g.DrawImage($crop, (New-Object System.Drawing.Rectangle $off, $off, $inner, $inner), 0, 0, $crop.Width, $crop.Height, [System.Drawing.GraphicsUnit]::Pixel, $attr)
  $g.Dispose()
  Save-Png $out $path
  $out.Dispose()
}
Icon 192 0.06 (Join-Path $root 'assets/icons/icon-192.png')
Icon 512 0.06 (Join-Path $root 'assets/icons/icon-512.png')
Icon 512 0.16 (Join-Path $root 'assets/icons/icon-maskable-512.png')
Icon 180 0.08 (Join-Path $root 'assets/icons/apple-touch-icon.png')
Write-Host 'Iconos generados en assets/icons'

$src.Dispose()
