# Native archive review demo

`textile-twitter-demo.zip` is a privacy-safe, synthetic Twitter/X archive with
nine readable records: two held reply threads, one reply whose external parent
is absent, one retweet, and two likes. Its prose describes the corpus product;
it contains no private account data or downloaded media.

Rebuild it after changing the readable source files:

```sh
bun run build:twitter-demo
```

## Five-minute product path

1. Start Textile with `bun run dev`. An OpenRouter key is not needed to import,
   read, curate, sync, or export.
2. Press **SELECT**, switch to **Stories**, activate **Import Archive**, and
   choose `examples/twitter-archive/textile-twitter-demo.zip`. The browser
   reads it locally; Textile never uploads the ZIP. The minimized readable Loom
   does use the configured Textile relay, so use a relay you trust for private
   archives.
3. Press **START** for MAP, then Down into the archive. Left/Right moves across
   thread roots, likes, and the retweet; Down follows held replies. The external
   reply remains a root and its missing source parent stays explicit in export
   provenance.
4. On “Keeping one turn should carry the thread…”, press `K`, then `N`, write
   “Portable context proof”, and press START/Escape to save. Touch users can
   open the same Keep and Note actions with **B**.
5. Press SELECT → Stories → the current archive's actions → **Export KEPT**.
   The downloaded Markdown contains that tweet, its complete held reply path,
   exact Twitter record IDs, authorship, the keep, and the note—without nearby
   unkept archive items.
6. Import that Markdown through **Import Archive** in a fresh browser. The kept
   path, marker, note, and source record IDs reopen without the ZIP.

This demonstrates the implemented boundary: source-native local intake,
thread review, durable judgment, and portable contextual conversation. It does
not infer a training role or claim that a Twitter export contains missing
external tweets.
