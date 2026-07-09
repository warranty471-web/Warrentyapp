Add-Type -AssemblyName System.Drawing

$srcPath = "c:\Users\prath\Downloads\Warrenty\public\logo.jpg"
$dest192Path = "c:\Users\prath\Downloads\Warrenty\public\icon-192.png"
$dest512Path = "c:\Users\prath\Downloads\Warrenty\public\icon-512.png"

if (Test-Path $srcPath) {
    Write-Host "Loading source image from $srcPath"
    $srcImage = [System.Drawing.Image]::FromFile($srcPath)
    
    # 512x512
    Write-Host "Creating 512x512 PNG..."
    $dest512 = New-Object System.Drawing.Bitmap(512, 512)
    $graph512 = [System.Drawing.Graphics]::FromImage($dest512)
    $graph512.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graph512.DrawImage($srcImage, 0, 0, 512, 512)
    $dest512.Save($dest512Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $graph512.Dispose()
    $dest512.Dispose()
    
    # 192x192
    Write-Host "Creating 192x192 PNG..."
    $dest192 = New-Object System.Drawing.Bitmap(192, 192)
    $graph192 = [System.Drawing.Graphics]::FromImage($dest192)
    $graph192.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graph192.DrawImage($srcImage, 0, 0, 192, 192)
    $dest192.Save($dest192Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $graph192.Dispose()
    $dest192.Dispose()
    
    $srcImage.Dispose()
    Write-Host "Conversion completed successfully!"
} else {
    Write-Error "Source logo file not found at $srcPath"
}
