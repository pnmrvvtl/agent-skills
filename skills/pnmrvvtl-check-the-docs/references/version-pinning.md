# Version pinning — resolve, never infer

A declared range is not a version. `^14.2.0` can be `14.2.0` or `14.2.35`, and the difference is
where the deprecations live. Read the lock, or ask the toolchain what it resolved.

Commands below use `rg` and `jq` for readability; neither is guaranteed to be installed. See the
Portability table in `sources.md` for the substitutions — `node -p` and `python -c` both read
JSON, and every lockfile below can also be read with a plain `grep`.

Fill this table before any fetch:

| Library | Declared | Resolved | Source |
|---|---|---|---|

`Declared` is what the manifest says. `Resolved` is what is installed. `Source` is the file or
command that produced it. When they disagree, `Resolved` wins and the gap goes in the brief.

---

## JavaScript / TypeScript

Best answer — ask the installed tree, not the manifest:

```bash
node -p "require('next/package.json').version"
npm ls next react --depth=0
pnpm list --depth=0 next
yarn why next
```

From the lockfile when `node_modules` is absent:

```bash
jq -r '.packages["node_modules/next"].version' package-lock.json
rg -A2 '^"next@' pnpm-lock.yaml | head
rg -A3 '^"next@npm:' yarn.lock | head
```

Also pin: `node -v`, the `engines` field, `compilerOptions.target` and `module` in
`tsconfig.json`, and the bundler (`vite`, `webpack`, `turbopack`) — API availability often keys
off these, not off the library version.

Monorepo: resolve per workspace. The version at the root is not necessarily the version the
package being edited resolves to.

## Python

```bash
python -c "import fastapi; print(fastapi.__version__)"
pip show fastapi | head -3
uv pip list | rg fastapi
rg -A1 'name = "fastapi"' uv.lock poetry.lock
```

Also pin: `python -V`, and `requires-python` in `pyproject.toml`.

## Go

```bash
go list -m all | rg gin-gonic
rg gin-gonic go.mod
go version
```

The `go` directive in `go.mod` gates language and stdlib features — pin it too.

## Rust

```bash
cargo tree -i tokio --depth 0
rg -A2 '^name = "tokio"' Cargo.lock
rustc --version
```

Pin the `edition` from `Cargo.toml` and the MSRV if one is declared.

## .NET

```bash
dotnet list package
rg 'PackageReference' -A0 *.csproj
rg '<TargetFramework' *.csproj
```

## JVM

```bash
./gradlew -q dependencies --configuration runtimeClasspath | head -40
mvn -q dependency:list | rg spring-boot
```

Pin the JDK (`java -version`) and the source/target compatibility level.

## Ruby / PHP / Dart

```bash
rg -A1 '^    <gem>' Gemfile.lock          # or: bundle list
composer show <vendor>/<pkg> | head -3
rg -A2 '^  <pkg>:' pubspec.lock
```

## Mobile platform surfaces

The library version is only half of it — the platform level decides what exists:

```bash
rg 'compileSdk|targetSdk|minSdk' android/app/build.gradle*
rg 'IPHONEOS_DEPLOYMENT_TARGET' ios/**/*.pbxproj | head -3
rg 'flutter:|sdk:' pubspec.yaml
```

## Containers, CI, runtime

When the answer depends on where it runs:

```bash
rg '^FROM' Dockerfile
rg 'node-version|python-version|go-version' .github/workflows/*.yml
```

---

## When the version cannot be resolved

Write `unknown` and say why: no lockfile, dependencies not installed, a vendored copy with no
version marker, a private registry that is not reachable.

Then either:

- **ask** — one question, if the whole task hinges on it, or
- **answer for the declared range** and state the assumption explicitly in the brief:
  `assumed next@14.2.x from ^14.2.0 — lockfile absent`

Never quietly answer for `latest`. That is the failure this file exists to prevent.
