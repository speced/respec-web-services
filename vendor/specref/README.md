# Vendored from tobie/specref

`bibref.js` and `format-date.js` are copied byte-for-byte from
<https://github.com/tobie/specref>, Apache-2.0, at commit
`fd96b31990dbddb2e93f40db2c1e9b3a19f9dfae`. `LICENSE` is that project's license
text.

```
sha256  a6d61c66e0ac6e5433bdfe9d37d047788a74fcf04451667971d4fbe1b88316c9  bibref.js
sha256  952e98ea622c0a8b44b5e13e47e303e5254086b01307703d15adff7b0981e186  format-date.js
```

`routes/bibrefs` runs these to turn the upstream `refs/*.json` into the map the
service serves. Update them only by copying a newer upstream revision and
changing the commit and hashes above; keeping them byte-identical is what makes
that a readable diff.

They sit outside `routes/` because `tsconfig.json` does not include this
directory, and because this package is `"type": "module"` while these are
CommonJS. The scraper copies them over the clone's own `lib/` before running
anything, so a commit to upstream's code never executes here.
