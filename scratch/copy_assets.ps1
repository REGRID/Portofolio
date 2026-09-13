Add-Type -AssemblyName System.Drawing
$outDir = "d:\WEBSITE BUILDING\Portofolio\public\reference_assets"
if (!(Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }
Copy-Item "d:\WEBSITE BUILDING\Portofolio\extracted_frames\pngs\frame_001.png" "$outDir\scene1_hero.png"
Copy-Item "d:\WEBSITE BUILDING\Portofolio\extracted_frames\pngs\frame_120.png" "$outDir\scene2_cards.png"
Copy-Item "d:\WEBSITE BUILDING\Portofolio\extracted_frames\pngs\frame_150.png" "$outDir\scene2_card_hover.png"
Copy-Item "d:\WEBSITE BUILDING\Portofolio\extracted_frames\pngs\frame_300.png" "$outDir\scene3_detail.png"
Write-Host "Copied reference assets successfully."
