<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

## TV app (android-tv) signing

`public/tv.apk` is what every board box downloads to update itself
(`public/tv-version.json`). It must be signed with the synagogue's release key
(SHA-256 `aa92b731…bc8263`, `android-tv/app/signing.properties`, which is not in
git). A build from any other machine or a cloud session is signed with a
throwaway debug key, and Android refuses it as an update on every installed
box. Build it on the machine that has the key:
`npm run tv:apk:release`, then copy
`android-tv/app/build/outputs/apk/release/app-release.apk` to `public/tv.apk`.
