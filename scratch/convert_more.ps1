Add-Type -AssemblyName System.Drawing
$outDir = "d:\WEBSITE BUILDING\Portofolio\extracted_frames\pngs"
$indices = @(50, 60, 65, 70, 75, 80, 85, 95, 100, 110, 130, 140, 160, 190, 200, 210, 220, 230, 250, 260, 280)
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
Write-Host "Done"
