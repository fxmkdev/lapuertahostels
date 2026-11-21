# Dependency exceptions

Audited on **2026-11-21**, starting at `origin/main` commit `cec99f9df`, using
Node 24.22.3 and pnpm 11.1.2. Reviewed all **52 overrides and two patches**. The
result retains **39 overrides and both patches**, removes **13 overrides**, and
raises three retained pins to satisfy their consumers. The subsequent CMS editor
timing fix adds the third local patch documented below.

## Evidence and removal policy

Sources are published npm manifests (linked by consumer/version below), registry
release tags, the repository's Dependabot advisory history, current npm advisory
ranges, and the shipped package code for local patches. Latest means the stable
`latest` tag on the audit date, not a recommendation to adopt a new major.
Package paths below start at workspace dependencies and show the immediate
consumer; `pnpm why --recursive <package>` expands their ancestors.

Remove a security override only when **all matching published constraints
exclude the affected ranges**, or when no matching dependency path remains. A
clean locked graph alone is insufficient. Include optional dependencies and
unresolved optional peers: Vite's optional YAML peer and broad Vite peers still
match selectors even though YAML 2 and Vite 6 are absent from the locked graph.

For an unused selector, the check covered installed package manifests plus
published manifests for the remaining locked packages, including
platform-specific optional packages. Dependency, optional-dependency, and
peer-dependency fields were checked using pnpm 11's range-intersection matching
semantics. Build tools are included; a development-only path is not grounds for
discarding a fix.

## Removed overrides

