# Doctor implementation notes

Read the matching [subsystem reference](../../../hub/README.md) alongside these notes.

Doctor's release-tool check (`[release] web_bundle = true`) asks the running hub
for an opt-in gh executable lookup, never auth/network. Old/offline hub results
stay unknown. Missing release tools name the hub PATH and require restart with
the tool on PATH; caller-side GitHub auth checks remain separate.

Doctor's sign-in mode check reads config mode and hub `user.list` counts only;
see `docs/hub/cland-doctor.md` and the doctor-users per-test guide. Refused
counts stay unknown with reload guidance; offline counts name hub start.

Remote doctor discovery distinguishes received refusals from transport failure.
Keep `HubRefusal` Error messages compatible for existing callers; doctor prints
only its safe refusal class and credential/host repair, never raw refusal text.
Refusal metadata uses `refusalCode`, separate from OS transport error `code`.
Keep error-only older-hub coverage and JSON Check fields stable.
