$players = @(
  @{ name = "ronaldinho"; id = 28115 },
  @{ name = "ronaldo_nazario"; id = 37576 },
  @{ name = "ibrahimovic"; id = 41236 },
  @{ name = "roberto_carlos"; id = 238405 },
  @{ name = "beckham"; id = 258751 },
  @{ name = "rivaldo"; id = 238409 },
  @{ name = "figo"; id = 238401 },
  @{ name = "cruyff"; id = 246824 },
  @{ name = "gullit"; id = 214100 },
  @{ name = "vieira"; id = 238395 },
  @{ name = "keane"; id = 238384 },
  @{ name = "ballack"; id = 238416 },
  @{ name = "vandersar"; id = 51539 },
  @{ name = "schmeichel"; id = 238386 },
  @{ name = "baresi"; id = 238418 },
  @{ name = "nistelrooy"; id = 238392 },
  @{ name = "inzaghi"; id = 238382 },
  @{ name = "delpiero"; id = 238377 },
  @{ name = "totti"; id = 350 },
  @{ name = "deco"; id = 238380 },
  @{ name = "rijkaard"; id = 238391 },
  @{ name = "matthaus"; id = 238390 },
  @{ name = "owen"; id = 238385 },
  @{ name = "rush"; id = 238421 },
  @{ name = "dalglish"; id = 246825 },
  @{ name = "lineker"; id = 238383 },
  @{ name = "shearer"; id = 238387 },
  @{ name = "stoichkov"; id = 238394 },
  @{ name = "hagi"; id = 238397 },
  @{ name = "butragueno"; id = 238419 },
  @{ name = "sanchez_hugo"; id = 252877 },
  @{ name = "yashin"; id = 238396 },
  @{ name = "garrincha"; id = 252879 },
  @{ name = "socrates"; id = 241775 },
  @{ name = "best"; id = 238417 },
  @{ name = "charlton"; id = 272605 },
  @{ name = "muller_gerd"; id = 269389 },
  @{ name = "etoo"; id = 238378 },
  @{ name = "vanpersie"; id = 264350 },
  @{ name = "kluivert"; id = 238393 },
  @{ name = "cantona"; id = 258752 },
  @{ name = "ferdinand"; id = 238399 },
  @{ name = "campbell"; id = 238400 },
  @{ name = "cole_ashley"; id = 258753 },
  @{ name = "zambrotta"; id = 252876 },
  @{ name = "lucio"; id = 271295 },
  @{ name = "vieri"; id = 238398 },
  @{ name = "veron"; id = 238403 },
  @{ name = "nedved"; id = 238402 },
  @{ name = "trezeguet"; id = 238404 },
  @{ name = "zola"; id = 238415 },
  @{ name = "desailly"; id = 238407 },
  @{ name = "blanc"; id = 238406 },
  @{ name = "makelele"; id = 241774 },
  @{ name = "ljungberg"; id = 264356 },
  @{ name = "litmanen"; id = 238414 },
  @{ name = "hyypia"; id = 264359 },
  @{ name = "riise"; id = 271296 },
  @{ name = "kewell"; id = 271298 },
  @{ name = "suker"; id = 238412 },
  @{ name = "ruicosta"; id = 238410 },
  @{ name = "carvalho"; id = 271294 },
  @{ name = "rummenigge"; id = 246826 },
  @{ name = "voller"; id = 271297 },
  @{ name = "papin"; id = 271299 },
  @{ name = "abedipele"; id = 264358 },
  @{ name = "koeman"; id = 246827 },
  @{ name = "laudrup_m"; id = 238413 },
  @{ name = "giuly"; id = 272584 },
  @{ name = "larsson"; id = 238411 },
  @{ name = "marquez"; id = 271302 },
  
  # Modern / active / recent
  @{ name = "haaland"; id = 239085 },
  @{ name = "mbappe"; id = 231747 },
  @{ name = "vinicius"; id = 238794 },
  @{ name = "bellingham"; id = 252371 },
  @{ name = "debruyne"; id = 192985 },
  @{ name = "salah"; id = 209331 },
  @{ name = "kane"; id = 202126 },
  @{ name = "lewandowski"; id = 188545 },
  @{ name = "griezmann"; id = 194765 },
  @{ name = "bernardo_silva"; id = 218667 },
  @{ name = "rodri"; id = 231866 },
  @{ name = "gundogan"; id = 186942 },
  @{ name = "kroos"; id = 182521 },
  @{ name = "courtois"; id = 192119 },
  @{ name = "terstegen"; id = 192448 },
  @{ name = "alisson"; id = 212831 },
  @{ name = "ederson"; id = 210257 },
  @{ name = "vandijk"; id = 203376 },
  @{ name = "rubendias"; id = 234396 },
  @{ name = "marquinhos"; id = 207865 },
  @{ name = "hakimi"; id = 235212 },
  @{ name = "davies"; id = 234390 },
  @{ name = "kimmich"; id = 222492 },
  @{ name = "goretzka"; id = 209658 },
  @{ name = "bruno_fernandes"; id = 212198 },
  @{ name = "odegaard"; id = 222665 },
  @{ name = "saka"; id = 246781 },
  @{ name = "rice"; id = 234011 },
  @{ name = "lautaro"; id = 231478 },
  @{ name = "barella"; id = 224163 },
  @{ name = "calhanoglu"; id = 208418 },
  @{ name = "leao"; id = 241721 },
  @{ name = "theo_hernandez"; id = 232656 },
  @{ name = "dimaria"; id = 183898 },
  @{ name = "dybala"; id = 211110 },
  @{ name = "son"; id = 200104 },
  @{ name = "dejong"; id = 228702 },
  @{ name = "pedri"; id = 251852 },
  @{ name = "araujo"; id = 243014 },
  @{ name = "militao"; id = 240138 },
  @{ name = "walker"; id = 188377 },
  @{ name = "foden"; id = 237698 },
  @{ name = "casemiro"; id = 200145 },
  @{ name = "donnarumma"; id = 230621 },
  @{ name = "dembele"; id = 231443 },
  @{ name = "wirtz"; id = 256630 },
  @{ name = "frimpong"; id = 251570 },
  @{ name = "grimaldo"; id = 205498 },
  @{ name = "xhaka"; id = 202652 },
  @{ name = "carvajal"; id = 204963 },
  @{ name = "rudiger"; id = 205452 },
  @{ name = "oblak"; id = 200389 },
  @{ name = "szczesny"; id = 186153 },
  @{ name = "sommer"; id = 188350 },
  @{ name = "alexis_sanchez"; id = 184941 },
  @{ name = "lukaku"; id = 192505 },
  @{ name = "kante"; id = 215914 },
  @{ name = "thiago_silva"; id = 164240 },
  @{ name = "hazard"; id = 183277 },
  @{ name = "trent"; id = 231281 },
  @{ name = "robertson"; id = 216267 }
)

