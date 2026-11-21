# Runs only against a disposable Postgres and PostgREST pair on the local Docker engine.
[CmdletBinding(DefaultParameterSetName = 'Acceptance')]
param(
  [Parameter(Mandatory, ParameterSetName = 'Local')]
  [switch] $Local,
  [Parameter(Mandatory, ParameterSetName = 'Browser')]
  [switch] $Browser,
  [Parameter(Mandatory, ParameterSetName = 'CodexMetadata')]
  [switch] $CodexMetadata
)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../../../..')).Path
$playwrightCli = Join-Path $repo 'apps/web/node_modules/playwright/cli.js'
if ($Browser) {
  if (-not (Test-Path -LiteralPath $playwrightCli)) { throw 'Install the workspace dependencies with pnpm install first.' }
  node $playwrightCli install chromium --only-shell
  if ($LASTEXITCODE) { throw 'Could not install the Playwright Chromium fixture.' }
}
$fixture = 'kino-agent-' + [guid]::NewGuid().ToString('n').Substring(0, 12)
$database = "$fixture-pg"
$rest = "$fixture-rest"
$secret = [guid]::NewGuid().ToString('n') + [guid]::NewGuid().ToString('n')

function Invoke-FixtureSql([string] $sql) {
  $sql | docker exec -i $database psql -U postgres -v ON_ERROR_STOP=1 --quiet
  if ($LASTEXITCODE) { throw 'Fixture SQL failed.' }
}

function Wait-Ready([scriptblock] $probe) {
  for ($attempt = 0; $attempt -lt 60; $attempt++) {
    if (& $probe) { return }
    Start-Sleep -Milliseconds 250
  }
  throw 'The isolated test service did not start.'
}

$originalUrl = $env:KINO_AGENT_TEST_POSTGREST_URL
$originalSecret = $env:KINO_AGENT_TEST_JWT_SECRET
$networkCreated = $false
$dbStarted = $false
$restStarted = $false
$scratch = $null

try {
  docker network create $fixture | Out-Null
  if ($LASTEXITCODE) { throw 'Could not create the fixture network.' }
  $networkCreated = $true

  docker run --rm --detach --name $database --network $fixture -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17 | Out-Null
  if ($LASTEXITCODE) { throw 'Could not start the fixture database.' }
  $dbStarted = $true
  Wait-Ready {
    docker exec $database pg_isready -U postgres -h 127.0.0.1 --quiet
    $LASTEXITCODE -eq 0
  }

  Invoke-FixtureSql @'
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),
    nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid
$$;
create function auth.role() returns text language sql stable as $$ select current_user::text $$;
grant usage on schema auth, public to anon, authenticated, service_role;
'@

  # The schema reference also describes Supabase storage. The fixture only needs the account tables.
  $baseline = Get-Content -Raw (Join-Path $repo 'database/schema.sql')
  $accountSchema = ($baseline -split '(?m)^INSERT INTO storage\.buckets', 2)[0]
  Invoke-FixtureSql ($accountSchema -replace '(?m)^  cast JSONB', '  "cast" JSONB')
  Invoke-FixtureSql @'
alter table public.titles add column if not exists episode_runtime integer;
alter table public.titles add column if not exists total_episodes integer;
alter table public.titles add column if not exists seasons_metadata jsonb;
grant select, insert, update on public.titles to service_role;
grant select on public.watchlists, public.watchlist_items, public.watch_diary,
  public.title_ratings, public.episode_ratings to anon, authenticated, service_role;
'@
  Invoke-FixtureSql (Get-Content -Raw (Join-Path $repo 'database/migrations/20261117_kino_agent_api.sql'))
  Invoke-FixtureSql (Get-Content -Raw (Join-Path $repo 'database/migrations/20261118_kino_ai_oauth.sql'))
  Invoke-FixtureSql (Get-Content -Raw (Join-Path $repo 'database/tests/kino_agent_acceptance_fixture.sql'))
  if ($Local -or $Browser -or $CodexMetadata) {
    Invoke-FixtureSql (Get-Content -Raw (Join-Path $repo 'database/tests/kino_agent_browser_fixture.sql'))
  }

  docker run --rm --detach --name $rest --network $fixture -p '127.0.0.1::3000' `
    -e "PGRST_DB_URI=postgresql://postgres@${database}:5432/postgres" -e PGRST_DB_SCHEMA=public `
    -e PGRST_DB_ANON_ROLE=anon -e "PGRST_JWT_SECRET=$secret" public.ecr.aws/supabase/postgrest:v14.14 | Out-Null
  if ($LASTEXITCODE) { throw 'Could not start fixture PostgREST.' }
  $restStarted = $true
  $address = docker port $rest 3000/tcp
  if ($LASTEXITCODE -or $address -notmatch '^127\.0\.0\.1:\d+$') { throw 'Expected a loopback fixture port.' }
  $env:KINO_AGENT_TEST_POSTGREST_URL = "http://$address"
  $env:KINO_AGENT_TEST_JWT_SECRET = $secret
  Wait-Ready {
    try {
      (Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 $env:KINO_AGENT_TEST_POSTGREST_URL).StatusCode -eq 200
    } catch {
      $false
    }
  }

  Push-Location $repo
  try {
    if ($Local -or $Browser -or $CodexMetadata) {
      $tempRoot = [IO.Path]::TrimEndingDirectorySeparator((Resolve-Path -LiteralPath ([IO.Path]::GetTempPath())).Path)
      $scratch = (New-Item -ItemType Directory -Path (Join-Path $tempRoot "$fixture-web")).FullName
    }
    if ($Browser) {
      node ./apps/web/tests/agent/local/start.mjs $scratch --browser
    } elseif ($CodexMetadata) {
      node ./apps/web/tests/agent/local/start.mjs $scratch --codex-metadata
    } elseif ($Local) {
      node ./apps/web/tests/agent/local/start.mjs $scratch
    } else {
      node --import ./apps/web/tests/agent/register.mjs --experimental-transform-types --test ./apps/web/tests/agent/acceptance.test.mjs ./apps/web/tests/agent/oauth.test.mjs
    }
    if ($LASTEXITCODE) { throw 'The isolated Kino fixture failed.' }
  } finally {
    Pop-Location
  }
} finally {
  $env:KINO_AGENT_TEST_POSTGREST_URL = $originalUrl
  $env:KINO_AGENT_TEST_JWT_SECRET = $originalSecret
  if ($restStarted) { docker stop $rest | Out-Null }
  if ($dbStarted) { docker stop $database | Out-Null }
  if ($networkCreated) { docker network rm $fixture | Out-Null }
  if ($scratch -and (Test-Path -LiteralPath $scratch)) {
    $target = Get-Item -LiteralPath (Resolve-Path -LiteralPath $scratch).Path
    if ($target.Parent.FullName -ne $tempRoot -or $target.Name -ne "$fixture-web" -or
        $target.Attributes.HasFlag([IO.FileAttributes]::ReparsePoint)) {
      throw 'Unexpected fixture workspace path.'
    }
    Remove-Item -LiteralPath $target.FullName -Recurse -Force
  }
}
