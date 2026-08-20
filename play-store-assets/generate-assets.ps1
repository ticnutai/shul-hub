Add-Type -AssemblyName System.Drawing

$assetsRoot = $PSScriptRoot
$sourceIcon = Join-Path (Split-Path $assetsRoot -Parent) "public\app-icon-1024.png"
$iconOut = Join-Path $assetsRoot "app-icon-512.png"
$featureOut = Join-Path $assetsRoot "feature-graphic-1024x500.png"

$source = [System.Drawing.Image]::FromFile($sourceIcon)
try {
    $icon = New-Object System.Drawing.Bitmap 512, 512
    $graphics = [System.Drawing.Graphics]::FromImage($icon)
    try {
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.DrawImage($source, 0, 0, 512, 512)
        $icon.Save($iconOut, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
        $graphics.Dispose()
        $icon.Dispose()
    }

    $feature = New-Object System.Drawing.Bitmap 1024, 500
    $canvas = [System.Drawing.Graphics]::FromImage($feature)
    try {
        $canvas.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $canvas.Clear([System.Drawing.ColorTranslator]::FromHtml("#162B55"))

        $gold = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml("#D7AF37")), 5
        $canvas.DrawLine($gold, 54, 72, 970, 72)
        $canvas.DrawLine($gold, 54, 428, 970, 428)

        $iconRect = New-Object System.Drawing.Rectangle 665, 105, 285, 285
        $canvas.DrawImage($source, $iconRect)

        $titleFont = New-Object System.Drawing.Font "Arial", 54, ([System.Drawing.FontStyle]::Bold)
        $bodyFont = New-Object System.Drawing.Font "Arial", 29, ([System.Drawing.FontStyle]::Regular)
        $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
        $soft = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml("#F7E7B2"))
        $format = New-Object System.Drawing.StringFormat
        $format.Alignment = [System.Drawing.StringAlignment]::Center
        $format.LineAlignment = [System.Drawing.StringAlignment]::Center
        $format.FormatFlags = [System.Drawing.StringFormatFlags]::DirectionRightToLeft

        $canvas.DrawString("בית כנסת בסר 3", $titleFont, $white, (New-Object System.Drawing.RectangleF 60, 125, 575, 95), $format)
        $canvas.DrawString("זמני תפילות • שיעורים • מודעות • חברותות", $bodyFont, $soft, (New-Object System.Drawing.RectangleF 65, 230, 565, 110), $format)

        $feature.Save($featureOut, [System.Drawing.Imaging.ImageFormat]::Png)
        $gold.Dispose()
        $titleFont.Dispose()
        $bodyFont.Dispose()
        $white.Dispose()
        $soft.Dispose()
        $format.Dispose()
    }
    finally {
        $canvas.Dispose()
        $feature.Dispose()
    }
}
finally {
    $source.Dispose()
}

Write-Output $iconOut
Write-Output $featureOut

$mobileScreens = @("home", "shiurim", "announcements", "chavrutot")
foreach ($screenName in $mobileScreens) {
    $rawPath = Join-Path $assetsRoot "$screenName-mobile-raw.png"
    if (-not (Test-Path -LiteralPath $rawPath)) { continue }

    $raw = [System.Drawing.Image]::FromFile($rawPath)
    try {
        $scaled = New-Object System.Drawing.Bitmap ($raw.Width * 3), ($raw.Height * 3)
        $scaledGraphics = [System.Drawing.Graphics]::FromImage($scaled)
        try {
            $scaledGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $scaledGraphics.DrawImage($raw, 0, 0, $scaled.Width, $scaled.Height)
            $scaled.Save((Join-Path $assetsRoot "$screenName-phone.png"), [System.Drawing.Imaging.ImageFormat]::Png)
        }
        finally {
            $scaledGraphics.Dispose()
            $scaled.Dispose()
        }
    }
    finally {
        $raw.Dispose()
    }
}