| Removed selector                 | Published upstream evidence                                                                                                                                                                                                                                | Latest stable release | Original security purpose                                                                                                                                                                                                                                                                                            |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `adm-zip` (`0.6.1`)              | DeepL upgraded from ^1.27.0 to ^1.29.0; 1.29.0 requires ^0.6.1, excluding affected releases through 0.6.0.                                                                                                                                                 | `0.6.1`               | [adm-zip: getDataAsync() bypasses the maxOutputLength size guard enforced by the synchronous getData() path](https://github.com/advisories/GHSA-c6fg-446q-cg94); [adm-zip: Duplicate ZIP entry names: getEntry() and extractAllTo() resolve to different content](https://github.com/advisories/GHSA-p634-w6r4-rjp2) |
| `axios` (`1.20.0`)               | DeepL 1.29.0 requires ^1.20.0, excluding the affected Axios ranges. Resolution stays at 1.20.0.                                                                                                                                                            | `1.21.1`              | [Axios: Header Injection via Inherited headers After Minimal Interceptor](https://github.com/advisories/GHSA-j8rh-479h-cp32); [Axios: Fetch Adapter Header Injection via Inherited FormData getHeaders](https://github.com/advisories/GHSA-4hqw-qxg8-jxx2)                                                           |
| `@eslint/plugin-kit` (`0.3.5`)   | [ESLint 9.39.4](https://registry.npmjs.org/eslint/9.39.4) requires ^0.4.1 and [ESLint 10.4.0](https://registry.npmjs.org/eslint/10.4.0) requires ^0.7.1; both exclude versions below the 0.3.4 fix. Removing the 0.3.5 downgrade resolves 0.4.1 and 0.7.3. | `0.7.3`               | [@eslint/plugin-kit is vulnerable to Regular Expression Denial of Service attacks through ConfigCommentParser](https://github.com/advisories/GHSA-xffm-g5w8-qvg7)                                                                                                                                                    |
| `diff` (`5.2.2`)                 | No dependency, optional dependency, or peer declaration in the audited graph references diff; the old 5.2.2 fix has no consumer.                                                                                                                           | `9.0.0`               | [jsdiff has a Denial of Service vulnerability in parsePatch and applyPatch](https://github.com/advisories/GHSA-73rr-hh4g-fpgx)                                                                                                                                                                                       |
| `brace-expansion@2` (`2.1.7`)    | Only ^1.1.7 and ^5.0.12 declarations remain; neither intersects the 2.x selector.                                                                                                                                                                          | `5.0.13`              | [brace-expansion: DoS via uncontrolled recursion in parseCommaParts causing stack exhaustion](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p)                                                                                                                                                                     |
| `brace-expansion@>=3` (`5.0.12`) | The sole matching consumer, [minimatch 11.0.1](https://registry.npmjs.org/minimatch/11.0.1), requires ^5.0.12, excluding affected 3.x/4.x/5.x releases. The minimatch 10→11 security override remains.                                                     | `5.0.13`              | [brace-expansion: DoS via uncontrolled recursion in parseCommaParts causing stack exhaustion](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p)                                                                                                                                                                     |
| `form-data@3` (`3.0.5`)          | DeepL 1.29.0 requires ^3.0.5, excluding affected 3.x releases.                                                                                                                                                                                             | `4.0.6`               | [form-data: CRLF injection in form-data via unescaped multipart field names and filenames](https://github.com/advisories/GHSA-hmw2-7cc7-3qxx)                                                                                                                                                                        |
| `form-data@4` (`4.0.6`)          | The sole 4.x consumer, [Axios 1.20.0](https://registry.npmjs.org/axios/1.20.0), requires ^4.0.6, excluding affected 4.x releases.                                                                                                                          | `4.0.6`               | [form-data: CRLF injection in form-data via unescaped multipart field names and filenames](https://github.com/advisories/GHSA-hmw2-7cc7-3qxx)                                                                                                                                                                        |
| `i18next-fs-backend` (`2.6.6`)   | The [frontend manifest](../apps/frontend/package.json) directly requires ^2.6.6; there are no other consumers. This excludes both recorded affected ranges.                                                                                                | `2.7.0`               | [i18next-fs-backend vulnerable to prototype pollution via crafted missing-key string](https://github.com/advisories/GHSA-2933-q333-qg83)                                                                                                                                                                             |
| `proxy-addr` (`2.0.8`)           | [Express 5.3.0](https://registry.npmjs.org/express/5.3.0) requires ^2.0.8, excluding the IP-spoofing affected range below 2.0.8.                                                                                                                           | `2.0.8`               | [proxy-addr vulnerable to IP spoofing via IPv4-mapped IPv6 trust subnet](https://github.com/advisories/GHSA-jqcg-44mw-7w3h)                                                                                                                                                                                          |
| `sharp` (`0.35.5`)               | [Next 16.4.6](https://registry.npmjs.org/next/16.4.6) requires optional sharp ^0.35.5, excluding the fixes below 0.35.0/0.35.4. Sharp build permission remains enabled.                                                                                    | `0.35.5`              | [sharp: Vulnerabilities in libheif: GHSA-g89c-p67h-r497 and GHSA-2jg2-4ch7-h545](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c)                                                                                                                                                                                  |
| `tar` (`7.5.15`)                 | No dependency, optional dependency, or peer declaration in the audited graph references tar; the old 7.5.15 pin has no consumer.                                                                                                                           | `7.5.23`              | [node-tar Symlink Path Traversal via Drive-Relative Linkpath](https://github.com/advisories/GHSA-9ppj-qmqm-q256)                                                                                                                                                                                                     |
| `uuid@11.1.0` (`11.1.1`)         | Published consumers require 13.0.2 or ^8.3.1; neither intersects 11.1.0. The separate react-d3-tree→11.1.1 security override remains.                                                                                                                      | `14.0.3`              | [uuid: Missing buffer bounds check in v3/v5/v6 when buf is provided](https://github.com/advisories/GHSA-w5hq-g745-h8pq)                                                                                                                                                                                              |

DeepL
[1.29.0's published manifest](https://registry.npmjs.org/deepl-node/1.29.0) is
the only direct dependency upgrade. Raising the manifest minimum to `^1.29.0` is
necessary: merely resolving it under `^1.27.0` would still admit the old unsafe
dependency constraints. No upstream major upgrade is included.

## Retained overrides

Each entry gives the blocking consumers, security/compatibility purpose, and
removal condition. The stated minimum is a conservative safe floor for the
relevant release line; other major lines require their own advisory range
review. All listed consumer constraints must meet that condition before removal,
including peers. The linked advisory is representative where several fixes have
accumulated; check the full current audit before changing any pin.

### `@babel/core` → `7.29.7`

Latest stable: `8.1.3`.

Consumers:
[@babel/helper-module-transforms@7.29.14](https://registry.npmjs.org/@babel/helper-module-transforms/7.29.14)
`^7.0.0` (peer);
[@react-router/dev@8.5.2](https://registry.npmjs.org/@react-router/dev/8.5.2)
`^7.29.7`;
[babel-dead-code-elimination@1.0.12](https://registry.npmjs.org/babel-dead-code-elimination/1.0.12)
`^7.23.7`;
[eslint-plugin-react-hooks@7.1.1](https://registry.npmjs.org/eslint-plugin-react-hooks/7.1.1)
`^7.24.4`; [react-docgen@8.0.4](https://registry.npmjs.org/react-docgen/8.0.4)
`^7.28.0`;
[react-router-devtools@6.2.3](https://registry.npmjs.org/react-router-devtools/6.2.3)
`^7.28.5`.

[sourceMappingURL arbitrary file read](https://github.com/advisories/GHSA-4x5r-pxfx-6jf8).
Remove when every matching consumer requires `7.29.6` or a verified secure
successor.

### `@tanstack/devtools-vite` → `0.7.0`

Latest stable: `0.8.7`.

Consumers:
[react-router-devtools@6.2.3](https://registry.npmjs.org/react-router-devtools/6.2.3)
`^0.4.1`.

Vite 8 peer compatibility. Remove when react-router-devtools declares a devtools
release whose Vite peer supports Vite 8; its current ^0.4.1 only supports Vite
6/7.

### `defu` → `6.1.7`

Latest stable: `6.1.7`.

Consumers: [c12@3.1.0](https://registry.npmjs.org/c12/3.1.0) `^6.1.4`;
[giget@2.0.0](https://registry.npmjs.org/giget/2.0.0) `^6.1.4`;
[rc9@2.1.2](https://registry.npmjs.org/rc9/2.1.2) `^6.1.4`.

[prototype pollution](https://github.com/advisories/GHSA-737v-mqg7-c878). Remove
when every matching consumer requires `6.1.5` or a verified secure successor.

### `@humanfs/node` → `0.16.8`

Latest stable: `0.17.0`.

Consumers: [eslint@10.4.0](https://registry.npmjs.org/eslint/10.4.0) `^0.16.6`;
[eslint@9.39.4](https://registry.npmjs.org/eslint/9.39.4) `^0.16.6`.

[filesystem security fix](https://github.com/advisories/GHSA-p498-v437-472g).
Remove when every matching consumer requires `0.16.8` or a verified secure
successor.

### `baseline-browser-mapping` → `2.11.0`

Latest stable: `2.11.39`.

Consumers: [browserslist@4.28.7](https://registry.npmjs.org/browserslist/4.28.7)
`^2.10.44`; [next@16.4.6](https://registry.npmjs.org/next/16.4.6) `^2.9.19`.

[security fix](https://github.com/advisories/GHSA-w5vr-8v7q-w6rv). Remove when
every matching consumer requires `2.11.0` or a verified secure successor.

### `body-parser` → `1.20.9`

Latest stable: `2.4.0`.

Consumers: [express@5.3.0](https://registry.npmjs.org/express/5.3.0) `^2.3.0`.

[compressed-body denial of service](https://github.com/advisories/GHSA-27r3-jxmh-p828).
Remove when every matching consumer requires `2.4.0 on the Express 5 path` or a
verified secure successor.

### `brace-expansion@1` → `1.1.21`

Latest stable: `5.0.13`.

Consumers: [minimatch@3.1.5](https://registry.npmjs.org/minimatch/3.1.5)
`^1.1.7`.

[brace expansion denial of service](https://github.com/advisories/GHSA-qhr7-859c-m2p7).
Remove when every matching consumer requires `1.1.21 on the 1.x line` or a
verified secure successor.

### `browserslist` → `4.28.7`

Latest stable: `4.29.6`.

Consumers:
[@babel/helper-compilation-targets@7.29.13](https://registry.npmjs.org/@babel/helper-compilation-targets/7.29.13)
`^4.24.0`;
[update-browserslist-db@1.2.3](https://registry.npmjs.org/update-browserslist-db/1.2.3)
`>= 4.21.0` (peer).

[security fixes](https://github.com/advisories/GHSA-73wf-gq98-2v4g). Remove when
every matching consumer requires `4.28.7` or a verified secure successor.

### `compression` → `1.8.2`

Latest stable: `1.8.2`.

Consumers:
[@react-router/serve@8.5.2](https://registry.npmjs.org/@react-router/serve/8.5.2)
`^1.8.1`.

[premature-close memory leak](https://github.com/advisories/GHSA-vc2v-76pw-4v95).
Remove when every matching consumer requires `1.8.2` or a verified secure
successor.

### `esbuild` → `0.28.1`

Latest stable: `0.28.2`.

Consumers: [storybook@10.6.2](https://registry.npmjs.org/storybook/10.6.2)
`^0.18.0 || ^0.19.0 || ^0.20.0 || ^0.21.0 || ^0.22.0 || ^0.23.0 || ^0.24.0 || ^0.25.0 || ^0.26.0 || ^0.27.0 || ^0.28.0`;
[tsx@4.23.15](https://registry.npmjs.org/tsx/4.23.15) `~0.28.0`;
[vite@8.1.6](https://registry.npmjs.org/vite/8.1.6) `^0.27.0 || ^0.28.0` (peer).

[development-server security fixes](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr).
Remove when every matching consumer requires `0.28.1` or a verified secure
successor.

### `fast-copy` → `3.1.0`

Latest stable: `4.3.3`.

Consumers: [pino-pretty@13.1.2](https://registry.npmjs.org/pino-pretty/13.1.2)
`^3.0.2`.

[deep-copy stack exhaustion](https://github.com/advisories/GHSA-jggr-w7fw-pc2j).
Remove when every matching consumer requires `3.1.0 on the 3.x line` or a
verified secure successor.

### `fast-uri` → `3.1.9`

Latest stable: `4.2.3`.

Consumers: [ajv@8.18.0](https://registry.npmjs.org/ajv/8.18.0) `^3.0.1`.

[URI parsing security fixes](https://github.com/advisories/GHSA-w74x-v6f9-j3xg).
Remove when every matching consumer requires `3.1.9 on the 3.x line` or a
verified secure successor.

### `flatted` → `3.4.2`

Latest stable: `3.4.4`.

Consumers: [flat-cache@4.0.1](https://registry.npmjs.org/flat-cache/4.0.1)
`^3.2.9`.

[security fixes](https://github.com/advisories/GHSA-rf6f-7fwh-wjgh). Remove when
every matching consumer requires `3.4.2` or a verified secure successor.

### `follow-redirects` → `1.16.2`

Latest stable: `1.16.3`.

Consumers: [axios@1.20.0](https://registry.npmjs.org/axios/1.20.0) `^1.16.0`.

[redirect security fixes](https://github.com/advisories/GHSA-mrwp-f3q8-3g9p).
Remove when every matching consumer requires `1.16.2` or a verified secure
successor.

### `glob` → `14.0.2`

Latest stable: `14.0.6`.

Consumers:
[@joshwooding/vite-plugin-react-docgen-typescript@0.7.0](https://registry.npmjs.org/@joshwooding/vite-plugin-react-docgen-typescript/0.7.0)
`^13.0.1`.

[glob security fixes](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4). Remove
when every matching consumer requires `14.0.2` or a verified secure successor.

### `happy-dom` → `21.0.4`

Latest stable: `21.0.4`.

Consumers:
[@lexical/headless@0.50.0](https://registry.npmjs.org/@lexical/headless/0.50.0)
`^20.9.0`; [vitest@4.1.12](https://registry.npmjs.org/vitest/4.1.12) `*` (peer).

[DOM security fixes](https://github.com/advisories/GHSA-834v-8h66-3h79). Remove
when every matching consumer requires `21.0.4` or a verified secure successor.

### `js-yaml` → `4.3.2`

Latest stable: `5.5.0`.

Consumers:
[@apidevtools/json-schema-ref-parser@11.9.3](https://registry.npmjs.org/@apidevtools/json-schema-ref-parser/11.9.3)
`^4.1.0`;
[@eslint/eslintrc@3.3.5](https://registry.npmjs.org/@eslint/eslintrc/3.3.5)
`^4.1.1`;
[json-schema-to-typescript@15.0.3](https://registry.npmjs.org/json-schema-to-typescript/15.0.3)
`^4.1.0`.

[YAML security fixes](https://github.com/advisories/GHSA-2883-xcg3-v3hh). Remove
when every matching consumer requires `4.3.2 on the 4.x line` or a verified
secure successor.

### `launch-editor` → `2.14.2`

Latest stable: `2.14.2`.

Consumers:
[@tanstack/devtools-vite@0.7.0](https://registry.npmjs.org/@tanstack/devtools-vite/0.7.0)
`^2.11.1`.

[editor-launch security fix](https://github.com/advisories/GHSA-v6wh-96g9-6wx3).
Remove when every matching consumer requires `2.14.1` or a verified secure
successor.

### `lodash` → `4.18.1`

Latest stable: `4.18.1`.

Consumers:
[@react-router/dev@8.5.2](https://registry.npmjs.org/@react-router/dev/8.5.2)
`^4.18.1`;
[json-schema-to-typescript@15.0.3](https://registry.npmjs.org/json-schema-to-typescript/15.0.3)
`^4.17.21`.

[template code injection and prototype pollution fixes](https://github.com/advisories/GHSA-r5fr-rjxr-66jc).
Remove when every matching consumer requires `4.18.1` or a verified secure
successor.

### `minimatch@3.1.2` → `3.1.5`

Latest stable: `11.0.9`.

Consumers:
[eslint-plugin-import@2.32.0](https://registry.npmjs.org/eslint-plugin-import/2.32.0)
`^3.1.2`;
[eslint-plugin-jsx-a11y@6.10.2](https://registry.npmjs.org/eslint-plugin-jsx-a11y/6.10.2)
`^3.1.2`;
[eslint-plugin-react@7.37.5](https://registry.npmjs.org/eslint-plugin-react/7.37.5)
`^3.1.2`.

[glob denial of service](https://github.com/advisories/GHSA-23c5-xmqv-rm74).
Remove when every matching consumer requires `3.1.5 on the 3.x line` or a
verified secure successor.

### `minimatch@10` → `11.0.1`

Latest stable: `11.0.9`.

Consumers:
[@eslint/config-array@0.23.5](https://registry.npmjs.org/@eslint/config-array/0.23.5)
`^10.2.4`;
[@react-router/fs-routes@8.5.2](https://registry.npmjs.org/@react-router/fs-routes/8.5.2)
`^10.2.5`;
[@typescript-eslint/typescript-estree@8.59.3](https://registry.npmjs.org/@typescript-eslint/typescript-estree/8.59.3)
`^10.2.2`;
[@typescript-eslint/typescript-estree@8.59.4](https://registry.npmjs.org/@typescript-eslint/typescript-estree/8.59.4)
`^10.2.2`;
[@typescript-eslint/typescript-estree@8.71.1](https://registry.npmjs.org/@typescript-eslint/typescript-estree/8.71.1)
`^10.2.2`; [eslint@10.4.0](https://registry.npmjs.org/eslint/10.4.0) `^10.2.4`.

[globparts amplification denial of service](https://github.com/advisories/GHSA-g3hv-75wg-m249).
Remove when every matching consumer requires `11.0.1` or a verified secure
successor.

### `mongoose` → `8.24.7`

Latest stable: `9.12.3`.

Consumers:
[@payloadcms/db-mongodb@3.94.1](https://registry.npmjs.org/@payloadcms/db-mongodb/3.94.1)
`8.24.7`;
[mongoose-lean-virtuals@1.1.1](https://registry.npmjs.org/mongoose-lean-virtuals/1.1.1)
`>=5.11.10` (peer).

[query/discriminator security fixes](https://github.com/advisories/GHSA-wr5m-5jph-8m96).
Remove when every matching consumer requires `8.24.7 on the 8.x line` or a
verified secure successor.

### `morgan` → `1.12.1`

Latest stable: `1.12.1`.

Consumers:
[@react-router/serve@8.5.2](https://registry.npmjs.org/@react-router/serve/8.5.2)
`^1.10.1`.

[logging security fixes](https://github.com/advisories/GHSA-9f6g-j8ch-79g4).
Remove when every matching consumer requires `1.12.1` or a verified secure
successor.

### `nanoid@3` → `3.3.18`

Latest stable: `6.0.2`.

Consumers: [postcss@8.5.23](https://registry.npmjs.org/postcss/8.5.23)
`^3.3.16`.

[identifier security fixes](https://github.com/advisories/GHSA-2v37-7h3g-55p8).
Remove when every matching consumer requires `3.3.18 on the 3.x line` or a
verified secure successor.

### `picomatch@2.3.1` → `2.3.2`

Latest stable: `4.0.7`.

Consumers: [anymatch@3.1.3](https://registry.npmjs.org/anymatch/3.1.3) `^2.0.4`;
[micromatch@4.0.8](https://registry.npmjs.org/micromatch/4.0.8) `^2.3.1`;
[readdirp@3.6.0](https://registry.npmjs.org/readdirp/3.6.0) `^2.2.1`.

[POSIX method injection and extglob ReDoS](https://github.com/advisories/GHSA-3v7f-55p6-f55p).
Remove when every matching consumer requires `2.3.2 on the 2.x line` or a
verified secure successor.

### `picomatch@4` → `4.0.5`

Latest stable: `4.0.7`.

Consumers:
[@rollup/pluginutils@5.4.0](https://registry.npmjs.org/@rollup/pluginutils/5.4.0)
`^4.0.2`;
[@tanstack/devtools-vite@0.7.0](https://registry.npmjs.org/@tanstack/devtools-vite/0.7.0)
`^4.0.3`; [fdir@6.5.0](https://registry.npmjs.org/fdir/6.5.0) `^3 || ^4` (peer);
[tinyglobby@0.2.17](https://registry.npmjs.org/tinyglobby/0.2.17) `^4.0.4`;
[unplugin@2.3.11](https://registry.npmjs.org/unplugin/2.3.11) `^4.0.3`;
[vite@8.1.6](https://registry.npmjs.org/vite/8.1.6) `^4.0.5`;
[vitest@4.1.12](https://registry.npmjs.org/vitest/4.1.12) `^4.0.3`.

[POSIX method injection and extglob ReDoS](https://github.com/advisories/GHSA-c2c7-rcm5-vvqj).
Remove when every matching consumer requires `4.0.4 on the 4.x line` or a
verified secure successor.

### `postcss` → `8.5.23`

Latest stable: `8.5.33`.

Consumers: [next@16.4.6](https://registry.npmjs.org/next/16.4.6) `8.5.23`;
[vite@8.1.6](https://registry.npmjs.org/vite/8.1.6) `^8.5.17`.

[CSS parsing security fixes](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp).
Remove when every matching consumer requires `8.5.23` or a verified secure
successor.

### `qs` → `6.16.1`

Latest stable: `6.17.1`.

Consumers: [body-parser@1.20.9](https://registry.npmjs.org/body-parser/1.20.9)
`~6.16.0`; [express@5.3.0](https://registry.npmjs.org/express/5.3.0) `^6.16.0`.

[query parsing security fixes](https://github.com/advisories/GHSA-6pq8-jhm2-2vcw).
Remove when every matching consumer requires `6.16.1` or a verified secure
successor.

### `react-d3-tree>uuid` → `11.1.1`

Latest stable: `14.0.3`.

Consumers: [react-d3-tree@3.6.6](https://registry.npmjs.org/react-d3-tree/3.6.6)
`^8.3.1`.

[UUID security fix](https://github.com/advisories/GHSA-w5hq-g745-h8pq). Remove
when react-d3-tree's published UUID range excludes the affected versions (the
11.x fix is `11.1.1`) and its UUID import remains compatible.

### `seroval` → `1.6.11`

Latest stable: `1.8.2`.

Consumers:
[seroval-plugins@1.5.6](https://registry.npmjs.org/seroval-plugins/1.5.6) `^1.0`
(peer); [solid-js@1.9.13](https://registry.npmjs.org/solid-js/1.9.13) `~1.5.0`.

[serialization security fixes](https://github.com/advisories/GHSA-f86p-h4j2-7qgj).
Remove when every matching consumer requires `1.6.11` or a verified secure
successor.

### `shell-quote` → `1.11.0`

Latest stable: `1.12.0`.

Consumers:
[launch-editor@2.14.2](https://registry.npmjs.org/launch-editor/2.14.2)
`^1.10.0`.

[command injection after a comment token](https://github.com/advisories/GHSA-pqg4-j6r4-53mv).
Remove when every matching consumer requires `1.11.0` or a verified secure
successor.

### `source-map-js` → `1.2.2`

Latest stable: `1.2.4`.

Consumers:
[@tailwindcss/node@4.3.0](https://registry.npmjs.org/@tailwindcss/node/4.3.0)
`^1.2.1`; [css-tree@3.2.1](https://registry.npmjs.org/css-tree/3.2.1) `^1.2.1`;
[postcss@8.5.23](https://registry.npmjs.org/postcss/8.5.23) `^1.2.1`;
[sass@1.77.4](https://registry.npmjs.org/sass/1.77.4) `>=0.6.2 <2.0.0`.

[indexed source-map denial of service](https://github.com/advisories/GHSA-68fv-2mgg-jv7q).
Remove when every matching consumer requires `1.2.2` or a verified secure
successor.

### `undici` → `7.30.1`

Latest stable: `8.13.1`.

Consumers: [jsdom@29.1.1](https://registry.npmjs.org/jsdom/29.1.1) `^7.25.0`;
[payload@3.94.1](https://registry.npmjs.org/payload/3.94.1) `7.30.1`.

[HTTP client security fixes](https://github.com/advisories/GHSA-4w7w-5xrc-9h26).
Remove when every matching consumer requires `7.30.1 on the 7.x line` or a
verified secure successor.

### `valibot` → `1.4.2`

Latest stable: `1.5.0`.

Consumers:
[@react-router/dev@8.5.2](https://registry.npmjs.org/@react-router/dev/8.5.2)
`^1.4.1`.

[validation security fixes](https://github.com/advisories/GHSA-5qjj-4xww-7phc).
Remove when every matching consumer requires `1.4.2` or a verified secure
successor.

### `vite@6.4.2` → `6.4.5`

Latest stable: `8.3.8`.

Consumers:
[@joshwooding/vite-plugin-react-docgen-typescript@0.7.0](https://registry.npmjs.org/@joshwooding/vite-plugin-react-docgen-typescript/0.7.0)
`^3.0.0 || ^4.0.0 || ^5.0.0 || ^6.0.0 || ^7.0.0 || ^8.0.0` (peer);
[@storybook/builder-vite@10.6.2](https://registry.npmjs.org/@storybook/builder-vite/10.6.2)
`^5.0.0 || ^6.0.0 || ^7.0.0 || ^8.0.0` (peer);
[@storybook/react-vite@10.6.2](https://registry.npmjs.org/@storybook/react-vite/10.6.2)
`^5.0.0 || ^6.0.0 || ^7.0.0 || ^8.0.0` (peer);
[@tailwindcss/vite@4.3.0](https://registry.npmjs.org/@tailwindcss/vite/4.3.0)
`^5.2.0 || ^6 || ^7 || ^8` (peer);
[@tanstack/devtools-vite@0.7.0](https://registry.npmjs.org/@tanstack/devtools-vite/0.7.0)
`^6.0.0 || ^7.0.0 || ^8.0.0` (peer);
[@vitest/mocker@4.1.12](https://registry.npmjs.org/@vitest/mocker/4.1.12)
`^6.0.0 || ^7.0.0 || ^8.0.0` (peer);
[react-router-devtools@6.2.3](https://registry.npmjs.org/react-router-devtools/6.2.3)
`>=5.0.0` (peer); [vitest@4.1.12](https://registry.npmjs.org/vitest/4.1.12)
`^6.0.0 || ^7.0.0 || ^8.0.0`;
[vitest@4.1.12](https://registry.npmjs.org/vitest/4.1.12)
`^6.0.0 || ^7.0.0 || ^8.0.0` (peer).

[development-server security fixes](https://github.com/advisories/GHSA-8g5g-mxqh-grgj).
Remove when matching peer ranges stop admitting vulnerable 6.4.2, or those paths
disappear. Retaining the Vite 8 pin alone is not upstream-minimum proof.

### `vite@8` → `8.1.6`

Latest stable: `8.3.8`.

Consumers:
[@joshwooding/vite-plugin-react-docgen-typescript@0.7.0](https://registry.npmjs.org/@joshwooding/vite-plugin-react-docgen-typescript/0.7.0)
`^3.0.0 || ^4.0.0 || ^5.0.0 || ^6.0.0 || ^7.0.0 || ^8.0.0` (peer);
[@react-router/dev@8.5.2](https://registry.npmjs.org/@react-router/dev/8.5.2)
`^7.0.0 || ^8.0.0` (peer);
[@storybook/builder-vite@10.6.2](https://registry.npmjs.org/@storybook/builder-vite/10.6.2)
`^5.0.0 || ^6.0.0 || ^7.0.0 || ^8.0.0` (peer);
[@storybook/react-vite@10.6.2](https://registry.npmjs.org/@storybook/react-vite/10.6.2)
`^5.0.0 || ^6.0.0 || ^7.0.0 || ^8.0.0` (peer);
[@tailwindcss/vite@4.3.0](https://registry.npmjs.org/@tailwindcss/vite/4.3.0)
`^5.2.0 || ^6 || ^7 || ^8` (peer);
[@tanstack/devtools-vite@0.7.0](https://registry.npmjs.org/@tanstack/devtools-vite/0.7.0)
`^6.0.0 || ^7.0.0 || ^8.0.0` (peer);
[@vitejs/plugin-react@6.0.2](https://registry.npmjs.org/@vitejs/plugin-react/6.0.2)
`^8.0.0` (peer);
[@vitest/mocker@4.1.12](https://registry.npmjs.org/@vitest/mocker/4.1.12)
`^6.0.0 || ^7.0.0 || ^8.0.0` (peer);
[react-router-devtools@6.2.3](https://registry.npmjs.org/react-router-devtools/6.2.3)
`>=5.0.0` (peer); [vite-node@6.0.0](https://registry.npmjs.org/vite-node/6.0.0)
`^8.0.0`; [vitest@4.1.12](https://registry.npmjs.org/vitest/4.1.12)
`^6.0.0 || ^7.0.0 || ^8.0.0`;
[vitest@4.1.12](https://registry.npmjs.org/vitest/4.1.12)
`^6.0.0 || ^7.0.0 || ^8.0.0` (peer); `apps/cms` `8.1.6`; `apps/frontend`
`8.1.6`.

[development-server security fixes](https://github.com/advisories/GHSA-698v-4r3x-3vcv).
Remove when every matching consumer requires `8.1.6 on the 8.x line` or a
verified secure successor.

### `ws` → `8.21.1`

Latest stable: `8.23.0`.

Consumers:
[@tanstack/devtools-event-bus@0.4.1](https://registry.npmjs.org/@tanstack/devtools-event-bus/0.4.1)
`^8.18.3`; [happy-dom@21.0.4](https://registry.npmjs.org/happy-dom/21.0.4)
`^8.21.0`; [openai@6.38.0](https://registry.npmjs.org/openai/6.38.0) `^8.18.0`
(peer); [payload@3.94.1](https://registry.npmjs.org/payload/3.94.1) `^8.16.0`;
[storybook@10.6.2](https://registry.npmjs.org/storybook/10.6.2) `^8.21.1`.

[WebSocket security fixes](https://github.com/advisories/GHSA-96hv-2xvq-fx4p).
Remove when every matching consumer requires `8.21.0` or a verified secure
successor.

### `yaml@2.7.1` → `2.8.3`

Latest stable: `2.9.1`.

Consumers: [vite@8.1.6](https://registry.npmjs.org/vite/8.1.6) `^2.4.2` (peer).

[YAML security fixes](https://github.com/advisories/GHSA-48c2-rrv3-qjmp). Remove
when every matching consumer requires `2.8.3 on the 2.x line` or a verified
secure successor.

### `zod` → `4.6.6`

Latest stable: `4.6.7`.

Consumers:
[@eslint-react/shared@5.8.3](https://registry.npmjs.org/@eslint-react/shared/5.8.3)
`^4.4.3`;
[eslint-plugin-react-hooks@7.1.1](https://registry.npmjs.org/eslint-plugin-react-hooks/7.1.1)
`^3.25.0 || ^4.0.0`; [openai@6.38.0](https://registry.npmjs.org/openai/6.38.0)
`^3.25 || ^4.0` (peer);
[zod-validation-error@4.0.2](https://registry.npmjs.org/zod-validation-error/4.0.2)
`^3.25.0 || ^4.0.0` (peer); `apps/cms` `^4.4.3`.

[schema-validation security fix](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).
Remove when every matching consumer requires `4.6.6` or a verified secure
successor.

## Compatibility and targeted pin updates

- Babel moves from 7.29.6 to **7.29.7** because React Router dev 8.5.2 requires
  `^7.29.7`. Other consumers still admit releases affected by the
  sourceMappingURL advisory, so the override cannot be removed. Its updated
  Babel helpers are confined to that dependency subtree.
- Picomatch 4 moves from 4.0.4 to **4.0.5** to satisfy Vite 8.1.6's `^4.0.5`.
  Other consumers still declare `^4.0.2`/`^4.0.3` or broad peers.
- ws moves from 8.21.0 to **8.21.1** to satisfy Storybook 10.6.2's `^8.21.1`.
  Payload, OpenAI, and the devtools event bus still admit vulnerable releases.
- The shell-quote override stays: launch-editor still declares `^1.10.0`, which
  admits the command-injection range `>=1.8.4 <1.11.0`. This advisory appears in
  the full registry query even though the repository Dependabot history only
  listed older shell-quote issues.
- The body-parser pin deliberately crosses Express's normal major to retain the
  existing security workaround: Express 5.3.0's `^2.3.0` admits the vulnerable
  2.3 line; the current upstream 2.x fix is 2.4.0. A newer stable body-parser
  alone does not make this override redundant.
- Payload's MongoDB adapter already pins Mongoose 8.24.7, but
  mongoose-lean-virtuals retains a broad `>=5.11.10` peer. Keep the guard under
  the conservative all-constraints policy. Likewise retain the optional YAML
  peer guard rather than calling it unused.
- The glob override remains because the installed docgen plugin's `^13.0.1`
  range admits affected releases. Its newer 0.9.1 release removes glob, but is
  outside its current pre-1.0 compatible range; no unrelated tooling migration
  is included.

## Retained local patches

| Patch                                                                                   | Published upstream evidence and purpose                                                                                                                                                                                                                                                                                                                            | Removal condition                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Payload 3.94.1](../patches/payload@3.94.1.patch)                                       | [Latest published Payload](https://registry.npmjs.org/payload/3.94.1) still omits `overrideAccess` from `beforeChangeArgs` in `dist/globals/operations/update.js`. Forwarding the caller's value allows trusted global initialization and relationship validation without changing anonymous access policy.                                                        | A published compatible release forwards `overrideAccess` at this call site, and fresh-database initialization plus denied anonymous locale/global access pass without the patch.                                     |
| [Payload UI 3.94.1](../patches/@payloadcms__ui@3.94.1.patch)                            | Shipped `useIntersect` reads only the first queued intersection entry. A batched non-intersecting entry followed by an intersecting entry can leave lazy CTA field bodies empty. The patch consumes the latest entry in both the standalone hook and client bundle. [Reproduction and validation in PR #429](https://github.com/fxmkdev/lapuertahostels/pull/429). | A published compatible release consumes the latest entry in both shipped implementations, and the batch regression plus CMS layout/help and structured/rich-text anchor persistence tests pass without the patch.    |
| [React Router filesystem routes 8.5.2](../patches/@react-router__fs-routes@8.5.2.patch) | [Latest published filesystem routes](https://registry.npmjs.org/@react-router/fs-routes/8.5.2) still imports `makeRe` from minimatch. The secure minimatch 11 override removes that API; the patch uses supported `filter` matching. [Tracking issue #423](https://github.com/fxmkdev/lapuertahostels/issues/423).                                                 | A published compatible release supports secure minimatch without this patch, and route type generation, production build, and route/ignore matching pass. Never restore vulnerable minimatch 10 to remove the patch. |

Recheck published tarballs, not only a merged upstream change or release notes.
When a fix ships, remove the patch file and its `patchedDependencies` entry
together, then regenerate the lockfile and run the affected regression checks.
Both Dockerfiles must continue copying `patches/` while any local patches
remain.

## Security documentation

The [Braces assessment](security/braces-risk-assessment.md) is historical.
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) was
withdrawn on 2026-10-23. Braces remains 3.0.3; no suppression, alert dismissal,
or custom security patch is introduced. Withdrawal of this advisory does not
establish that every dependency or future use is safe.

## Validation

Baseline full and production pnpm audits both reported zero advisories. Final
checks used the same Node/pnpm versions and retained the existing test
configuration:

- `pnpm audit --json` and `pnpm audit --prod --json`: **zero advisories** before
  and after.
- Final offline frozen-lockfile installation passed. Restoring the shell-quote
  guard changed override metadata only; the tested package graph was unchanged.
- Each of the 13 removals passed a range-intersection check against the complete
  current npm advisory ranges, using all final published consumer declarations.
  The 1,363 final locked package manifests were covered, including optional and
  peer declarations. Package changes are limited to DeepL, the three raised
  pins, Babel's helper subtree, and ESLint's supported plugin-kit subtree.
- Both patch hashes are unchanged. Route discovery checks passed for ordinary
  files, default hidden-file exclusion, explicit ignored files/folders, and
  retained route folders with secure minimatch 11.
- CMS/shared Payload type generation passed; no generated tracked files changed.
- CMS lint, formatting, **35 unit tests**, and production build passed.
- Frontend typecheck, lint, formatting, **89 unit tests**, production build, and
  Storybook build passed.
- The unchanged Playwright suite passed **all 13 tests** with one worker against
  disposable MongoDB 8.0.38, Redis 8.4.8, local S3-compatible storage, and both
  production builds. Repository assertion/test timeouts were unchanged. This
  includes trusted CMS initialization and denied anonymous locale access;
  separate anonymous locale-read and global-update requests both returned 403.
- Focused documentation/config formatting and `git diff --check` passed.

`pnpm peers check` still reports the pre-existing Vite 6.4.5 peer expectations
introduced by the retained `vite@6.4.2` override while Vite 8.1.6 is installed.
The same report reproduced on the unchanged Payload 3.94.1 baseline checkout. It
is recorded rather than hidden with a peer-warning suppression or solved by
removing a guard without the required upstream-minimum proof. Both Vite builds,
route generation, and the browser suite passed. Revisit the selector alongside
upstream peer-range changes.

The first browser attempt could only run global setup because the exact
Playwright headless-shell revision was absent. Installing that revision in a
temporary directory allowed the full suite above to pass; no browser or timeout
configuration was committed.
