# Deterministic exact-score card generator — QUIZ-SCOPED.
# Produces quiz-scoped assets to prevent denominator collision:
#   m90_score_00..m90_score_18  →  N / 18  (music90s, 18Q)
#   g90_score_00..g90_score_20  →  N / 20  (guess90s, 20Q)
# Source masters in assets-source/score-cards/ -> production assets:
#   scripts/optimize-share-cards.ps1  -> public/share-cards/m90_score_XX.jpg + g90_score_XX.jpg
# Visual direction: premium editorial nostalgia (cream / wine / silver / cassette).

Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root 'assets-source\score-cards'

$W = 1080
$H = 1350
$bg     = [System.Drawing.Color]::FromArgb(247, 242, 233)
$ink    = [System.Drawing.Color]::FromArgb(43, 36, 30)
$wine   = [System.Drawing.Color]::FromArgb(122, 43, 51)
$silver = [System.Drawing.Color]::FromArgb(178, 171, 158)
$muted  = [System.Drawing.Color]::FromArgb(139, 129, 117)
$inkSoft= [System.Drawing.Color]::FromArgb(253, 249, 244)
$EN_DASH = [char]0x2013
$IZ18 = [char]0x438 + [char]0x437 + ' 18'
$IZ20 = [char]0x438 + [char]0x437 + ' 20'

function Cyr([int[]]$codes) {
  $sb = New-Object System.Text.StringBuilder
  foreach ($c in $codes) { [void]$sb.Append([char]$c) }
  return $sb.ToString()
}

# Quiz-scoped band titles (codepoints only; no UTF-8 source bytes).
# Music90s (m90) 18Q
$T_M90_SLUC   = Cyr @(0x421, 0x43b, 0x443, 0x447, 0x430, 0x439, 0x43d, 0x43e) + ' ' + Cyr @(0x437, 0x430, 0x433, 0x43b, 0x44f, 0x43d, 0x443, 0x43b, 0x430) + ' ' + Cyr @(0x432) + ' ' + '9' + '0' + '-' + Cyr @(0x435)
$T_M90_GDE    = Cyr @(0x413, 0x434, 0x435) + '-' + Cyr @(0x442, 0x43e) + ' ' + Cyr @(0x44d, 0x442, 0x43e) + ' ' + Cyr @(0x438, 0x433, 0x440, 0x430, 0x43b, 0x43e)
$T_M90_CASSMEM = Cyr @(0x41a, 0x430, 0x441, 0x441, 0x435, 0x442, 0x43d, 0x430, 0x44f) + ' ' + Cyr @(0x43f, 0x430, 0x43c, 0x44f, 0x442, 0x44c)
$T_M90_DISCO2  = Cyr @(0x417, 0x432, 0x435, 0x437, 0x434, 0x430) + ' ' + Cyr @(0x448, 0x43a, 0x43e, 0x43b, 0x44c, 0x43d, 0x43e, 0x439) + ' ' + Cyr @(0x434, 0x438, 0x441, 0x43a, 0x43e, 0x442, 0x435, 0x43a, 0x438)
$T_M90_GLAVRED = Cyr @(0x413, 0x43b, 0x430, 0x432, 0x440, 0x435, 0x434) + ' ' + Cyr @(0x436, 0x443, 0x440, 0x43d, 0x430, 0x43b, 0x430) + ' ' + 'C' + 'o' + 'o' + 'l'
$T_M90_TYEST  = Cyr @(0x422, 0x44b) + ' ' + Cyr @(0x438) + ' ' + Cyr @(0x435, 0x441, 0x442, 0x44c) + ' ' + '9' + '0' + '-' + Cyr @(0x435)
# Guess90s (g90) 20Q
$T_G90_ROOKIE = Cyr @(0x422, 0x44b) + ' ' + Cyr @(0x441, 0x43b, 0x443, 0x447, 0x430, 0x439, 0x43d, 0x43e) + ' ' + Cyr @(0x437, 0x430, 0x448, 0x43b, 0x430) + ' ' + Cyr @(0x432) + ' ' + '9' + '0' + '-' + Cyr @(0x435)
$T_G90_FAM    = Cyr @(0x413, 0x434, 0x435) + '-' + Cyr @(0x442, 0x43e) + ' ' + Cyr @(0x44d, 0x442, 0x43e) + ' ' + Cyr @(0x441, 0x43b, 0x44b, 0x448, 0x430, 0x43b, 0x430)
$T_G90_CASS   = Cyr @(0x41A, 0x430, 0x441, 0x441, 0x435, 0x442, 0x43D, 0x44B, 0x439) + ' ' + Cyr @(0x447, 0x435, 0x43B, 0x43E, 0x432, 0x435, 0x43A)
$T_G90_DISCO  = Cyr @(0x414, 0x438, 0x441, 0x43a, 0x43e, 0x442, 0x435, 0x43a, 0x430) + ' ' + '1' + '9' + '9' + '9'
$T_G90_LEGEND = Cyr @(0x41b, 0x435, 0x433, 0x435, 0x43d, 0x434, 0x430) + ' ' + Cyr @(0x43a, 0x430, 0x441, 0x441, 0x435, 0x442, 0x43d, 0x43e, 0x433, 0x43e) + ' ' + Cyr @(0x432, 0x435, 0x43a, 0x430)
$T_THROW   = Cyr @(0x411, 0x440, 0x43E, 0x441, 0x438, 0x442, 0x44C) + ' ' + Cyr @(0x432, 0x44B, 0x437, 0x43E, 0x432)

