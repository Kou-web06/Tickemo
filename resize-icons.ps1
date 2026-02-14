# iOS アイコンリサイズスクリプト
# PowerShell 5.1以降で実行

Add-Type -AssemblyName System.Drawing

function Resize-Image {
    param(
        [string]$InputPath,
        [string]$OutputPath,
        [int]$Width,
        [int]$Height
    )
    
    $image = [System.Drawing.Image]::FromFile($InputPath)
    $bitmap = New-Object System.Drawing.Bitmap($Width, $Height)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    
    # 高品質な補間設定
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    
    $graphics.DrawImage($image, 0, 0, $Width, $Height)
    
    # 出力ディレクトリが存在しない場合は作成
    $outputDir = Split-Path $OutputPath
    if (-not (Test-Path $outputDir)) {
        New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
    }
    
    $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    
    $graphics.Dispose()
    $bitmap.Dispose()
    $image.Dispose()
    
    Write-Host "Created: $OutputPath" -ForegroundColor Green
}

# リサイズする画像とサイズの定義
$sizes = @(
    @{ Name = "20@2x"; Size = 40 },
    @{ Name = "20@3x"; Size = 60 },
    @{ Name = "29@2x"; Size = 58 },
    @{ Name = "29@3x"; Size = 87 },
    @{ Name = "40@2x"; Size = 80 },
    @{ Name = "40@3x"; Size = 120 },
    @{ Name = "60@2x"; Size = 120 },
    @{ Name = "60@3x"; Size = 180 }
)

$icons = @("icon2", "icon3", "icon4")

Write-Host "`nStarting iOS icon resize..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

foreach ($icon in $icons) {
    Write-Host "`nProcessing: $icon" -ForegroundColor Yellow
    
    $sourcePath = "assets\app-icon\$icon.png"
    
    if (-not (Test-Path $sourcePath)) {
        Write-Host "Warning: $sourcePath not found" -ForegroundColor Red
        continue
    }
    
    foreach ($size in $sizes) {
        $outputPath = "ios-assets\Tickemo\Images.xcassets\$icon.appiconset\$icon-$($size.Name).png"
        Resize-Image -InputPath $sourcePath -OutputPath $outputPath -Width $size.Size -Height $size.Size
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Complete! All icons have been resized." -ForegroundColor Green
$totalFiles = $icons.Count * $sizes.Count
Write-Host "`nGenerated $totalFiles files in total." -ForegroundColor Cyan
