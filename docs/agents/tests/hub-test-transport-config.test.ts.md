# hub/test/transport-config.test.ts

T2 uses sealed tempProject/projectHub and the real CLI reload command. No native
SSH or process lifecycle is asserted. Start refuses outbound, unknown string and
non-string transports in the second pool, naming its field; reload refuses the
same bytes and accepts the restored config. The preservation control starts and
reloads with ssh, omitted transport and malformed unrelated host keys; parseConfig
readback equals the prior config. Scratch suite locks stay below the fixture root.

Run `node --test hub/test/transport-config.test.ts` alone after checking disk/load.
The companion T1 transport-kind test covers the parser's input types; T2
transport-records checks invalid persisted rows and the unchanged previous shape.

T-1734: quoted-empty pool startup now reports the pool grammar before transport
validation; invalid pool names are fatal startup configuration errors.
