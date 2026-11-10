# Things only you can do

Open items first. Nothing here blocks current work unless it says so.

## Open

1. **Accept the collaborator invitation (blocks every push, pull request and merge).**
   `git push` to `edhar98/Mugnut` fails with `403 Permission denied to GrishaKh`. GitHub shows a pending invitation with write access that has not been accepted yet.
   - Signed in as `GrishaKh`, open https://github.com/edhar98/Mugnut/invitations and click **Accept invitation**.
   - Then tell me, or run these yourself from the project folder:
     ```
     git push -u origin daily-mode
     gh pr create --repo edhar98/Mugnut --base main --head daily-mode --fill
     ```
   - Until then all work stays in local branches on this Mac; the live site is unchanged.

2. **Analytics site code (Gate 0).** Do you have a GoatCounter or Plausible site for Mugnut?
   - If yes: tell me the provider and the site code (GoatCounter: the `xxxx` in `xxxx.goatcounter.com`; Plausible: the domain you registered).
   - If no and you want one: create a free GoatCounter site at https://www.goatcounter.com/signup (account creation is yours to do) and send me the code.
   - Until then analytics is built but switched off.

## Done
- (nothing yet)