$working = @()
$failed = @()

foreach ($p in $players) {
  $padded = [string]$p.id
  while ($padded.Length -lt 6) { $padded = "0" + $padded }
  $part1 = $padded.Substring(0, 3)
  $part2 = $padded.Substring(3, 3)
  
  # Try latest years first (25 down to 18)
  $found = $false
  foreach ($ver in 25..18) {
    $url = "https://cdn.sofifa.net/players/$part1/$part2/${ver}_360.png"
    try {
      $req = [System.Net.WebRequest]::Create($url)
      $req.Method = "HEAD"
      $req.Timeout = 1000
      $res = $req.GetResponse()
      if ($res.StatusCode -eq "OK") {
        Write-Host "[SUCCESS] $($p.name) (ID: $($p.id)) ver $ver works!" -ForegroundColor Green
        $working += @{ name = $p.name; id = $p.id; ver = $ver }
        $found = $true
        $res.Close()
        break
      }
      $res.Close()
    } catch {
      # Ignore error and try older version
    }
  }
  if (-not $found) {
    Write-Host "[FAIL] No working URL found for $($p.name) (ID: $($p.id))" -ForegroundColor Red
    $failed += $p.name
  }
}

# Output summary to a text file for reference
$outputJson = $working | ConvertTo-Json -Compress
Set-Content -Path "verified_players.json" -Value $outputJson
Write-Host "Verification complete. Total working: $($working.Count). Total failed: $($failed.Count)." -ForegroundColor Cyan
