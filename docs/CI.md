# CI contract

Forgejo CI uses the reviewed shared workflow pinned in `.forgejo/workflows/ci.yml`.
The project-owned `.ci/profile.json` declares the actual pnpm workspace checks:
frozen install, generated demo verification, all seven builds, static checks and
workspace tests, and the actual package binary's help, local query, and invalid
command behavior. Every workspace package must
produce a nonempty, passing JUnit report. Failures propagate to the required job;
compiler failures are not converted into successful asset-copy commands.

The shared action retains source/dependency identity, phase timings and results.
Reports include setup/test timing evidence and test failures. PRs cancel older
PR runs; main validation is preserved. A reviewed workflow pin makes a shared
update explicit. Revert the consumer pin/profile through the normal PR path to
roll back; preserve meaningful checks and protection settings.

Kinocut demonstrated that reusable toolchains can remove repeated setup costs:
normal master CI fell from 20m34s to 15m55s with matching test counts. Its remaining
4m46s–9m54s test shards and 29m41s local suite show why the next step is profiling,
not blindly adding concurrency. These are Kinocut observations, not DialectOS
speedup claims. Judge scheduling changes by whole-workflow elapsed time and
aggregate work, including queue/setup and local edit-to-confidence costs.

See the shared [CI profiles and measurement guide](https://git.kyanitelabs.tech/KyaniteLabs/.github/src/branch/main/docs/CI_PROFILES.md)
for the organization-wide method. This pilot exercises the built CLI; a clean
install of distributed package tarballs and broader release acceptance remain
separate checks to qualify. Existing GitHub checks remain separate evidence.
