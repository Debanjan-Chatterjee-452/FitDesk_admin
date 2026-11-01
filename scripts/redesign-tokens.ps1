$root = 'D:\Gym Admin Website\src'
$files = Get-ChildItem $root -Recurse -File -Include *.tsx,*.ts,*.css
# longest-first replacements
$map = @(
  @{o='bg-pine-ink'; n='bg-primary-ink'},
  @{o='bg-pine-soft'; n='bg-primary-soft'},
  @{o='bg-pine-deep'; n='bg-primary-strong'},
  @{o='bg-pine'; n='bg-primary'},
  @{o='text-pine-ink'; n='text-primary-ink'},
  @{o='text-pine'; n='text-primary'},
  @{o='bg-canvas'; n='bg-bg'},
  @{o='bg-paper'; n='bg-surface'},
  @{o='bg-sand'; n='bg-elevated'},
  @{o='text-sand'; n='text-muted'},
  @{o='hover:bg-\[#F6F7F2\]'; n='hover:bg-elevated'},
  @{o='hover:bg-\[#EFF1EA\]'; n='hover:bg-elevated'},
  @{o='hover:bg-\[#EBEEE6\]'; n='hover:bg-elevated'},
  @{o='bg-\[#FAFBF7\]'; n='bg-elevated'},
  @{o='bg-\[#F6F7F2\]'; n='bg-elevated'},
  @{o='hover:bg-\[#DCEAE1\]'; n='hover:bg-primary-soft'},
  @{o='bg-\[#DCEAE1\]'; n='bg-primary-soft'},
  @{o='hover:border-\[#C8D0C4\]'; n='hover:border-line'},
  @{o='border-\[#DCEDBF\]'; n='border-primary/20'},
  @{o='hover:bg-\[#CBD3C7\]'; n='hover:bg-line'},
  @{o='bg-\[#EFF1EA\]'; n='bg-elevated'},
  @{o='bg-\[#EAEDE5\]'; n='bg-elevated'},
  @{o='bg-\[#3A5B50\]'; n='bg-primary-strong'},
  @{o='text-\[#B3BAB2\]'; n='text-faint'},
  @{o='text-\[#A0A9A2\]'; n='text-faint'},
  @{o='shadow-\[0_10px_24px_-14px_rgba\(10,42,34,0\.7\)\]'; n='shadow-[0_10px_24px_-12px_rgb(var(--primary)/0.7)]'}
)
foreach ($f in $files) {
  $c = Get-Content $f.FullName -Raw
  $orig = $c
  foreach ($r in $map) {
    $c = $c -replace $r.o, $r.n
  }
  if ($c -ne $orig) {
    Set-Content -Path $f.FullName -Value $c -NoNewline
  }
}
Write-Output 'done'