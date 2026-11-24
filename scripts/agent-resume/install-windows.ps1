# Registers a scheduled task that runs `herdr-resume.mjs snapshot` every 2 minutes, hidden.
# Expects herdr-resume.mjs in $env:USERPROFILE\.claude\hooks and node + hc on PATH.
$node = (Get-Command node).Source
$script = Join-Path $env:USERPROFILE '.claude\hooks\herdr-resume.mjs'
$action = New-ScheduledTaskAction -Execute 'conhost.exe' -Argument "--headless `"$node`" `"$script`" snapshot"
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 2)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName 'herdr-agent-snapshot' -Action $action -Trigger $trigger -Settings $settings -Force | Select-Object TaskName, State