$m90Bands = @(
  @{ max = 4;  title = $T_M90_SLUC;     sub = '0' + $EN_DASH + '4 ' + $IZ18 },
  @{ max = 7;  title = $T_M90_GDE;      sub = '5' + $EN_DASH + '7 ' + $IZ18 },
  @{ max = 10; title = $T_M90_CASSMEM;  sub = '8' + $EN_DASH + '10 ' + $IZ18 },
  @{ max = 13; title = $T_M90_DISCO2;   sub = '11' + $EN_DASH + '13 ' + $IZ18 },
  @{ max = 16; title = $T_M90_GLAVRED;  sub = '14' + $EN_DASH + '16 ' + $IZ18 },
  @{ max = 17; title = $T_M90_TYEST;    sub = '17 ' + $IZ18 },
  @{ max = 18; title = $T_M90_TYEST;    sub = '18 ' + $IZ18 }
)

$g90Bands = @(
  @{ max = 5;  title = $T_G90_ROOKIE; sub = '0' + $EN_DASH + '5 ' + $IZ20 },
  @{ max = 10; title = $T_G90_FAM;    sub = '6' + $EN_DASH + '10 ' + $IZ20 },
  @{ max = 14; title = $T_G90_CASS;   sub = '11' + $EN_DASH + '14 ' + $IZ20 },
  @{ max = 18; title = $T_G90_DISCO;  sub = '15' + $EN_DASH + '18 ' + $IZ20 },
  @{ max = 20; title = $T_G90_LEGEND; sub = '19' + $EN_DASH + '20 ' + $IZ20 }
)

function Band-For([int]$score, $bands) {
  foreach ($b in $bands) { if ($score -le $b.max) { return $b } }
  return $bands[-1]
}

function Draw-Cassette {
  param($g, [int]$cx, [int]$cy, [int]$w, [int]$h)
  $pen = New-Object System.Drawing.Pen($silver, 4)
  $body = New-Object System.Drawing.Rectangle(($cx - [int]($w/2)), ($cy - [int]($h/2)), $w, $h)
  $g.DrawRectangle($pen, $body)
  $label = New-Object System.Drawing.Rectangle(($cx - [int]($w*0.32)), ($cy - [int]($h*0.30)), [int]($w*0.64), [int]($h*0.34))
  $g.DrawRectangle($pen, $label)
  $r = [int]($h * 0.20)
  foreach ($dx in @(-[int]($w*0.16), [int]($w*0.16))) {
    $reel = New-Object System.Drawing.Rectangle(($cx + $dx - $r), ($cy - $r + [int]($h*0.04)), (2*$r), (2*$r))
    $g.DrawEllipse($pen, $reel)
  }
  $pen.Dispose()
}

