# CMS

## Internal links and anchors

For an internal link, choose the target page and select an Element ID in the
Fragment field. To enter a custom fragment, type its value without `#` and
select **Use …**. Clear the field to link to the whole page.

Suggestions use Element IDs from the target page's saved hero and content
blocks. Save anchor changes on the target page, then reopen the link editor to
refresh suggestions. Existing fragments remain unchanged even if an anchor is
renamed or deleted, the target page changes, or suggestions cannot load.
Renaming an Element ID does not update incoming links automatically.

The selector is shared by structured links and rich-text internal links.
Fragments remain plain strings; no content migration is needed.

## Tests

Run `pnpm --filter @lapuertahostels/cms test` for anchor extraction and fragment
field tests. Frontend link-rendering regressions are covered by
`pnpm --filter @lapuertahostels/frontend test --run`.
