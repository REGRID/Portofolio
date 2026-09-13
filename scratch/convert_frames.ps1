Add-Type -AssemblyName System.Drawing
$outDir = "d:\WEBSITE BUILDING\Portofolio\extracted_frames\pngs"
if (!(Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }
$indices = @(1, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 210, 240, 270, 300)
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
Write-Host "Converted $($indices.Count) frames successfully."