function New-ScoreCard {
  param([int]$score, $band, [string]$totalStr)
  $bmp = New-Object System.Drawing.Bitmap($W, $H)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $g.Clear($bg)
  $center = New-Object System.Drawing.StringFormat
  $center.Alignment = [System.Drawing.StringAlignment]::Center
  $center.LineAlignment = [System.Drawing.StringAlignment]::Center
  $overline = Cyr @(0x422, 0x44B) + '   ' + Cyr @(0x422, 0x43E, 0x447, 0x43D, 0x43E) + '   ' + Cyr @(0x41F, 0x43E, 0x43C, 0x43D, 0x438, 0x448, 0x44C) + '   ' + Cyr @(0x41C, 0x443, 0x437, 0x44B, 0x43A, 0x443) + '   90-' + [char]0x445 + ' ?'
  $fOver = New-Object System.Drawing.Font('Segoe UI', 26, [System.Drawing.FontStyle]::Regular)
  $overRect = New-Object System.Drawing.RectangleF(60, 96, ($W - 120), 50)
  $g.DrawString($overline, $fOver, (New-Object System.Drawing.SolidBrush($muted)), $overRect, $center)
  Draw-Cassette $g ([int]($W/2)) 470 620 300
  $fScore = New-Object System.Drawing.Font('Georgia', 190, [System.Drawing.FontStyle]::Bold)
  $scoreRect = New-Object System.Drawing.RectangleF(40, 380, ($W - 80), 320)
  $g.DrawString(('{0} / {1}' -f $score, $totalStr), $fScore, (New-Object System.Drawing.SolidBrush($wine)), $scoreRect, $center)
  $fTitle = New-Object System.Drawing.Font('Georgia', 66, [System.Drawing.FontStyle]::Regular)
  $titleRect = New-Object System.Drawing.RectangleF(70, 760, ($W - 140), 200)
  $g.DrawString($band.title, $fTitle, (New-Object System.Drawing.SolidBrush($ink)), $titleRect, $center)
  $fSub = New-Object System.Drawing.Font('Segoe UI', 38, [System.Drawing.FontStyle]::Regular)
  $subRect = New-Object System.Drawing.RectangleF(70, 950, ($W - 140), 70)
  $g.DrawString($band.sub, $fSub, (New-Object System.Drawing.SolidBrush($muted)), $subRect, $center)
  $fCta = New-Object System.Drawing.Font('Segoe UI', 40, [System.Drawing.FontStyle]::Bold)
  $pillW = 470; $pillH = 104
  $pill = New-Object System.Drawing.Rectangle(([int](($W - $pillW)/2)), 1090, $pillW, $pillH)
  $brushWine = New-Object System.Drawing.SolidBrush($wine)
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddArc($pill.X, $pill.Y, $pillH, $pillH, 180, 180)
  $path.AddArc(($pill.X + $pillW - $pillH), $pill.Y, $pillH, $pillH, 270, 180)
  $path.AddArc(($pill.X + $pillW - $pillH), ($pill.Y + $pillH - $pillH), $pillH, $pillH, 0, 180)
  $path.AddArc($pill.X, ($pill.Y + $pillH - $pillH), $pillH, $pillH, 90, 180)
  $path.CloseFigure()
  $g.FillPath($brushWine, $path)
  $ctaRect = New-Object System.Drawing.RectangleF($pill.X, $pill.Y, $pillW, $pillH)
  $g.DrawString($T_THROW, $fCta, (New-Object System.Drawing.SolidBrush($inkSoft)), $ctaRect, $center)
  $g.Dispose()
  return $bmp
}

New-Item -ItemType Directory -Force -Path $outDir | Out-Null
# Music90s: m90_score_00..m90_score_18
for ($s = 0; $s -le 18; $s++) {
  $band = Band-For $s $m90Bands
  $name = 'm90_score_{0:d2}' -f $s
  $path = Join-Path $outDir ($name + '.png')
  $bmp = New-ScoreCard $s $band '18'
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host ('  {0}.png  ({1} KB)' -f $name, [math]::Round((Get-Item $path).Length / 1KB))
}
# Guess90s: g90_score_00..g90_score_20
for ($s = 0; $s -le 20; $s++) {
  $band = Band-For $s $g90Bands
  $name = 'g90_score_{0:d2}' -f $s
  $path = Join-Path $outDir ($name + '.png')
  $bmp = New-ScoreCard $s $band '20'
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host ('  {0}.png  ({1} KB)' -f $name, [math]::Round((Get-Item $path).Length / 1KB))
}
# Legacy generic score_00..score_20 kept for backwards compat of old share links (copies of m90 for 0..18, g90 for 19..20)
# Generate them as well to avoid 404 for old URLs — they are not used for new shares.
for ($s = 0; $s -le 18; $s++) {
  $src = Join-Path $outDir ('m90_score_{0:d2}.png' -f $s)
  $dst = Join-Path $outDir ('score_{0:d2}.png' -f $s)
  Copy-Item -LiteralPath $src -Destination $dst -Force
}
for ($s = 19; $s -le 20; $s++) {
  $src = Join-Path $outDir ('g90_score_{0:d2}.png' -f $s)
  $dst = Join-Path $outDir ('score_{0:d2}.png' -f $s)
  Copy-Item -LiteralPath $src -Destination $dst -Force
}
Write-Host 'done.'
