param(
    [Parameter(Mandatory = $true)]
    [int]$PR
)

# Navigate to your repo folder
Set-Location "E:\telnyx-web\new\telnyx-web-main"

Write-Host "📦 Fetching PR #$PR from origin..."
git fetch origin "pull/$PR/head:pr-$PR"

Write-Host "🔄 Checking out main branch..."
git checkout main

Write-Host "🔀 Merging PR #$PR into main..."
# Use 'theirs' merge strategy but don't commit automatically
git merge "pr-$PR" --strategy-option theirs --no-edit --no-commit

# Keep local Firebase and script files safe
if (Test-Path ".\firebase.json") {
    Write-Host "⚙️ Preserving firebase.json..."
    git checkout --ours firebase.json
}
if (Test-Path ".\.firebase") {
    Write-Host "⚙️ Preserving .firebase folder..."
    git checkout --ours .firebase
}
if (Test-Path ".\mergepr.ps1") {
    Write-Host "⚙️ Preserving mergepr.ps1..."
    git add mergepr.ps1
}

git commit -am "Merged PR #$PR (kept firebase.json, .firebase/, mergepr.ps1)"
git push origin main

Write-Host "🧹 Cleaning up temporary branch..."
git branch -D "pr-$PR" 2>$null

# Clean repo safely without removing important files
# Write-Host "🧽 Cleaning workspace safely..."
# git clean -fdx --exclude=firebase.json --exclude=.firebase --exclude=mergepr.ps1 --exclude=.gitignore --exclude=.gitattributes --exclude=node_modules

git fetch origin
git reset --hard origin/main

Write-Host "`n✅ Pull Request #$PR merged successfully without deleting Firebase files!"
