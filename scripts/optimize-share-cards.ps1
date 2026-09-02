# Converts hand-drawn archetype artwork from references/ into production
# share-card assets under public/share-cards/:
#   result_<id>.jpg        1080x1350 (Telegram InlineQueryResultPhoto / app hero)
#   result_<id>_thumb.jpg   256x320  (Telegram required thumbnail_url)
#
# Crop-to-fill centering preserves composition; JPEG quality tuned so each
# full card stays well under ~150 KB (Telegram downloads these server-side).
#
# Usage:  pwsh -File scripts/optimize-share-cards.ps1
#         powershell -ExecutionPolicy Bypass -File scripts/optimize-share-cards.ps1

Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$refs = Join-Path $root 'assets-source'
$out  = Join-Path $root 'public\share-cards'

# source file -> result id (must match src/content/quizzes results[].id)
$mapping = [ordered]@{
  'quiet-luxury.png'  = 'quiet'
  'parisian.png'      = 'paris'
  'italian-diva.png'  = 'italian'
  'the-collector.png' = 'collector'
  'cottage-soul.png'  = 'cottage'
  'scandi-calm.png'   = 'scandi'
}

# Score-card masters (Music90s) share the SAME 1080x1350 pipeline. They are
# NOT in the quiz result-id registry; they are addressed by deterministic
# score_XX keys produced by scripts/generate-score-cards.ps1.
$scoreSourceDir = Join-Path $refs 'score-cards'

$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
  Where-Object { $_.MimeType -eq 'image/jpeg' }

function Convert-Card {
  param([string]$SourcePath, [string]$DestPath, [int]$TargetW, [int]$TargetH, [int]$Quality)

  $img = [System.Drawing.Image]::FromFile($SourcePath)
  try {
    # Scale up to cover the target rect completely, then center-crop.
    $scale = [Math]::Max($TargetW / $img.Width, $TargetH / $img.Height)
    $w = [int][Math]::Round($img.Width * $scale)
    $h = [int][Math]::Round($img.Height * $scale)
    $x = [int](($TargetW - $w) / 2)
    $y = [int](($TargetH - $h) / 2)

    $bmp = New-Object System.Drawing.Bitmap($TargetW, $TargetH)
    try {
      $g = [System.Drawing.Graphics]::FromImage($bmp)
      try {
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.Clear([System.Drawing.Color]::White)
        $g.DrawImage($img, $x, $y, $w, $h)
      } finally { $g.Dispose() }

      $encParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
      $encParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
        [System.Drawing.Imaging.Encoder]::Quality, [long]$Quality)
      try {
        $bmp.Save($DestPath, $jpegCodec, $encParams)
      } finally { $encParams.Dispose() }
    } finally { $bmp.Dispose() }
  } finally { $img.Dispose() }

  $kb = [math]::Round((Get-Item $DestPath).Length / 1KB)
  Write-Host ("  {0} <- {1} ({2} KB)" -f (Split-Path -Leaf $DestPath), (Split-Path -Leaf $SourcePath), $kb)
}

foreach ($entry in $mapping.GetEnumerator()) {
  $src = Join-Path $refs $entry.Key
  if (-not (Test-Path $src)) {
    Write-Warning "missing reference: $($entry.Key)"
    continue
  }
  Convert-Card -SourcePath $src -DestPath (Join-Path $out "result_$($entry.Value).jpg") `
    -TargetW 1080 -TargetH 1350 -Quality 74
  Convert-Card -SourcePath $src -DestPath (Join-Path $out "result_$($entry.Value)_thumb.jpg") `
    -TargetW 256 -TargetH 320 -Quality 80
}

if (Test-Path $scoreSourceDir) {
  # Quiz-scoped exact-score cards: prevent denominator collision (m90 9/18 vs g90 9/20)
  for ($s = 0; $s -le 18; $s++) {
    $name = 'm90_score_{0:d2}' -f $s
    $src = Join-Path $scoreSourceDir ($name + '.png')
    if (-not (Test-Path $src)) { Write-Warning "missing score master: $name.png"; continue }
    Convert-Card -SourcePath $src -DestPath (Join-Path $out ("$name.jpg")) `
      -TargetW 1080 -TargetH 1350 -Quality 74
    Convert-Card -SourcePath $src -DestPath (Join-Path $out ("${name}_thumb.jpg")) `
      -TargetW 256 -TargetH 320 -Quality 80
  }
  for ($s = 0; $s -le 20; $s++) {
    $name = 'g90_score_{0:d2}' -f $s
    $src = Join-Path $scoreSourceDir ($name + '.png')
    if (-not (Test-Path $src)) { Write-Warning "missing score master: $name.png"; continue }
    Convert-Card -SourcePath $src -DestPath (Join-Path $out ("$name.jpg")) `
      -TargetW 1080 -TargetH 1350 -Quality 74
    Convert-Card -SourcePath $src -DestPath (Join-Path $out ("${name}_thumb.jpg")) `
      -TargetW 256 -TargetH 320 -Quality 80
  }
  # Legacy generic score_XX kept for backwards compat of old share links (will be phased out)
  for ($s = 0; $s -le 20; $s++) {
    $name = 'score_{0:d2}' -f $s
    $src = Join-Path $scoreSourceDir ($name + '.png')
    if (-not (Test-Path $src)) { continue }
    Convert-Card -SourcePath $src -DestPath (Join-Path $out ("$name.jpg")) `
      -TargetW 1080 -TargetH 1350 -Quality 74
    Convert-Card -SourcePath $src -DestPath (Join-Path $out ("${name}_thumb.jpg")) `
      -TargetW 256 -TargetH 320 -Quality 80
  }
}

Write-Host 'done.'
