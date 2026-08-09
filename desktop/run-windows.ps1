$BaseDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$JarPath = Join-Path $BaseDir "target\stickvania-desktop.jar"
$NativePath = Join-Path $BaseDir "target\natives\windows"

if (-not (Test-Path -LiteralPath $JarPath)) {
    $JarPath = Join-Path $BaseDir "stickvania-desktop.jar"
}
if (-not (Test-Path -LiteralPath $NativePath)) {
    $NativePath = Join-Path $BaseDir "natives\windows"
}

if (-not (Test-Path -LiteralPath $JarPath)) {
    Write-Error "Missing desktop jar. Run npm.cmd run build:desktop from the repository root."
    exit 1
}
if (-not (Test-Path -LiteralPath $NativePath)) {
    Write-Error "Missing Windows native library directory: $NativePath"
    exit 1
}

$JavaCompatArgs = @()
& java --enable-native-access=ALL-UNNAMED -version *> $null
if ($LASTEXITCODE -eq 0) {
    $JavaCompatArgs += "--enable-native-access=ALL-UNNAMED"
}
& java --sun-misc-unsafe-memory-access=allow -version *> $null
if ($LASTEXITCODE -eq 0) {
    $JavaCompatArgs += "--sun-misc-unsafe-memory-access=allow"
}

& java `
    @JavaCompatArgs `
    "-Dorg.lwjgl.librarypath=$NativePath" `
    "-Dnet.java.games.input.librarypath=$NativePath" `
    "-Djava.library.path=$NativePath" `
    "-Djinput.useDefaultPlugin=false" `
    "-Dnet.java.games.input.plugins=net.java.games.input.DirectAndRawInputEnvironmentPlugin" `
    -jar $JarPath

exit $LASTEXITCODE
