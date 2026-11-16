# La Puerta Hostels Website

[![Build](https://github.com/felixmokross/lapuertahostels/actions/workflows/build.yml/badge.svg)](https://github.com/felixmokross/lapuertahostels/actions/workflows/build.yml)
[![Clean Preview](https://github.com/felixmokross/lapuertahostels/actions/workflows/clean-preview.yml/badge.svg)](https://github.com/felixmokross/lapuertahostels/actions/workflows/clean-preview.yml)

This is the website for La Puerta Hostels, a Colombian hotel business. All
content is controlled via a tailored CMS based on
[Payload CMS](https://payloadcms.com/). The frontend is powered by the
[React Router framework (formerly Remix)](https://reactrouter.com).

Besides the root brand, each hotel location has its own specific sub-brand. The
website reflects this by transitioning between themes when navigating from a
page of one brand to a page of another brand.

## Tech Stack

- [React Router framework (formerly Remix)](https://reactrouter.com/)
- [Payload CMS](https://payloadcms.com/)
- [MongoDB](https://www.mongodb.com/)

## Dependency Patches

`patches/payload@3.90.2.patch` preserves `overrideAccess` during field
validation in Payload global updates. Without it, CMS initialization on an empty
database rejects the default fallback locale before creating the E2E API key.
The patch keeps normal relationship access checks intact; the E2E setup checks
both trusted initialization and denied anonymous locale access.

Both application Dockerfiles copy `patches/` before installing dependencies.
When upgrading Payload, check whether upstream global updates now pass
`overrideAccess` to `beforeChange`, then remove the patch and its
`patchedDependencies` entry if the fix is included.

## Dependency Security

The remaining `braces` advisory has been assessed as low practical risk for the
current application and accepted for PR #410. The package remains flagged by
audit; it has not been patched or suppressed. See the
[security assessment](docs/security/braces-risk-assessment.md) for the
dependency paths, evidence, limitations, and conditions that require
reassessment.
