Add-Type -AssemblyName System.Speech
$lines = [ordered]@{
  'v_problem'  = 'You give Claude a task, and it thinks. Five minutes. Ten. Sometimes twenty. And you just sit there, staring at words like Cogitating, Vibing, Schlepping. That is dead time. What if you could play, and earn, right there? Meet PassBCH dot cash. Bitcoin Cash games that live in your terminal.'
  'v_intro'    = 'No browser. No new app. Just one terminal, next to VS Code, or any editor, anywhere.'
  'v_start'    = 'Type npx passbch. That is it. No long command to remember. New here? Press one key to play as a guest with a free welcome bonus. No money? No problem. Invite a friend with your referral code, and you both get more to play.'
  'v_rps'      = 'Rock, Paper, Scissors against the House Bot. Your move is locked with a hash before the bot plays, so nobody can cheat.'
  'v_updown'   = 'Up or Down. Check the live chart, then call where the real Bitcoin Cash price goes in the next minute. A countdown shows if you are winning, and a right call pays one point nine times.'
  'v_pf'       = 'Prompt Fight. Write one strategy line, and your A.I. agent fights the House Agent, move by move, right in your terminal.'
  'v_coin'     = 'Coin Flip. The house locks its secret seed before you pick, your terminal adds its own, and the coin lands.'
  'v_type'     = 'Typing Race. Type the phrase faster than the House Bot. The server keeps the time.'
  'v_friend'   = 'Now the best part. Challenge a friend. PassBCH prints one short line, npx passbch race, and a code. Your friend types it on their own computer, anywhere in the world, and you race head to head. First to finish takes the pot.'
  'v_proof'    = 'Every result is written to the Bitcoin Cash blockchain. Check the worldwide leaderboard, and verify any game, right from the terminal.'
  'v_withdraw' = 'And when you win, withdraw. Open the vault, paste your Bitcoin Cash address, and the money is sent on chain, in seconds.'
  'v_web'      = 'Not a developer? Never opened a terminal? That is why we also deployed PassBCH on Vercel. Anyone can play the same games from a browser or a phone, with the same account, and the same on-chain proof.'
  'v_end'      = 'PassBCH dot cash. Type npx passbch, and play while your A.I. thinks.'
  'v_earn'     = 'And Bitcoin Cash earns too. Every game is a real on-chain transaction, so miners collect network fees, and the platform earns a five percent fee on every withdrawal.'
}
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.SelectVoice('Microsoft David Desktop'); $s.Rate = 1; $s.Volume = 100
foreach ($k in $lines.Keys) { $f = Join-Path $PSScriptRoot "$k.wav"; $s.SetOutputToWaveFile($f); $s.Speak($lines[$k]); $s.SetOutputToNull(); Write-Output "$k $([math]::Round((Get-Item $f).Length / 44100, 1))s" }
