Add-Type -AssemblyName System.Drawing

$srcImg = [System.Drawing.Image]::FromFile("d:\WEBSITE BUILDING\Portofolio\extracted_frames\pngs\frame_150.png")
$outDir = "d:\WEBSITE BUILDING\Portofolio\public\reference_assets"

# 1. Crop Card 03 Fluid Artwork (inside frame_150: x=412, y=177, w=172, h=218 approx in 800x600)
$rectFluid = New-Object System.Drawing.Rectangle(412, 178, 172, 218)
$bmpFluid = New-Object System.Drawing.Bitmap($rectFluid.Width, $rectFluid.Height)
$g1 = [System.Drawing.Graphics]::FromImage($bmpFluid)
$g1.DrawImage($srcImg, 0, 0, $rectFluid, [System.Drawing.GraphicsUnit]::Pixel)
$bmpFluid.Save("$outDir\card_linea_fluid.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g1.Dispose()
$bmpFluid.Dispose()
$srcImg.Dispose()

# 2. Crop Scene 3 3D Spheres from frame_300 (x=100, y=120, w=286, h=376)
$src300 = [System.Drawing.Image]::FromFile("d:\WEBSITE BUILDING\Portofolio\extracted_frames\pngs\frame_300.png")
$rectSpheres = New-Object System.Drawing.Rectangle(100, 120, 288, 376)
$bmpSpheres = New-Object System.Drawing.Bitmap($rectSpheres.Width, $rectSpheres.Height)
$g2 = [System.Drawing.Graphics]::FromImage($bmpSpheres)
$g2.DrawImage($src300, 0, 0, $rectSpheres, [System.Drawing.GraphicsUnit]::Pixel)
$bmpSpheres.Save("$outDir\scene3_spheres.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g2.Dispose()
$bmpSpheres.Dispose()
$src300.Dispose()

Write-Host "Cropped card_linea_fluid.png and scene3_spheres.png successfully."
