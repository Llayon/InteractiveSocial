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
$refs = Join-Path $root 'references'
$out  = Join-Path $root 'public\share-cards'

# reference file -> result id (must match src/content/quizzes results[].id)
$mapping = [ordered]@{
  'QuietLuxyru.png'    = 'quiet'
  'Parisian.png'       = 'paris'
  'ItalianDiva.png'    = 'italian'
  'THE COLLECTOR.png'  = 'collector'
  'COTTAGE SOUL.png'   = 'cottage'
  'SCANDI CALM.png'    = 'scandi'
}

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

Write-Host 'done.'
