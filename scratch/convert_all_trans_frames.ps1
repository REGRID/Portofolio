Add-Type -AssemblyName System.Drawing
$outDir = "d:\WEBSITE BUILDING\Portofolio\extracted_frames\pngs"
for ($i = 68; $i -le 105; $i++) {
    $pad = "{0:D3}" -f $i
    $inPath = "d:\WEBSITE BUILDING\Portofolio\extracted_frames\ffout$pad.gif"
    $outPath = "$outDir\frame_$pad.png"
    if (Test-Path $inPath) {
        $img = [System.Drawing.Image]::FromFile($inPath)
        $img.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
        $img.Dispose()
    }
}
Write-Host "Converted frames 68 to 105 successfully."
