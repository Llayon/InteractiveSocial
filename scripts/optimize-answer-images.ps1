# Converts question-answer artwork (references/q*-*.png) into optimized
# landscape JPEGs under public/answers/, keyed by assetKey (q1-a … q2-d):
#   public/answers/q1-a.jpg  …  public/answers/q2-d.jpg
#
# Source art is 1672x941; we downscale to 1200x675 (same 16:9, retina-ready
# for ~120px-tall cards) and tune JPEG quality so each stays ~150 KB.
#
# Usage: powershell -ExecutionPolicy Bypass -File scripts/optimize-answer-images.ps1

Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$refs = Join-Path $root 'assets-source'
$out  = Join-Path $root 'public\answers'

# source file -> public key (width x height target)
$mapping = [ordered]@{
  'q1-a.png' = @{ key = 'q1-a'; w = 1200; h = 675 }
  'q1-b.png' = @{ key = 'q1-b'; w = 1200; h = 675 }
  'q1-c.png' = @{ key = 'q1-c'; w = 1200; h = 675 }
  'q1-d.png' = @{ key = 'q1-d'; w = 1200; h = 675 }
  'q2-a.png' = @{ key = 'q2-a'; w = 1200; h = 675 }
  'q2-b.png' = @{ key = 'q2-b'; w = 1200; h = 675 }
  'q2-c.png' = @{ key = 'q2-c'; w = 1200; h = 675 }
  'q2-d.png' = @{ key = 'q2-d'; w = 1200; h = 675 }
}

if (-not (Test-Path $out)) { New-Item -ItemType Directory -Path $out | Out-Null }

$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
  Where-Object { $_.MimeType -eq 'image/jpeg' }

foreach ($entry in $mapping.GetEnumerator()) {
  $spec = $entry.Value
  $src = Join-Path $refs $entry.Key
  $dest = Join-Path $out "$($spec.key).jpg"
  if (-not (Test-Path $src)) { Write-Warning "missing $($entry.Key)"; continue }

  $img = [System.Drawing.Image]::FromFile($src)
  try {
    # center-crop to exact 16:9 then scale to target
    $scale = [Math]::Max($spec.w / $img.Width, $spec.h / $img.Height)
    $cw = [int][Math]::Round($img.Width * $scale)
    $ch = [int][Math]::Round($img.Height * $scale)
    $cx = [int](($spec.w - $cw) / 2)
    $cy = [int](($spec.h - $ch) / 2)

    $bmp = New-Object System.Drawing.Bitmap($spec.w, $spec.h)
    try {
      $g = [System.Drawing.Graphics]::FromImage($bmp)
      try {
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.Clear([System.Drawing.Color]::White)
        $g.DrawImage($img, $cx, $cy, $cw, $ch)
      } finally { $g.Dispose() }

      $enc = New-Object System.Drawing.Imaging.EncoderParameters(1)
      $enc.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
        [System.Drawing.Imaging.Encoder]::Quality, [long]80)
      try { $bmp.Save($dest, $jpegCodec, $enc) } finally { $enc.Dispose() }
    } finally { $bmp.Dispose() }
  } finally { $img.Dispose() }

  $kb = [math]::Round((Get-Item $dest).Length / 1KB)
  Write-Host ("  {0} <- {1} ({2} KB)" -f (Split-Path -Leaf $dest), $entry.Key, $kb)
}

Write-Host 'done.'