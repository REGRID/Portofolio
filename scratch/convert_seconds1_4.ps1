Add-Type -AssemblyName System.Drawing
$outDir = "d:\WEBSITE BUILDING\Portofolio\extracted_frames\pngs"
if (!(Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }
$indices = @(30, 45, 60, 70, 74, 76, 78, 80, 82, 85, 88, 92, 96, 100, 110, 120)
foreach ($idx in $indices) {
    $pad = "{0:D3}" -f $idx
    $inPath = "d:\WEBSITE BUILDING\Portofolio\extracted_frames\ffout$pad.gif"
    $outPath = "$outDir\frame_$pad.png"
    if (Test-Path $inPath) {
        $img = [System.Drawing.Image]::FromFile($inPath)
        $img.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
        $img.Dispose()
    }
}
Write-Host "Converted frames successfully."
