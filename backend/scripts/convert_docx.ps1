param(
  [Parameter(Mandatory=$true)][string]$DocxPath,
  [Parameter(Mandatory=$true)][string]$PdfPath
)

$ErrorActionPreference = 'Stop'

$resolvedDocx = [System.IO.Path]::GetFullPath($DocxPath)
$resolvedPdf = [System.IO.Path]::GetFullPath($PdfPath)

if (!(Test-Path $resolvedDocx)) {
  Write-Error "Source file not found: $resolvedDocx"
  exit 1
}

$targetDir = [System.IO.Path]::GetDirectoryName($resolvedPdf)
if (!(Test-Path $targetDir)) {
  New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
}

$word = $null
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0

  $doc = $word.Documents.Open($resolvedDocx, $false, $true)
  # 17 = wdExportFormatPDF
  $doc.ExportAsFixedFormat($resolvedPdf, 17)
  $doc.Close($false)
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc) | Out-Null
  Write-Output "SUCCESS"
}
catch {
  Write-Error $_.Exception.Message
  exit 1
}
finally {
  if ($word -ne $null) {
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
  }
}

