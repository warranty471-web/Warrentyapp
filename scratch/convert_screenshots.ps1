Add-Type -AssemblyName System.Drawing

$srcMobile = "C:\Users\prath\.gemini\antigravity\brain\d15c9fbc-d4ed-498b-ab1d-2e4373ce0984\screenshot_mobile_1783618427856.jpg"
$srcDesktop = "C:\Users\prath\.gemini\antigravity\brain\d15c9fbc-d4ed-498b-ab1d-2e4373ce0984\screenshot_desktop_1783618442310.jpg"

$destMobile = "c:\Users\prath\Downloads\Warrenty\public\screenshot-mobile.png"
$destDesktop = "c:\Users\prath\Downloads\Warrenty\public\screenshot-desktop.png"

# Convert Mobile Image (resize to 1080x1920)
if (Test-Path $srcMobile) {
    Write-Host "Converting mobile screenshot..."
    $img = [System.Drawing.Image]::FromFile($srcMobile)
    $bmp = New-Object System.Drawing.Bitmap(1080, 1920)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($img, 0, 0, 1080, 1920)
    $bmp.Save($destMobile, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    $img.Dispose()
}

# Convert Desktop Image (resize to 1920x1080)
if (Test-Path $srcDesktop) {
    Write-Host "Converting desktop screenshot..."
    $img = [System.Drawing.Image]::FromFile($srcDesktop)
    $bmp = New-Object System.Drawing.Bitmap(1920, 1080)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($img, 0, 0, 1920, 1080)
    $bmp.Save($destDesktop, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    $img.Dispose()
}

Write-Host "Screenshots converted successfully!"
