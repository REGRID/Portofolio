Add-Type -AssemblyName System.Drawing
$outDir = "d:\WEBSITE BUILDING\Portofolio\extracted_frames\pngs"
for ($i = 70; $i -le 94; $i += 2) {
    $pad = "{0:D3}" -f $i
    $inPath = "d:\WEBSITE BUILDING\Portofolio\extracted_frames\ffout$pad.gif"
    $outPath = "$outDir\frame_$pad.png"
    if (Test-Path $inPath) {
        $img = [System.Drawing.Image]::FromFile($inPath)
        $img.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
        $img.Dispose()
    }
}
Write-Host "Converted frames 70 to 94 successfully."
