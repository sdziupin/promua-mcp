## Summary

<!-- What changed and why? -->

## Validation

- [ ] CI is green
- [ ] No browser automation was introduced
- [ ] README/docs updated when behavior changed
- [ ] Breaking changes are called out

## Branch policy

Normal development targets `devel`.
Release PRs merge `devel` into `main`.
A successful merge into `main` triggers an automatic npm + GitHub release.
