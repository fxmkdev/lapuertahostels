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

## Runtime

Use Node.js 26.13.1 or newer on the Node 26 LTS line, compatible with Payload
3.94. The package manifests declare this supported range, and
`pnpm-workspace.yaml` uses 26.13.1 as its dependency-compatibility baseline.
That setting does not switch your runtime; select a supported Node version
before running pnpm.

## Development and E2E Database Images

Both `docker-compose.yml` and `tests/e2e/docker-compose.yml` pin the same
explicit database versions. Production alignment was checked on 2026-11-21:

| Service | Development / E2E image | Production baseline                                             |
| ------- | ----------------------- | --------------------------------------------------------------- |
| MongoDB | `mongo:8.0.38`          | MongoDB Atlas 8.0.39, confirmed by the production operator      |
| Redis   | `redis:8.4.8`           | Upstash via Fly; documented Redis API compatibility through 8.4 |

MongoDB uses the available official 8.0.38 image because `mongo:8.0.39` was not
published when checked. This accepted one-patch difference keeps local and E2E
instances on production's
[supported 8.0 release series](https://www.mongodb.com/legal/support-policy/lifecycles).
Redis 8.4.8 is a local API compatibility baseline based on
[Upstash's compatibility documentation](https://upstash.com/docs/redis/overall/compatibility),
not a claim that Upstash runs the same Redis server implementation or patch. The
[official MongoDB image catalog](https://github.com/docker-library/official-images/blob/master/library/mongo)
and
[official Redis image catalog](https://github.com/docker-library/official-images/blob/master/library/redis)
list the available tags;
[Redis's support policy](https://github.com/redis/redis/security/policy)
identifies supported release series.

When updating these pins, first reconfirm the Atlas version and Upstash API
compatibility, then check upstream support and image availability. Update both
Compose files and this table together, including the verification date and any
accepted production differences. Validate both Compose configurations and run
the complete E2E suite against fresh test volumes, including an explicit Redis
cache write/read check: frontend pages can still render when Redis fails.

Existing volumes may have been written by a newer `latest` image. Use fresh
volumes for disposable test data, or back up valuable development data and
follow the database's supported migration procedure before switching versions.
Do not delete existing development volumes as part of verification.

## Dependency Exceptions

See the [dependency exception inventory](docs/dependency-exceptions.md) for
every retained pnpm override and local patch, its upstream evidence, and its
removal condition. The inventory also records exceptions removed after upstream
fixes.

Both application Dockerfiles copy `patches/` before installing dependencies.
Keep that setup while any local patches remain, and follow the inventory's
removal checks when upgrading Payload or React Router.

## Dependency Security

The previously assessed Braces advisory was withdrawn on October 23, 2026. The
package remains at 3.0.3; no audit suppression or custom patch was added. See
the [historical security assessment](docs/security/braces-risk-assessment.md)
for the original evidence and the dated withdrawal update, and the
[dependency exception inventory](docs/dependency-exceptions.md) for current
security fixes and audit results.
